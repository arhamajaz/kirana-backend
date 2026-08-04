import request from 'supertest';
import app from '../app';
import { prisma, disconnectDb } from '../config/database';
import { CompoundingFrequency } from '../generated/prisma/client';

describe('Customer Module Integration Tests', () => {
  let merchantA: { id: string; email: string };
  let merchantB: { id: string; email: string };
  let customerAId: string;

  beforeAll(async () => {
    // Clean database to ensure deterministic tests
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();

    // Seed test merchant users
    merchantA = await prisma.user.create({
      data: {
        email: 'merchant.a@test.com',
        passwordHash: 'hashedpassword123',
        businessName: 'Merchant A Stores',
      },
    });

    merchantB = await prisma.user.create({
      data: {
        email: 'merchant.b@test.com',
        passwordHash: 'hashedpassword456',
        businessName: 'Merchant B Stores',
      },
    });
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.transaction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
    await disconnectDb();
  });

  describe('POST /api/v1/customers - Create Customer', () => {
    it('should create a customer with valid data and return 201', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .send({
          name: 'Rajesh Kumar',
          phoneNumber: '9876543210',
          lendingRate: 24,
          depositRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.customer).toBeDefined();
      expect(response.body.data.customer.name).toBe('Rajesh Kumar');
      expect(response.body.data.customer.phoneNumber).toBe('9876543210');
      expect(response.body.data.customer.userId).toBe(merchantA.id);
      expect(response.body.data.customer.isActive).toBe(true);

      customerAId = response.body.data.customer.id;
    });

    it('should normalize phone number with surrounding whitespace and succeed', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .send({
          name: 'Normalized Phone Customer',
          phoneNumber: '  9123456789   ',
          lendingRate: 20,
          depositRate: 10,
          compoundingFrequency: CompoundingFrequency.QUARTERLY,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.customer.phoneNumber).toBe('9123456789');
    });

    it('should fail to create customer with duplicate phone number under same merchant', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .send({
          name: 'Rajesh Duplicate',
          phoneNumber: '9876543210', // duplicate
          lendingRate: 24,
          depositRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('already exists');
    });

    it('should allow customer with same phone number under different merchants', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('x-user-id', merchantB.id)
        .send({
          name: 'Rajesh Under Merchant B',
          phoneNumber: '9876543210', // same phone as Rajesh under Merchant A
          lendingRate: 18,
          depositRate: 8,
          compoundingFrequency: CompoundingFrequency.YEARLY,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.customer.userId).toBe(merchantB.id);
    });

    it('should fail with validation error when phone number contains non-digits', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .send({
          name: 'Bad Phone',
          phoneNumber: '98-7654-321', // contains dashes
          lendingRate: 24,
          depositRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.errors).toBeDefined();
    });

    it('should fail with validation error when phone number length is not 10', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .send({
          name: 'Short Phone',
          phoneNumber: '987654321', // 9 digits
          lendingRate: 24,
          depositRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
        });

      expect(response.status).toBe(400);
    });

    it('should fail with validation error when lending/deposit rates are negative', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .send({
          name: 'Negative Rates',
          phoneNumber: '9555555555',
          lendingRate: -5,
          depositRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
        });

      expect(response.status).toBe(400);
    });

    it('should fail with validation error when lending/deposit rates exceed 100', async () => {
      const response = await request(app)
        .post('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .send({
          name: 'Excessive Rates',
          phoneNumber: '9555555555',
          lendingRate: 105,
          depositRate: 12,
          compoundingFrequency: CompoundingFrequency.MONTHLY,
        });

      expect(response.status).toBe(400);
    });

    it('should fallback to seeded user when x-user-id header is missing', async () => {
      const response = await request(app).post('/api/v1/customers').send({
        name: 'Fallback Merchant Customer',
        phoneNumber: '9666666666',
        lendingRate: 24,
        depositRate: 12,
        compoundingFrequency: CompoundingFrequency.MONTHLY,
      });

      expect(response.status).toBe(201);
      // Since merchantA was created first, it should be the fallback seeded merchant
      expect(response.body.data.customer.userId).toBe(merchantA.id);
    });
  });

  describe('GET /api/v1/customers/:id - Get Customer', () => {
    it('should fetch active customer details by id', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${customerAId}`)
        .set('x-user-id', merchantA.id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.customer.id).toBe(customerAId);
    });

    it('should return 404 for non-existent customer uuid', async () => {
      const nonExistentUuid = '99999999-9999-9999-9999-999999999999';
      const response = await request(app)
        .get(`/api/v1/customers/${nonExistentUuid}`)
        .set('x-user-id', merchantA.id);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });

    it('should return 404 when trying to fetch a customer belonging to another merchant', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${customerAId}`)
        .set('x-user-id', merchantB.id); // Merchant B requesting Merchant A's customer

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/customers/:id - Update Customer', () => {
    it('should successfully update customer fields', async () => {
      const response = await request(app)
        .patch(`/api/v1/customers/${customerAId}`)
        .set('x-user-id', merchantA.id)
        .send({
          name: 'Rajesh Kumar Updated',
          lendingRate: 25,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.customer.name).toBe('Rajesh Kumar Updated');
      expect(Number(response.body.data.customer.lendingRate)).toBe(25);
    });

    it('should reject empty update payloads with 400', async () => {
      const response = await request(app)
        .patch(`/api/v1/customers/${customerAId}`)
        .set('x-user-id', merchantA.id)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Validation failed');
    });

    it('should reject update if phone number conflicts with duplicate phone under same merchant', async () => {
      const response = await request(app)
        .patch(`/api/v1/customers/${customerAId}`)
        .set('x-user-id', merchantA.id)
        .send({
          phoneNumber: '9123456789', // taken by Normalized Phone Customer
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('GET /api/v1/customers - Get All and Search with Pagination & Sorting', () => {
    beforeAll(async () => {
      // Seed more customers to test pagination
      // Currently Merchant A has:
      // 1. Rajesh Kumar Updated (9876543210)
      // 2. Normalized Phone Customer (9123456789)
      // 3. Fallback Merchant Customer (9666666666)
      // Let's seed 5 more active customers for Merchant A
      for (let i = 1; i <= 5; i++) {
        await prisma.customer.create({
          data: {
            userId: merchantA.id,
            name: `Pagination Customer ${i}`,
            phoneNumber: `900000000${i}`,
            lendingRate: 20,
            depositRate: 10,
            compoundingFrequency: CompoundingFrequency.MONTHLY,
            isActive: true,
          },
        });
      }
    });

    it('should fetch list with default pagination (limit=20, page=1, sort=name, order=asc)', async () => {
      const response = await request(app).get('/api/v1/customers').set('x-user-id', merchantA.id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.customers).toHaveLength(8); // 3 original + 5 new
      expect(response.body.data.pagination).toEqual({
        total: 8,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });

      // Verify sorting order asc by name
      const names = response.body.data.customers.map((c: { name: string }) => c.name);
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sortedNames);
    });

    it('should enforce pagination limit and offset', async () => {
      const response = await request(app)
        .get('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .query({ page: 2, limit: 3 });

      expect(response.status).toBe(200);
      expect(response.body.data.customers).toHaveLength(3);
      expect(response.body.data.pagination).toEqual({
        total: 8,
        page: 2,
        limit: 3,
        totalPages: 3,
        hasNext: true,
        hasPrevious: true,
      });
    });

    it('should sort in descending order', async () => {
      const response = await request(app)
        .get('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .query({ sort: 'name', order: 'desc' });

      expect(response.status).toBe(200);
      const names = response.body.data.customers.map((c: { name: string }) => c.name);
      const sortedNamesDesc = [...names].sort((a, b) => b.localeCompare(a));
      expect(names).toEqual(sortedNamesDesc);
    });

    it('should search customers by name or phone number', async () => {
      const response = await request(app)
        .get('/api/v1/customers/search')
        .set('x-user-id', merchantA.id)
        .query({ q: 'Pagination' });

      expect(response.status).toBe(200);
      expect(response.body.data.customers).toHaveLength(5);
      response.body.data.customers.forEach((c: { name: string }) => {
        expect(c.name).toContain('Pagination');
      });
    });

    it('should reject invalid query params', async () => {
      // page=0
      let res = await request(app)
        .get('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .query({ page: 0 });
      expect(res.status).toBe(400);

      // limit > 100
      res = await request(app)
        .get('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .query({ limit: 150 });
      expect(res.status).toBe(400);

      // invalid sort field
      res = await request(app)
        .get('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .query({ sort: 'password' });
      expect(res.status).toBe(400);

      // invalid order
      res = await request(app)
        .get('/api/v1/customers')
        .set('x-user-id', merchantA.id)
        .query({ order: 'upward' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/customers/:id - Archive (Soft Delete)', () => {
    it('should archive customer and return 200', async () => {
      const response = await request(app)
        .delete(`/api/v1/customers/${customerAId}`)
        .set('x-user-id', merchantA.id);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('archived');
    });

    it('should exclude archived customer when fetching by id (returns 404)', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${customerAId}`)
        .set('x-user-id', merchantA.id);

      expect(response.status).toBe(404);
    });

    it('should exclude archived customer from normal lists', async () => {
      const response = await request(app).get('/api/v1/customers').set('x-user-id', merchantA.id);

      expect(response.status).toBe(200);
      const ids = response.body.data.customers.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(customerAId);
    });

    it('should exclude archived customer from search results', async () => {
      const response = await request(app)
        .get('/api/v1/customers/search')
        .set('x-user-id', merchantA.id)
        .query({ q: 'Rajesh' });

      expect(response.status).toBe(200);
      const ids = response.body.data.customers.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(customerAId);
    });
  });
});
