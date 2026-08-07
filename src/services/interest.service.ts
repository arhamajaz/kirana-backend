import {
  calculateInterest,
  InterestCalculatorInput,
  InterestCalculatorOutput,
} from '../utils/interestCalculator';

export class InterestService {
  /**
   * Delegates interest calculation to the pure mathematical utility.
   */
  public calculate(input: InterestCalculatorInput): InterestCalculatorOutput {
    return calculateInterest(input);
  }
}
