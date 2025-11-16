# 🔒 Security Implementation Guide

## Phase 1.2: Enterprise-Grade Security Features

This document describes the comprehensive security measures implemented in the LMS-SCORM platform to achieve production-ready security standards.

---

## 🛡️ Security Features Implemented

### 1. Rate Limiting

**Purpose**: Prevent abuse, DDoS attacks, and brute-force attempts

**Implementation**: `server/middleware/rateLimiter.ts`

#### Rate Limit Tiers:

- **Standard API Limiter**
  - 100 requests per 15 minutes per IP
  - Applied to most API endpoints
  - Returns HTTP 429 with retry-after header

- **Authentication Limiter**
  - 5 login attempts per 15 minutes per IP
  - Prevents brute-force attacks
  - Doesn't count successful authentications

- **Upload Limiter**
  - 20 uploads per hour per IP
  - More lenient due to large file sizes
  - Doesn't count failed uploads

- **API Key Limiter**
  - 10 API key operations per day per user
  - Prevents key generation abuse

- **Speed Limiter**
  - Gradual response delay after 50 requests
  - 100ms additional delay per request
  - Maximum 5 seconds delay

#### Usage Example:

```typescript
import { authLimiter, uploadLimiter } from './middleware/rateLimiter';

// Apply to auth endpoints
app.post('/api/auth/login', authLimiter, loginHandler);

// Apply to upload endpoints
app.post('/api/courses/upload', uploadLimiter, uploadHandler);
```

---

### 2. Audit Logging

**Purpose**: Track sensitive operations for compliance, security, and debugging

**Implementation**: `server/middleware/auditLog.ts`

#### Audited Actions:

**Authentication:**
- Login/logout events
- Failed login attempts
- Password changes

**User Management:**
- User creation, updates, deletion
- Role changes

**Course Management:**
- Course uploads, updates, deletions
- Course exports

**Dispatch Management:**
- Dispatch creation, updates, deletion
- User additions/removals

**License Management:**
- License updates
- License limit exceeded events

**Security Events:**
- Unauthorized access attempts
- Permission denied events
- Rate limit exceeded events

#### Log Format:

```typescript
{
  userId: number | null,
  tenantId: number | null,
  action: string,              // e.g., 'course.upload'
  resource: string,             // e.g., 'course'
  resourceId?: string,          // e.g., course ID
  ipAddress: string,
  userAgent: string,
  metadata: {
    method: string,
    path: string,
    query: object,
    body: object              // Sensitive fields redacted
  },
  timestamp: Date,
  success: boolean,
  errorMessage?: string
}
```

#### Usage Example:

```typescript
import { auditAction, AUDITABLE_ACTIONS } from './middleware/auditLog';

// Audit a specific action
app.post('/api/courses', 
  auditAction(AUDITABLE_ACTIONS.COURSE_UPLOAD, 'course'),
  createCourseHandler
);

// Auto-audit all state-changing operations
app.use(autoAudit());
```

---

### 3. API Key Management

**Purpose**: Secure programmatic access with fine-grained permissions

**Implementation**: `server/middleware/apiKeys.ts`

#### Features:

- **Secure Generation**: Cryptographically random keys with SHA-256 hashing
- **Key Format**: `prefix_64hexchars` (e.g., `sk_abc123...`)
- **Scope-Based Permissions**: Fine-grained access control
- **Expiration Support**: Optional time-based expiration
- **Usage Tracking**: Last used timestamp
- **Key Rotation**: Secure key rotation mechanism

#### Available Scopes:

```typescript
// Course operations
COURSE_READ: 'course:read'
COURSE_WRITE: 'course:write'
COURSE_DELETE: 'course:delete'

// Dispatch operations
DISPATCH_READ: 'dispatch:read'
DISPATCH_WRITE: 'dispatch:write'
DISPATCH_DELETE: 'dispatch:delete'

// Analytics
ANALYTICS_READ: 'analytics:read'

// xAPI
XAPI_WRITE: 'xapi:write'
XAPI_READ: 'xapi:read'

// Admin (wildcard)
ADMIN: 'admin:*'
```

#### API Usage:

**Creating an API Key:**
```typescript
import { createApiKey } from './middleware/apiKeys';

const { key, id } = await createApiKey({
  tenantId: 1,
  userId: 123,
  name: 'Production API Key',
  scopes: ['course:read', 'dispatch:write'],
  expiresInDays: 90
});

// Return key to user (ONLY TIME IT'S SHOWN)
console.log('Your API key:', key);
```

**Protecting Routes:**
```typescript
import { apiKeyAuth, API_SCOPES } from './middleware/apiKeys';

// Require API key with specific scopes
app.get('/api/courses', 
  apiKeyAuth([API_SCOPES.COURSE_READ]),
  listCoursesHandler
);
```

**Using API Keys (Client):**
```bash
# Via X-API-Key header
curl -H "X-API-Key: sk_abc123..." https://api.example.com/courses

# Via Authorization header
curl -H "Authorization: Bearer sk_abc123..." https://api.example.com/courses
```

**Rotating Keys:**
```typescript
import { rotateApiKey } from './middleware/apiKeys';

const newKey = await rotateApiKey(oldKeyId, {
  tenantId: 1,
  userId: 123,
  name: 'Rotated Key',
  scopes: ['course:read']
});
```

---

### 4. Security Headers

**Purpose**: Protect against common web vulnerabilities

**Implementation**: `server/middleware/security.ts`

#### Headers Applied:

**Content Security Policy (CSP):**
- Prevents XSS attacks
- Controls resource loading
- Allows SCORM iframe embedding

**HTTP Strict Transport Security (HSTS):**
- Enforces HTTPS
- 1 year max-age
- Include subdomains

