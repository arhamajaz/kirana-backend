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

    // 4. Initialize internal entry representation
    interface InternalEntry extends LedgerEntry {
      lastInterestDate: Date;
    }

    const allEntries: InternalEntry[] = [];
    const availableCreditSources: Array<{ creditId: string; date: Date; remaining: number }> = [];
    let totalMoneyLent = 0;
    let totalMoneyReceived = 0;

    // 5. Walk through chronological events
    for (const event of events) {
      if (event.kind === 'DEBIT') {
        const tx = event.tx;
        const amount = Number(tx.amount);
        totalMoneyLent += amount;
        const interestStartDate = new Date(getEffectiveDate(tx));

        // Resolve interest configuration: Transaction override -> Customer default -> System fallback
        const resolvedInterestType: InterestType =
          tx.interestType || customer.defaultInterestType || 'SIMPLE';

        const resolvedInterestRate: number =
          tx.interestRate !== null && tx.interestRate !== undefined
            ? Number(tx.interestRate)
            : Number(customer.lendingRate);

        const resolvedFrequency: CompoundingFrequency | null =
          resolvedInterestType === 'COMPOUND'
            ? tx.compoundingFrequency || customer.compoundingFrequency || 'MONTHLY'
            : null;

        const resolvedCustomDays: number | null =
          resolvedFrequency === 'CUSTOM'
            ? tx.customCompoundDays || customer.customCompoundDays || null
            : null;

        const newEntry: InternalEntry = {
          entryId: tx.id,
          originalPrincipal: amount,
          remainingPrincipal: amount,
          interestType: resolvedInterestType,
          interestRate: resolvedInterestRate,
          compoundingFrequency: resolvedFrequency,
          customCompoundDays: resolvedCustomDays,
          entryDate: new Date(tx.date),
          interestStartDate,
          dueDate: tx.dueDate ? new Date(tx.dueDate) : null,
          accruedInterest: 0,
          interestPaid: 0,
          remainingInterest: 0,
          totalDue: amount,
          status: 'ACTIVE',
          payments: [],
          remarks: tx.remarks,
          lastInterestDate: interestStartDate,
        };

        // If prior unallocated credit exists, apply it immediately to this new DEBIT principal
        for (const creditSource of availableCreditSources) {
          if (creditSource.remaining <= 0) continue;
          if (newEntry.remainingPrincipal <= 0) break;

          const principalToPay = Math.min(creditSource.remaining, newEntry.remainingPrincipal);
          newEntry.remainingPrincipal -= principalToPay;
          creditSource.remaining -= principalToPay;

          newEntry.payments.push({
            creditId: creditSource.creditId,
            amount: this.roundTo2(principalToPay),
            date: creditSource.date,
            appliedToPrincipal: this.roundTo2(principalToPay),
            appliedToInterest: 0,
          });

          if (newEntry.remainingPrincipal <= 0) {
            newEntry.status = 'SETTLED';
          } else {
            newEntry.status = 'PARTIALLY_PAID';
          }
        }

        allEntries.push(newEntry);
      } else {
        // CREDIT payment event
        const tx = event.tx;
        const amount = Number(tx.amount);
        totalMoneyReceived += amount;
        let remainingCredit = amount;
        const paymentDate = new Date(tx.date);

        const paymentAllocationMap = new Map<
          string,
          { appliedToPrincipal: number; appliedToInterest: number }
        >();

        if (tx.targetEntryId) {
          // TARGETED PAYMENT ALLOCATION
          const targetEntry = allEntries.find((e) => e.entryId === tx.targetEntryId);
          if (targetEntry) {
            // Accrue interest on targetEntry up to paymentDate
            if (
              paymentDate.getTime() > targetEntry.lastInterestDate.getTime() &&
              targetEntry.remainingPrincipal > 0
            ) {
              const calcResult = this.interestService.calculate({
                principal: targetEntry.remainingPrincipal,
                annualInterestRate: targetEntry.interestRate,
                startDate: targetEntry.lastInterestDate,
                calculationDate: paymentDate,
                interestType: targetEntry.interestType,
                compoundingFrequency: targetEntry.compoundingFrequency || undefined,
                customCompoundDays: targetEntry.customCompoundDays,
              });

              targetEntry.accruedInterest += calcResult.interest;
              targetEntry.lastInterestDate = paymentDate;
            }

            let appliedToPrincipal = 0;
            let appliedToInterest = 0;

            // Pass 1: Apply to targetEntry principal
            if (remainingCredit > 0 && targetEntry.remainingPrincipal > 0) {
              const principalToPay = Math.min(remainingCredit, targetEntry.remainingPrincipal);
              targetEntry.remainingPrincipal -= principalToPay;
              remainingCredit -= principalToPay;
              appliedToPrincipal = principalToPay;
            }

            // Pass 2: Apply to targetEntry unpaid accrued interest
            if (remainingCredit > 0) {
              const currentUnpaidInterest = Math.max(
                0,
                targetEntry.accruedInterest - targetEntry.interestPaid,
              );
              if (currentUnpaidInterest > 0) {
                const interestToPay = Math.min(remainingCredit, currentUnpaidInterest);
                targetEntry.interestPaid += interestToPay;
                remainingCredit -= interestToPay;
                appliedToInterest = interestToPay;
              }
            }

            if (appliedToPrincipal > 0 || appliedToInterest > 0) {
              paymentAllocationMap.set(targetEntry.entryId, {
                appliedToPrincipal,
                appliedToInterest,
              });
            }
          }
        } else {
          // Pass 1: Accrue interest up to paymentDate and apply payment to Principal across existing DEBIT entries in FIFO order
          for (const entry of allEntries) {
            // Accrue interest up to payment date on existing active entries
            if (
              paymentDate.getTime() > entry.lastInterestDate.getTime() &&
              entry.remainingPrincipal > 0
            ) {
              const calcResult = this.interestService.calculate({
                principal: entry.remainingPrincipal,
                annualInterestRate: entry.interestRate,
                startDate: entry.lastInterestDate,
                calculationDate: paymentDate,
                interestType: entry.interestType,
                compoundingFrequency: entry.compoundingFrequency || undefined,
                customCompoundDays: entry.customCompoundDays,
              });

              entry.accruedInterest += calcResult.interest;
              entry.lastInterestDate = paymentDate;
            }

            if (remainingCredit > 0 && entry.remainingPrincipal > 0) {
              const principalToPay = Math.min(remainingCredit, entry.remainingPrincipal);
              entry.remainingPrincipal -= principalToPay;
              remainingCredit -= principalToPay;

              paymentAllocationMap.set(entry.entryId, {
                appliedToPrincipal: principalToPay,
                appliedToInterest: 0,
              });
            }
          }

          // Pass 2: If payment remains after principal across all existing entries is cleared, apply to unpaid accrued interest
          if (remainingCredit > 0) {
            for (const entry of allEntries) {
              if (remainingCredit <= 0) break;

              const currentUnpaidInterest = Math.max(0, entry.accruedInterest - entry.interestPaid);
              if (currentUnpaidInterest > 0) {
                const interestToPay = Math.min(remainingCredit, currentUnpaidInterest);
                entry.interestPaid += interestToPay;
                remainingCredit -= interestToPay;

                const existing = paymentAllocationMap.get(entry.entryId) || {
                  appliedToPrincipal: 0,
                  appliedToInterest: 0,
                };
                existing.appliedToInterest += interestToPay;
                paymentAllocationMap.set(entry.entryId, existing);
              }
            }
          }
        }

        // Record payments on entries
        for (const [entryId, alloc] of paymentAllocationMap.entries()) {
          const entry = allEntries.find((e) => e.entryId === entryId);
          if (entry && (alloc.appliedToPrincipal > 0 || alloc.appliedToInterest > 0)) {
            entry.payments.push({
              creditId: tx.id,
              amount: this.roundTo2(alloc.appliedToPrincipal + alloc.appliedToInterest),
              date: tx.date,
              appliedToPrincipal: this.roundTo2(alloc.appliedToPrincipal),
              appliedToInterest: this.roundTo2(alloc.appliedToInterest),
            });
          }
        }

        // Update statuses of all entries
        for (const entry of allEntries) {
          const unpaidInterest = Math.max(0, entry.accruedInterest - entry.interestPaid);
          if (entry.remainingPrincipal <= 0 && unpaidInterest <= 0) {
            entry.status = 'SETTLED';
          } else if (
            entry.remainingPrincipal < entry.originalPrincipal ||
            entry.interestPaid > 0
          ) {
            entry.status = 'PARTIALLY_PAID';
          } else {
            entry.status = 'ACTIVE';
          }
        }

        // If payment still remains after clearing all existing entries' principal and interest, buffer as available unallocated credit
        if (remainingCredit > 0) {
          availableCreditSources.push({
            creditId: tx.id,
            date: paymentDate,
            remaining: remainingCredit,
          });
        }
      }
    }

    // 6. Accrue remaining interest on all active entries up to calculationDate
    let totalOutstandingPrincipal = 0;
    let totalAccruedInterest = 0;

    const finalEntries: LedgerEntry[] = allEntries.map((entry) => {
      if (
        calculationDate.getTime() > entry.lastInterestDate.getTime() &&
        entry.remainingPrincipal > 0
      ) {
        const calcResult = this.interestService.calculate({
          principal: entry.remainingPrincipal,
          annualInterestRate: entry.interestRate,
          startDate: entry.lastInterestDate,
          calculationDate,
          interestType: entry.interestType,
          compoundingFrequency: entry.compoundingFrequency || undefined,
          customCompoundDays: entry.customCompoundDays,
        });

        entry.accruedInterest += calcResult.interest;
        entry.lastInterestDate = calculationDate;
      }

      const accruedRounded = this.roundTo2(entry.accruedInterest);
      const paidRounded = this.roundTo2(entry.interestPaid);
      const remainingPrincipalRounded = this.roundTo2(Math.max(0, entry.remainingPrincipal));
      const remainingInterestRounded = this.roundTo2(Math.max(0, accruedRounded - paidRounded));
      const totalDueRounded = this.roundTo2(
        remainingPrincipalRounded + remainingInterestRounded,
      );

      let status: 'ACTIVE' | 'PARTIALLY_PAID' | 'SETTLED' = 'ACTIVE';
      if (remainingPrincipalRounded === 0 && remainingInterestRounded === 0) {
        status = 'SETTLED';
      } else if (
        remainingPrincipalRounded < entry.originalPrincipal ||
        paidRounded > 0
      ) {
        status = 'PARTIALLY_PAID';
      }

      totalOutstandingPrincipal += remainingPrincipalRounded;
      totalAccruedInterest += remainingInterestRounded;

      return {
        entryId: entry.entryId,
        originalPrincipal: entry.originalPrincipal,
        remainingPrincipal: remainingPrincipalRounded,
        interestType: entry.interestType,
        interestRate: entry.interestRate,
        compoundingFrequency: entry.compoundingFrequency,
        customCompoundDays: entry.customCompoundDays,
        entryDate: entry.entryDate,
        interestStartDate: entry.interestStartDate,
        dueDate: entry.dueDate,
        accruedInterest: accruedRounded,
        interestPaid: paidRounded,
        remainingInterest: remainingInterestRounded,
        totalDue: totalDueRounded,
        status,
        payments: entry.payments,
        remarks: entry.remarks,
      };
    });

    const totalUnallocatedCredit = availableCreditSources.reduce(
      (sum, src) => sum + src.remaining,
      0,
    );

    const summary: LedgerSummary = {
      totalMoneyLent: this.roundTo2(totalMoneyLent),
      totalMoneyReceived: this.roundTo2(totalMoneyReceived),
      outstandingPrincipal: this.roundTo2(totalOutstandingPrincipal),
      accruedInterest: this.roundTo2(totalAccruedInterest),
      totalDue: this.roundTo2(totalOutstandingPrincipal + totalAccruedInterest),
    };

    if (totalUnallocatedCredit > 0) {
      summary.unallocatedCredit = this.roundTo2(totalUnallocatedCredit);
    }

    return {
      customer,
      summary,
      entries: finalEntries,
      transactions: dbTransactions,
    };
  }

  private roundTo2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }
}
