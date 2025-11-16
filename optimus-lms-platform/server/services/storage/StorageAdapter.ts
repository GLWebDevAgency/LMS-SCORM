/**
 * Storage Adapter Interface
 * Provides a common interface for different storage backends (local, CloudFlare R2, AWS S3+CloudFront)
 * Enables zero-downtime switching between storage providers with graceful fallback
 */

export interface UploadOptions {
  /** Content type of the file (e.g., 'application/zip', 'text/html') */
  contentType?: string;
  /** Cache control header for CDN (e.g., 'max-age=31536000, immutable') */
  cacheControl?: string;
  /** Additional metadata to store with the file */
  metadata?: Record<string, string>;
}

export interface UploadResult {
  /** Storage key/path for the uploaded file */
  key: string;
  /** Public URL to access the file (CDN URL if applicable) */
  url: string;
  /** Size of the uploaded file in bytes */
  size: number;
  /** Checksum/ETag of the file for integrity verification */
  etag?: string;
}

export interface SignedUrlOptions {
  /** Expiration time in seconds (default: 3600 = 1 hour) */
  expiresIn?: number;
  /** Content disposition for downloads (e.g., 'attachment; filename="course.zip"') */
  contentDisposition?: string;
}

/**
 * Base interface for all storage adapters
 * Implements the adapter pattern for pluggable storage backends
 */
export interface StorageAdapter {
  /** Provider type identifier */
  readonly type: 'local' | 'cloudflare-r2' | 's3-cloudfront';
  
  /** Whether CDN is enabled for this adapter */
  readonly cdnEnabled: boolean;
  
  /**
   * Upload a file to storage
   * @param filePath - Local file path to upload
   * @param destinationKey - Destination key/path in storage
   * @param options - Upload options (content type, cache control, etc.)
   * @returns Upload result with URL and metadata
   */
  uploadFile(
    filePath: string,
    destinationKey: string,
    options?: UploadOptions
  ): Promise<UploadResult>;
  
  /**
   * Upload a buffer to storage
   * @param buffer - File content as buffer
   * @param destinationKey - Destination key/path in storage
   * @param options - Upload options (content type, cache control, etc.)
   * @returns Upload result with URL and metadata
   */
  uploadBuffer(
    buffer: Buffer,
    destinationKey: string,
    options?: UploadOptions
  ): Promise<UploadResult>;
  
  /**
   * Delete a file from storage
   * @param key - Storage key/path to delete
   * @returns True if deletion successful, false otherwise
   */
  deleteFile(key: string): Promise<boolean>;
  
  /**
   * Delete multiple files from storage (batch operation)
   * @param keys - Array of storage keys/paths to delete
   * @returns Number of successfully deleted files
   */
  deleteFiles(keys: string[]): Promise<number>;
  
  /**
   * Get public URL for a file
   * @param key - Storage key/path
   * @returns Public URL (CDN URL if applicable)
   */
  getPublicUrl(key: string): string;
  
  /**
   * Get signed URL for private/temporary access
   * @param key - Storage key/path
   * @param options - Signed URL options (expiration, content disposition)
   * @returns Signed URL with limited validity
   */
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  
  /**
   * Check if storage provider is healthy and accessible
   * @returns True if storage is accessible, false otherwise
   */
  healthCheck(): Promise<boolean>;
  
  /**
   * Purge CDN cache for specific keys (if CDN-enabled)
   * @param keys - Array of storage keys/paths to purge from CDN cache
   * @returns True if purge successful, false if not supported/failed
   */
  purgeCdnCache(keys: string[]): Promise<boolean>;
}
