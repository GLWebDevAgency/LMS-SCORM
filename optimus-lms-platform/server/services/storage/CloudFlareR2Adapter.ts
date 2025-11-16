import { promises as fs } from 'fs';
import { StorageAdapter, UploadOptions, UploadResult, SignedUrlOptions } from './StorageAdapter';

/**
 * CloudFlare R2 Storage Adapter with CDN Integration
 * Implements storage using CloudFlare R2 (S3-compatible) with automatic CDN distribution
 * Recommended for optimal global performance with sub-100ms latency
 */
export class CloudFlareR2Adapter implements StorageAdapter {
  readonly type = 'cloudflare-r2' as const;
  readonly cdnEnabled = true;
  
  private readonly accountId: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucketName: string;
  private readonly cdnDomain: string;
  private readonly region: string;
  
  /**
   * @param config - CloudFlare R2 configuration
   */
  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    cdnDomain: string;
    region?: string;
  }) {
    this.accountId = config.accountId;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucketName = config.bucketName;
    this.cdnDomain = config.cdnDomain;
    this.region = config.region || 'auto';
  }
  
  /**
   * Get S3 client endpoint for CloudFlare R2
   */
  private getEndpoint(): string {
    return `https://${this.accountId}.r2.cloudflarestorage.com`;
  }
  
  /**
   * Create AWS SDK v3 S3 client for R2 (lazy loaded)
   * R2 is S3-compatible, so we use the AWS SDK
   */
  private async getS3Client() {
    // Lazy load AWS SDK to avoid bundling if not used
    const { S3Client } = await import('@aws-sdk/client-s3');
    
    return new S3Client({
      region: this.region,
      endpoint: this.getEndpoint(),
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
  
  /**
   * Upload a file to CloudFlare R2
   */
  async uploadFile(
    filePath: string,
    destinationKey: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getS3Client();
    
    // Read file
    const fileBuffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    
    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: destinationKey,
      Body: fileBuffer,
      ContentType: options?.contentType || 'application/octet-stream',
      CacheControl: options?.cacheControl,
      Metadata: options?.metadata,
    });
    
    const response = await client.send(command);
    
    return {
      key: destinationKey,
      url: this.getPublicUrl(destinationKey),
      size: stats.size,
      etag: response.ETag,
    };
  }
  
  /**
   * Upload a buffer to CloudFlare R2
   */
  async uploadBuffer(
    buffer: Buffer,
    destinationKey: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getS3Client();
    
    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: destinationKey,
      Body: buffer,
      ContentType: options?.contentType || 'application/octet-stream',
      CacheControl: options?.cacheControl,
      Metadata: options?.metadata,
    });
    
    const response = await client.send(command);
    
    return {
      key: destinationKey,
      url: this.getPublicUrl(destinationKey),
      size: buffer.length,
      etag: response.ETag,
    };
  }
  
  /**
   * Delete a file from CloudFlare R2
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.getS3Client();
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      
      await client.send(command);
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${key} from R2:`, error);
      return false;
    }
  }
  
  /**
   * Delete multiple files from CloudFlare R2 (batch operation)
   */
  async deleteFiles(keys: string[]): Promise<number> {
    try {
      const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
      const client = await this.getS3Client();
      
      // R2 supports batch delete (up to 1000 objects per request)
      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false,
        },
      });
      
      const response = await client.send(command);
      return response.Deleted?.length || 0;
    } catch (error) {
      console.error('Failed to batch delete files from R2:', error);
      return 0;
    }
  }
  
  /**
   * Get public CDN URL for a file
   */
  getPublicUrl(key: string): string {
    // Return CDN URL (CloudFlare automatically CDN-enables R2 buckets with custom domain)
    return `https://${this.cdnDomain}/${key}`;
  }
  
  /**
   * Get signed URL for private/temporary access
   */
  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await this.getS3Client();
    
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: options?.contentDisposition,
    });
    
    // Generate signed URL (default: 1 hour expiration)
    const signedUrl = await getSignedUrl(client, command, {
      expiresIn: options?.expiresIn || 3600,
    });
    
    return signedUrl;
  }
  
  /**
   * Check if R2 storage is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
      const client = await this.getS3Client();
      
      const command = new HeadBucketCommand({
        Bucket: this.bucketName,
      });
      
      await client.send(command);
      return true;
    } catch (error) {
      console.error('CloudFlare R2 health check failed:', error);
      return false;
    }
  }
  
  /**
   * Purge CloudFlare CDN cache for specific files
   */
  async purgeCdnCache(keys: string[]): Promise<boolean> {
    try {
      // CloudFlare Zone API for cache purging
      const zoneId = process.env.CLOUDFLARE_ZONE_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      
      if (!zoneId || !apiToken) {
        console.warn('CloudFlare Zone ID or API Token not configured, skipping cache purge');
        return false;
      }
      
      // Convert keys to full URLs
      const urls = keys.map(key => this.getPublicUrl(key));
      
      // Purge cache via CloudFlare API
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: urls,
        }),
      });
      
      if (!response.ok) {
        console.error('CloudFlare cache purge failed:', await response.text());
        return false;
      }
      
      console.log(`Successfully purged ${urls.length} files from CloudFlare CDN cache`);
      return true;
    } catch (error) {
      console.error('Failed to purge CloudFlare CDN cache:', error);
      return false;
    }
  }
}
