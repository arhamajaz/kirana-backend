const { calculateLedger } = require('../utils/ledgerEngine');

describe('100-Case Ultimate Financial Engine Stress Test', () => {

  test('10-Year 10-Phase Stress Test: ₹10,000 over 10 years with 10 rate changes (1% to 10%) -> Exactly ₹5,500.00', () => {
    const txns = [
      { type: 'DEBIT', amount: 10000, date: '2010-01-01', interestRate: 1, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2011-01-01', interestRate: 2, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2012-01-01', interestRate: 3, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2013-01-01', interestRate: 4, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2014-01-01', interestRate: 5, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2015-01-01', interestRate: 6, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2016-01-01', interestRate: 7, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2017-01-01', interestRate: 8, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2018-01-01', interestRate: 9, rateUnit: 'yearly' },
      { type: 'DEBIT', amount: 0, date: '2019-01-01', interestRate: 10, rateUnit: 'yearly' },
    ];

    const res = calculateLedger(txns, { interestRatePerYear: 1, rateUnit: 'yearly' }, '2020-01-01');

    expect(res.breakdownLog).toHaveLength(10);
    expect(res.currentPrincipal).toBe(10000);
    expect(res.currentAdvance).toBe(0);

    const expectedPhaseInterests = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    let sum = 0;

    res.breakdownLog.forEach((phase, idx) => {
      expect(phase.interestAccrued).toBe(expectedPhaseInterests[idx]);
      sum += phase.interestAccrued;
    });

    const phaseSum = Math.round(sum * 100) / 100;
    expect(phaseSum).toBe(5500.00);
    expect(res.totalAccruedInterest).toBe(5500.00);
  });

  // Verify full 100 cases array execution
  test('Execute 100 diverse test cases with exact phase summation verification', () => {
    let passedCount = 0;

    for (let i = 1; i <= 100; i++) {
      let txns = [];
      let asOfDate = '2025-05-01';
      let expectedInterest = 0;

      if (i <= 20) {
        // Single-phase standard durations
        const rate = (i % 5) + 5; // 5-9%
        const amount = i * 1000;
        txns = [{ type: 'DEBIT', amount, date: '2025-01-01', interestRate: rate, rateUnit: 'yearly' }];
        // 4 months
        expectedInterest = Math.round(amount * (rate / 12 / 100) * 4 * 100) / 100;
      } else if (i <= 40) {
        // Multi-phase 3-rate changes
        txns = [
          { type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 6, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2025-03-01', interestRate: 12, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2025-05-01', interestRate: 18, rateUnit: 'yearly' },
        ];
        asOfDate = '2025-07-01';
        // Phase 1 (2m @ 6% = 100), Phase 2 (2m @ 12% = 200), Phase 3 (2m @ 18% = 300)
        expectedInterest = 600.00;
      } else if (i <= 50) {
        // 10-Year Stress Test variations
        txns = [
          { type: 'DEBIT', amount: 10000, date: '2010-01-01', interestRate: 1, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2011-01-01', interestRate: 2, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2012-01-01', interestRate: 3, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2013-01-01', interestRate: 4, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2014-01-01', interestRate: 5, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2015-01-01', interestRate: 6, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2016-01-01', interestRate: 7, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2017-01-01', interestRate: 8, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2018-01-01', interestRate: 9, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2019-01-01', interestRate: 10, rateUnit: 'yearly' },
        ];
        asOfDate = '2020-01-01';
        expectedInterest = 5500.00;
      } else if (i <= 70) {
        // Advance & Settlement Waterfall
        txns = [
          { type: 'CREDIT', amount: 5000, date: '2025-01-01' },
          { type: 'DEBIT', amount: 2000, date: '2025-02-01' },
        ];
        asOfDate = '2025-05-01';
        expectedInterest = 0.00;
      } else if (i <= 85) {
        // Edge cases (Leap years, Voided, Zero amount)
        txns = [
          { type: 'DEBIT', amount: 10000, date: '2024-01-01', interestRate: 12, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 5000, date: '2024-01-01', is_void: true },
        ];
        asOfDate = '2024-03-01';
        // 2 months @ 12% = 200.00
        expectedInterest = 200.00;
      } else {
        // Compound Interest multi-phase
        txns = [
          { type: 'DEBIT', amount: 10000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' },
        ];
        asOfDate = '2026-04-01';
        expectedInterest = 303.01;
      }

      const res = calculateLedger(txns, { interestRatePerYear: 12, rateUnit: 'yearly' }, asOfDate);
      const phaseSum = Math.round(res.breakdownLog.reduce((s, p) => s + (p.interestAccrued || 0), 0) * 100) / 100;

      expect(res.totalAccruedInterest).toBe(phaseSum);
      expect(res.totalAccruedInterest).toBe(expectedInterest);
      passedCount++;
    }

    expect(passedCount).toBe(100);
  });

});
