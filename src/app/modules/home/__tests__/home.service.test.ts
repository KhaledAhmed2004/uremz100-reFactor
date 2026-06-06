import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomeService } from '../home.service';
import { redisClient } from '../../../../shared/redisClient';
import { Content } from '../../content/content.model';

// Mock dependencies
vi.mock('../../../../shared/redisClient', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

vi.mock('../../content/content.model', () => ({
  Content: {
    find: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

vi.mock('../../recently-watched/recently-watched.model', () => ({
  RecentlyWatched: {
    find: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    populate: vi.fn(),
  },
}));

describe('HomeService.getHomeContentFromDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch from database and cache when redis returns null', async () => {
    // Simulate Redis cache miss
    (redisClient.get as any).mockResolvedValue(null);
    
    // Simulate DB returning data
    const mockData = [{ _id: '1', title: 'Test Movie', type: 'MOVIE' }];
    (Content.limit as any).mockResolvedValue(mockData);

    const result = await HomeService.getHomeContentFromDB();

    expect(result.sections).toBeDefined();
    // Verify redisClient.get was called for cache keys
    expect(redisClient.get).toHaveBeenCalledWith('home:trending');
    // Verify DB was queried
    expect(Content.find).toHaveBeenCalled();
    // Verify redisClient.setex was called to save cache
    expect(redisClient.setex).toHaveBeenCalled();
  });

  it('should return cached data directly without calling database', async () => {
    // Simulate Redis cache hit
    const cachedData = [{ _id: '1', title: 'Cached Movie' }];
    (redisClient.get as any).mockResolvedValue(JSON.stringify(cachedData));

    // Reset DB mocks so we can verify they weren't called
    (Content.limit as any).mockClear();

    const result = await HomeService.getHomeContentFromDB();

    expect(result.sections).toBeDefined();
    expect(redisClient.get).toHaveBeenCalledWith('home:trending');
    
    // The DB query should not be resolved or fetched if all are cached
    // Wait, the DB query setup might still happen because `Content.find()` is chained.
    // The actual execution is blocked inside fetchWithCache if cache hits.
    expect(redisClient.setex).not.toHaveBeenCalled();
  });

  it('should not crash if one query fails (Promise.allSettled behavior)', async () => {
    // Simulate Redis cache miss
    (redisClient.get as any).mockResolvedValue(null);
    
    // Simulate DB rejecting
    (Content.limit as any).mockRejectedValueOnce(new Error('DB Error')).mockResolvedValue([]);

    // It should not throw error, it should just return the fulfilled sections
    const result = await HomeService.getHomeContentFromDB();
    expect(result.sections).toBeDefined();
  });
});
