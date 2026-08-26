import request from 'supertest';
import app from '../app';
import { prisma, disconnectDb } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

describe('Auth Module Integration Tests', () => {
  let merchant: { id: string; email: string };
  const rawPassword = 'password123';

  beforeAll(async () => {
    // Clean database
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    merchant = await prisma.user.create({
      data: {
        email: 'merchant@test.com',
        passwordHash,
        businessName: 'Merchant Test Stores',
      },
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
    await disconnectDb();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should successfully login with correct credentials', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'merchant@test.com',
        password: rawPassword,
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(merchant.email);
      expect(response.body.data.user.id).toBe(merchant.id);
      expect(response.body.data.user.businessName).toBe('Merchant Test Stores');
    });

    it('should fail to login with wrong password', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'merchant@test.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should fail to login with non-existent email', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@test.com',
        password: rawPassword,
      });

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should fail to login with invalid input types (validation schema)', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'invalid-email-format',
        password: '',
      });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new merchant', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'newmerchant@test.com',
        password: 'password123',
        name: 'New Merchant',
        businessName: 'New Kirana Store',
      });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('newmerchant@test.com');
      expect(response.body.data.user.businessName).toBe('New Kirana Store');
    });

    it('should fail to register if email already exists', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'merchant@test.com',
        password: 'password123',
        businessName: 'Duplicate Store',
      });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('Auth Middleware Route Protection', () => {
    it('should reject access with 401 when Authorization header is missing', async () => {
      const response = await request(app).get('/api/v1/customers');
      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Token missing or malformed');
    });

    it('should reject access with 401 with malformed token (no Bearer prefix)', async () => {
      const response = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', 'InvalidTokenBody');
      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Token missing or malformed');
    });

    it('should reject access with 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid or expired token');
    });

    it('should reject access with 401 with expired token', async () => {
      const expiredToken = jwt.sign({ id: merchant.id, email: merchant.email }, config.JWT_SECRET, {
        expiresIn: '-10s',
      });
      const response = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid or expired token');
    });

    it('should reject access with 401 when user no longer exists in database', async () => {
      const tempToken = jwt.sign(
        { id: 'non-existent-uuid-1234', email: 'deleted@test.com' },
        config.JWT_SECRET,
        { expiresIn: '1d' },
      );
      const response = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(response.status).toBe(401);
      expect(response.body.message).toContain('User no longer exists');
    });
  });
});
