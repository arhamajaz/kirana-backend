import { prisma } from '../config/database';
import { InterestService } from './interest.service';
import { AppError } from '../middleware/errorHandler';

export interface LedgerSummary {
  totalMoneyLent: number;
  totalMoneyReceived: number;
  outstandingPrincipal: number;
  accruedInterest: number;
  totalDue: number;
}

export interface LedgerResult {
  customer: unknown;
  summary: LedgerSummary;
  transactions: unknown[];
}

export class LedgerService {
  private interestService = new InterestService();

  /**
   * Generates the running balance ledger for a specific customer.
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

    // 3. Sort chronologically by: interestStartDate/date -> date -> createdAt -> id
    const getEffectiveDate = (tx: import('../generated/prisma/client').Transaction) =>
      tx.interestStartDate || tx.date;

    const allTx = dbTransactions
      .map((tx) => ({
        ...tx,
        effectiveDate: new Date(getEffectiveDate(tx)),
        amountNum: Number(tx.amount),
      }))
      .sort((a, b) => {
        const timeDiff = a.effectiveDate.getTime() - b.effectiveDate.getTime();
        if (timeDiff !== 0) return timeDiff;
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (createdDiff !== 0) return createdDiff;
        return a.id.localeCompare(b.id);
      });

    // 4. Walk the timeline to calculate dynamic segmented interest and running balance
    let runningOutstanding = 0;
    let totalAccruedInterest = 0;
    let totalMoneyLent = 0;
    let totalMoneyReceived = 0;
    let currentDate: Date | null = null;

    for (const event of allTx) {
      const eventDate = event.effectiveDate;
      const amount = event.amountNum;

      if (currentDate !== null) {
        // Calculate interest accrued on the running outstanding balance for the duration
        if (eventDate.getTime() > currentDate.getTime() && runningOutstanding > 0) {
          const result = this.interestService.calculate({
            principal: runningOutstanding,
            annualInterestRate: Number(customer.lendingRate),
            startDate: currentDate,
            calculationDate: eventDate,
            compoundingFrequency:
              customer.compoundingFrequency as import('../utils/interestCalculator').CompoundingFrequency,
          });
          totalAccruedInterest += result.interest;
        }
      }

      // Process event
      if (event.type === 'DEBIT') {
        runningOutstanding += amount;
        totalMoneyLent += amount;
      } else {
        runningOutstanding -= amount;
        totalMoneyReceived += amount;
      }

      // Clamp outstanding balance at 0 (cannot be negative)
      runningOutstanding = Math.max(0, runningOutstanding);

      // Advance timeline
      currentDate = eventDate;
    }

    // After final event, calculate interest from last event to calculationDate
    if (
      currentDate !== null &&
      calculationDate.getTime() > currentDate.getTime() &&
      runningOutstanding > 0
    ) {
      const result = this.interestService.calculate({
        principal: runningOutstanding,
        annualInterestRate: Number(customer.lendingRate),
        startDate: currentDate,
        calculationDate,
        compoundingFrequency:
          customer.compoundingFrequency as import('../utils/interestCalculator').CompoundingFrequency,
      });
      totalAccruedInterest += result.interest;
    }

    // Clean up temporary properties before returning transactions
    const finalTransactions = allTx.map((tx) => {
      const copy = { ...tx } as Record<string, unknown>;
      delete copy.effectiveDate;
      delete copy.amountNum;
      return copy;
    });

    return {
      customer,
      summary: {
        totalMoneyLent: this.roundTo2(totalMoneyLent),
        totalMoneyReceived: this.roundTo2(totalMoneyReceived),
        outstandingPrincipal: this.roundTo2(runningOutstanding),
        accruedInterest: this.roundTo2(totalAccruedInterest),
        totalDue: this.roundTo2(runningOutstanding + totalAccruedInterest),
      },
      transactions: finalTransactions,
    };
  }

  private roundTo2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }
}
