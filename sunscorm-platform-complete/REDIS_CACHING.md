# Redis Caching Implementation Guide

## Overview

This document describes the production-grade Redis caching layer implemented in Phase 2.1, designed to achieve sub-200ms API response times, 70%+ cache hit rates, and 60% reduction in database load.

## Architecture

### Two-Tier Caching Strategy

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
┌──────▼──────────────────┐
│  API Layer (Express)    │
└──────┬──────────────────┘
       │
┌──────▼──────────────────┐
│   Cache Service         │  ← Transparent caching
│  (Redis/Fallback)       │
└──────┬──────────────────┘
       │
┌──────▼──────────────────┐
│   Database (Postgres)   │
└─────────────────────────┘
```

### Components

1. **Redis Client** (`server/config/redis.ts`)
   - Singleton pattern with lazy connection
   - Automatic reconnection with exponential backoff
   - Graceful degradation if Redis unavailable

2. **Cache Service** (`server/services/cacheService.ts`)
   - Cache-aside pattern implementation
   - JSON serialization for complex objects
   - Pattern-based key deletion
   - Batch operations support
   - Health monitoring and statistics

3. **Session Storage** (`server/replitAuth.ts`)
   - Primary: Redis (fast, distributed)
   - Fallback: PostgreSQL (reliable)
   - Automatic detection and switching

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Redis Configuration (OPTIONAL - graceful degradation if not set)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password
CACHE_TTL_DEFAULT=300
```

### Docker Compose

If using Docker, add Redis service:

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis_data:
```

## Cache Key Patterns

All cache keys follow a structured pattern for easy management:

| Pattern | Example | TTL | Use Case |
|---------|---------|-----|----------|
| `tenant:{id}` | `tenant:123` | 1 hour | Tenant data (rarely changes) |
| `course:{id}` | `course:456` | 10 min | Course metadata |
| `dispatch:{id}` | `dispatch:789` | 5 min | Dispatch status |
| `dashboard:stats:{tenantId}` | `dashboard:stats:123` | 1 min | Analytics data |
| `scorm:manifest:{filename}:{mtime}` | `scorm:manifest:course.zip:1234567890` | 1 hour | Parsed SCORM manifests |
| `sess:{sessionId}` | `sess:abc123` | 1 week | User sessions |

## Usage Examples

### Basic Caching

```typescript
import { cacheService } from './services/cacheService';

// Get with manual caching
const user = await cacheService.get<User>('user:123');
if (!user) {
  const fetchedUser = await db.query(...);
  await cacheService.set('user:123', fetchedUser, 600);
  return fetchedUser;
}
return user;
```

### Cache-Aside Pattern (Recommended)

```typescript
import { cacheService } from './services/cacheService';

// Automatic caching with wrap()
const user = await cacheService.wrap(
  'user:123',
  async () => {
    // This function only runs on cache miss
    return await db.query(...);
  },
  600 // TTL in seconds
);
```

### Cache Invalidation

```typescript
import { cacheService } from './services/cacheService';

// Single key
await cacheService.delete('course:456');

// Pattern-based (use cautiously in production)
await cacheService.deletePattern('course:*');

// Multiple related caches
await cacheService.delete('course:456');
await cacheService.deletePattern(`dispatches:list:${tenantId}*`);
```

### Batch Operations

```typescript
import { cacheService } from './services/cacheService';

// Get multiple keys at once
const keys = ['user:1', 'user:2', 'user:3'];
const users = await cacheService.mget<User>(keys);

// Set multiple keys at once
await cacheService.mset([
  { key: 'user:1', value: user1, ttl: 600 },
  { key: 'user:2', value: user2, ttl: 600 },
  { key: 'user:3', value: user3, ttl: 600 },
]);
```

## Storage Layer Integration

The storage layer automatically caches frequently accessed data:

### Courses

```typescript
// Cached with 10-minute TTL
const course = await storage.getCourse(courseId);

