const { calculateLedger } = require('../utils/ledgerEngine');

describe('150-Case Ultimate Financial Engine Stress Test', () => {

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

  test('2-Phase Compound Capitalization Benchmark: 50k (4m @ 12% yr compound) + 100k debit (2m @ 12% yr compound) -> Exactly ₹5,086.01', () => {
    const txns = [
      { type: 'DEBIT', amount: 50000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' },
      { type: 'DEBIT', amount: 100000, date: '2026-05-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }
    ];
    const res = calculateLedger(txns, { interestRatePerYear: 12, rateUnit: 'yearly', interestType: 'compound' }, '2026-07-01');
    expect(res.breakdownLog).toHaveLength(2);
    expect(res.breakdownLog[0].interestAccrued).toBe(2030.20);
    expect(res.breakdownLog[1].activePrincipal).toBe(152030.20);
    expect(res.breakdownLog[1].interestAccrued).toBe(3055.81);
    expect(res.totalAccruedInterest).toBe(5086.01);
  });

  test('Execute 150 diverse test cases with exact phase summation verification', () => {
    let passedCount = 0;

    for (let i = 1; i <= 150; i++) {
      let txns = [];
      let asOfDate = '2025-05-01';
      let expectedInterest = 0;
      let options = { interestRatePerYear: 12, rateUnit: 'yearly' };

      if (i <= 30) {
        // Single-phase standard durations
        const rate = (i % 5) + 5; // 5-9%
        const amount = i * 1000;
        txns = [{ type: 'DEBIT', amount, date: '2025-01-01', interestRate: rate, rateUnit: 'yearly' }];
        expectedInterest = Math.round(amount * (rate / 12 / 100) * 4 * 100) / 100;
      } else if (i <= 60) {
        // Multi-phase 3-rate changes
        const amount = 10000 + (i - 30) * 1000;
        txns = [
          { type: 'DEBIT', amount, date: '2025-01-01', interestRate: 6, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2025-03-01', interestRate: 12, rateUnit: 'yearly' },
          { type: 'DEBIT', amount: 0, date: '2025-05-01', interestRate: 18, rateUnit: 'yearly' },
        ];
        asOfDate = '2025-07-01';
        const p1 = amount * (0.06 / 12) * 2;
        const p2 = amount * (0.12 / 12) * 2;
        const p3 = amount * (0.18 / 12) * 2;
        expectedInterest = Math.round((p1 + p2 + p3) * 100) / 100;
      } else if (i <= 90) {
        // Multi-phase Compound Interest with Capitalization
        if (i % 2 === 0) {
          // Benchmark 2-phase compound capitalization
          txns = [
            { type: 'DEBIT', amount: 50000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' },
            { type: 'DEBIT', amount: 100000, date: '2026-05-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }
          ];
          asOfDate = '2026-07-01';
          expectedInterest = 5086.01;
        } else {
          // 2-phase compound rate change (10k @ 12% yr 3m + 6% yr 3m)
          txns = [
            { type: 'DEBIT', amount: 10000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' },
            { type: 'DEBIT', amount: 0, date: '2026-04-01', interestRate: 6, rateUnit: 'yearly', interestType: 'compound' }
          ];
          asOfDate = '2026-07-01';
          expectedInterest = 458.33;
        }
      } else if (i <= 110) {
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
      } else if (i <= 135) {
        // Advance & Settlement Waterfall
        txns = [
          { type: 'CREDIT', amount: 5000, date: '2025-01-01' },
          { type: 'DEBIT', amount: 2000, date: '2025-02-01' },
        ];
        asOfDate = '2025-05-01';
        expectedInterest = 0.00;
      } else {
        // Edge cases (Leap years, Voided, Rate unit variations)
        if (i % 2 === 0) {
          txns = [{ type: 'DEBIT', amount: 3000, date: '2024-02-28' }];
          asOfDate = '2024-03-01';
          options = { interestRatePerMonth: 2, rateUnit: 'monthly' };
          expectedInterest = 4.14;
        } else {
          txns = [
            { type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 6, rateUnit: 'p.a.' }
          ];
          asOfDate = '2025-05-01';
          expectedInterest = 200.00;
        }
      }

      const res = calculateLedger(txns, options, asOfDate);
      const phaseSum = Math.round(res.breakdownLog.reduce((s, p) => s + (p.interestAccrued || 0), 0) * 100) / 100;

      expect(res.totalAccruedInterest).toBe(phaseSum);
      expect(res.totalAccruedInterest).toBe(expectedInterest);
      passedCount++;
    }

    expect(passedCount).toBe(150);
  });

});
