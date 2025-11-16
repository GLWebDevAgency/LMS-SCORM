import Redis from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Get singleton Redis client with automatic reconnection
 * Implements graceful degradation if Redis is unavailable
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    const redisPassword = process.env.REDIS_PASSWORD;

    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true, // Don't connect immediately
      enableOfflineQueue: true, // Queue commands when offline
      enableReadyCheck: true,
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis ready to accept commands');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    redisClient.on('close', () => {
      console.log('⚠️ Redis connection closed');
    });

    // Try to connect
    redisClient.connect().catch((err) => {
      console.error('⚠️ Redis initial connection failed:', err.message);
      console.log('⚠️ Application will continue without Redis caching');
    });
  }

  return redisClient;
}

/**
 * Check if Redis is available and healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    if (!redisClient) {
      return false;
    }
    await redisClient.ping();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gracefully disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
