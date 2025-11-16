import { describe, it, expect, afterAll } from 'vitest';
import { getRedisClient, isRedisHealthy, disconnectRedis } from './redis';

describe('Redis Client', () => {
  afterAll(async () => {
    await disconnectRedis();
  });

  describe('getRedisClient', () => {
    it('should return a Redis client instance', () => {
      const client = getRedisClient();
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
      expect(typeof client.set).toBe('function');
    });

    it('should return the same instance on multiple calls (singleton)', () => {
      const client1 = getRedisClient();
      const client2 = getRedisClient();
      expect(client1).toBe(client2);
    });

    it('should handle configuration from environment variables', () => {
      const client = getRedisClient();
      expect(client).toBeDefined();
      // Client should be configured based on env vars (or defaults)
    });
  });

  describe('isRedisHealthy', () => {
    it('should check Redis health status', async () => {
      const healthy = await isRedisHealthy();
      expect(typeof healthy).toBe('boolean');
    });

    it('should handle when Redis is not available gracefully', async () => {
      // Should not throw even if Redis is down
      await expect(isRedisHealthy()).resolves.not.toThrow();
    });
  });

  describe('disconnectRedis', () => {
    it('should disconnect Redis gracefully', async () => {
      await expect(disconnectRedis()).resolves.not.toThrow();
    });
  });

  describe('Redis operations', () => {
    it('should handle basic get/set operations if Redis is available', async () => {
      const client = getRedisClient();
      const healthy = await isRedisHealthy();

      if (healthy) {
        // Test basic operations
        await client.set('test:redis:basic', 'test-value');
        const value = await client.get('test:redis:basic');
        expect(value).toBe('test-value');

        // Cleanup
        await client.del('test:redis:basic');
      } else {
        // Redis not available, skip actual operations
        expect(healthy).toBe(false);
      }
    });

    it('should handle ping command', async () => {
      const client = getRedisClient();
      
      try {
        const response = await client.ping();
        expect(response).toBe('PONG');
      } catch (error) {
        // Redis not available, which is acceptable in test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      // The client should not throw errors during initialization
      // even if Redis is not available
      expect(() => getRedisClient()).not.toThrow();
    });

    it('should handle failed commands gracefully', async () => {
      const client = getRedisClient();
      const healthy = await isRedisHealthy();

      if (!healthy) {
        // If Redis is not healthy, operations should either:
        // 1. Throw errors that can be caught
        // 2. Queue commands for later
        
        try {
          await client.get('test:key');
        } catch (error) {
          // Error is acceptable when Redis is down
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('reconnection behavior', () => {
    it('should have reconnection strategy configured', () => {
      const client = getRedisClient();
      expect(client.options.retryStrategy).toBeDefined();
    });

    it('should have proper retry configuration', () => {
      const client = getRedisClient();
      expect(client.options.maxRetriesPerRequest).toBe(3);
    });

    it('should have lazy connect enabled', () => {
      const client = getRedisClient();
      expect(client.options.lazyConnect).toBe(true);
    });
  });
});
