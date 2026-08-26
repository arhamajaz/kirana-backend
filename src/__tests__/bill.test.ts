import request from 'supertest';
import app from '../app';
import { prisma, disconnectDb } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

describe('Bill & Cashbook Module Integration Tests', () => {
  let merchant: { id: string; email: string };
  let token: string;
  let createdBillId: string;

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
        email: 'bill_merchant@test.com',
        passwordHash,
        businessName: 'Bill Test Store',
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

  it('POST /api/v1/bills - should create a new invoice and cashbook entry', async () => {
    const response = await request(app)
      .post('/api/v1/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Suresh Kumar',
        totalAmount: 1200.00,
        paidAmount: 1200.00,
        itemsJson: [{ name: 'Wheat Bag', qty: 1, price: 1200.00 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('success');
    expect(response.body.data.customerName).toBe('Suresh Kumar');
    createdBillId = response.body.data.id;
  });

  it('GET /api/v1/bills - should list all bills for merchant', async () => {
    const response = await request(app)
      .get('/api/v1/bills')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.length).toBe(1);
  });

  it('POST /api/v1/bills/:id/void - should void an invoice', async () => {
    const response = await request(app)
      .post(`/api/v1/bills/${createdBillId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Returned goods' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.isVoid).toBe(true);
  });

  it('POST /api/v1/cashbook - should create manual cash entry', async () => {
    const response = await request(app)
      .post('/api/v1/cashbook')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'out',
        amount: 250.00,
        remarks: 'Shop Cleaning Expense',
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('success');
    expect(response.body.data.type).toBe('out');
  });

  it('GET /api/v1/cashbook - should list all cashbook entries', async () => {
    const response = await request(app)
      .get('/api/v1/cashbook')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