// Automatically invalidates cache
await storage.updateCourse(courseId, data);
```

### Tenants

```typescript
// Cached with 1-hour TTL (tenants rarely change)
const tenant = await storage.getTenant(tenantId);

// Automatically invalidates cache
await storage.updateTenant(tenantId, data);
```

### Dashboard Stats

```typescript
// Cached with 1-minute TTL (frequently changing)
const stats = await storage.getDashboardStats(tenantId);
```

## Admin Cache Management

### View Cache Statistics

```bash
GET /api/admin/cache/stats
Authorization: Bearer <admin_token>

Response:
{
  "enabled": true,
  "healthy": true,
  "info": {
    "raw_stats": "...",
    "raw_keyspace": "..."
  }
}
```

### Clear Cache

```bash
# Clear specific pattern
POST /api/admin/cache/clear
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "pattern": "course:*"
}

# Clear all cache
POST /api/admin/cache/clear
Authorization: Bearer <admin_token>
Content-Type: application/json

{}
```

## Health Monitoring

### Basic Health Check

```bash
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2025-11-16T17:00:00.000Z",
  "uptime": 3600
}
```

### Detailed Health Check

```bash
GET /health/detailed

Response:
{
  "status": "healthy",
  "timestamp": "2025-11-16T17:00:00.000Z",
  "uptime": 3600,
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15
    },
    "redis": {
      "status": "healthy"
    },
    "cache": {
      "status": "healthy"
    }
  }
}
```

## Graceful Degradation

### What Happens When Redis is Unavailable?

The system is designed to continue functioning without Redis:

1. **Sessions**: Automatically fall back to PostgreSQL
2. **Cache Operations**: Return `null` (cache miss), triggering direct DB queries
3. **No Errors**: All cache failures are caught and logged
4. **Monitoring**: Health checks report degraded status

### Example Behavior

```typescript
// With Redis available
const course = await storage.getCourse('123');
// ✅ Fetched from Redis cache (5ms)

// With Redis unavailable
const course = await storage.getCourse('123');
// ✅ Fetched from PostgreSQL database (50ms)
// ⚠️ Warning logged: "Redis unavailable - using direct DB"
```

## Performance Monitoring

### Key Metrics to Track

1. **Cache Hit Rate**: Target 70%+
   ```typescript
   const stats = await cacheService.getStats();
   ```

2. **API Response Times**: Target <200ms
   - Monitor with APM tools (Datadog, New Relic)
   - Check `/health/detailed` endpoint

3. **Database Load**: Target 60% reduction
   - Monitor PostgreSQL query counts
   - Compare before/after cache implementation

4. **Redis Memory Usage**
   - Monitor with `redis-cli INFO memory`
   - Set up alerts for high memory usage

### Recommended Alerts

```yaml
# Example alert configuration
alerts:
  - name: redis_down
    condition: redis_up == 0
    duration: 5m
    severity: warning
    
  - name: cache_hit_rate_low
    condition: cache_hit_rate < 0.5
    duration: 10m
    severity: warning
    
  - name: api_response_slow
    condition: p95_response_time > 200ms
    duration: 5m
    severity: critical
```

## Testing

### Running Tests

```bash
# Run cache service tests
npm test server/services/cacheService.test.ts

# Run Redis client tests
npm test server/config/redis.test.ts

