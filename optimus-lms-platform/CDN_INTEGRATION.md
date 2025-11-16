# CDN Integration Guide

## Overview

This guide covers the global CDN infrastructure for SCORM assets, enabling sub-100ms latency worldwide using CloudFlare R2 and AWS CloudFront integration with a flexible storage adapter pattern.

## Architecture

### Storage Adapter Pattern

```
┌─────────────────────────────────────────┐
│        Application Layer                 │
│    (Course Upload / SCORM Launch)        │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│       Asset Service                      │
│  (High-level SCORM operations)          │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│     Storage Factory                      │
│  (Provider selection & fallback)        │
└─────┬─────────┬────────────┬────────────┘
      │         │            │
┌─────▼─┐  ┌────▼───┐  ┌────▼────────┐
│ Local │  │ R2 CDN │  │ S3+CloudFront│
│Storage│  │        │  │              │
└───────┘  └────────┘  └──────────────┘
```

### Components

1. **Storage Adapters** (`server/services/storage/`)
   - `StorageAdapter.ts` - Base interface for all storage providers
   - `LocalStorageAdapter.ts` - Filesystem storage (default/fallback)
   - `CloudFlareR2Adapter.ts` - CloudFlare R2 with automatic CDN
   - `S3CloudFrontAdapter.ts` - AWS S3 + CloudFront

2. **Asset Service** (`server/services/assetService.ts`)
   - High-level SCORM asset management
   - ZIP extraction and upload
   - URL generation (public and signed)
   - Asset cleanup

3. **CDN Service** (`server/services/cdnService.ts`)
   - Cache purging and invalidation
   - CDN status monitoring
   - Analytics integration (future)

4. **Admin Routes** (`server/routes/admin.ts`)
   - POST `/api/admin/cdn/purge` - Manual cache purge
   - POST `/api/admin/cdn/purge/:courseId` - Per-course cache purge
   - GET `/api/admin/cdn/status` - CDN status and metrics
   - GET `/api/admin/storage/info` - Storage provider information

## Setup Guides

### Option 1: CloudFlare R2 (Recommended)

**Why CloudFlare R2?**
- S3-compatible API (easy migration)
- Zero egress fees
- Automatic CDN distribution
- Sub-100ms global latency
- Simple pricing: $0.015/GB storage

#### Step 1: Create CloudFlare R2 Bucket

1. Sign up at [cloudflare.com](https://www.cloudflare.com/products/r2/)
2. Navigate to R2 Object Storage
3. Create a new bucket (e.g., `scorm-assets-prod`)
4. Enable public access or configure custom domain

#### Step 2: Generate API Credentials

1. Go to R2 → Manage R2 API Tokens
2. Create API token with read/write permissions
3. Note down:
   - Account ID
   - Access Key ID
   - Secret Access Key

#### Step 3: Configure Custom Domain (Optional but Recommended)

1. Go to your R2 bucket settings
2. Add custom domain (e.g., `cdn.yourdomain.com`)
3. CloudFlare automatically provisions SSL certificate
4. Update DNS as instructed

#### Step 4: Environment Configuration

Add to your `.env` file:

```bash
# Storage Provider
STORAGE_PROVIDER=cloudflare-r2

# CloudFlare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=scorm-assets-prod
CLOUDFLARE_R2_CDN_DOMAIN=cdn.yourdomain.com

# CloudFlare Zone Configuration (for cache purging)
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_api_token
```

#### Step 5: Install AWS SDK (R2 is S3-compatible)

```bash
pnpm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

#### Step 6: Restart Application

```bash
npm run dev  # Development
# or
npm start    # Production
```

The system will automatically use CloudFlare R2 for all new course uploads!

---

### Option 2: AWS S3 + CloudFront

**Why AWS S3 + CloudFront?**
- Enterprise-grade infrastructure
- Advanced caching controls
- Integration with existing AWS services
- Mature ecosystem and tooling

#### Step 1: Create S3 Bucket

1. Log into AWS Console → S3
2. Create bucket (e.g., `scorm-assets-prod`)
3. Region: Choose closest to your users
4. Block public access: Configure based on security requirements
5. Enable versioning (recommended)

#### Step 2: Configure S3 Bucket Policy

Example policy for CloudFront access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity YOUR_OAI_ID"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::scorm-assets-prod/*"
    }
  ]
}
```

#### Step 3: Create CloudFront Distribution

1. AWS Console → CloudFront → Create Distribution
2. Origin Settings:
   - Origin Domain: Your S3 bucket
   - Origin Access: Origin Access Identity (OAI)
3. Default Cache Behavior:
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD, OPTIONS
   - Cache Policy: CachingOptimized
4. Distribution Settings:
   - Alternate Domain Names (CNAMEs): cdn.yourdomain.com
   - SSL Certificate: Request ACM certificate
5. Create distribution and wait for deployment (~15 minutes)

#### Step 4: Configure DNS

Add CNAME record:
```
cdn.yourdomain.com → d111111abcdef8.cloudfront.net
```

#### Step 5: Create IAM User with Permissions

Create IAM user with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::scorm-assets-prod",
        "arn:aws:s3:::scorm-assets-prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
    }
  ]
}
```

#### Step 6: Environment Configuration

Add to your `.env` file:

```bash
# Storage Provider
STORAGE_PROVIDER=s3-cloudfront

