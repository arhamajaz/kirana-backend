import request from 'supertest';
import app from '../app';

describe('GET /health', () => {
  it('should return 200 success with server health message', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('message', 'Server is healthy');
    expect(response.body).toHaveProperty('timestamp');
  });
});
