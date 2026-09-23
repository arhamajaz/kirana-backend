import { prisma } from '../config/database';
import { InterestService } from './interest.service';
import { AppError } from '../middleware/errorHandler';
import {
  Customer,
  Transaction,
  InterestType,
  CompoundingFrequency,
  TransactionType,
} from '../generated/prisma/client';
import { calculateLedger, LedgerTransaction, LedgerOptions, LedgerCalculationResult, BreakdownEntry } from '../utils/ledgerEngine';

export { calculateLedger, LedgerTransaction, LedgerOptions, LedgerCalculationResult, BreakdownEntry };


export interface EntryPaymentAllocation {
  creditId: string;
  amount: number;
  date: Date;
  appliedToPrincipal: number;
  appliedToInterest: number;
}

export interface LedgerEntry {
  entryId: string;
  originalPrincipal: number;
  remainingPrincipal: number;
  interestType: InterestType;
  interestRate: number;
  compoundingFrequency: CompoundingFrequency | null;
  customCompoundDays: number | null;
  entryDate: Date;
  interestStartDate: Date;
  dueDate: Date | null;
  accruedInterest: number;
  interestPaid: number;
  remainingInterest: number;
  totalDue: number;
  status: 'ACTIVE' | 'PARTIALLY_PAID' | 'SETTLED';
  payments: EntryPaymentAllocation[];
  remarks: string | null;
}

export interface LedgerSummary {
  totalMoneyLent: number;
  totalMoneyReceived: number;
  outstandingPrincipal: number;
  accruedInterest: number;
  totalDue: number;
  unallocatedCredit?: number;
}

export interface LedgerResult {
  customer: Customer;
  summary: LedgerSummary;
  entries: LedgerEntry[];
  transactions: Transaction[];
  breakdownLog?: BreakdownEntry[];
}

export class LedgerService {
  private interestService = new InterestService();

  /**
   * Generates the per-entry interest ledger for a specific customer.
   */
  public async generateLedger(
    userId: string,
    customerId: string,
    calculationDate: Date = new Date(),
  ): Promise<LedgerResult> {
    // 1. Fetch customer and verify existence & ownership
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        userId,
        isActive: true,
      },
    });

    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    // 2. Fetch all non-voided transactions for this customer
    const dbTransactions = await prisma.transaction.findMany({
      where: {
        customerId,
        isVoided: false,
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const getEffectiveDate = (tx: Transaction) => tx.interestStartDate || tx.date;

    // 3. Prepare timeline events sorted chronologically
    type TimelineEvent =
      | {
          kind: 'DEBIT';
          date: Date;
          createdAt: Date;
          id: string;
          tx: Transaction;
        }
      | {
          kind: 'CREDIT';
          date: Date;
          createdAt: Date;
          id: string;
          tx: Transaction;
        };

    const events: TimelineEvent[] = [];

    for (const tx of dbTransactions) {
      if (tx.type === TransactionType.DEBIT) {
        events.push({
          kind: 'DEBIT',
          date: new Date(getEffectiveDate(tx)),
          createdAt: new Date(tx.createdAt),
          id: tx.id,
          tx,
        });
      } else {
        events.push({
          kind: 'CREDIT',
          date: new Date(tx.date),
          createdAt: new Date(tx.createdAt),
          id: tx.id,
          tx,
        });
      }
    }

    // Stable chronological sort
    events.sort((a, b) => {
      const timeDiff = a.date.getTime() - b.date.getTime();
      if (timeDiff !== 0) return timeDiff;
      const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdDiff !== 0) return createdDiff;
      return a.id.localeCompare(b.id);
    });

    // 4. Invoke canonical calculateLedger engine as SINGLE SOURCE OF TRUTH
    const engineTxns: LedgerTransaction[] = dbTransactions.map((t) => ({
      id: t.id,
      type: t.type === TransactionType.DEBIT ? 'DEBIT' : 'CREDIT',
      amount: Number(t.amount),
      date: t.date,
      isVoid: t.isVoided,
      interestRate: t.interestRate !== null && t.interestRate !== undefined ? Number(t.interestRate) : undefined,
    }));

    const runningResult = calculateLedger(
      engineTxns,
      Number(customer.lendingRate),
      calculationDate,
    );

    let totalMoneyLent = 0;
    let totalMoneyReceived = 0;

    for (const t of dbTransactions) {
      if (t.type === TransactionType.DEBIT) {
        totalMoneyLent += Number(t.amount);
      } else {
        totalMoneyReceived += Number(t.amount);
      }
    }

    const summary: LedgerSummary = {
      totalMoneyLent: this.roundTo2(totalMoneyLent),
      totalMoneyReceived: this.roundTo2(totalMoneyReceived),
      outstandingPrincipal: this.roundTo2(runningResult.currentPrincipal),
      accruedInterest: this.roundTo2(runningResult.totalAccruedInterest),
      totalDue: this.roundTo2(runningResult.currentPrincipal + runningResult.totalAccruedInterest),
    };

    if (runningResult.currentAdvance > 0) {
      summary.unallocatedCredit = this.roundTo2(runningResult.currentAdvance);
    }

    const entries: LedgerEntry[] = dbTransactions
      .filter((t) => t.type === TransactionType.DEBIT)
      .map((tx) => ({
        entryId: tx.id,
        originalPrincipal: Number(tx.amount),
        remainingPrincipal: Number(tx.amount),
        interestType: tx.interestType || customer.defaultInterestType || 'SIMPLE',
        interestRate: tx.interestRate !== null && tx.interestRate !== undefined ? Number(tx.interestRate) : Number(customer.lendingRate),
        compoundingFrequency: tx.compoundingFrequency || customer.compoundingFrequency || 'MONTHLY',
        customCompoundDays: tx.customCompoundDays || customer.customCompoundDays || null,
        entryDate: new Date(tx.date),
        interestStartDate: new Date(tx.interestStartDate || tx.date),
        dueDate: tx.dueDate ? new Date(tx.dueDate) : null,
        accruedInterest: 0,
        interestPaid: 0,
        remainingInterest: 0,
        totalDue: Number(tx.amount),
        status: 'ACTIVE',
        payments: [],
        remarks: tx.remarks,
      }));

    return {
      customer,
      summary,
      entries,
      transactions: dbTransactions,
      breakdownLog: runningResult.breakdownLog,
    };
  }

  private roundTo2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }
}
