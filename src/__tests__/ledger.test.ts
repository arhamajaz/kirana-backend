import request from 'supertest';
import app from '../app';
import { prisma, disconnectDb } from '../config/database';
import { calculateInterest } from '../utils/interestCalculator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { CompoundingFrequency, TransactionType } from '../generated/prisma/client';

describe('Phase 1.1 - Running Balance Ledger and Dynamic Interest Tests', () => {
  describe('Unit Tests - Interest Calculator Utility', () => {
    it('should correctly calculate YEARLY compounding interest (Example 1)', () => {
      // Example 1: Principal = 10000, Rate = 12%, Frequency = YEARLY, Time = 1 year (365 days)
      const result = calculateInterest({
        principal: 10000,
        annualInterestRate: 12,
        startDate: new Date('2026-01-01T00:00:00Z'),
        calculationDate: new Date('2027-01-01T00:00:00Z'),
        compoundingFrequency: 'YEARLY',
      });

      expect(result.elapsedDays).toBe(365);
      expect(result.elapsedYears).toBe(1);
      expect(result.interest).toBe(1200);
      expect(result.totalAmount).toBe(11200);
    });

    it('should correctly calculate MONTHLY compounding interest (Example 2)', () => {
      // Example 2: Principal = 10000, Rate = 12%, Frequency = MONTHLY, Time = 1 year
      const result = calculateInterest({
        principal: 10000,
        annualInterestRate: 12,
        startDate: new Date('2026-01-01T00:00:00Z'),
        calculationDate: new Date('2027-01-01T00:00:00Z'),
        compoundingFrequency: 'MONTHLY',
      });

      expect(result.interest).toBe(1268.25);
      expect(result.totalAmount).toBe(11268.25);
    });

    it('should correctly calculate QUARTERLY compounding interest (Example 3)', () => {
      // Example 3: Principal = 5000, Rate = 18%, Frequency = QUARTERLY, Time = 6 months (182 days calendar-wise)
      const result = calculateInterest({
        principal: 5000,
        annualInterestRate: 18,
        startDate: new Date('2026-01-01T00:00:00Z'),
        calculationDate: new Date('2026-07-02T00:00:00Z'),
        compoundingFrequency: 'QUARTERLY',
      });

      // 5000 * (1 + 0.18/4)^(4 * 182/365) = 5458.81
      expect(result.interest).toBe(458.81);
      expect(result.totalAmount).toBe(5458.81);
    });

    it('should correctly handle zero elapsed days (Example 4)', () => {
      const result = calculateInterest({
        principal: 8000,
        annualInterestRate: 24,
        startDate: new Date('2026-01-01T00:00:00Z'),
        calculationDate: new Date('2026-01-01T00:00:00Z'),
        compoundingFrequency: 'MONTHLY',
      });

      expect(result.elapsedDays).toBe(0);
      expect(result.interest).toBe(0);
      expect(result.totalAmount).toBe(8000);
    });

    it('should support DAILY compounding frequency', () => {
      const result = calculateInterest({
        principal: 10000,
        annualInterestRate: 10,
        startDate: new Date('2026-01-01T00:00:00Z'),
        calculationDate: new Date('2026-01-11T00:00:00Z'),
        compoundingFrequency: 'DAILY',
      });

      expect(result.elapsedDays).toBe(10);
      expect(result.interest).toBe(27.43);
      expect(result.totalAmount).toBe(10027.43);
    });

    it('should support WEEKLY compounding frequency', () => {
      const result = calculateInterest({
        principal: 10000,
        annualInterestRate: 10,
        startDate: new Date('2026-01-01T00:00:00Z'),
        calculationDate: new Date('2026-01-08T00:00:00Z'),
        compoundingFrequency: 'WEEKLY',
      });

      expect(result.elapsedDays).toBe(7);
      expect(result.interest).toBe(19.18);
      expect(result.totalAmount).toBe(10019.18);
    });

    it('should handle zero principal correctly', () => {
      const result = calculateInterest({
        principal: 0,
        annualInterestRate: 15,
        startDate: new Date('2026-01-01T00:00:00Z'),
        calculationDate: new Date('2026-06-01T00:00:00Z'),
        compoundingFrequency: 'MONTHLY',
      });

      expect(result.interest).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should handle zero interest rate correctly', () => {
      const result = calculateInterest({
        principal: 5000,
        annualInterestRate: 0,
        startDate: new Date('2026-01-01T00:00:00Z'),
        calculationDate: new Date('2026-06-01T00:00:00Z'),
        compoundingFrequency: 'MONTHLY',
      });

      expect(result.interest).toBe(0);
      expect(result.totalAmount).toBe(5000);
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
          email: 'merchant.a@test.com',
          passwordHash: passHash,
          businessName: 'Merchant A Stores',
        },
      });
      tokenA = jwt.sign({ id: merchantA.id, email: merchantA.email }, config.JWT_SECRET, {
        expiresIn: '1h',
      });

      merchantB = await prisma.user.create({
        data: {
          email: 'merchant.b@test.com',
          passwordHash: passHash,
          businessName: 'Merchant B Stores',
        },
      });

      customerA = await prisma.customer.create({
        data: {
          userId: merchantA.id,
          name: 'Customer A',
          phoneNumber: '9000000001',
          lendingRate: 12.0,
          depositRate: 6.0,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
          isActive: true,
        },
      });

      customerB = await prisma.customer.create({
        data: {
          userId: merchantB.id,
          name: 'Customer B',
          phoneNumber: '9000000002',
          lendingRate: 15.0,
          depositRate: 7.0,
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

    it('should calculate ledger with correct running outstanding balance and interest (Test 3 / Rule 2 & 3)', async () => {
      // Setup timeline:
      // - 1 Jan: Debit 10,000 (interest starts Jan 1)
      // - 15 Jan: Debit 7,000 (interest starts Jan 15)
      // - 25 Jan: Credit 5,000 (interest starts Jan 25)
      // - 10 Feb: Debit 4,000 (but VOIDED)
      await prisma.transaction.createMany({
        data: [
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 10000,
            date: new Date('2026-01-01T00:00:00Z'),
            interestStartDate: new Date('2026-01-01T00:00:00Z'),
            remarks: 'Debit 1',
            isVoided: false,
          },
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 7000,
            date: new Date('2026-01-15T00:00:00Z'),
            interestStartDate: new Date('2026-01-15T00:00:00Z'),
            remarks: 'Debit 2',
            isVoided: false,
          },
          {
            customerId: customerA.id,
            type: TransactionType.CREDIT,
            amount: 5000,
            date: new Date('2026-01-25T00:00:00Z'),
            interestStartDate: new Date('2026-01-25T00:00:00Z'),
            remarks: 'Credit 1',
            isVoided: false,
          },
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 4000,
            date: new Date('2026-02-10T00:00:00Z'),
            interestStartDate: new Date('2026-02-10T00:00:00Z'),
            remarks: 'Voided Debit',
            isVoided: true,
          },
        ],
      });

      // Calculate on 2026-02-01T00:00:00Z (UTC)
      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      const { summary, transactions } = res.body.data;

      // Aggregates checking:
      expect(summary.totalMoneyLent).toBe(17000);
      expect(summary.totalMoneyReceived).toBe(5000);
      expect(summary.outstandingPrincipal).toBe(12000);

      // Interest math checks:
      // Interval 1 (1 Jan -> 15 Jan): P = 10,000. Interest = 45.90
      // Interval 2 (15 Jan -> 25 Jan): P = 17,000. Interest = 55.66
      // Interval 3 (25 Jan -> 1 Feb): P = 12,000. Interest = 27.56
      // Total Interest = 45.89 + 55.66 + 27.56 = 129.11
      expect(summary.accruedInterest).toBe(129.11);
      expect(summary.totalDue).toBe(12129.11);

      // Verify voided transactions are completely omitted
      const voided = transactions.find(
        (t: { remarks: string | null }) => t.remarks === 'Voided Debit',
      );
      expect(voided).toBeUndefined();
    });

    it('should clamp running outstanding balance at zero and stop interest accrual (Test 4 & 5 / Rule 6 & 8)', async () => {
      // Setup timeline:
      // - 1 Jan: Debit 10,000
      // - 15 Jan: Credit 12,000 (overpayment)
      // Calculate on 2026-02-01T00:00:00Z (UTC)
      await prisma.transaction.createMany({
        data: [
          {
            customerId: customerA.id,
            type: TransactionType.DEBIT,
            amount: 10000,
            date: new Date('2026-01-01T00:00:00Z'),
            interestStartDate: new Date('2026-01-01T00:00:00Z'),
            remarks: 'Debit 1',
            isVoided: false,
          },
          {
            customerId: customerA.id,
            type: TransactionType.CREDIT,
            amount: 12000,
            date: new Date('2026-01-15T00:00:00Z'),
            interestStartDate: new Date('2026-01-15T00:00:00Z'),
            remarks: 'Overpayment Credit',
            isVoided: false,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=2026-02-01T00:00:00Z`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const { summary } = res.body.data;

      // Outstanding balance is clamped at zero
      expect(summary.outstandingPrincipal).toBe(0);
      expect(summary.totalMoneyLent).toBe(10000);
      expect(summary.totalMoneyReceived).toBe(12000);

      // Interest from Jan 15 to Feb 1 should be 0 because balance is 0
      // Total Interest = Interest on 10,000 for 14 days (45.90) + 0 = 45.90
      expect(summary.accruedInterest).toBe(45.9);
      expect(summary.totalDue).toBe(45.9);
    });

    it('should reject malformed calculationDate query parameters', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerA.id}/ledger?calculationDate=invalid-date`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });
  });
});
