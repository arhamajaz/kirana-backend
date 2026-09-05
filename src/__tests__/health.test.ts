import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';

jest.mock('../config/database', () => ({
  prisma: {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user-123' }),
    },
  },
}));

describe('GET /health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-123' });
  });

  it('should return 200 success with server and database health message', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty(
      'message',
      'Malwa Ledger Pro API Server and Database are healthy.',
    );
    expect(response.body).toHaveProperty('timestamp');
  });

  it('should return 500 status when database ping fails', async () => {
    (prisma.user.findFirst as jest.Mock).mockRejectedValueOnce(new Error('Connection error'));

    const response = await request(app).get('/health');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Database unreachable',
    });
  });
});
