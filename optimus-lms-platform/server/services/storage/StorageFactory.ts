import { StorageAdapter } from './StorageAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { CloudFlareR2Adapter } from './CloudFlareR2Adapter';
import { S3CloudFrontAdapter } from './S3CloudFrontAdapter';

/**
 * Storage Factory
 * Creates and manages storage adapter instances with graceful fallback to local storage
 * Implements singleton pattern for efficient resource management
 */
export class StorageFactory {
  private static instance: StorageAdapter | null = null;
  private static initializationPromise: Promise<StorageAdapter> | null = null;
  
  /**
   * Get or create storage adapter instance (singleton)
   * Automatically falls back to local storage if CDN provider fails
   */
  static async getAdapter(): Promise<StorageAdapter> {
    // Return existing instance if available
    if (this.instance) {
      return this.instance;
    }
    
    // Wait for ongoing initialization if any
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    // Start new initialization
    this.initializationPromise = this.createAdapter();
    this.instance = await this.initializationPromise;
    this.initializationPromise = null;
    
    return this.instance;
  }
  
  /**
   * Create storage adapter based on configuration
   * Implements graceful fallback strategy
   */
  private static async createAdapter(): Promise<StorageAdapter> {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    
    console.log(`Initializing storage provider: ${provider}`);
    
    try {
      switch (provider) {
        case 'cloudflare-r2':
          return await this.createCloudFlareR2Adapter();
        
        case 's3-cloudfront':
          return await this.createS3CloudFrontAdapter();
        
        case 'local':
        default:
          return this.createLocalAdapter();
      }
    } catch (error) {
      console.error(`Failed to initialize ${provider} storage adapter:`, error);
      console.warn('Falling back to local storage adapter');
      return this.createLocalAdapter();
    }
  }
  
  /**
   * Create CloudFlare R2 adapter with validation
   */
  private static async createCloudFlareR2Adapter(): Promise<StorageAdapter> {
    const config = {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      cdnDomain: process.env.CLOUDFLARE_R2_CDN_DOMAIN,
    };
    
    // Validate required configuration
    const missingConfig = Object.entries(config)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
    
    if (missingConfig.length > 0) {
      throw new Error(
        `Missing CloudFlare R2 configuration: ${missingConfig.join(', ')}. ` +
        'Please set the required environment variables.'
      );
    }
    
    const adapter = new CloudFlareR2Adapter(config as any);
    
    // Verify adapter is healthy before returning
    const isHealthy = await adapter.healthCheck();
    if (!isHealthy) {
      throw new Error('CloudFlare R2 adapter health check failed');
    }
    
    console.log('✓ CloudFlare R2 adapter initialized successfully');
    return adapter;
  }
  
  /**
   * Create S3 + CloudFront adapter with validation
   */
  private static async createS3CloudFrontAdapter(): Promise<StorageAdapter> {
    const config = {
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucketName: process.env.AWS_S3_BUCKET_NAME,
      cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
      cloudFrontDistributionId: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
    };
    
    // Validate required configuration (distribution ID is optional for cache purging)
    const requiredConfig = {
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      bucketName: config.bucketName,
      cloudFrontDomain: config.cloudFrontDomain,
    };
    
    const missingConfig = Object.entries(requiredConfig)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
    
    if (missingConfig.length > 0) {
      throw new Error(
        `Missing AWS S3/CloudFront configuration: ${missingConfig.join(', ')}. ` +
        'Please set the required environment variables.'
      );
    }
    
    const adapter = new S3CloudFrontAdapter(config as any);
    
    // Verify adapter is healthy before returning
    const isHealthy = await adapter.healthCheck();
    if (!isHealthy) {
      throw new Error('AWS S3 adapter health check failed');
    }
    
    console.log('✓ AWS S3 + CloudFront adapter initialized successfully');
    return adapter;
  }
  
  /**
   * Create local storage adapter (always succeeds)
   */
  private static createLocalAdapter(): StorageAdapter {
    const uploadsDir = process.env.UPLOADS_DIR;
    const baseUrl = process.env.PUBLIC_DOMAIN;
    
    const adapter = new LocalStorageAdapter(uploadsDir, baseUrl);
    console.log('✓ Local storage adapter initialized');
    return adapter;
  }
  
  /**
   * Reset singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
    this.initializationPromise = null;
  }
  
  /**
   * Get current adapter type without initializing
   */
  static getConfiguredProvider(): string {
    return process.env.STORAGE_PROVIDER || 'local';
  }
}