# AWS S3 + CloudFront Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET_NAME=scorm-assets-prod
AWS_CLOUDFRONT_DOMAIN=cdn.yourdomain.com
AWS_CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC
```

#### Step 7: Install AWS SDKs

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/client-cloudfront
```

#### Step 8: Restart Application

```bash
npm run dev  # Development
# or
npm start    # Production
```

---

### Option 3: Local Storage (Default)

**When to use Local Storage?**
- Development environment
- Low-traffic deployments
- When CDN costs are a concern
- Testing and staging environments

Local storage is the default and requires no additional configuration. Files are stored in `uploads/courses/` directory.

To explicitly use local storage:

```bash
# Storage Provider (or leave unset)
STORAGE_PROVIDER=local

# Optional: Custom uploads directory
UPLOADS_DIR=/var/www/uploads

# Optional: Public domain for URLs
PUBLIC_DOMAIN=https://yourdomain.com
```

## Migration Guide

### Migrating Existing Courses to CDN

If you have existing courses in local storage and want to migrate to CDN:

#### Step 1: Run Database Migration

```bash
# Apply database schema changes
psql $DATABASE_URL < migrations/add_cdn_fields.sql
```

#### Step 2: Configure CDN Provider

Follow the setup guide for your chosen provider (CloudFlare R2 or AWS S3+CloudFront).

#### Step 3: Use Migration Script (Coming Soon)

```bash
# This will upload existing courses to CDN and update database
npm run migrate-to-cdn
```

Or migrate manually via admin interface:
1. Admin Dashboard → Courses
2. Select course to migrate
3. Click "Migrate to CDN"
4. System uploads to CDN and updates database

#### Step 4: Verify Migration

1. Check Admin → CDN Status
2. Test course launches
3. Verify CDN URLs in course records

## Cache Management

### Manual Cache Purging

**Admin Dashboard:**
1. Navigate to Admin → CDN Management
2. Options:
   - Purge All Cache
   - Purge Course Cache (by Course ID)
   - Purge Specific URLs

**API Endpoints:**

```bash
# Purge all cache
curl -X POST https://your-domain.com/api/admin/cdn/purge \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your_csrf_token" \
  -d '{"purgeAll": true}'

# Purge specific course
curl -X POST https://your-domain.com/api/admin/cdn/purge/course-id-123 \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your_csrf_token"

# Purge specific URLs
curl -X POST https://your-domain.com/api/admin/cdn/purge \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your_csrf_token" \
  -d '{"keys": ["courses/123/package.zip", "courses/456/package.zip"]}'
```

### Automatic Cache Purging

Cache is automatically purged when:
- Course is deleted (soft delete)
- Course file is replaced/updated
- Manual purge via admin interface

### Cache Headers

The system applies optimal cache headers:

**SCORM Packages (ZIP files):**
- `Cache-Control: public, max-age=31536000, immutable`
- 1 year cache (packages are immutable)

**HTML files:**
- `Cache-Control: public, max-age=3600`
- 1 hour cache (allows for updates)

**Assets (JS, CSS, images, etc.):**
- `Cache-Control: public, max-age=31536000, immutable`
- 1 year cache (asset versioning via file names)

## Performance Optimization

### Best Practices

1. **Use CloudFlare R2 for Best Performance**
   - Automatic global distribution
   - Zero egress fees
   - Fastest setup

2. **Enable CDN for All Courses**
   - Set `STORAGE_PROVIDER=cloudflare-r2` or `s3-cloudfront`
   - New courses automatically use CDN
   - Migrate existing courses