**Frame Protection:**
- X-Frame-Options: DENY
- Prevents clickjacking

**MIME Type Sniffing:**
- X-Content-Type-Options: nosniff
- Prevents MIME confusion attacks

**XSS Protection:**
- X-XSS-Protection: 1; mode=block
- Browser-level XSS filtering

**Referrer Policy:**
- strict-origin-when-cross-origin
- Privacy protection

**Permissions Policy:**
- Disables unnecessary browser features
- geolocation, microphone, camera, etc.

#### Additional Security Middleware:

**IP Whitelist:**
```typescript
import { ipWhitelist } from './middleware/security';

// Protect admin endpoints
app.use('/api/admin', ipWhitelist(['192.168.1.0/24']));
```

**User Agent Validation:**
```typescript
import { validateUserAgent } from './middleware/security';

// Block suspicious bots
app.use(validateUserAgent());
```

**Request Size Validation:**
```typescript
import { validateRequestSize } from './middleware/security';

// Limit request size
app.use(validateRequestSize(512)); // 512MB max
```

**Input Sanitization:**
```typescript
import { sanitizeInput } from './middleware/security';

// Sanitize all inputs
app.use(sanitizeInput());
```

---

## 🔐 Security Best Practices

### API Key Management

1. **Never commit API keys to version control**
2. **Store keys in environment variables or secrets manager**
3. **Rotate keys regularly (recommended: every 90 days)**
4. **Use minimal scopes (principle of least privilege)**
5. **Revoke keys immediately when compromised**
6. **Never log full API keys (hash or truncate them)**

### Rate Limiting

1. **Adjust limits based on your traffic patterns**
2. **Monitor rate limit hits for abuse patterns**
3. **Consider user-specific limits for authenticated requests**
4. **Use distributed rate limiting (Redis) for multi-server deployments**

### Audit Logging

1. **Never log sensitive data (passwords, API keys, credit cards)**
2. **Retain logs for compliance requirements (typically 90-365 days)**
3. **Monitor logs for security events**
4. **Export logs to SIEM for analysis**
5. **Implement log rotation and archival**

### Security Headers

1. **Test CSP policy thoroughly (can break legitimate functionality)**
2. **Enable HSTS only after confirming HTTPS works properly**
3. **Keep Helmet.js updated for latest security patches**
4. **Monitor browser console for CSP violations**

---

## 📊 Security Monitoring

### Metrics to Track:

1. **Rate Limit Hits**
   - High rate limit hits may indicate abuse
   - Track by IP and endpoint

2. **Failed Authentication Attempts**
   - Multiple failures from same IP = potential brute force
   - Alert after threshold (e.g., 10 failures)

3. **Invalid API Key Attempts**
   - Track revoked or invalid key usage
   - May indicate compromised key

4. **Suspicious User Agents**
   - Block known scanners and bots
   - Update blocklist regularly

5. **Unusual Traffic Patterns**
   - Sudden spikes in requests
   - Off-hours activity
   - Geographic anomalies

### Recommended Monitoring Tools:

- **Application Performance Monitoring**: Datadog, New Relic, Sentry
- **Log Aggregation**: Splunk, ELK Stack, Loggly
- **Security Information and Event Management**: Splunk, IBM QRadar
- **Intrusion Detection**: Fail2ban, OSSEC

---

## 🧪 Testing Security Features

### Unit Tests:

```bash
# Test rate limiter configuration
npm test -- server/middleware/rateLimiter.test.ts

# Test API key generation and validation
npm test -- server/middleware/apiKeys.test.ts
```

### Integration Tests:

```typescript
describe('Rate Limiting Integration', () => {
  it('should block after max attempts', async () => {
    // Make 6 requests (limit is 5)
    for (let i = 0; i < 6; i++) {
      const response = await request(app).post('/api/auth/login');
      if (i < 5) {
        expect(response.status).not.toBe(429);
      } else {
        expect(response.status).toBe(429);
        expect(response.body.error).toBe('AUTH_RATE_LIMIT_EXCEEDED');
      }
    }
  });
});
```

### Manual Security Testing:

1. **Test Rate Limiting**:
   ```bash
   # Send multiple rapid requests
   for i in {1..10}; do curl -X POST http://localhost:5000/api/auth/login; done
   ```

2. **Test API Key Authentication**:
   ```bash
   # With valid key
   curl -H "X-API-Key: sk_valid..." http://localhost:5000/api/courses
   
   # With invalid key
   curl -H "X-API-Key: invalid" http://localhost:5000/api/courses
   ```

3. **Test Security Headers**:
   ```bash
   curl -I http://localhost:5000
   # Check for X-Frame-Options, CSP, HSTS, etc.
   ```

---

## 🚀 Production Deployment Checklist

- [ ] Environment variables configured (SESSION_SECRET, etc.)
- [ ] Rate limiting configured for production traffic
- [ ] Audit logging enabled and forwarded to log aggregator
- [ ] API keys generated for production integrations
- [ ] Security headers configured (HSTS enabled)
- [ ] IP whitelisting configured for admin endpoints
- [ ] Monitoring and alerting setup
- [ ] SSL/TLS certificates installed and valid
- [ ] Backup and disaster recovery tested
- [ ] Security scan completed (OWASP ZAP, Nessus)
- [ ] Penetration testing performed
- [ ] Security documentation updated
- [ ] Team trained on security procedures

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## 🆘 Security Incident Response

If you discover a security vulnerability:

1. **Do NOT disclose publicly**
2. **Email security team immediately**
3. **Provide detailed description and steps to reproduce**
4. **Include affected versions and potential impact**
5. **Wait for acknowledgment before disclosure**

---

**Last Updated**: November 16, 2025
**Version**: 1.0.0
**Maintainer**: Security Team
