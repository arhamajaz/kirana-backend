export interface LedgerTransaction {
  id?: string;
  type: 'DEBIT' | 'CREDIT' | 'debit' | 'credit';
  amount: number | string;
  date: Date | string;
  is_void?: boolean;
  isVoid?: boolean;
  isVoided?: boolean;
  is_voided?: boolean;
  interestRate?: number | string | null;
  rate?: number | string | null;
  rateUnit?: 'monthly' | 'yearly' | 'annual' | string;
  isAnnual?: boolean;
}

export interface LedgerOptions {
  interestRatePerMonth?: number;
  interestRatePerYear?: number;
  rateUnit?: 'monthly' | 'yearly' | 'annual' | string;
  isAnnual?: boolean;
  asOfDate?: Date | string | null;
  initialPrincipal?: number;
  initialAdvance?: number;
  initialAccruedInterest?: number;
}

export interface BreakdownEntry {
  startDate: Date | string;
  endDate: Date | string;
  daysElapsed: number;
  activePrincipal: number;
  interestGenerated: number;
  interestAccrued: number;
  rateApplied: number | string;
  monthlyRate?: number;
  isAdvance?: boolean;
}

export interface LedgerCalculationResult {
  currentPrincipal: number;
  currentAdvance: number;
  totalAccruedInterest: number;
  breakdownLog: BreakdownEntry[];
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates the customer ledger state using the strict
 * "Running Balance with Zero-Interest Credit Protocol".
 */
export function calculateLedger(
  transactions: LedgerTransaction[] = [],
  rateOrOptions: number | LedgerOptions = 0,
  asOfDateParam: Date | string | null = null
): LedgerCalculationResult {
  let defaultRate = 0;
  let isYearlyRate = false;
  let asOfDate: Date | null = null;
  let principalDue = 0;
  let advanceBalance = 0;
  let accruedInterest = 0;
  const breakdownLog: BreakdownEntry[] = [];

  if (typeof rateOrOptions === 'number') {
    defaultRate = rateOrOptions;
    if (asOfDateParam) {
      asOfDate = new Date(asOfDateParam);
    }
  } else if (rateOrOptions && typeof rateOrOptions === 'object') {
    if (rateOrOptions.interestRatePerYear !== undefined) {
      defaultRate = rateOrOptions.interestRatePerYear;
      isYearlyRate = true;
    } else {
      defaultRate = rateOrOptions.interestRatePerMonth ?? 0;
      isYearlyRate = rateOrOptions.rateUnit === 'yearly' || rateOrOptions.rateUnit === 'annual' || rateOrOptions.isAnnual === true;
    }
    principalDue = rateOrOptions.initialPrincipal ?? 0;
    advanceBalance = rateOrOptions.initialAdvance ?? 0;
    accruedInterest = rateOrOptions.initialAccruedInterest ?? 0;
    if (rateOrOptions.asOfDate) {
      asOfDate = new Date(rateOrOptions.asOfDate);
    } else if (asOfDateParam) {
      asOfDate = new Date(asOfDateParam);
    }
  }

  // Directive 3 / Edge Case 47: Filter out voided transactions
  const validTxns = transactions.filter((t) => {
    return !t.is_void && !t.isVoid && !t.isVoided && !t.is_voided;
  });

  // Directive 2 / Edge Case 48: Sort transactions chronologically (Date ASC).
  // Same-Day Transactions: process DEBIT before CREDIT.
  const sortedTxns = [...validTxns].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    const typeA = String(a.type).toUpperCase();
    const typeB = String(b.type).toUpperCase();
    if (typeA !== typeB) {
      return typeA === 'DEBIT' ? -1 : 1;
    }
    return 0;
  });

  // Directive 1: Core State Machine Variables
  let lastDate: Date | null = null;
  let rawActiveRate = defaultRate;
  let activeIsYearly = isYearlyRate;

  // Chronological Loop per Transaction
  for (const tx of sortedTxns) {
    const txDate = new Date(tx.date);
    if (isNaN(txDate.getTime())) continue;

    // Step A: Accrue Interest to Current Date
    if (lastDate !== null) {
      const exactDays = Math.max(
        0,
        Math.round((txDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Rule: If advanceBalance > 0, newInterest = 0 (Advance balances NEVER accrue interest)
      if (exactDays > 0) {
        const effectiveMonthlyRate = activeIsYearly ? rawActiveRate / 12 : rawActiveRate;
        const rateLabel = activeIsYearly 
          ? `${roundMoney(effectiveMonthlyRate)}% monthly (${rawActiveRate}% yearly)` 
          : `${rawActiveRate}% monthly`;

        if (principalDue > 0 && advanceBalance === 0) {
          const elapsedMonths = exactDays / 30; // Strict 30-day month divisor
          const newInterest = roundMoney(principalDue * (effectiveMonthlyRate / 100) * elapsedMonths);
          accruedInterest = roundMoney(accruedInterest + newInterest);
          breakdownLog.push({
            startDate: new Date(lastDate),
            endDate: new Date(txDate),
            daysElapsed: exactDays,
            activePrincipal: principalDue,
            interestGenerated: newInterest,
            interestAccrued: newInterest,
            rateApplied: rateLabel,
            monthlyRate: effectiveMonthlyRate,
            isAdvance: false,
          });
        } else if (advanceBalance > 0) {
          breakdownLog.push({
            startDate: new Date(lastDate),
            endDate: new Date(txDate),
            daysElapsed: exactDays,
            activePrincipal: 0,
            interestGenerated: 0,
            interestAccrued: 0,
            rateApplied: '0%',
            monthlyRate: 0,
            isAdvance: true,
          });
        }
      }
    }

    // Edge Case 43: Mid-stream Rate Change per Transaction override
    const txRate = tx.interestRate ?? tx.rate;
    if (txRate !== undefined && txRate !== null && !isNaN(Number(txRate))) {
      rawActiveRate = Number(txRate);
      if (tx.rateUnit === 'yearly' || tx.rateUnit === 'annual' || tx.isAnnual) {
        activeIsYearly = true;
      } else if (tx.rateUnit === 'monthly') {
        activeIsYearly = false;
      }
    }

    // Step B: Apply Transaction Amounts (Strict Settlement Order)
    let amount = roundMoney(Number(tx.amount) || 0);
    const type = String(tx.type).toUpperCase();

    if (type === 'DEBIT') {
      // Phase 1: Draw from advanceBalance first
      const deduction = roundMoney(Math.min(amount, advanceBalance));
      advanceBalance = roundMoney(advanceBalance - deduction);
      amount = roundMoney(amount - deduction);

      // Phase 2: Any remaining amount is added to principalDue
      principalDue = roundMoney(principalDue + amount);
    } else if (type === 'CREDIT') {
      // Phase 1: Pay off accruedInterest first
      const intPayment = roundMoney(Math.min(amount, accruedInterest));
      accruedInterest = roundMoney(accruedInterest - intPayment);
      amount = roundMoney(amount - intPayment);

      // Phase 2: Pay off principalDue second
      const prinPayment = roundMoney(Math.min(amount, principalDue));
      principalDue = roundMoney(principalDue - prinPayment);
      amount = roundMoney(amount - prinPayment);

      // Phase 3: Any remaining amount becomes advanceBalance
      advanceBalance = roundMoney(advanceBalance + amount);
    }

    // Step C: Update Date
    lastDate = txDate;
  }

  // Step A (Final): Accrue Interest up to asOfDate if requested
  if (asOfDate && !isNaN(asOfDate.getTime()) && lastDate !== null) {
    if (asOfDate.getTime() > lastDate.getTime()) {
      const exactDays = Math.max(
        0,
        Math.round((asOfDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      if (exactDays > 0) {
        const effectiveMonthlyRate = activeIsYearly ? rawActiveRate / 12 : rawActiveRate;
        const rateLabel = activeIsYearly 
          ? `${roundMoney(effectiveMonthlyRate)}% monthly (${rawActiveRate}% yearly)` 
          : `${rawActiveRate}% monthly`;

        if (principalDue > 0 && advanceBalance === 0) {
          const elapsedMonths = exactDays / 30;
          const newInterest = roundMoney(principalDue * (effectiveMonthlyRate / 100) * elapsedMonths);
          accruedInterest = roundMoney(accruedInterest + newInterest);
          breakdownLog.push({
            startDate: new Date(lastDate),
            endDate: new Date(asOfDate),
            daysElapsed: exactDays,
            activePrincipal: principalDue,
            interestGenerated: newInterest,
            interestAccrued: newInterest,
            rateApplied: rateLabel,
            monthlyRate: effectiveMonthlyRate,
            isAdvance: false,
          });
        } else if (advanceBalance > 0) {
          breakdownLog.push({
            startDate: new Date(lastDate),
            endDate: new Date(asOfDate),
            daysElapsed: exactDays,
            activePrincipal: 0,
            interestGenerated: 0,
            interestAccrued: 0,
            rateApplied: '0%',
            monthlyRate: 0,
            isAdvance: true,
          });
        }
      }
    }
  }

  // Directive 3 / Item 50: Output Format
  return {
    currentPrincipal: roundMoney(principalDue),
    currentAdvance: roundMoney(advanceBalance),
    totalAccruedInterest: roundMoney(accruedInterest),
    breakdownLog,
  };
}
