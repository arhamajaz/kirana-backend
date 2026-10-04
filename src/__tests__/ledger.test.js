const { calculateLedger } = require('../utils/ledgerEngine');

describe('calculateLedger Interest Engine (50 Test Cases)', () => {

  // ==========================================
  // Group 1: Basic Interest & Principal (1-10)
  // ==========================================
  describe('Group 1: Basic Interest & Principal', () => {
    test('1. Single Debit, 30 days elapsed -> Check 1 month interest', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toMatchObject({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 19.35,
      });
    });

    test('2. Single Debit, 15 days elapsed -> Check 0.5 month interest', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-16');
      expect(res).toMatchObject({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 9.68,
      });
    });

    test('3. Single Debit, 0 days elapsed -> 0 interest', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-01');
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
        currentPrincipal: 2000,
        currentAdvance: 0,
        totalAccruedInterest: 19.35,
      });
    });

    test('5. Three Debits, 30 days apart -> Int on D1 for 30d, Int on (D1+D2) for 30d', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 3000,
        currentAdvance: 0,
        totalAccruedInterest: 61.93,
      });
    });

    test('6. 1000 Debit @ 2% for 30 days = 19.35 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res.totalAccruedInterest).toBe(19.35);
      expect(res.currentPrincipal).toBe(1000);
    });

    test('7. 1000 Debit @ 1.5% for 30 days = 14.52 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 1.5, '2025-01-31');
      expect(res.totalAccruedInterest).toBe(14.52);
      expect(res.currentPrincipal).toBe(1000);
    });

    test('8. 1000 Debit @ 0% for 30 days = 0 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 0, '2025-01-31');
      expect(res.totalAccruedInterest).toBe(0);
      expect(res.currentPrincipal).toBe(1000);
    });

    test('9. 5000 Debit @ 3% for 10 days = 48.39 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 5000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 3, '2025-01-11');
      expect(res.totalAccruedInterest).toBe(48.39);
      expect(res.currentPrincipal).toBe(5000);
    });

    test('10. Fractional amounts: 1000.50 Debit @ 2% for 30 days = 19.36 Int', () => {
      const txns = [{ type: 'DEBIT', amount: 1000.5, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res.totalAccruedInterest).toBe(19.36);
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
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 1000,
        totalAccruedInterest: 0,
      });
    });

    test('12. Single Credit -> Wait 30 days -> Advance remains same, 0 Int', () => {
      const txns = [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
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
    test('21. Due 1000, Int 19.35, Credit 10 -> Int = 9.35, Due 1000', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 10, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 9.35,
      });
    });

    test('22. Due 1000, Int 19.35, Credit 20 -> Int = 0, Due 999.35', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 20, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 999.35,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('23. Due 1000, Int 19.35, Credit 520 -> Int = 0, Due 499.35', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 520, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 499.35,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('24. Due 1000, Int 19.35, Credit 1020 -> Int = 0, Due 0', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1020, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 0.65,
        totalAccruedInterest: 0,
      });
    });

    test('25. Due 1000, Int 19.35, Credit 1100 -> Int = 0, Due 0, Advance 80.65', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1100, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 80.65,
        totalAccruedInterest: 0,
      });
    });

    test('26. Due 1000, Int 0, Credit 1500 -> Int = 0, Due 0, Advance 500', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1500, date: '2025-01-01' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 25,
      });
    });

    test('28. Partial Int payment -> wait 30 days -> new int accrues on Principal, adds to remaining Int bucket', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 10, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2, '2025-03-02');
      expect(res).toMatchObject({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 30.64,
      });
    });

    test('29. Huge Credit pays off years of accumulated interest and principal -> remainder correctly hits Advance', () => {
      const txns = [
        { type: 'DEBIT', amount: 10000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 15000, date: '2025-10-28' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 3025.81,
        totalAccruedInterest: 0,
      });
    });

    test('30. Credit exactly equals (Due + Int) -> State is completely 0', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'CREDIT', amount: 1019.35, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('32. Feb 1: Debit 1000 -> State: Due 2000, Int 20', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 2000,
        currentAdvance: 0,
        totalAccruedInterest: 19.35,
      });
    });

    test('33. Mar 1: Debit 1000 -> State: Due 3000, Int 61.93', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 3000,
        currentAdvance: 0,
        totalAccruedInterest: 61.93,
      });
    });

    test('34. Apr 1: Credit 4000 -> Accrues int. State: Advance 880.01', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 880.01,
        totalAccruedInterest: 0,
      });
    });

    test('35. Apr 15: Debit 500 -> State: Advance 380.01', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 380.01,
        totalAccruedInterest: 0,
      });
    });

    test('36. Apr 20: Debit 1000 -> State: Due 619.99, Advance 0', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
        { type: 'DEBIT', amount: 1000, date: '2025-04-20' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 619.99,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('37. May 20: Credit 1000 -> State: Advance 367.61', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-31' },
        { type: 'DEBIT', amount: 1000, date: '2025-03-02' },
        { type: 'CREDIT', amount: 4000, date: '2025-04-01' },
        { type: 'DEBIT', amount: 500, date: '2025-04-15' },
        { type: 'DEBIT', amount: 1000, date: '2025-04-20' },
        { type: 'CREDIT', amount: 1000, date: '2025-05-20' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 367.61,
        totalAccruedInterest: 0,
      });
    });

    test('38. Jun 1: Debit 500 -> State: Due 132.39', () => {
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
      expect(res).toMatchObject({
        currentPrincipal: 132.39,
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
      expect(res.currentPrincipal).toBe(132.39);
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
      expect(res.totalAccruedInterest).toBe(0);
      expect(res.currentPrincipal).toBe(619.99);
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
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('42. Same Day: Credit 1000, Debit 1000 -> Due 0, Int 0', () => {
      const txns = [
        { type: 'CREDIT', amount: 1000, date: '2025-01-01' },
        { type: 'DEBIT', amount: 1000, date: '2025-01-01' },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
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
      const res = calculateLedger(txns, 2, '2025-03-02');
      expect(res).toMatchObject({
        currentPrincipal: 1000,
        currentAdvance: 0,
        totalAccruedInterest: 19.35,
      });
    });

    test('44. Leap Year: Feb 28 to Mar 1 (depends on days math)', () => {
      const txns = [{ type: 'DEBIT', amount: 3000, date: '2024-02-28' }];
      const res = calculateLedger(txns, 2, '2024-03-01');
      expect(res).toMatchObject({
        currentPrincipal: 3000,
        currentAdvance: 0,
        totalAccruedInterest: 4.14,
      });
    });

    test('45. Micro amounts: Debit 0.01 -> wait 30 days -> Int rounds to 0.00', () => {
      const txns = [{ type: 'DEBIT', amount: 0.01, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toMatchObject({
        currentPrincipal: 0.01,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('46. Macro amounts: Debit 9,999,999.00 -> wait 30 days -> verify no scientific notation crashes', () => {
      const txns = [{ type: 'DEBIT', amount: 9999999.0, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2, '2025-01-31');
      expect(res).toMatchObject({
        currentPrincipal: 9999999,
        currentAdvance: 0,
        totalAccruedInterest: 193548.37,
      });
    });

    test('47. Transaction Voiding: If a transaction is marked is_void, the engine skips it completely', () => {
      const txns = [
        { type: 'DEBIT', amount: 1000, date: '2025-01-01', is_void: true },
        { type: 'DEBIT', amount: 500, date: '2025-01-01', is_void: false },
      ];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
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
      expect(res).toMatchObject({
        currentPrincipal: 1500,
        currentAdvance: 0,
        totalAccruedInterest: 19.35,
      });
    });

    test('49. Zero Amount: Debit 0 -> state unchanged', () => {
      const txns = [{ type: 'DEBIT', amount: 0, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2);
      expect(res).toMatchObject({
        currentPrincipal: 0,
        currentAdvance: 0,
        totalAccruedInterest: 0,
      });
    });

    test('50. Output Format: Final function must return { currentPrincipal: number, currentAdvance: number, totalAccruedInterest: number, breakdownLog: array }', () => {
      const txns = [{ type: 'DEBIT', amount: 100, date: '2025-01-01' }];
      const res = calculateLedger(txns, 2);
      expect(res).toHaveProperty('currentPrincipal');
      expect(res).toHaveProperty('currentAdvance');
      expect(res).toHaveProperty('totalAccruedInterest');
      expect(res).toHaveProperty('breakdownLog');
      expect(typeof res.currentPrincipal).toBe('number');
      expect(typeof res.currentAdvance).toBe('number');
      expect(typeof res.totalAccruedInterest).toBe('number');
      expect(Array.isArray(res.breakdownLog)).toBe(true);
    });
  });

  describe('Comprehensive Advance & Settlement Waterfall Benchmark', () => {
    const transactions = [
      { type: 'DEBIT', amount: 1000, date: '2026-01-01' },
      { type: 'DEBIT', amount: 1000, date: '2026-02-01' },
      { type: 'DEBIT', amount: 1000, date: '2026-03-01' },
      { type: 'CREDIT', amount: 4000, date: '2026-04-01' },
      { type: 'DEBIT', amount: 500, date: '2026-04-15' },
      { type: 'DEBIT', amount: 1000, date: '2026-04-20' },
      { type: 'CREDIT', amount: 1000, date: '2026-05-20' },
      { type: 'DEBIT', amount: 500, date: '2026-06-01' },
    ];

    test('asOfDate: 2026-04-01 -> Principal: 0, Advance: 880, Accrued Interest: 0', () => {
      const res = calculateLedger(transactions, 2, '2026-04-01');
      expect(res.currentPrincipal).toBe(0);
      expect(res.currentAdvance).toBe(880);
      expect(res.totalAccruedInterest).toBe(0);
    });

    test('asOfDate: 2026-05-20 -> Principal: 0, Advance: 367.60, Accrued Interest: 0', () => {
      const res = calculateLedger(transactions, 2, '2026-05-20');
      expect(res.currentPrincipal).toBe(0);
      expect(res.currentAdvance).toBe(367.60);
      expect(res.totalAccruedInterest).toBe(0);
    });

    test('asOfDate: 2026-06-01 -> Principal: 132.40, Advance: 0, Accrued Interest: 0', () => {
      const res = calculateLedger(transactions, 2, '2026-06-01');
      expect(res.currentPrincipal).toBe(132.40);
      expect(res.currentAdvance).toBe(0);
      expect(res.totalAccruedInterest).toBe(0);
    });
  });
});

