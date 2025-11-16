import { promises as fs } from 'fs';
import { StorageAdapter, UploadOptions, UploadResult, SignedUrlOptions } from './StorageAdapter';

/**
 * AWS S3 + CloudFront Storage Adapter with CDN Integration
 * Implements storage using AWS S3 with CloudFront CDN distribution
 * Alternative to CloudFlare R2 for organizations already using AWS infrastructure
 */
export class S3CloudFrontAdapter implements StorageAdapter {
  readonly type = 's3-cloudfront' as const;
  readonly cdnEnabled = true;
  
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucketName: string;
  private readonly cloudFrontDomain: string;
  private readonly cloudFrontDistributionId?: string;
  
  /**
   * @param config - AWS S3 + CloudFront configuration
   */
  constructor(config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    cloudFrontDomain: string;
    cloudFrontDistributionId?: string;
  }) {
    this.region = config.region;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucketName = config.bucketName;
    this.cloudFrontDomain = config.cloudFrontDomain;
    this.cloudFrontDistributionId = config.cloudFrontDistributionId;
  }
  
  /**
   * Create AWS SDK v3 S3 client (lazy loaded)
   */
  private async getS3Client() {
    const { S3Client } = await import('@aws-sdk/client-s3');
    
    return new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
  
  /**
   * Create AWS SDK v3 CloudFront client (lazy loaded)
   */
  private async getCloudFrontClient() {
    const { CloudFrontClient } = await import('@aws-sdk/client-cloudfront');
    
    return new CloudFrontClient({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
  
  /**
   * Upload a file to S3
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
    
    // Upload to S3
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
   * Upload a buffer to S3
   */
  async uploadBuffer(
    buffer: Buffer,
    destinationKey: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getS3Client();
    
    // Upload to S3
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
   * Delete a file from S3
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
      console.error(`Failed to delete file ${key} from S3:`, error);
      return false;
    }
  }
  
  /**
   * Delete multiple files from S3 (batch operation)
   */
  async deleteFiles(keys: string[]): Promise<number> {
    try {
      const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
      const client = await this.getS3Client();
      
      // S3 supports batch delete (up to 1000 objects per request)
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
      console.error('Failed to batch delete files from S3:', error);
      return 0;
    }
  }
  
  /**
   * Get public CloudFront CDN URL for a file
   */
  getPublicUrl(key: string): string {
    // Return CloudFront CDN URL
    return `https://${this.cloudFrontDomain}/${key}`;
  }
  
  /**
   * Get signed CloudFront URL for private/temporary access
   */
  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    // For CloudFront signed URLs, we need CloudFront key pair
    // For simplicity, falling back to S3 pre-signed URLs
    // In production, implement CloudFront signed URLs for better security
    
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await this.getS3Client();
    
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: options?.contentDisposition,
    });
    
    // Generate S3 signed URL (default: 1 hour expiration)
    const signedUrl = await getSignedUrl(client, command, {
      expiresIn: options?.expiresIn || 3600,
    });
    
    return signedUrl;
  }
  
  /**
   * Check if S3 storage is healthy
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
      console.error('AWS S3 health check failed:', error);
      return false;
    }
  }
  
  /**
   * Purge CloudFront CDN cache for specific files
   */
  async purgeCdnCache(keys: string[]): Promise<boolean> {
    try {
      if (!this.cloudFrontDistributionId) {
        console.warn('CloudFront Distribution ID not configured, skipping cache purge');
        return false;
      }
      
      const { CreateInvalidationCommand } = await import('@aws-sdk/client-cloudfront');
      const client = await this.getCloudFrontClient();
      
      // Convert keys to CloudFront invalidation paths
      const paths = keys.map(key => `/${key}`);
      
      // Create CloudFront invalidation
      const command = new CreateInvalidationCommand({
        DistributionId: this.cloudFrontDistributionId,
        InvalidationBatch: {
          CallerReference: `invalidation-${Date.now()}`,
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      });
      
      await client.send(command);
      console.log(`Successfully created CloudFront invalidation for ${paths.length} paths`);
      return true;
    } catch (error) {
      console.error('Failed to create CloudFront invalidation:', error);
      return false;
    }
  }
}
