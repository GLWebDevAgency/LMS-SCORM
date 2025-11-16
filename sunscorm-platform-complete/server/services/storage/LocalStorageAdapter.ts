import { promises as fs } from 'fs';
import path from 'path';
import { StorageAdapter, UploadOptions, UploadResult, SignedUrlOptions } from './StorageAdapter';

/**
 * Local Filesystem Storage Adapter
 * Implements storage using local filesystem (current implementation)
 * Serves as fallback when CDN providers are unavailable
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly type = 'local' as const;
  readonly cdnEnabled = false;
  
  private readonly uploadsDir: string;
  private readonly baseUrl: string;
  
  /**
   * @param uploadsDir - Base directory for file uploads (default: uploads/courses)
   * @param baseUrl - Base URL for serving files (e.g., https://example.com or empty for relative URLs)
   */
  constructor(uploadsDir?: string, baseUrl?: string) {
    this.uploadsDir = uploadsDir || path.join(process.cwd(), 'uploads', 'courses');
    this.baseUrl = baseUrl || process.env.PUBLIC_DOMAIN || '';
  }
  
  /**
   * Initialize storage directory
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create uploads directory:', error);
      throw error;
    }
  }
  
  /**
   * Upload a file from local filesystem to storage
   */
  async uploadFile(
    filePath: string,
    destinationKey: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    await this.ensureDirectory();
    
    // Sanitize destination key to prevent path traversal
    const safeKey = destinationKey.replace(/\.\./g, '').replace(/^\/+/, '');
    const destinationPath = path.join(this.uploadsDir, safeKey);
    
    // Ensure destination directory exists
    const destinationDir = path.dirname(destinationPath);
    await fs.mkdir(destinationDir, { recursive: true });
    
    // Copy file to destination
    await fs.copyFile(filePath, destinationPath);
    
    // Get file stats
    const stats = await fs.stat(destinationPath);
    
    return {
      key: safeKey,
      url: this.getPublicUrl(safeKey),
      size: stats.size,
      etag: `${stats.mtime.getTime()}-${stats.size}`, // Simple ETag based on mtime and size
    };
  }
  
  /**
   * Upload a buffer to storage
   */
  async uploadBuffer(
    buffer: Buffer,
    destinationKey: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    await this.ensureDirectory();
    
    // Sanitize destination key
    const safeKey = destinationKey.replace(/\.\./g, '').replace(/^\/+/, '');
    const destinationPath = path.join(this.uploadsDir, safeKey);
    
    // Ensure destination directory exists
    const destinationDir = path.dirname(destinationPath);
    await fs.mkdir(destinationDir, { recursive: true });
    
    // Write buffer to file
    await fs.writeFile(destinationPath, buffer);
    
    return {
      key: safeKey,
      url: this.getPublicUrl(safeKey),
      size: buffer.length,
      etag: `${Date.now()}-${buffer.length}`,
    };
  }
  
  /**
   * Delete a file from storage
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadsDir, key);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Delete multiple files from storage
   */
  async deleteFiles(keys: string[]): Promise<number> {
    let deletedCount = 0;
    
    for (const key of keys) {
      const success = await this.deleteFile(key);
      if (success) deletedCount++;
    }
    
    return deletedCount;
  }
  
  /**
   * Get public URL for a file
   * For local storage, returns a path relative to uploads directory
   */
  getPublicUrl(key: string): string {
    // Return absolute URL if baseUrl is set, otherwise relative path
    if (this.baseUrl) {
      return `${this.baseUrl}/uploads/courses/${key}`;
    }
    return `/uploads/courses/${key}`;
  }
  
  /**
   * Get signed URL (not supported for local storage, returns public URL)
   */
  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    // Local storage doesn't support signed URLs, return public URL
    console.warn('Signed URLs not supported for local storage, returning public URL');
    return this.getPublicUrl(key);
  }
  
  /**
   * Check if storage is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureDirectory();
      // Try to write and delete a test file
      const testFile = path.join(this.uploadsDir, '.health-check');
      await fs.writeFile(testFile, 'ok');
      await fs.unlink(testFile);
      return true;
    } catch (error) {
      console.error('Local storage health check failed:', error);
      return false;
    }
  }
  
  /**
   * CDN cache purging not applicable for local storage
   */
  async purgeCdnCache(keys: string[]): Promise<boolean> {
    // No CDN to purge for local storage
    return true;
  }
  
  /**
   * Get the absolute path for a storage key
   * Useful for direct file system operations (e.g., ZIP extraction)
   */
  getAbsolutePath(key: string): string {
    return path.join(this.uploadsDir, key);
  }
}