3. **Monitor Cache Hit Rates**
   - Target: 95%+ cache hit rate
   - Check Admin → CDN Analytics
   - Purge cache sparingly

4. **Optimize SCORM Packages**
   - Compress images (use WebP)
   - Minify JavaScript and CSS
   - Remove unnecessary files

5. **Use Custom Domains**
   - Better branding
   - Consistent URLs
   - SSL/TLS included

### Expected Performance

| Metric | Before CDN | After CDN |
|--------|-----------|-----------|
| **Global Latency** | 500ms+ | <100ms |
| **Origin Bandwidth** | 100% | 20% |
| **CDN Hit Rate** | 0% | 95%+ |
| **SCORM Launch Time** | 2-5s | 200-500ms |
| **Concurrent Users** | Limited | Unlimited |

## Troubleshooting

### Common Issues

#### Issue: "CDN upload failed, falling back to local storage"

**Cause:** CDN credentials invalid or CDN service unavailable

**Solution:**
1. Verify environment variables are set correctly
2. Check AWS SDK is installed: `npm install @aws-sdk/client-s3`
3. Test credentials manually
4. Check CloudFlare/AWS service status

#### Issue: "Course assets not loading"

**Cause:** CDN URLs incorrect or CORS configuration missing

**Solution:**
1. Check CDN domain in `.env`
2. Verify bucket/distribution is public
3. Configure CORS on S3 bucket:

```json
{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": []
  }]
}
```

#### Issue: "Cache not purging"

**Cause:** Missing API credentials or incorrect configuration

**Solution:**
1. Verify CloudFlare Zone ID and API Token
2. For AWS: Check CloudFront Distribution ID
3. Ensure IAM user has invalidation permissions

#### Issue: "High CDN costs"

**Cause:** Frequent cache purging or high egress

**Solution:**
1. Use CloudFlare R2 (zero egress fees)
2. Reduce cache purge frequency
3. Optimize asset sizes

### Health Checks

```bash
# Check CDN status
curl https://your-domain.com/api/admin/cdn/status

# Check storage provider
curl https://your-domain.com/api/admin/storage/info

# System health
curl https://your-domain.com/health/detailed
```

## Security Considerations

1. **Private Content**
   - Use signed URLs for private courses
   - Set appropriate expiration times
   - Implement access controls

2. **API Credentials**
   - Never commit credentials to git
   - Use environment variables
   - Rotate credentials regularly
   - Use least-privilege IAM policies

3. **CORS Configuration**
   - Restrict allowed origins in production
   - Only allow necessary HTTP methods
   - Review CORS configuration regularly

4. **Access Control**
   - CDN management requires admin role
   - Audit CDN operations
   - Monitor for unusual activity

## Cost Estimation

### CloudFlare R2

**Storage:** $0.015/GB/month
**Operations:** 
- Class A (writes): $4.50/million requests
- Class B (reads): $0.36/million requests
- **Egress: FREE**

**Example (1TB storage, 10M reads/month):**
- Storage: $15/month
- Reads: $3.60/month
- **Total: ~$19/month**

### AWS S3 + CloudFront

**S3 Storage:** $0.023/GB/month (us-east-1)
**CloudFront:**
- Data Transfer: $0.085/GB (first 10TB)
- Requests: $0.0075/10,000 requests

**Example (1TB storage, 10M reads/month):**
- S3 Storage: $23/month
- CloudFront Transfer (assuming 2TB): $170/month
- **Total: ~$193/month**

**Recommendation:** CloudFlare R2 is 10x more cost-effective for high-traffic workloads.

## Support

For issues or questions:
1. Check [GitHub Issues](https://github.com/GLWebDevAgency/LMS-SCORM/issues)
2. Review [REDIS_CACHING.md](./REDIS_CACHING.md) for related caching concepts
3. Contact support team

## Changelog

### Version 1.0.0 (Current)
- ✅ Storage adapter pattern with 3 providers
- ✅ CloudFlare R2 integration
- ✅ AWS S3 + CloudFront integration
- ✅ Asset service for SCORM management
- ✅ CDN cache purging
- ✅ Admin management endpoints
- ✅ Automatic fallback to local storage
- ✅ Backward compatibility with existing courses

### Roadmap
- [ ] Migration script for bulk course migration
- [ ] CDN analytics dashboard
- [ ] Automatic cache warming
- [ ] Multi-region replication
- [ ] Advanced signed URL policies
