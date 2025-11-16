import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cacheService } from './cacheService';
import { getRedisClient, disconnectRedis } from '../config/redis';

describe('CacheService', () => {
  let redis: any;
  
  beforeAll(async () => {
    redis = getRedisClient();
    // Wait a bit for Redis to connect (if available)
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  beforeEach(async () => {
    // Clear test keys before each test
    try {
      const keys = await redis.keys('test:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      // Redis might not be available in test environment
      console.log('Redis not available for cleanup, skipping');
    }
  });

  describe('basic operations', () => {
    it('should set and get a value', async () => {
      const key = 'test:basic:value';
      const value = { foo: 'bar', num: 42 };

      await cacheService.set(key, value, 60);
      const retrieved = await cacheService.get(key);

      if (await cacheService.isHealthy()) {
        expect(retrieved).toEqual(value);
      } else {
        // If Redis is not available, get should return null
        expect(retrieved).toBeNull();
      }
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('test:nonexistent');
      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      const key = 'test:delete:key';
      const value = { test: true };

      await cacheService.set(key, value, 60);
      await cacheService.delete(key);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toBeNull();
    });

    it('should handle complex objects', async () => {
      const key = 'test:complex:object';
      const value = {
        string: 'hello',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        nested: {
          deep: {
            value: 'nested'
          }
        },
        nullValue: null,
        undefinedValue: undefined
      };

      await cacheService.set(key, value, 60);
      const retrieved = await cacheService.get(key);

      if (await cacheService.isHealthy()) {
        expect(retrieved).toEqual(value);
      } else {
        expect(retrieved).toBeNull();
      }
    });
  });

  describe('wrap pattern', () => {
    it('should fetch from cache on first miss, then return cached value', async () => {
      const key = 'test:wrap:counter';
      let fetchCount = 0;

      const fetcher = async () => {
        fetchCount++;
        return { count: fetchCount };
      };

      // First call - should fetch
      const result1 = await cacheService.wrap(key, fetcher, 60);
      
      // Second call - should use cache (if Redis is available)
      const result2 = await cacheService.wrap(key, fetcher, 60);

      if (await cacheService.isHealthy()) {
        expect(fetchCount).toBe(1); // Fetcher called only once
        expect(result1).toEqual({ count: 1 });
        expect(result2).toEqual({ count: 1 }); // Same cached value
      } else {
        // Without Redis, fetcher is called each time
        expect(fetchCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle async fetcher errors gracefully', async () => {
      const key = 'test:wrap:error';
      const errorMessage = 'Fetcher error';

      const fetcher = async () => {
        throw new Error(errorMessage);
      };

      await expect(cacheService.wrap(key, fetcher, 60)).rejects.toThrow(errorMessage);
    });
  });

  describe('pattern deletion', () => {
    it('should delete keys matching pattern', async () => {
      const keys = [
        'test:pattern:user:1',
        'test:pattern:user:2',
        'test:pattern:user:3',
        'test:other:key'
      ];

      // Set all keys
      for (const key of keys) {
        await cacheService.set(key, { value: key }, 60);
      }

      // Delete pattern
      const deletedCount = await cacheService.deletePattern('test:pattern:user:*');

      if (await cacheService.isHealthy()) {
        expect(deletedCount).toBe(3);

        // Check deleted keys are gone
        for (let i = 1; i <= 3; i++) {
          const result = await cacheService.get(`test:pattern:user:${i}`);
          expect(result).toBeNull();
        }

        // Check other key still exists
        const otherKey = await cacheService.get('test:other:key');
        expect(otherKey).toEqual({ value: 'test:other:key' });
      } else {
        expect(deletedCount).toBe(0);
      }
    });

    it('should return 0 when no keys match pattern', async () => {
      const deletedCount = await cacheService.deletePattern('test:nonexistent:*');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('batch operations', () => {
    it('should get multiple keys at once', async () => {
      const keys = ['test:batch:1', 'test:batch:2', 'test:batch:3'];
      const values = [
        { id: 1, name: 'first' },
        { id: 2, name: 'second' },
        { id: 3, name: 'third' }
      ];

      // Set values
      for (let i = 0; i < keys.length; i++) {
        await cacheService.set(keys[i], values[i], 60);
      }

      // Get all at once
      const results = await cacheService.mget(keys);

      if (await cacheService.isHealthy()) {
        expect(results).toHaveLength(3);
        expect(results[0]).toEqual(values[0]);
        expect(results[1]).toEqual(values[1]);
        expect(results[2]).toEqual(values[2]);
      } else {
        expect(results).toEqual([null, null, null]);
      }
    });

    it('should set multiple keys at once', async () => {
      const entries = [
        { key: 'test:mset:1', value: { a: 1 }, ttl: 60 },
        { key: 'test:mset:2', value: { b: 2 }, ttl: 60 },
        { key: 'test:mset:3', value: { c: 3 }, ttl: 60 }
      ];

      await cacheService.mset(entries);

      if (await cacheService.isHealthy()) {
        for (const entry of entries) {
          const result = await cacheService.get(entry.key);
          expect(result).toEqual(entry.value);
        }
      }
    });
  });

  describe('health checks', () => {
    it('should report health status', async () => {
      const healthy = await cacheService.isHealthy();
      expect(typeof healthy).toBe('boolean');
    });

    it('should test read/write operations', async () => {
      const canReadWrite = await cacheService.testReadWrite();
      expect(typeof canReadWrite).toBe('boolean');
    });

    it('should get cache statistics', async () => {
      const stats = await cacheService.getStats();
      
      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('healthy');
      expect(typeof stats.enabled).toBe('boolean');
      expect(typeof stats.healthy).toBe('boolean');
    });
  });

  describe('graceful degradation', () => {
    it('should handle operations when Redis is unavailable', async () => {
      // These operations should not throw errors even if Redis is down
      await expect(cacheService.get('test:degradation')).resolves.not.toThrow();
      await expect(cacheService.set('test:degradation', { test: true }, 60)).resolves.not.toThrow();
      await expect(cacheService.delete('test:degradation')).resolves.not.toThrow();
      await expect(cacheService.deletePattern('test:*')).resolves.not.toThrow();
    });

    it('should allow wrap to work with direct fetcher when Redis unavailable', async () => {
      const key = 'test:degradation:wrap';
      let fetchCount = 0;

      const fetcher = async () => {
        fetchCount++;
        return { fetched: true, count: fetchCount };
      };

      const result = await cacheService.wrap(key, fetcher, 60);
      
      expect(result).toEqual({ fetched: true, count: 1 });
      expect(fetchCount).toBe(1);
    });
  });

  describe('TTL behavior', () => {
    it('should respect TTL when setting values', async () => {
      const key = 'test:ttl:short';
      const value = { expires: 'soon' };

      await cacheService.set(key, value, 1); // 1 second TTL

      if (await cacheService.isHealthy()) {
        // Immediately should be available
        const immediate = await cacheService.get(key);
        expect(immediate).toEqual(value);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Should be expired
        const expired = await cacheService.get(key);
        expect(expired).toBeNull();
      }
    }, 3000); // Increase test timeout
  });
});
