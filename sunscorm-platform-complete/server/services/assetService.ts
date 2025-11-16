import { promises as fs } from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import { promisify } from 'util';
import { StorageFactory } from './storage/StorageFactory';
import { StorageAdapter } from './storage/StorageAdapter';
import { LocalStorageAdapter } from './storage/LocalStorageAdapter';

/**
 * Asset Service
 * High-level service for managing SCORM course assets with CDN integration
 * Handles upload, extraction, URL generation, and cleanup operations
 */

export interface CourseAssetMetadata {
  courseId: string;
  fileName: string;
  fileSize: number;
  storageKey: string;
  cdnEnabled: boolean;
  uploadedAt: Date;
}

export interface AssetUploadResult {
  storageKey: string;
  cdnUrl: string;
  cdnEnabled: boolean;
  fileSize: number;
  assetCount?: number;
}

/**
 * Asset Service - Main class for SCORM asset management
 */
export class AssetService {
  private storageAdapter: StorageAdapter | null = null;
  
  /**
   * Get storage adapter instance (lazy loaded)
   */
  private async getStorage(): Promise<StorageAdapter> {
    if (!this.storageAdapter) {
      this.storageAdapter = await StorageFactory.getAdapter();
    }
    return this.storageAdapter;
  }
  
  /**
   * Upload complete SCORM package (ZIP file) to storage/CDN
   * @param filePath - Local path to the SCORM ZIP file
   * @param courseId - Unique course identifier
   * @param options - Optional upload configuration
   * @returns Upload result with storage key and CDN URL
   */
  async uploadCoursePackage(
    filePath: string,
    courseId: string,
    options?: {
      fileName?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<AssetUploadResult> {
    const storage = await this.getStorage();
    
    // Generate storage key for the course package
    const fileName = options?.fileName || path.basename(filePath);
    const storageKey = `courses/${courseId}/${fileName}`;
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Upload to storage with optimal cache settings for SCORM packages
    const result = await storage.uploadFile(filePath, storageKey, {
      contentType: 'application/zip',
      cacheControl: 'public, max-age=31536000, immutable', // 1 year - packages are immutable
      metadata: {
        courseId,
        fileName,
        uploadedAt: new Date().toISOString(),
        ...options?.metadata,
      },
    });
    
    console.log(`✓ Uploaded course package: ${courseId} (${this.formatBytes(stats.size)})`);
    
    return {
      storageKey: result.key,
      cdnUrl: result.url,
      cdnEnabled: storage.cdnEnabled,
      fileSize: result.size,
    };
  }
  
  /**
   * Upload extracted SCORM assets individually to CDN
   * Useful for granular cache control and optimization
   * @param zipPath - Path to the SCORM ZIP file
   * @param courseId - Unique course identifier
   * @returns Upload result with asset count
   */
  async uploadCourseAssets(
    zipPath: string,
    courseId: string
  ): Promise<AssetUploadResult> {
    const storage = await this.getStorage();
    
    // Extract all files from ZIP
    const files = await this.extractZipFiles(zipPath);
    
    let uploadedCount = 0;
    let totalSize = 0;
    
    // Upload each asset individually with appropriate cache headers
    for (const [fileName, buffer] of files.entries()) {
      const storageKey = `courses/${courseId}/assets/${fileName}`;
      const contentType = this.getContentType(fileName);
      const cacheControl = this.getCacheControl(fileName);
      
      await storage.uploadBuffer(buffer, storageKey, {
        contentType,
        cacheControl,
        metadata: {
          courseId,
          originalFile: fileName,
        },
      });
      
      uploadedCount++;
      totalSize += buffer.length;
    }
    
    console.log(`✓ Uploaded ${uploadedCount} assets for course ${courseId} (${this.formatBytes(totalSize)})`);
    
    return {
      storageKey: `courses/${courseId}/assets/`,
      cdnUrl: storage.getPublicUrl(`courses/${courseId}/assets/`),
      cdnEnabled: storage.cdnEnabled,
      fileSize: totalSize,
      assetCount: uploadedCount,
    };
  }
  
  /**
   * Get public CDN URL for a course asset
   * @param storageKey - Storage key for the asset
   * @returns Public CDN URL or local URL
   */
  async getCourseAssetUrl(storageKey: string): Promise<string> {
    const storage = await this.getStorage();
    return storage.getPublicUrl(storageKey);
  }
  
  /**
   * Generate signed URL for private/temporary access to course assets
   * @param storageKey - Storage key for the asset
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Signed URL with limited validity
   */
  async getSignedAssetUrl(
    storageKey: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const storage = await this.getStorage();
    return storage.getSignedUrl(storageKey, { expiresIn });
  }
  
  /**
   * Delete all assets for a course from storage/CDN
   * @param courseId - Unique course identifier
   * @param storageKey - Optional specific storage key to delete
   * @returns True if deletion successful
   */
  async deleteCourseAssets(
    courseId: string,
    storageKey?: string
  ): Promise<boolean> {
    const storage = await this.getStorage();
    
    if (storageKey) {
      // Delete specific storage key
      const success = await storage.deleteFile(storageKey);
      
      // Purge from CDN cache if enabled
      if (success && storage.cdnEnabled) {
        await storage.purgeCdnCache([storageKey]);
      }
      
      return success;
    } else {
      // For local storage, we can delete by course ID pattern
      // For cloud storage, this would require listing and deleting all objects with the prefix
      console.warn(`Bulk deletion for course ${courseId} - implementation depends on storage adapter`);
      
      // If using local storage, can delete the directory
      if (storage instanceof LocalStorageAdapter) {
        const coursePath = (storage as any).getAbsolutePath(`courses/${courseId}`);
        try {
          await fs.rm(coursePath, { recursive: true, force: true });
          console.log(`✓ Deleted local assets for course ${courseId}`);
          return true;
        } catch (error) {
          console.error(`Failed to delete local assets for course ${courseId}:`, error);
          return false;
        }
      }
      
      // For cloud storage, would need to list objects with prefix and delete
      // This is a TODO for production implementation
      console.log(`Note: Cloud storage bulk deletion not yet implemented for course ${courseId}`);
      return false;
    }
  }
  
  /**
   * Purge CDN cache for specific course assets
   * @param storageKeys - Array of storage keys to purge
   * @returns True if purge successful
   */
  async purgeCdnCache(storageKeys: string[]): Promise<boolean> {
    const storage = await this.getStorage();
    
    if (!storage.cdnEnabled) {
      console.log('CDN not enabled, skipping cache purge');
      return true;
    }
    
    return storage.purgeCdnCache(storageKeys);
  }
  
  /**
   * Get storage adapter information
   * @returns Storage adapter type and CDN status
   */
  async getStorageInfo(): Promise<{
    type: string;
    cdnEnabled: boolean;
    healthy: boolean;
  }> {
    const storage = await this.getStorage();
    const healthy = await storage.healthCheck();
    
    return {
      type: storage.type,
      cdnEnabled: storage.cdnEnabled,
      healthy,
    };
  }
  
  /**
   * Extract all files from a ZIP archive
   * @param zipPath - Path to ZIP file
   * @returns Map of file names to buffers
   */
  private async extractZipFiles(zipPath: string): Promise<Map<string, Buffer>> {
    const openZip = promisify(yauzl.open);
    const zipFile = await openZip(zipPath, { lazyEntries: true });
    
    const files = new Map<string, Buffer>();
    
    return new Promise((resolve, reject) => {
      zipFile.readEntry();
      
      zipFile.on('entry', (entry: any) => {
        if (entry.fileName.endsWith('/')) {
          // Directory entry, skip
          zipFile.readEntry();
          return;
        }
        
        zipFile.openReadStream(entry, (err: any, readStream: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          const chunks: Buffer[] = [];
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          readStream.on('end', () => {
            const fileContent = Buffer.concat(chunks);
            files.set(entry.fileName, fileContent);
            zipFile.readEntry();
          });
          readStream.on('error', reject);
        });
      });
      
      zipFile.on('end', () => resolve(files));
      zipFile.on('error', reject);
    });
  }
  
  /**
   * Get content type for a file based on extension
   */
  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
  
  /**
   * Get optimal cache control header for a file
   * HTML files: shorter cache (1 hour) for dynamic updates
   * Assets: long cache (1 year) for immutable content
   */
  private getCacheControl(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    // HTML files should have shorter cache for updates
    if (ext === '.html' || ext === '.htm') {
      return 'public, max-age=3600'; // 1 hour
    }
    
    // All other assets are immutable and can be cached indefinitely
    return 'public, max-age=31536000, immutable'; // 1 year
  }
  
  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export singleton instance
export const assetService = new AssetService();
