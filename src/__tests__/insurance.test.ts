import request from 'supertest';
import app from '../app';
import { prisma, disconnectDb } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

describe('Insurance Module Integration Tests', () => {
  let merchant: { id: string; email: string };
  let token: string;

  beforeAll(async () => {
    await prisma.insurance.deleteMany();
    await prisma.cashbook.deleteMany();
    await prisma.bill.deleteMany();
    await prisma.item.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('password123', 10);
    merchant = await prisma.user.create({
      data: {
        email: 'ins_merchant@test.com',
        passwordHash,
        businessName: 'Insurance Test Store',
      },
    });

    token = jwt.sign({ id: merchant.id, email: merchant.email }, config.JWT_SECRET, {
      expiresIn: '1d',
    });
  });

  afterAll(async () => {
    await prisma.insurance.deleteMany();
    await prisma.cashbook.deleteMany();
    await prisma.bill.deleteMany();
    await prisma.item.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
    await disconnectDb();
  });

  it('GET /api/v1/insurance - should return default or existing insurance policy', async () => {
    const response = await request(app)
      .get('/api/v1/insurance')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.policyName).toBeDefined();
  });

  it('PUT /api/v1/insurance - should update insurance policy details', async () => {
    const response = await request(app)
      .put('/api/v1/insurance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        policyName: 'Kirana Store Comprehensive Shield',
        provider: 'ICICI Lombard',
        premiumAmount: 5200.00,
        renewalDate: '2027-05-15',
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.provider).toBe('ICICI Lombard');
  });
});
