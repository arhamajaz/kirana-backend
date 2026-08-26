import request from 'supertest';
import app from '../app';
import { prisma, disconnectDb } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

describe('Item Module Integration Tests', () => {
  let merchant: { id: string; email: string };
  let token: string;
  let createdItemId: string;

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
        email: 'item_merchant@test.com',
        passwordHash,
        businessName: 'Item Test Store',
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

  it('POST /api/v1/items - should create a new inventory item', async () => {
    const response = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Basmati Rice 5kg',
        qty: 50,
        minReorderQty: 10,
        buyPrice: 400.00,
        sellPrice: 480.00,
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('success');
    expect(response.body.data.name).toBe('Basmati Rice 5kg');
    expect(response.body.data.qty).toBe(50);
    createdItemId = response.body.data.id;
  });

  it('GET /api/v1/items - should retrieve all inventory items for merchant', async () => {
    const response = await request(app)
      .get('/api/v1/items')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(1);
  });

  it('PATCH /api/v1/items/:id - should update item stock and price', async () => {
    const response = await request(app)
      .patch(`/api/v1/items/${createdItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        qty: 45,
        sellPrice: 495.00,
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.qty).toBe(45);
  });

  it('DELETE /api/v1/items/:id - should delete an item', async () => {
    const response = await request(app)
      .delete(`/api/v1/items/${createdItemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');

    const getRes = await request(app)
      .get('/api/v1/items')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.body.data.length).toBe(0);
  });
});
