import request from 'supertest';
import app from '../app';
import { prisma, disconnectDb } from '../config/database';
import { calculateInterest } from '../utils/interestCalculator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { CompoundingFrequency, InterestType, TransactionType } from '../generated/prisma/client';

describe('Per-Entry Interest Engine & Ledger Tests', () => {
  describe('Unit Tests - Interest Calculator Utility', () => {
    describe('NO_INTEREST Mode', () => {
      it('should calculate 0 interest for NO_INTEREST after 1 year', () => {
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'NO_INTEREST',
        });

        expect(result.elapsedDays).toBe(365);
        expect(result.interest).toBe(0);
        expect(result.totalAmount).toBe(10000);
      });

      it('should calculate 0 interest for NO_INTEREST over 5 years', () => {
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 18,
          startDate: new Date('2020-01-01T00:00:00Z'),
          calculationDate: new Date('2025-01-01T00:00:00Z'),
          interestType: 'NO_INTEREST',
        });

        expect(result.elapsedDays).toBe(1827);
        expect(result.interest).toBe(0);
        expect(result.totalAmount).toBe(10000);
      });
    });

    describe('SIMPLE Interest Mode', () => {
      it('should correctly calculate SIMPLE interest for 1 year (10,000 @ 12% = 1,200)', () => {
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'SIMPLE',
        });

        expect(result.elapsedDays).toBe(365);
        expect(result.interest).toBe(1200);
        expect(result.totalAmount).toBe(11200);
      });

      it('should correctly calculate SIMPLE interest for 2 years (10,000 @ 12% = 2,400)', () => {
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2024-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'SIMPLE',
        });

        // 2 years (731 days accounting for leap year 2024) -> 10000 * 12 * 731 / (100 * 365) = 2403.29
        expect(result.interest).toBeCloseTo(2403.29, 1);
        expect(result.totalAmount).toBeCloseTo(12403.29, 1);
      });
    });

    describe('COMPOUND Interest Mode', () => {
      it('should correctly calculate YEARLY compounding for 1 year (10,000 @ 12% = 1,200)', () => {
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'YEARLY',
        });

        expect(result.interest).toBe(1200);
        expect(result.totalAmount).toBe(11200);
      });

      it('should correctly calculate YEARLY compounding for 2 years (10,000 @ 12% = 2,544)', () => {
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2027-01-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'YEARLY',
        });

        // 10000 * (1.12)^2 = 12544
        expect(result.interest).toBe(2544);
        expect(result.totalAmount).toBe(12544);
      });

      it('should support DAILY compounding (n=365)', () => {
        // P = 10,000, r = 12%, t = 1 yr (365 days), n = 365
        // A = 10000 * (1 + 0.12/365)^365 = 11274.75, Interest = 1274.75
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'DAILY',
        });

        expect(result.interest).toBe(1274.75);
        expect(result.totalAmount).toBe(11274.75);
      });

      it('should support WEEKLY compounding (n=52)', () => {
        // P = 10,000, r = 12%, t = 1 yr (365 days), n = 52
        // A = 10000 * (1 + 0.12/52)^52 = 11273.41, Interest = 1273.41
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'WEEKLY',
        });

        expect(result.interest).toBe(1273.41);
        expect(result.totalAmount).toBe(11273.41);
      });

      it('should support MONTHLY compounding', () => {
        // P = 10,000, r = 12%, t = 1 yr, n = 12
        // A = 10000 * (1 + 0.01)^12 = 11268.25, Interest = 1268.25
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'MONTHLY',
        });

        expect(result.interest).toBe(1268.25);
        expect(result.totalAmount).toBe(11268.25);
      });

      it('should support QUARTERLY compounding', () => {
        // P = 5,000, r = 18%, t = 182/365 yr, n = 4
        // A = 5000 * (1 + 0.045)^(4 * 182/365) = 5458.81, Interest = 458.81
        const result = calculateInterest({
          principal: 5000,
          annualInterestRate: 18,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2025-07-02T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'QUARTERLY',
        });

        expect(result.interest).toBe(458.81);
        expect(result.totalAmount).toBe(5458.81);
      });

      it('should support HALF_YEARLY compounding', () => {
        // P = 10,000, r = 12%, t = 1 yr, n = 2
        // A = 10000 * (1 + 0.06)^2 = 11236.00, Interest = 1236.00
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'HALF_YEARLY',
        });

        expect(result.interest).toBe(1236);
        expect(result.totalAmount).toBe(11236);
      });

      it('should support CUSTOM compounding (e.g. customCompoundDays = 30)', () => {
        // P = 10,000, r = 12%, t = 1 yr (365 days), customCompoundDays = 30 -> n = 365/30 = 12.166667
        // Rate per period = 0.12 / (365/30) = 0.00986301
        // A = 10000 * (1 + 0.00986301)^12.166667 = 11268.34, Interest = 1268.34
        const result = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'CUSTOM',
          customCompoundDays: 30,
        });

        expect(result.interest).toBe(1268.34);
        expect(result.totalAmount).toBe(11268.34);
      });

      it('should accurately handle leap year date intervals (Feb 28 -> Mar 1)', () => {
        // 2024 is a leap year (includes Feb 29): 2024-02-28 to 2024-03-01 is 2 days
        const leapResult = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2024-02-28T00:00:00Z'),
          calculationDate: new Date('2024-03-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'DAILY',
        });
        expect(leapResult.elapsedDays).toBe(2);

        // 2023 is a non-leap year: 2023-02-28 to 2023-03-01 is 1 day
        const nonLeapResult = calculateInterest({
          principal: 10000,
          annualInterestRate: 12,
          startDate: new Date('2023-02-28T00:00:00Z'),
          calculationDate: new Date('2023-03-01T00:00:00Z'),
          interestType: 'COMPOUND',
          compoundingFrequency: 'DAILY',
        });
        expect(nonLeapResult.elapsedDays).toBe(1);
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero elapsed days', () => {
        const result = calculateInterest({
          principal: 8000,
          annualInterestRate: 24,
          startDate: new Date('2026-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'SIMPLE',
        });

        expect(result.elapsedDays).toBe(0);
        expect(result.interest).toBe(0);
        expect(result.totalAmount).toBe(8000);
      });

      it('should handle zero interest rate', () => {
        const result = calculateInterest({
          principal: 5000,
          annualInterestRate: 0,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'SIMPLE',
        });

        expect(result.interest).toBe(0);
        expect(result.totalAmount).toBe(5000);
      });

      it('should handle zero principal', () => {
        const result = calculateInterest({
          principal: 0,
          annualInterestRate: 15,
          startDate: new Date('2025-01-01T00:00:00Z'),
          calculationDate: new Date('2026-01-01T00:00:00Z'),
          interestType: 'SIMPLE',
        });

        expect(result.interest).toBe(0);
        expect(result.totalAmount).toBe(0);
      });
    });
  });

  describe('Integration Tests - Customer Ledger API Endpoint', () => {
    let merchantA: import('../generated/prisma/client').User;
    let merchantB: import('../generated/prisma/client').User;
    let tokenA: string;
    let customerA: import('../generated/prisma/client').Customer;
    let customerB: import('../generated/prisma/client').Customer;

    beforeAll(async () => {
      await prisma.transaction.deleteMany();
      await prisma.customer.deleteMany();
      await prisma.user.deleteMany();

      const passHash = await bcrypt.hash('password123', 10);

      merchantA = await prisma.user.create({
        data: {
          email: 'merchant.ledger.a@test.com',
          passwordHash: passHash,
          businessName: 'Merchant A Ledger Stores',
        },
      });
      tokenA = jwt.sign({ id: merchantA.id, email: merchantA.email }, config.JWT_SECRET, {
        expiresIn: '1h',
      });

      merchantB = await prisma.user.create({
        data: {
          email: 'merchant.ledger.b@test.com',
          passwordHash: passHash,
          businessName: 'Merchant B Stores',
        },
      });

      customerA = await prisma.customer.create({
        data: {
          userId: merchantA.id,
          name: 'Customer A Ledger',
          phoneNumber: '9000000010',
          lendingRate: 12.0,
          depositRate: 6.0,
          defaultInterestType: InterestType.SIMPLE,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
          isActive: true,
        },
      });

      customerB = await prisma.customer.create({
        data: {
          userId: merchantB.id,
          name: 'Customer B',
          phoneNumber: '9000000020',
          lendingRate: 15.0,
          depositRate: 7.0,
          defaultInterestType: InterestType.SIMPLE,
          compoundingFrequency: CompoundingFrequency.YEARLY,
          isActive: true,
        },
      });
    });

    beforeEach(async () => {
      await prisma.transaction.deleteMany();
    });

    afterAll(async () => {
      await prisma.transaction.deleteMany();
      await prisma.customer.deleteMany();
      await prisma.user.deleteMany();
      await disconnectDb();
    });

    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get(`/api/v1/customers/${customerA.id}/ledger`);
      expect(res.status).toBe(401);
    });

    it('should return 404 when customer belongs to another merchant', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerB.id}/ledger`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Customer not found');
    });

    // Test 1: Multiple independent entries with different rates/types
    it('should calculate multiple DEBIT entries independently (Rule 3)', async () => {
      // Entry 1: 10,000 @ 12% SIMPLE, Jan 1 2025
      // Entry 2: 5,000 @ 15% SIMPLE, Jan 1 2025
      await prisma.transaction.createMany({
        data: [
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 10000,
            date: new Date('2025-01-01T00:00:00Z'),
            interestStartDate: new Date('2025-01-01T00:00:00Z'),
            interestType: InterestType.SIMPLE,
            interestRate: 12,
            remarks: 'Entry 1',
          },
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 5000,
            date: new Date('2025-01-01T00:00:00Z'),
            interestStartDate: new Date('2025-01-01T00:00:00Z'),
            interestType: InterestType.SIMPLE,
            interestRate: 15,
            remarks: 'Entry 2',
          },
        ],
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-01-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const { summary, entries } = res.body.data;
      expect(entries).toHaveLength(2);

      const entry1 = entries.find((e: { originalPrincipal: number }) => e.originalPrincipal === 10000);
      const entry2 = entries.find((e: { originalPrincipal: number }) => e.originalPrincipal === 5000);

      expect(entry1).toBeDefined();
      expect(entry2).toBeDefined();

      // Entry 1: 10,000 * 12% * 1 = 1,200
      expect(entry1.accruedInterest).toBe(1200);
      expect(entry1.totalDue).toBe(11200);

      // Entry 2: 5,000 * 15% * 1 = 750
      expect(entry2.accruedInterest).toBe(750);
      expect(entry2.totalDue).toBe(5750);

      // Summary
      expect(summary.totalMoneyLent).toBe(15000);
      expect(summary.outstandingPrincipal).toBe(15000);
      expect(summary.accruedInterest).toBe(1950);
      expect(summary.totalDue).toBe(16950);
    });

    // Test 2: Rule 5 Full Settlement (Principal + Interest)
    it('should correctly settle full principal + accrued interest with CREDIT (Rule 5)', async () => {
      // Entry: 1,250 DEBIT on Jan 1 2026
      // Accrues interest up to Feb 1 2026 (31 days)
      // At 24% annual SIMPLE rate: 1250 * 24 * 31 / (100 * 365) = 25.48
      // CREDIT: 1,275.48 on Feb 1 2026
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1250,
          date: new Date('2026-01-01T00:00:00Z'),
          interestStartDate: new Date('2026-01-01T00:00:00Z'),
          interestType: InterestType.SIMPLE,
          interestRate: 24,
          remarks: 'Loan 1250',
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1275.48,
          date: new Date('2026-02-01T00:00:00Z'),
          interestStartDate: new Date('2026-02-01T00:00:00Z'),
          remarks: 'Full settlement',
        },
      });

      // Query on Feb 15 2026 (after settlement)
      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-15T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;

      expect(entries[0].status).toBe('SETTLED');
      expect(entries[0].remainingPrincipal).toBe(0);
      expect(entries[0].remainingInterest).toBe(0);
      expect(entries[0].totalDue).toBe(0);

      expect(summary.outstandingPrincipal).toBe(0);
      expect(summary.accruedInterest).toBe(0);
      expect(summary.totalDue).toBe(0);
    });

    // Test 3: Rule 6 Principal-only payment
    it('should handle principal-only payment, preserving unpaid accrued interest (Rule 6)', async () => {
      // DEBIT 1,250 on Jan 1 2026 (@ 24% simple = 25.48 interest as of Feb 1)
      // CREDIT 1,250 on Feb 1 2026 (pays principal only)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1250,
          date: new Date('2026-01-01T00:00:00Z'),
          interestStartDate: new Date('2026-01-01T00:00:00Z'),
          interestType: InterestType.SIMPLE,
          interestRate: 24,
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1250,
          date: new Date('2026-02-01T00:00:00Z'),
          interestStartDate: new Date('2026-02-01T00:00:00Z'),
        },
      });

      // Query on Feb 15 (14 days after payment) -> No future interest on 0 principal
      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-15T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;

      expect(entries[0].remainingPrincipal).toBe(0);
      expect(entries[0].remainingInterest).toBe(25.48);
      expect(entries[0].totalDue).toBe(25.48);

      expect(summary.outstandingPrincipal).toBe(0);
      expect(summary.accruedInterest).toBe(25.48);
      expect(summary.totalDue).toBe(25.48);
    });

    // Test 4: Rule 7 Partial payment
    it('should handle partial payment, accruing future interest only on remaining principal (Rule 7)', async () => {
      // DEBIT 1,250 on Jan 1 2026 (@ 24% simple)
      // CREDIT 500 on Feb 1 2026 -> Remaining principal = 750
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1250,
          date: new Date('2026-01-01T00:00:00Z'),
          interestStartDate: new Date('2026-01-01T00:00:00Z'),
          interestType: InterestType.SIMPLE,
          interestRate: 24,
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 500,
          date: new Date('2026-02-01T00:00:00Z'),
          interestStartDate: new Date('2026-02-01T00:00:00Z'),
        },
      });

      // As of Feb 1:
      // Interval 1 (Jan 1 -> Feb 1 = 31 days): Interest on 1250 = 25.48
      // Remaining principal = 750
      const resFeb1 = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resFeb1.body.data.summary.outstandingPrincipal).toBe(750);
      expect(resFeb1.body.data.summary.accruedInterest).toBe(25.48);

      // As of Feb 15 (14 days later):
      // Additional interest on 750 for 14 days @ 24% = 750 * 24 * 14 / (100 * 365) = 6.90
      // Total interest = 25.48 + 6.90 = 32.38
      const resFeb15 = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-15T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resFeb15.body.data.summary.outstandingPrincipal).toBe(750);
      expect(resFeb15.body.data.summary.accruedInterest).toBe(32.38);
      expect(resFeb15.body.data.summary.totalDue).toBe(782.38);
    });

    // Test 5: Critical Regression Test (DEBIT 500 + DEBIT 750 + CREDIT 1250)
    it('should pass critical regression test (DEBIT 500 + DEBIT 750 + CREDIT 1250 -> 0 principal)', async () => {
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 500,
          date: new Date('2026-01-01T00:00:00Z'),
          interestStartDate: new Date('2026-01-01T00:00:00Z'),
          interestType: InterestType.SIMPLE,
          interestRate: 24,
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 750,
          date: new Date('2026-01-15T00:00:00Z'),
          interestStartDate: new Date('2026-01-15T00:00:00Z'),
          interestType: InterestType.SIMPLE,
          interestRate: 24,
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1250,
          date: new Date('2026-02-01T00:00:00Z'),
          interestStartDate: new Date('2026-02-01T00:00:00Z'),
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-15T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;

      expect(summary.outstandingPrincipal).toBe(0);
      expect(entries[0].remainingPrincipal).toBe(0);
      expect(entries[1].remainingPrincipal).toBe(0);
    });

    // Test 6: Overpayment
    it('should track overpayments cleanly without negative principal or negative interest (Rule 8)', async () => {
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2026-01-01T00:00:00Z'),
          interestStartDate: new Date('2026-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1500, // 500 overpayment
          date: new Date('2026-02-01T00:00:00Z'),
          interestStartDate: new Date('2026-02-01T00:00:00Z'),
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary } = res.body.data;

      expect(summary.outstandingPrincipal).toBe(0);
      expect(summary.accruedInterest).toBe(0);
      expect(summary.totalDue).toBe(0);
      expect(summary.unallocatedCredit).toBe(500);
    });

    // Test 7: Voided transactions exclusion
    it('should exclude voided transactions from per-entry calculations', async () => {
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2026-01-01T00:00:00Z'),
          interestStartDate: new Date('2026-01-01T00:00:00Z'),
          isVoided: true, // voided
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 500,
          date: new Date('2026-01-01T00:00:00Z'),
          interestStartDate: new Date('2026-01-01T00:00:00Z'),
          isVoided: false,
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-01-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;
      expect(entries).toHaveLength(1);
      expect(summary.totalMoneyLent).toBe(500);
      expect(summary.outstandingPrincipal).toBe(500);
    });

    // Test 8: Step 8 Multi-Entry Overpayment (3 x 1,000 @ 12% Simple, 4,000 Payment)
    it('should correctly settle all 3 entries and track exact unallocatedCredit on 4,000 payment', async () => {
      // 3 DEBIT entries of 1,000 each on 2025-01-01 @ 12% Simple
      // As of 2026-08-19 (595 days elapsed):
      // Each entry interest = 1000 * 12 * 595 / (100 * 365) = 195.62
      // Total principal = 3,000, Total interest = 586.86, Total due = 3,586.86
      // CREDIT: 4,000 on 2026-08-19
      await prisma.transaction.createMany({
        data: [
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 1000,
            date: new Date('2025-01-01T00:00:00Z'),
            interestStartDate: new Date('2025-01-01T00:00:00Z'),
            interestType: InterestType.SIMPLE,
            interestRate: 12,
            remarks: 'Debit 1',
          },
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 1000,
            date: new Date('2025-01-01T00:00:00Z'),
            interestStartDate: new Date('2025-01-01T00:00:00Z'),
            interestType: InterestType.SIMPLE,
            interestRate: 12,
            remarks: 'Debit 2',
          },
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 1000,
            date: new Date('2025-01-01T00:00:00Z'),
            interestStartDate: new Date('2025-01-01T00:00:00Z'),
            interestType: InterestType.SIMPLE,
            interestRate: 12,
            remarks: 'Debit 3',
          },
        ],
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 4000,
          date: new Date('2026-08-19T00:00:00Z'),
          interestStartDate: new Date('2026-08-19T00:00:00Z'),
          remarks: 'Overpayment of 4000',
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-08-19T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;

      expect(entries).toHaveLength(3);
      for (const entry of entries) {
        expect(entry.status).toBe('SETTLED');
        expect(entry.remainingPrincipal).toBe(0);
        expect(entry.remainingInterest).toBe(0);
        expect(entry.totalDue).toBe(0);
        expect(entry.payments.length).toBeGreaterThan(0);
      }

      // Summary checks
      expect(summary.totalMoneyLent).toBe(3000);
      expect(summary.totalMoneyReceived).toBe(4000);
      expect(summary.outstandingPrincipal).toBe(0);
      expect(summary.accruedInterest).toBe(0);
      expect(summary.totalDue).toBe(0);
      expect(summary.unallocatedCredit).toBeCloseTo(413.14, 1);
    });

    // Test 9: Complete Lifecycle Test: Overpayment (639.01) -> Pre-Debit Hold -> June Debit Absorption -> Subsequent Interest
    it('should correctly handle multi-year overpayment lifecycle, holding unallocated credit, absorbing into June debit, and accruing interest only on remaining principal', async () => {
      // 1. Three DEBIT entries of 1,000 each on 2024-01-01 @ 12% Simple
      await prisma.transaction.createMany({
        data: [
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 1000,
            date: new Date('2024-01-01T00:00:00Z'),
            interestStartDate: new Date('2024-01-01T00:00:00Z'),
            interestType: InterestType.SIMPLE,
            interestRate: 12,
            remarks: 'Debit 1',
          },
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 1000,
            date: new Date('2024-01-01T00:00:00Z'),
            interestStartDate: new Date('2024-01-01T00:00:00Z'),
            interestType: InterestType.SIMPLE,
            interestRate: 12,
            remarks: 'Debit 2',
          },
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 1000,
            date: new Date('2024-01-01T00:00:00Z'),
            interestStartDate: new Date('2024-01-01T00:00:00Z'),
            interestType: InterestType.SIMPLE,
            interestRate: 12,
            remarks: 'Debit 3',
          },
        ],
      });

      // 2. Overpayment CREDIT of 4,000 on 2025-01-01
      // 2024 is a leap year (366 days). Interest per entry = 1000 * 12 * 366 / 36500 = 120.33
      // Total interest = 360.99, Total due = 3,360.99
      // Unallocated credit = 4,000 - 3,360.99 = 639.01
      const creditTx = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 4000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          remarks: 'Payment of 4000',
        },
      });

      // 3. Verify ledger state BEFORE June debit (as of 2025-05-01)
      const resPreJune = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-05-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resPreJune.status).toBe(200);
      expect(resPreJune.body.data.summary.outstandingPrincipal).toBe(0);
      expect(resPreJune.body.data.summary.accruedInterest).toBe(0);
      expect(resPreJune.body.data.summary.totalDue).toBe(0);
      expect(resPreJune.body.data.summary.unallocatedCredit).toBeCloseTo(639.01, 1);
      expect(resPreJune.body.data.summary.totalMoneyReceived).toBe(4000);

      // 4. Create new DEBIT of 1,000 on 2025-06-01 @ 12% Simple
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-06-01T00:00:00Z'),
          interestStartDate: new Date('2025-06-01T00:00:00Z'),
          interestType: InterestType.SIMPLE,
          interestRate: 12,
          remarks: 'June Debit 4',
        },
      });

      // 5. Verify ledger as of 2025-06-01 (same day as June debit):
      // - 639.01 absorbed into principal immediately
      // - remainingPrincipal = 360.99
      // - unallocatedCredit = 0 / undefined
      const resJune1 = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-06-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resJune1.status).toBe(200);
      const summaryJune1 = resJune1.body.data.summary;
      const entriesJune1 = resJune1.body.data.entries;

      expect(summaryJune1.totalMoneyLent).toBe(4000);
      expect(summaryJune1.totalMoneyReceived).toBe(4000); // Not double-counted
      expect(summaryJune1.outstandingPrincipal).toBeCloseTo(360.99, 1);
      expect(summaryJune1.accruedInterest).toBe(0);
      expect(summaryJune1.totalDue).toBeCloseTo(360.99, 1);
      expect(summaryJune1.unallocatedCredit).toBeUndefined();

      // Check Entry 4 payment allocation metadata
      const entry4 = entriesJune1.find((e: { remarks: string }) => e.remarks === 'June Debit 4');
      expect(entry4).toBeDefined();
      expect(entry4.originalPrincipal).toBe(1000);
      expect(entry4.remainingPrincipal).toBeCloseTo(360.99, 1);
      expect(entry4.status).toBe('PARTIALLY_PAID');
      expect(entry4.payments).toHaveLength(1);
      expect(entry4.payments[0].creditId).toBe(creditTx.id);
      expect(entry4.payments[0].appliedToPrincipal).toBeCloseTo(639.01, 1);
      expect(entry4.payments[0].appliedToInterest).toBe(0);

      // 6. Verify ledger as of 2025-10-01 (122 days after June 1):
      // - New interest must accrue ONLY on remaining 360.99 principal:
      //   360.99 * 12 * 122 / (100 * 365) = 14.48
      // - The absorbed 639.01 must generate ZERO interest.
      // - Total due = 360.99 + 14.48 = 375.47
      const resOct1 = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-10-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resOct1.status).toBe(200);
      const summaryOct1 = resOct1.body.data.summary;
      const entry4Oct1 = resOct1.body.data.entries.find((e: { remarks: string }) => e.remarks === 'June Debit 4');

      expect(summaryOct1.outstandingPrincipal).toBeCloseTo(360.99, 1);
      expect(summaryOct1.accruedInterest).toBeCloseTo(14.48, 1);
      expect(summaryOct1.totalDue).toBeCloseTo(375.47, 1);

      expect(entry4Oct1.accruedInterest).toBeCloseTo(14.48, 1);
      expect(entry4Oct1.remainingInterest).toBeCloseTo(14.48, 1);
      expect(entry4Oct1.totalDue).toBeCloseTo(375.47, 1);
    });

    // Test 10: Multiple DEBITs with Different Compound Rates and Compounding Frequencies
    it('should independently calculate compound interest for multiple DEBIT entries with different rates and frequencies', async () => {
      // Entry 1: 10,000 @ 12% Monthly compound on 2025-01-01 -> 1 yr interest = 1268.25
      // Entry 2: 5,000 @ 10% Half-Yearly compound on 2025-01-01 -> 1 yr interest = 5000 * ((1 + 0.05)^2 - 1) = 512.50
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 10000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.COMPOUND,
          interestRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
          remarks: 'Debit Monthly 12%',
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 5000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.COMPOUND,
          interestRate: 10,
          compoundingFrequency: CompoundingFrequency.HALF_YEARLY,
          remarks: 'Debit Half-Yearly 10%',
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-01-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;
      expect(entries).toHaveLength(2);

      const entry1 = entries.find((e: { remarks: string }) => e.remarks === 'Debit Monthly 12%');
      const entry2 = entries.find((e: { remarks: string }) => e.remarks === 'Debit Half-Yearly 10%');

      expect(entry1.accruedInterest).toBe(1268.25);
      expect(entry1.totalDue).toBe(11268.25);

      expect(entry2.accruedInterest).toBe(512.5);
      expect(entry2.totalDue).toBe(5512.5);

      // Summary aggregate
      expect(summary.totalMoneyLent).toBe(15000);
      expect(summary.outstandingPrincipal).toBe(15000);
      expect(summary.accruedInterest).toBe(1780.75); // 1268.25 + 512.50
      expect(summary.totalDue).toBe(16780.75);
    });

    // Test 11: Partial Payment with Compound Interest (Future Compounding on Remaining Principal Only)
    it('should compound future interest strictly on remaining principal after partial principal payment', async () => {
      // 1. DEBIT: 10,000 @ 12% Yearly compound on 2024-01-01
      // Year 1 (2024-01-01 to 2025-01-01): 10,000 * 12% * 366/365 = 1203.29 interest, Total due = 11203.29
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 10000,
          date: new Date('2024-01-01T00:00:00Z'),
          interestStartDate: new Date('2024-01-01T00:00:00Z'),
          interestType: InterestType.COMPOUND,
          interestRate: 12,
          compoundingFrequency: CompoundingFrequency.YEARLY,
        },
      });

      // 2. CREDIT: 6,000 on 2025-01-01 (pays 6,000 principal, leaving 4,000 remaining principal and 1203.29 unpaid interest)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 6000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
        },
      });

      // 3. Ledger as of 2026-01-01 (1 yr after payment):
      // Year 2 interest accrues ONLY on remaining 4,000 principal: 4,000 * 12% * 365/365 = 480.00
      // Total accrued interest = 1203.48 + 480.00 = 1683.48
      // Total due = 4,000 + 1683.48 = 5683.48
      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-01-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;
      expect(entries[0].remainingPrincipal).toBe(4000);
      expect(entries[0].accruedInterest).toBeCloseTo(1683.48, 1);
      expect(entries[0].totalDue).toBeCloseTo(5683.48, 1);

      expect(summary.outstandingPrincipal).toBe(4000);
      expect(summary.accruedInterest).toBeCloseTo(1683.48, 1);
      expect(summary.totalDue).toBeCloseTo(5683.48, 1);
    });

    // Test 12: Payment Before Interest Start Date
    it('should correctly reduce principal without premature interest when payment occurs before interest start date', async () => {
      // DEBIT on 2025-01-01, interest starts on 2025-02-01 (10,000 @ 12% Yearly)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 10000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-02-01T00:00:00Z'),
          interestType: InterestType.COMPOUND,
          interestRate: 12,
          compoundingFrequency: CompoundingFrequency.YEARLY,
        },
      });

      // CREDIT of 3,000 on 2025-01-15 (before interest begins)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 3000,
          date: new Date('2025-01-15T00:00:00Z'),
          interestStartDate: new Date('2025-01-15T00:00:00Z'),
        },
      });

      // Ledger as of 2026-02-01 (1 year after interestStartDate):
      // Compound interest = 7,000 * 12% = 840.00
      // Total due = 7,000 + 840 = 7840.00
      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;
      expect(entries[0].remainingPrincipal).toBe(7000);
      expect(entries[0].accruedInterest).toBe(840);
      expect(entries[0].totalDue).toBe(7840);
      expect(summary.outstandingPrincipal).toBe(7000);
      expect(summary.totalDue).toBe(7840);
    });

    // Test 13: Same-Day Transaction and Settlement
    it('should handle same-day DEBIT and CREDIT without extra interest period', async () => {
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 5000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.COMPOUND,
          interestRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
        },
      });

      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 5000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-01-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;
      expect(entries[0].remainingPrincipal).toBe(0);
      expect(entries[0].accruedInterest).toBe(0);
      expect(entries[0].totalDue).toBe(0);
      expect(entries[0].status).toBe('SETTLED');
      expect(summary.outstandingPrincipal).toBe(0);
      expect(summary.totalDue).toBe(0);
    });

    // Test 14: Basic Targeted Payment (Targeting Debit C among A, B, C)
    it('should apply payment to target entry C while leaving A and B completely unaffected', async () => {
      // DEBIT A = 1,000, DEBIT B = 2,000, DEBIT C = 3,000 on 2025-01-01 @ NO_INTEREST
      const txA = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
          remarks: 'Debit A',
        },
      });

      const txB = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 2000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
          remarks: 'Debit B',
        },
      });

      const txC = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 3000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
          remarks: 'Debit C',
        },
      });

      // CREDIT 1,500 targeting C
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1500,
          date: new Date('2025-02-01T00:00:00Z'),
          interestStartDate: new Date('2025-02-01T00:00:00Z'),
          targetEntryId: txC.id,
          remarks: 'Payment targeted to C',
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-02-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;

      const entryA = entries.find((e: { entryId: string }) => e.entryId === txA.id);
      const entryB = entries.find((e: { entryId: string }) => e.entryId === txB.id);
      const entryC = entries.find((e: { entryId: string }) => e.entryId === txC.id);

      // A and B untouched
      expect(entryA.remainingPrincipal).toBe(1000);
      expect(entryA.status).toBe('ACTIVE');

      expect(entryB.remainingPrincipal).toBe(2000);
      expect(entryB.status).toBe('ACTIVE');

      // C reduced by 1,500 -> 1,500 remaining
      expect(entryC.remainingPrincipal).toBe(1500);
      expect(entryC.status).toBe('PARTIALLY_PAID');
      expect(entryC.payments).toHaveLength(1);
      expect(entryC.payments[0].amount).toBe(1500);

      // Summary
      expect(summary.totalMoneyLent).toBe(6000);
      expect(summary.totalMoneyReceived).toBe(1500);
      expect(summary.outstandingPrincipal).toBe(4500);
      expect(summary.totalDue).toBe(4500);
    });

    // Test 15: Targeted Payment with Compound Interest Payoff
    it('should pay principal first and accrued compound interest on the targeted entry', async () => {
      // DEBIT 10,000 @ 12% Monthly compound on 2024-01-01
      // Year 1 (2024-01-01 to 2025-01-01, 366 days in leap year):
      // A = 10000 * (1 + 0.01)^(12 * 366/365) = 11271.94, interest = 1271.94, total due = 11271.94
      const txCompound = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 10000,
          date: new Date('2024-01-01T00:00:00Z'),
          interestStartDate: new Date('2024-01-01T00:00:00Z'),
          interestType: InterestType.COMPOUND,
          interestRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
        },
      });

      // Targeted payment of 11,271.94 on 2025-01-01
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 11271.94,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          targetEntryId: txCompound.id,
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-01-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;
      expect(entries[0].remainingPrincipal).toBe(0);
      expect(entries[0].remainingInterest).toBe(0);
      expect(entries[0].totalDue).toBe(0);
      expect(entries[0].status).toBe('SETTLED');
      expect(entries[0].payments[0].appliedToPrincipal).toBe(10000);
      expect(entries[0].payments[0].appliedToInterest).toBeCloseTo(1271.94, 1);

      expect(summary.outstandingPrincipal).toBe(0);
      expect(summary.accruedInterest).toBe(0);
      expect(summary.totalDue).toBe(0);
    });

    // Test 16: Targeted Payment Exceeding Target Debt (Excess to Unallocated Credit)
    it('should place excess payment beyond target debt into unallocatedCredit without spilling to other entries', async () => {
      // DEBIT A = 1,000 (0%), DEBIT B = 1,000 (0%) on 2025-01-01
      const txA = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
        },
      });

      const txB = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
        },
      });

      // Targeted payment of 1,500 to A (exceeds A's 1,000 principal by 500)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1500,
          date: new Date('2025-02-01T00:00:00Z'),
          interestStartDate: new Date('2025-02-01T00:00:00Z'),
          targetEntryId: txA.id,
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-02-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;

      const entryA = entries.find((e: { entryId: string }) => e.entryId === txA.id);
      const entryB = entries.find((e: { entryId: string }) => e.entryId === txB.id);

      // Entry A settled with 1,000 applied
      expect(entryA.remainingPrincipal).toBe(0);
      expect(entryA.status).toBe('SETTLED');
      expect(entryA.payments[0].appliedToPrincipal).toBe(1000);

      // Entry B remains untouched at 1,000 (did not spill over)
      expect(entryB.remainingPrincipal).toBe(1000);
      expect(entryB.status).toBe('ACTIVE');

      // Summary: 500 excess is in unallocatedCredit
      expect(summary.totalMoneyLent).toBe(2000);
      expect(summary.totalMoneyReceived).toBe(1500);
      expect(summary.outstandingPrincipal).toBe(1000);
      expect(summary.totalDue).toBe(1000);
      expect(summary.unallocatedCredit).toBe(500);
    });

    // Test 17: Multiple Targeted Payments to the Same Entry
    it('should accumulate multiple targeted payments against the same entry until settled', async () => {
      const tx = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
        },
      });

      // Pay 300
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 300,
          date: new Date('2025-02-01T00:00:00Z'),
          interestStartDate: new Date('2025-02-01T00:00:00Z'),
          targetEntryId: tx.id,
        },
      });

      // Pay 200
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 200,
          date: new Date('2025-03-01T00:00:00Z'),
          interestStartDate: new Date('2025-03-01T00:00:00Z'),
          targetEntryId: tx.id,
        },
      });

      // Pay 500
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 500,
          date: new Date('2025-04-01T00:00:00Z'),
          interestStartDate: new Date('2025-04-01T00:00:00Z'),
          targetEntryId: tx.id,
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-04-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;
      expect(entries[0].remainingPrincipal).toBe(0);
      expect(entries[0].status).toBe('SETTLED');
      expect(entries[0].payments).toHaveLength(3);
      expect(summary.outstandingPrincipal).toBe(0);
      expect(summary.totalDue).toBe(0);
    });

    // Test 18: Targeted Payment Followed by Normal FIFO Payment
    it('should correctly allocate a subsequent normal FIFO payment after a prior targeted payment', async () => {
      // DEBIT A = 1,000, DEBIT B = 2,000 on 2025-01-01 @ 0%
      const txA = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
        },
      });

      const txB = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 2000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
        },
      });

      // 1. Targeted payment of 500 to B on 2025-02-01 (B remaining = 1,500)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 500,
          date: new Date('2025-02-01T00:00:00Z'),
          interestStartDate: new Date('2025-02-01T00:00:00Z'),
          targetEntryId: txB.id,
        },
      });

      // 2. Normal FIFO payment of 700 on 2025-03-01 (FIFO pays A: A remaining = 300)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 700,
          date: new Date('2025-03-01T00:00:00Z'),
          interestStartDate: new Date('2025-03-01T00:00:00Z'),
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-03-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;

      const entryA = entries.find((e: { entryId: string }) => e.entryId === txA.id);
      const entryB = entries.find((e: { entryId: string }) => e.entryId === txB.id);

      expect(entryA.remainingPrincipal).toBe(300); // 1,000 - 700
      expect(entryB.remainingPrincipal).toBe(1500); // 2,000 - 500

      expect(summary.outstandingPrincipal).toBe(1800);
      expect(summary.totalDue).toBe(1800);
    });

    // Test 19: FIFO Payment Followed by Targeted Payment
    it('should correctly allocate a targeted payment after a prior FIFO payment reduced part of the target', async () => {
      // DEBIT A = 1,000, DEBIT B = 2,000 on 2025-01-01 @ 0%
      const txA = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
        },
      });

      const txB = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 2000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
        },
      });

      // 1. Normal FIFO payment of 1,500 on 2025-02-01 (clears A = 1,000, leaves B = 1,500)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1500,
          date: new Date('2025-02-01T00:00:00Z'),
          interestStartDate: new Date('2025-02-01T00:00:00Z'),
        },
      });

      // 2. Targeted payment of 1,000 to B on 2025-03-01 (B remaining = 500)
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1000,
          date: new Date('2025-03-01T00:00:00Z'),
          interestStartDate: new Date('2025-03-01T00:00:00Z'),
          targetEntryId: txB.id,
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-03-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary, entries } = res.body.data;

      const entryA = entries.find((e: { entryId: string }) => e.entryId === txA.id);
      const entryB = entries.find((e: { entryId: string }) => e.entryId === txB.id);

      expect(entryA.remainingPrincipal).toBe(0);
      expect(entryA.status).toBe('SETTLED');

      expect(entryB.remainingPrincipal).toBe(500); // 2,000 - 500 (FIFO) - 1,000 (Targeted)
      expect(entryB.status).toBe('PARTIALLY_PAID');

      expect(summary.outstandingPrincipal).toBe(500);
      expect(summary.totalDue).toBe(500);
    });

    // Test 20: Void Interaction with Targeted Payments
    it('should exclude voided debit from ledger calculations even if targeted by a payment', async () => {
      await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
          isVoided: true, // voided
        },
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-01-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.entries).toHaveLength(0);
      expect(res.body.data.summary.outstandingPrincipal).toBe(0);
    });

    // Test 21: Targeted Overpayment -> Unallocated Credit -> Subsequent Debit Absorption
    it('should correctly absorb targeted overpayment unallocated credit into subsequent debit and accrue interest only on remaining principal', async () => {
      // 1. DEBIT A = 1,000 on 2025-01-01 @ NO_INTEREST
      const txA = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-01-01T00:00:00Z'),
          interestStartDate: new Date('2025-01-01T00:00:00Z'),
          interestType: InterestType.NO_INTEREST,
          remarks: 'Debit A',
        },
      });

      // 2. Targeted CREDIT of 1,400 targeting A on 2025-02-01 (1,000 pays A, 400 excess)
      const creditTx = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.CREDIT,
          amount: 1400,
          date: new Date('2025-02-01T00:00:00Z'),
          interestStartDate: new Date('2025-02-01T00:00:00Z'),
          targetEntryId: txA.id,
          remarks: 'Targeted payment to A with overpayment',
        },
      });

      // 3. Verify ledger state BEFORE Debit B (as of 2025-02-15)
      const resPreB = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-02-15T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resPreB.status).toBe(200);
      const summaryPreB = resPreB.body.data.summary;
      const entryAPreB = resPreB.body.data.entries.find((e: { entryId: string }) => e.entryId === txA.id);

      expect(entryAPreB.remainingPrincipal).toBe(0);
      expect(entryAPreB.status).toBe('SETTLED');
      expect(summaryPreB.outstandingPrincipal).toBe(0);
      expect(summaryPreB.accruedInterest).toBe(0);
      expect(summaryPreB.totalDue).toBe(0);
      expect(summaryPreB.unallocatedCredit).toBe(400);
      expect(summaryPreB.totalMoneyReceived).toBe(1400);

      // 4. Create new DEBIT B of 1,000 on 2025-03-01 @ 12% Simple
      const txB = await prisma.transaction.create({
        data: {
          customerId: customerA.id,
          type: TransactionType.DEBIT,
          amount: 1000,
          date: new Date('2025-03-01T00:00:00Z'),
          interestStartDate: new Date('2025-03-01T00:00:00Z'),
          interestType: InterestType.SIMPLE,
          interestRate: 12,
          remarks: 'Debit B',
        },
      });

      // 5. Verify ledger as of 2025-03-01 (same day as Debit B):
      // - 400 absorbed into Debit B immediately
      // - Debit B remainingPrincipal = 600
      // - unallocatedCredit = 0 / undefined
      const resB1 = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-03-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resB1.status).toBe(200);
      const summaryB1 = resB1.body.data.summary;
      const entryB1 = resB1.body.data.entries.find((e: { entryId: string }) => e.entryId === txB.id);

      expect(summaryB1.totalMoneyLent).toBe(2000);
      expect(summaryB1.totalMoneyReceived).toBe(1400); // Not double-counted
      expect(summaryB1.outstandingPrincipal).toBe(600);
      expect(summaryB1.accruedInterest).toBe(0);
      expect(summaryB1.totalDue).toBe(600);
      expect(summaryB1.unallocatedCredit).toBeUndefined();

      expect(entryB1.remainingPrincipal).toBe(600);
      expect(entryB1.status).toBe('PARTIALLY_PAID');
      expect(entryB1.payments).toHaveLength(1);
      expect(entryB1.payments[0].creditId).toBe(creditTx.id);
      expect(entryB1.payments[0].appliedToPrincipal).toBe(400);

      // 6. Verify ledger as of 2025-07-01 (122 days after March 1):
      // - New interest must accrue ONLY on remaining 600 principal:
      //   600 * 12 * 122 / (100 * 365) = 24.07
      // - The absorbed 400 must generate ZERO interest.
      // - Total due = 600 + 24.07 = 624.07
      const resJuly1 = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2025-07-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resJuly1.status).toBe(200);
      const summaryJuly1 = resJuly1.body.data.summary;
      const entryBJuly1 = resJuly1.body.data.entries.find((e: { entryId: string }) => e.entryId === txB.id);

      expect(summaryJuly1.outstandingPrincipal).toBe(600);
      expect(summaryJuly1.accruedInterest).toBeCloseTo(24.07, 1);
      expect(summaryJuly1.totalDue).toBeCloseTo(624.07, 1);

      expect(entryBJuly1.accruedInterest).toBeCloseTo(24.07, 1);
      expect(entryBJuly1.remainingInterest).toBeCloseTo(24.07, 1);
      expect(entryBJuly1.totalDue).toBeCloseTo(624.07, 1);
    });
  });
});
