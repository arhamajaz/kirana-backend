const { calculateLedger } = require('../utils/ledgerEngine');

describe('calculateLedger Interest Engine (50 Test Cases)', () => {

  // ==========================================
  // Group 1: Basic Interest & Principal (1-10)
  // ==========================================
  describe('Group 1: Basic Interest & Principal', () => {
    test('1. Single Debit, 30 days elapsed -> Check 1 month interest', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 20,
      });
    });

    test('2. Single Debit, 15 days elapsed -> Check 0.5 month interest', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-16');
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 10,
      });
    });

    test('3. Single Debit, 0 days elapsed -> 0 interest', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-01');
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('4. Two Debits, 30 days apart -> Int on D1 for 30 days', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 2000,
        currentAdvance: 0,
        totalAccruedInterest: 20,
      });
    });

    test('5. Three Debits, 30 days apart -> Int on D1 for 30d, Int on (D1+D2) for 30d', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 3000,
        currentAdvance: 0,
        totalAccruedInterest: 60,
      });
    });

    test('6. 1000 Debit @ 2% for 30 days = 20 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res.totalAccruedInterest).toBe(20);
      expect(res.currentPrincipal).toBe(1000);
    });

    test('7. 1000 Debit @ 1.5% for 30 days = 15 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 1.5, '2025-01-31');
      expect(res.totalAccruedInterest).toBe(15);
      expect(res.currentPrincipal).toBe(1000);
    });

    test('8. 1000 Debit @ 0% for 30 days = 0 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 0, '2025-01-31');
      expect(res.totalAccruedInterest).toBe(0);
      expect(res.currentPrincipal).toBe(1000);
    });

    test('9. 5000 Debit @ 3% for 10 days = 50 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 5000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 3, '2025-01-11');
      expect(res.totalAccruedInterest).toBe(50);
      expect(res.currentPrincipal).toBe(5000);
    });

    test('10. Fractional amounts: 1000.50 Debit @ 2% for 30 days = 20.01 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 1000.5, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res.totalAccruedInterest).toBe(20.01);
      expect(res.currentPrincipal).toBe(1000.5);
    });
  });

  // ==========================================
  // Group 2: The "Advance" Protocol (11-20)
  // ==========================================
  describe('Group 2: The "Advance" Protocol', () => {
    test('11. Single Credit -> Goes 100% to Advance', () => {
      const txns = [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 1000,
        totalAccruedInterest: 0,
      });
    });

    test('12. Single Credit -> Wait 30 days -> Advance remains same, 0 Int', () => {
      const txns = [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 1000,
        totalAccruedInterest: 0,
      });
    });

    test('13. Credit then smaller Debit -> Debit deducts from Advance, 0 Due', () => {
      const txns = [
        { type: 'CREDIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 400, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 600,
        totalAccruedInterest: 0,
      });
    });

    test('14. Credit then exact equal Debit -> Advance = 0, Due = 0', () => {
      const txns = [
        { type: 'CREDIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('15. Credit 1000 then Debit 1500 -> Advance = 0, Due = 500', () => {
      const txns = [
        { type: 'CREDIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1500, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 500,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('16. Due = 0, Credit 500, wait 30 days, Debit 500 -> Due = 0, Int = 0', () => {
      const txns = [
        { type: 'CREDIT', amount: 500, date: '2025-01-01' },
        { type: 'DEBIT', amount: 500, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('17. Due = 0, Credit 1000, wait 15 days, Credit 500 -> Advance = 1500', () => {
      const txns = [
        { type: 'CREDIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 500, date: '2025-01-16' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 1500,
        totalAccruedInterest: 0,
      });
    });

    test('18. Advance = 100, Debit 50, Debit 50 -> Advance = 0', () => {
      const txns = [
        { type: 'CREDIT', amount: 100, date: '2025-01-01' },
        { type: 'DEBIT', amount: 50, date: '2025-01-15' },
        { type: 'DEBIT', amount: 50, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('19. Advance = 1000, Debit 2000 (same day) -> Due = 1000', () => {
      const txns = [
        { type: 'CREDIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 2000, date: '2025-01-01' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('20. Advance = 0.01, Debit 1000 -> Due = 999.99', () => {
      const txns = [
        { type: 'CREDIT', amount: 0.01, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 999.99,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });
  });

  // ================================================================
  // Group 3: Settlement Waterfall (Interest -> Principal -> Advance) (21-30)
  // ================================================================
  describe('Group 3: Settlement Waterfall', () => {
    test('21. Due 1000, Int 20, Credit 10 -> Int = 10, Due 1000', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 10, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 10,
      });
    });

    test('22. Due 1000, Int 20, Credit 20 -> Int = 0, Due 1000', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 20, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('23. Due 1000, Int 20, Credit 520 -> Int = 0, Due 500', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 520, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 500,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('24. Due 1000, Int 20, Credit 1020 -> Int = 0, Due 0', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1020, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('25. Due 1000, Int 20, Credit 1100 -> Int = 0, Due 0, Advance 80', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1100, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 80,
        totalAccruedInterest: 0,
      });
    });

    test('26. Due 1000, Int 0, Credit 1500 -> Int = 0, Due 0, Advance 500', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1500, date: '2025-01-01' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 500,
        totalAccruedInterest: 0,
      });
    });

    test('27. Due 0, Int 50 (from past), Credit 25 -> Int 25, Due 0', () => {
      const txns = [
        { type: 'CREDIT', amount: 25, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, { interestRatePerMonth: 2, initialAccruedInterest: 50, initialPrincipal: 0 });
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 25,
      });
    });

    test('28. Partial Int payment -> wait 30 days -> new int accrues on Principal, adds to remaining Int bucket', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 10, date: '2025-01-31' }, // Accrued 20, Credit 10 -> Int remains 10, Due 1000
      ];
      const res = calculateLedger(txns, 2, '2025-03-02'); // +30 days -> new int = 20, total int = 30
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 30,
      });
    });

    test('29. Huge Credit pays off years of accumulated interest and principal -> remainder correctly hits Advance', () => {
      const txns = [
        { type: 'DEBIT', amount: 10000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 15000, date: '2025-10-28' }, // 300 days = 10 months -> Int = 2000
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 3000,
        totalAccruedInterest: 0,
      });
    });

    test('30. Credit exactly equals (Due + Int) -> State is completely 0', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1020, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });
  });

  // ==========================================
  // Group 4: The Benchmark Example (31-40)
  // ==========================================
  describe('Group 4: The Benchmark Example', () => {
    test('31. Jan 1: Debit 1000', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('32. Feb 1: Debit 1000 -> State: Due 2000, Int 20', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, // Feb 1 (30 days)
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 2000,
        currentAdvance: 0,
        totalAccruedInterest: 20,
      });
    });

    test('33. Mar 1: Debit 1000 -> State: Due 3000, Int 60 (20+40)', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, // Mar 1 (30 days)
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 3000,
        currentAdvance: 0,
        totalAccruedInterest: 60,
      });
    });

    test('34. Apr 1: Credit 4000 -> Accrues 60 int. Total Int = 120. State: Advance 880', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, // Apr 1 (30 days)
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 880,
        totalAccruedInterest: 0,
      });
    });

    test('35. Apr 15: Debit 500 -> State: Advance 380', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 380,
        totalAccruedInterest: 0,
      });
    });

    test('36. Apr 20: Debit 1000 -> State: Due 620, Advance 0', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
        { type: 'DEBIT', amount: 1000, date: '2025-04-20' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 620,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('37. May 20: Credit 1000 -> Accrues 12.40 int. State: Advance 367.60', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
        { type: 'DEBIT', amount: 1000, date: '2025-04-20' },
        { type: 'CREDIT', amount: 1000, date: '2025-05-20' }, // 30 days after Apr 20 -> 620 * 0.02 = 12.40 int
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 367.60,
        totalAccruedInterest: 0,
      });
    });

    test('38. Jun 1: Debit 500 -> State: Due 132.40', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
        { type: 'DEBIT', amount: 1000, date: '2025-04-20' },
        { type: 'CREDIT', amount: 1000, date: '2025-05-20' },
        { type: 'DEBIT', amount: 500, date: '2025-06-01' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 132.40,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('39. Ensure the EXACT numbers from this workflow match exactly without rounding errors', () => {
      const fullBenchmarkTxns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
        { type: 'DEBIT', amount: 1000, date: '2025-04-20' },
        { type: 'CREDIT', amount: 1000, date: '2025-05-20' },
        { type: 'DEBIT', amount: 500, date: '2025-06-01' },
      ];
      const res = calculateLedger(fullBenchmarkTxns, 2);
      expect(res.currentPrincipal).toBe(132.40);
      expect(res.currentAdvance).toBe(0);
      expect(res.totalAccruedInterest).toBe(0);
    });

    test('40. Verify zero interest is generated between Apr 1 to Apr 20', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
        { type: 'DEBIT', amount: 1000, date: '2025-04-20' },
      ];
      const res = calculateLedger(txns, 2);
      // On Apr 1, advance was 880. Apr 15 debit 500 left 380 advance. Apr 20 debit 1000 consumed 380 advance -> Due 620.
      // During Apr 1 to Apr 20, advanceBalance was > 0 for all intervals, so 0 interest was generated.
      expect(res.totalAccruedInterest).toBe(0);
      expect(res.currentPrincipal).toBe(620);
      expect(res.currentAdvance).toBe(0);
    });
  });

  // ==========================================
  // Group 5: Edge Cases & Stress Tests (41-50)
  // ==========================================
  describe('Group 5: Edge Cases & Stress Tests', () => {
    test('41. Same Day: Debit 1000, Credit 1000 -> Due 0, Int 0', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1000, date: '2025-01-01' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('42. Same Day: Credit 1000, Debit 1000 -> Due 0, Int 0', () => {
      // Debits processed before credits on same day
      const txns = [
        { type: 'CREDIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('43. Rate Change: Account set to 0% halfway through -> Int stops accruing', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01', interestRate: 2 },
        { type: 'DEBIT', amount: 0, date: '2025-01-31', interestRate: 0 },
      ];
      const res = calculateLedger(txns, 2, '2025-03-02'); // +30 days @ 0%
      expect(res).toEqual({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 20,
      });
    });

    test('44. Leap Year: Feb 28 to Mar 1 (depends on days math, assuming flat 30-day divisor for safety)', () => {
      const txns = [{ type: 'DEBIT', amount: 3000, date: '2024-02-28' }];
      const res = calculateLedger(txns, 2, '2024-03-01'); // 2 days in leap year 2024
      // 3000 * 0.02 * (2/30) = 4.00
      expect(res).toEqual({
        currentPrincipal: 3000,
        currentAdvance: 0,
        totalAccruedInterest: 4,
      });
    });

    test('45. Micro amounts: Debit 0.01 -> wait 30 days -> Int rounds to 0.00', () => {
      const txns = [{ type: 'DEBIT', amount: 0.01, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toEqual({
        currentPrincipal: 0.01,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('46. Macro amounts: Debit 9,999,999.00 -> wait 30 days -> verify no scientific notation crashes', () => {
      const txns = [{ type: 'DEBIT', amount: 9999999.0, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toEqual({
        currentPrincipal: 9999999,
        currentAdvance: 0,
        totalAccruedInterest: 199999.98,
      });
    });

    test('47. Transaction Voiding: If a transaction is marked is_void, the engine skips it completely', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01', is_void: true },
        { type: 'DEBIT', amount: 500, date: '2025-01-01', is_void: false },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 500,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('48. Backdated Entry: Ensure sorting by transaction.date ASC happens BEFORE the loop', () => {
      const txns = [
        { type: 'DEBIT', amount: 500, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
      ];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toEqual({
        currentPrincipal: 1500,
        currentAdvance: 0,
        totalAccruedInterest: 20,
      });
    });

    test('49. Zero Amount: Debit 0 -> state unchanged', () => {
      const txns = [{ type: 'DEBIT', amount: 0, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2);
      expect(res).toEqual({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('50. Output Format: Final function must return { currentPrincipal: number, currentAdvance: number, totalAccruedInterest: number }', () => {
      const txns = [{ type: 'DEBIT', amount: 100, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2);
      expect(res).toHaveProperty('currentPrincipal');
      expect(res).toHaveProperty('currentAdvance');
      expect(res).toHaveProperty('totalAccruedInterest');
      expect(typeof res.currentPrincipal).toBe('number');
      expect(typeof res.currentAdvance).toBe('number');
      expect(typeof res.totalAccruedInterest).toBe('number');
    });
  });
});
