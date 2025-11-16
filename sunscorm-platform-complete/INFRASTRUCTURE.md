# 🏗️ Infrastructure & Deployment Guide

## Phase 1.3: Enterprise Infrastructure Setup

This document provides guidance for deploying the LMS-SCORM platform in a production environment with high availability, performance optimization, and automated backup systems.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Setup](#database-setup)
3. [Redis Cache](#redis-cache)
4. [CDN Configuration](#cdn-configuration)
5. [Load Balancing](#load-balancing)
6. [Backup & Recovery](#backup--recovery)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Performance Optimization](#performance-optimization)
9. [High Availability](#high-availability)
10. [Deployment Checklist](#deployment-checklist)

---

## 🏛️ Architecture Overview

### Recommended Production Architecture

```
┌─────────────────┐
│   CloudFlare    │ ← CDN for static assets
│      CDN        │
└────────┬────────┘
         │
┌────────▼────────┐
│  Load Balancer  │ ← AWS ELB / Nginx
│   (SSL Term.)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ App   │ │ App   │ ← Node.js instances (horizontal scaling)
│ Node1 │ │ Node2 │
└───┬───┘ └──┬────┘
    │        │
    └────┬───┘
         │
    ┌────▼────┐
    │  Redis  │ ← Session store & cache
    │ Cluster │
    └────┬────┘
         │
    ┌────▼────┐
    │Postgres │ ← Primary database
    │  RDS    │
    └────┬────┘
         │
    ┌────▼────┐
    │   S3    │ ← SCORM file storage
    │ Bucket  │
    └─────────┘
```

### Components:

1. **CDN (CloudFlare/CloudFront)**: Serves static assets and SCORM content
2. **Load Balancer**: Distributes traffic across app instances
3. **App Servers**: Node.js application servers (2+ instances)
4. **Redis**: Session storage and caching layer
5. **PostgreSQL**: Primary database (RDS with read replicas)
6. **S3**: Object storage for SCORM packages
7. **Monitoring**: Application Performance Monitoring (Datadog/New Relic)

---

## 💾 Database Setup

### PostgreSQL Configuration

#### Production Settings:

```sql
-- Performance tuning
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET random_page_cost = '1.1';
ALTER SYSTEM SET effective_io_concurrency = '200';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- Connection pooling
ALTER SYSTEM SET max_connections = '200';

-- Reload configuration
SELECT pg_reload_conf();
```

#### Indexes for Performance:

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_courses_tenant_id ON courses(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_dispatches_course_id ON dispatches(course_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_dispatch_users_dispatch_id ON dispatch_users(dispatch_id);
CREATE INDEX CONCURRENTLY idx_xapi_statements_actor ON xapi_statements(actor_id);
CREATE INDEX CONCURRENTLY idx_xapi_statements_timestamp ON xapi_statements(created_at);

-- Partial indexes for soft deletes
CREATE INDEX CONCURRENTLY idx_courses_active ON courses(id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_dispatches_active ON dispatches(id) WHERE deleted_at IS NULL;
```

#### Read Replicas:

```typescript
// Configure read/write splitting
import { Pool } from 'pg';

const writePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

const readPool = new Pool({
  connectionString: process.env.DATABASE_READ_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

// Use read replica for read-only queries
export async function getCoursesOptimized() {
  const result = await readPool.query('SELECT * FROM courses WHERE deleted_at IS NULL');
  return result.rows;
}
```

---

## 🔴 Redis Cache

### Redis Setup

#### Installation (Docker):

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

  redis-commander:
    image: rediscommander/redis-commander:latest
    ports:
      - "8081:8081"
    environment:
      - REDIS_HOSTS=local:redis:6379
    depends_on:
      - redis

volumes:
  redis-data:
```

#### Redis Configuration:

```typescript
// server/cache.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (error) => {
  console.error('[REDIS] Connection error:', error);
});

redis.on('connect', () => {
  console.log('[REDIS] Connected successfully');
});

export { redis };
```

#### Caching Strategies:

```typescript
// Cache course data
export async function getCourseWithCache(courseId: string) {
  const cacheKey = `course:${courseId}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Cache miss - fetch from database
  const course = await storage.getCourse(courseId);
  
  // Store in cache (15 minutes TTL)
  await redis.setex(cacheKey, 900, JSON.stringify(course));
  
  return course;
}

// Invalidate cache on update
export async function updateCourseWithCache(courseId: string, data: any) {
  const updated = await storage.updateCourse(courseId, data);
  
  // Invalidate cache
  await redis.del(`course:${courseId}`);
  
  return updated;
}

// Session storage in Redis
import session from 'express-session';
import RedisStore from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));
```

---

## 🌐 CDN Configuration

### CloudFlare Setup

#### DNS Configuration:

1. Point domain to CloudFlare nameservers
2. Enable "Proxied" (orange cloud) for main domain
3. Configure SSL/TLS: Full (strict)

#### Page Rules:

```
1. Cache Everything for SCORM assets:
   URL: *example.com/api/preview/*/assets/*
   Settings:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   - Browser Cache TTL: 1 week

2. Bypass cache for API:
   URL: *example.com/api/*
   Settings:
   - Cache Level: Bypass

3. Security settings:
   URL: *example.com/*
   Settings:
   - Security Level: High
   - Browser Integrity Check: On
```

#### Performance Settings:

- **Auto Minify**: Enable JS, CSS, HTML
- **Brotli**: Enabled
- **HTTP/2**: Enabled
- **HTTP/3 (QUIC)**: Enabled

### AWS CloudFront Alternative:

```typescript
// CDN URL configuration
const CDN_URL = process.env.CDN_URL || '';

export function getCDNUrl(path: string): string {
  if (!CDN_URL) return path;
  return `${CDN_URL}${path}`;
}

// Use in SCORM asset serving
app.get('/api/preview/:courseId/assets/*', async (req, res) => {
  const assetPath = req.params[0];
  
  // Redirect to CDN if available
  if (CDN_URL) {
    return res.redirect(`${CDN_URL}/courses/${req.params.courseId}/${assetPath}`);
  }
  
  // Otherwise serve locally
  // ... local serving logic
});
```

---

## ⚖️ Load Balancing

### Nginx Configuration:

```nginx
upstream scorm_app {
    least_conn;
    server app1:5000 weight=1 max_fails=3 fail_timeout=30s;
    server app2:5000 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Large file upload support
    client_max_body_size 512M;
    client_body_timeout 300s;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss;
    
    location / {
        proxy_pass http://scorm_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://scorm_app;
    }
}
```

---

## 💾 Backup & Recovery

### Automated Backup Strategy

#### PostgreSQL Backups:

```bash
#!/bin/bash
# backup-db.sh

# Configuration
DB_NAME="scorm_production"
BACKUP_DIR="/backups/postgres"
S3_BUCKET="s3://my-backups/postgres"
RETENTION_DAYS=30

# Create backup with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Perform backup
pg_dump -Fc -h localhost -U postgres ${DB_NAME} | gzip > ${BACKUP_FILE}

# Upload to S3
aws s3 cp ${BACKUP_FILE} ${S3_BUCKET}/

# Delete local backups older than 7 days
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +7 -delete

# Delete S3 backups older than retention period
aws s3 ls ${S3_BUCKET}/ | while read -r line; do
    file=$(echo $line | awk '{print $4}')
    fileDate=$(echo $file | grep -oP '\d{8}' | head -1)
    if [ ! -z "$fileDate" ]; then
        age=$(( ($(date +%s) - $(date -d "$fileDate" +%s)) / 86400 ))
        if [ $age -gt $RETENTION_DAYS ]; then
            aws s3 rm ${S3_BUCKET}/${file}
        fi
    fi
done

echo "Backup completed: ${BACKUP_FILE}"
```

#### Cron Schedule:

```cron
# Daily full backup at 2 AM
0 2 * * * /opt/scripts/backup-db.sh

# Hourly WAL archiving
0 * * * * /opt/scripts/archive-wal.sh
```

#### Restore Procedure:

```bash
#!/bin/bash
# restore-db.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore-db.sh <backup-file>"
    exit 1
fi

# Download from S3 if needed
if [[ $BACKUP_FILE == s3://* ]]; then
    aws s3 cp $BACKUP_FILE /tmp/restore.sql.gz
    BACKUP_FILE="/tmp/restore.sql.gz"
fi

# Stop application
systemctl stop scorm-app

# Restore database
gunzip < $BACKUP_FILE | pg_restore -Fc -d scorm_production

# Start application
systemctl start scorm-app

echo "Database restored from ${BACKUP_FILE}"
```

#### Redis Backups:

```bash
#!/bin/bash
# backup-redis.sh

REDIS_HOST="localhost"
REDIS_PORT="6379"
BACKUP_DIR="/backups/redis"
S3_BUCKET="s3://my-backups/redis"

# Trigger Redis save
redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} BGSAVE

# Wait for save to complete
while [ $(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} LASTSAVE) -eq $LAST_SAVE ]; do
    sleep 1
done

# Copy RDB file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp /var/lib/redis/dump.rdb ${BACKUP_DIR}/dump_${TIMESTAMP}.rdb

# Upload to S3
aws s3 cp ${BACKUP_DIR}/dump_${TIMESTAMP}.rdb ${S3_BUCKET}/
```

---

## 📊 Monitoring & Alerting

### Application Performance Monitoring

#### Datadog Integration:

```typescript
// server/monitoring.ts
import StatsD from 'hot-shots';

const dogstatsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: 8125,
  globalTags: {
    env: process.env.NODE_ENV,
    service: 'scorm-platform',
  },
});

// Track request duration
export function trackRequest(req: Request, res: Response, duration: number) {
  dogstatsd.histogram('http.request.duration', duration, {
    method: req.method,
    path: req.route?.path || req.path,
    status: res.statusCode.toString(),
  });
}

// Track business metrics
export function trackCourseUpload(tenantId: string, fileSize: number) {
  dogstatsd.increment('course.upload', 1, { tenant_id: tenantId });
  dogstatsd.histogram('course.upload.size', fileSize, { tenant_id: tenantId });
}

// Track errors
export function trackError(error: Error, context: any) {
  dogstatsd.increment('error', 1, {
    error_type: error.name,
    ...context,
  });
}
```

#### Health Check Endpoint:

```typescript
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      storage: 'unknown',
    },
  };

  try {
    // Check database
    await storage.getUsers();
    health.checks.database = 'healthy';
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check Redis
    await redis.ping();
    health.checks.redis = 'healthy';
  } catch (error) {
    health.checks.redis = 'unhealthy';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

## 🚀 Performance Optimization

### Recommended Optimizations:

1. **Enable compression**: Gzip/Brotli for API responses
2. **Connection pooling**: Limit database connections
3. **Query optimization**: Use EXPLAIN ANALYZE for slow queries
4. **Asset optimization**: Minify JS/CSS, optimize images
5. **Lazy loading**: Load SCORM content on-demand
6. **Pagination**: Limit result sets to 50-100 items
7. **Indexes**: Add indexes for frequently queried fields
8. **Caching**: Use Redis for session and data caching

---

## 🔄 High Availability

### Zero-Downtime Deployment:

```bash
#!/bin/bash
# deploy.sh

# Rolling deployment
for server in app1 app2; do
    echo "Deploying to ${server}..."
    
    # Pull latest code
    ssh ${server} "cd /opt/scorm-app && git pull"
    
    # Install dependencies
    ssh ${server} "cd /opt/scorm-app && npm ci"
    
    # Build application
    ssh ${server} "cd /opt/scorm-app && npm run build"
    
    # Restart application (PM2)
    ssh ${server} "pm2 restart scorm-app"
    
    # Wait for health check
    sleep 30
    
    # Verify health
    if ! curl -f http://${server}:5000/health; then
        echo "Health check failed on ${server}. Rolling back..."
        ssh ${server} "pm2 restart scorm-app"
        exit 1
    fi
    
    echo "Deployment to ${server} successful"
done
```

---

## ✅ Deployment Checklist

### Pre-Deployment:
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Backup system tested
- [ ] Monitoring configured
- [ ] Load testing performed
- [ ] Security scan completed

### Deployment:
- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Deploy to production (rolling)
- [ ] Verify health checks
- [ ] Monitor error rates
- [ ] Check performance metrics

### Post-Deployment:
- [ ] Verify all features working
- [ ] Check logs for errors
- [ ] Monitor resource usage
- [ ] Update documentation
- [ ] Notify team

---

**Last Updated**: November 16, 2025
**Version**: 1.0.0
