import request from 'supertest';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import app from '../../../../app'; // Assuming app.ts is at src/app.ts
import { redisClient } from '../../../../shared/redisClient';

// Mock Redis to avoid requiring a real Redis instance during integration tests
vi.mock('../../../../shared/redisClient', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

describe('Home API Integration Tests', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  it('GET /api/v1/home/content should return 200 and sections array', async () => {
    // Mock redis cache miss
    (redisClient.get as any).mockResolvedValue(null);

    const res = await request(app).get('/api/v1/home/content');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('sections');
    expect(Array.isArray(res.body.data.sections)).toBe(true);
  });

  it('GET /api/v1/home/content should not crash if x-guest-id is provided', async () => {
    const res = await request(app)
      .get('/api/v1/home/content')
      .set('x-guest-id', 'test-guest-123');
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
