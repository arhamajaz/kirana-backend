export type CompoundingFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface InterestCalculatorInput {
  principal: number;
  annualInterestRate: number;
  startDate: Date | string;
  calculationDate: Date | string;
  compoundingFrequency: CompoundingFrequency;
}

export interface InterestCalculatorOutput {
  elapsedDays: number;
  elapsedYears: number;
  interest: number;
  totalAmount: number;
}

/**
 * Calculates compound interest based on financial rules.
 * Uses standard formula: A = P * (1 + r/n)^(n * t)
 */
export function calculateInterest(input: InterestCalculatorInput): InterestCalculatorOutput {
  const { principal, annualInterestRate, startDate, calculationDate, compoundingFrequency } = input;

  const d1 = new Date(startDate);
  d1.setUTCHours(0, 0, 0, 0);
  const d2 = new Date(calculationDate);
  d2.setUTCHours(0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  const elapsedDays = Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / msPerDay));
  const elapsedYears = elapsedDays / 365.0;

  if (principal <= 0 || annualInterestRate <= 0 || elapsedDays <= 0) {
    return {
      elapsedDays,
      elapsedYears,
      interest: 0,
      totalAmount: principal,
    };
  }

  let n = 12; // default MONTHLY
  switch (compoundingFrequency) {
    case 'DAILY':
      n = 365;
      break;
    case 'WEEKLY':
      n = 52;
      break;
    case 'MONTHLY':
      n = 12;
      break;
    case 'QUARTERLY':
      n = 4;
      break;
    case 'YEARLY':
      n = 1;
      break;
  }

  const ratePerPeriod = annualInterestRate / 100.0 / n;
  const totalPeriods = n * elapsedYears;
  const totalAmount = principal * Math.pow(1 + ratePerPeriod, totalPeriods);
  const interest = totalAmount - principal;

  return {
    elapsedDays,
    elapsedYears,
    interest: Math.round((interest + Number.EPSILON) * 100) / 100,
    totalAmount: Math.round((totalAmount + Number.EPSILON) * 100) / 100,
  };
}