# Run all tests
npm test
```

### Test Coverage

- ✅ Basic operations (get/set/delete)
- ✅ Cache-aside pattern (wrap)
- ✅ Pattern deletion
- ✅ Batch operations
- ✅ TTL behavior
- ✅ Graceful degradation
- ✅ Health checks
- ✅ Error handling

## Troubleshooting

### Redis Connection Issues

**Problem**: Application logs "Redis connection failed"

**Solution**:
1. Check Redis is running: `redis-cli ping`
2. Verify connection settings in `.env`
3. Check firewall rules
4. Review Redis logs

**Impact**: Application continues with PostgreSQL fallback

### High Memory Usage

**Problem**: Redis using too much memory

**Solution**:
1. Check key count: `redis-cli DBSIZE`
2. Review TTL settings (reduce if needed)
3. Implement key eviction policy:
   ```
   maxmemory 2gb
   maxmemory-policy allkeys-lru
   ```

### Low Cache Hit Rate

**Problem**: Cache hit rate below 50%

**Possible Causes**:
1. TTL too short - increase for stable data
2. Cache being cleared too frequently
3. Keys not following expected patterns
4. High cache churn

**Solution**:
1. Analyze cache patterns with stats endpoint
2. Adjust TTL values in storage layer
3. Review cache invalidation logic

## Best Practices

### DO ✅

1. **Use wrap() pattern**: Simplest and most reliable
   ```typescript
   await cacheService.wrap(key, fetcher, ttl);
   ```

2. **Invalidate on updates**: Keep cache fresh
   ```typescript
   await storage.updateCourse(id, data);
   await cacheService.delete(`course:${id}`);
   ```

3. **Set appropriate TTLs**: Match data change frequency
   - Rarely changing (tenants): 1 hour
   - Moderate (courses): 10 minutes
   - Frequently changing (stats): 1 minute

4. **Monitor health**: Check `/health/detailed` regularly

5. **Handle cache misses**: Always have fallback logic

### DON'T ❌

1. **Don't rely solely on cache**: Always fetch from DB on miss
2. **Don't use pattern deletion in hot paths**: It's expensive
3. **Don't cache sensitive data**: Sessions are OK, passwords are not
4. **Don't ignore degraded status**: Investigate Redis issues
5. **Don't set TTL too long**: Stale data is worse than no cache

## Migration Guide

### From No Caching

1. Install dependencies:
   ```bash
   npm install ioredis connect-redis@7
   ```

2. Add environment variables to `.env`

3. Deploy with Redis available

4. Monitor cache hit rates

### From Other Cache Systems

1. Keep existing cache during migration
2. Deploy Redis alongside
3. Gradually move keys to new pattern
4. Deprecate old cache once stable

## Security Considerations

### Redis Authentication

Always use password authentication in production:

```env
REDIS_PASSWORD=strong_random_password_here
```

### Network Security

1. **Firewall Rules**: Only allow access from app servers
2. **TLS/SSL**: Use encrypted connections for remote Redis
3. **ACLs**: Configure Redis ACLs for fine-grained access

### Cache Poisoning

Prevent cache poisoning attacks:
1. Validate data before caching
2. Use signed session tokens
3. Implement rate limiting on cache clear endpoints

## Performance Targets

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| API Response Time | 300ms | <150ms | 🎯 Target |
| Database Load | 100% | <40% | 🎯 Target |
| Session Lookup | 50ms | <5ms | 🎯 Target |
| Dashboard Load | 500ms | <50ms | 🎯 Target |
| Cache Hit Rate | 0% | >70% | 🎯 Target |

## Support

For issues or questions:
1. Check logs: `tail -f logs/app.log`
2. Review health endpoint: `curl http://localhost:5000/health/detailed`
3. Test Redis connection: `redis-cli -h localhost -p 6379 ping`

## Changelog

### Phase 2.1 (Current)
- ✅ Redis client singleton with reconnection
- ✅ Cache service with graceful degradation
- ✅ Session migration to Redis
- ✅ Storage layer caching
- ✅ SCORM manifest caching
- ✅ Health checks and monitoring
- ✅ Admin cache management
- ✅ Comprehensive test suite

### Future Enhancements
- 🔜 Cache warming on startup
- 🔜 Distributed cache invalidation
- 🔜 Cache metrics dashboard
- 🔜 Advanced eviction policies
- 🔜 Redis Cluster support

---

**Last Updated**: November 16, 2025  
**Version**: 2.1.0  
**Status**: Production Ready ✅
