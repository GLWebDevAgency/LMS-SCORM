import type Redis from 'ioredis';
import { getRedisClient, isRedisHealthy } from '../config/redis';

/**
 * Production-grade cache service with graceful degradation
 * If Redis is unavailable, methods gracefully fall through to direct DB access
 */
export class CacheService {
  private redis: Redis;
  private defaultTTL = 300; // 5 minutes in seconds
  private enabled = true;

  constructor() {
    this.redis = getRedisClient();
    
    // Check if Redis is available on initialization
    this.checkAvailability();
  }

  /**
   * Check if Redis is available and disable caching if not
   */
  private async checkAvailability(): Promise<void> {
    try {
      const healthy = await isRedisHealthy();
      if (!healthy) {
        this.enabled = false;
        console.warn('⚠️ Redis unavailable - caching disabled, falling back to direct DB access');
      }
    } catch (error) {
      this.enabled = false;
      console.warn('⚠️ Redis unavailable - caching disabled, falling back to direct DB access');
    }
  }

  /**
   * Get value from cache
   * Returns null if key doesn't exist or Redis is unavailable
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        return null;
      }
      return JSON.parse(cached) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl || this.defaultTTL, serialized);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * WARNING: Use with caution in production - can be expensive
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error(`Cache deletePattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Cache-aside pattern: Get from cache or fetch from source
   * This is the primary caching pattern used throughout the application
   */
  async wrap<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch from source
    const data = await fetcher();
    
    // Store in cache for next time (fire and forget)
    this.set(key, data, ttl).catch((err) => {
      console.error(`Background cache set failed for ${key}:`, err);
    });

    return data;
  }

  /**
   * Check if caching is enabled and healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      return await isRedisHealthy();
    } catch (error) {
      return false;
    }
  }

  /**
   * Test cache read/write operations
   */
  async testReadWrite(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const testKey = 'health:test';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 10);
      const retrieved = await this.get<{ timestamp: number }>(testKey);
      await this.delete(testKey);
      
      return retrieved !== null && typeof retrieved === 'object' && 'timestamp' in retrieved && retrieved.timestamp === testValue.timestamp;
    } catch (error) {
      console.error('Cache read/write test failed:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    healthy: boolean;
    info?: any;
  }> {
    const stats = {
      enabled: this.enabled,
      healthy: false,
      info: undefined as any,
    };

    if (!this.enabled) {
      return stats;
    }

    try {
      stats.healthy = await this.isHealthy();
      
      if (stats.healthy) {
        const info = await this.redis.info('stats');
        const keyspace = await this.redis.info('keyspace');
        
        // Parse Redis info into structured data
        stats.info = {
          raw_stats: info,
          raw_keyspace: keyspace,
        };
      }
    } catch (error) {
      console.error('Error getting cache stats:', error);
    }

    return stats;
  }

  /**
   * Flush all cache keys (use with extreme caution)
   */
  async flush(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      await this.redis.flushdb();
      console.log('✅ Cache flushed successfully');
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }

  /**
   * Get multiple keys at once (batch operation)
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.enabled || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await this.redis.mget(...keys);
      return values.map((value) => (value ? JSON.parse(value) as T : null));
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once (batch operation)
   */
  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    if (!this.enabled || entries.length === 0) {
      return;
    }

    try {
      // Use pipeline for better performance
      const pipeline = this.redis.pipeline();
      
      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        pipeline.setex(entry.key, entry.ttl || this.defaultTTL, serialized);
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
