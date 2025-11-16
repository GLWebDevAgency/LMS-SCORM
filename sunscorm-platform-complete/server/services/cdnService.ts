import { StorageFactory } from './storage/StorageFactory';
import { storage } from '../storage';

/**
 * CDN Service
 * Manages CDN cache purging and invalidation for CloudFlare and AWS CloudFront
 * Provides centralized cache management for course assets
 */

export interface CdnPurgeOptions {
  /** Purge everything (wildcard) */
  purgeAll?: boolean;
  /** Specific storage keys to purge */
  keys?: string[];
  /** Course ID to purge all assets for */
  courseId?: string;
  /** Pattern-based purging (e.g., 'courses/*/index.html') */
  pattern?: string;
}

export interface CdnPurgeResult {
  success: boolean;
  purgedKeys: string[];
  message: string;
  cdnProvider?: string;
}

/**
 * CDN Service - Cache management and purging
 */
export class CdnService {
  /**
   * Purge CDN cache based on options
   * @param options - Purge options (keys, courseId, pattern, or purgeAll)
   * @returns Purge result with status and details
   */
  async purgeCache(options: CdnPurgeOptions): Promise<CdnPurgeResult> {
    const storageAdapter = await StorageFactory.getAdapter();
    
    // Check if CDN is enabled
    if (!storageAdapter.cdnEnabled) {
      return {
        success: true,
        purgedKeys: [],
        message: 'CDN not enabled, no cache to purge',
      };
    }
    
    let keysToPurge: string[] = [];
    
    // Determine keys to purge based on options
    if (options.purgeAll) {
      // Purge everything - most CDN providers support wildcard
      keysToPurge = ['*'];
    } else if (options.courseId) {
      // Purge all assets for a specific course
      keysToPurge = await this.getCourseAssetKeys(options.courseId);
    } else if (options.pattern) {
      // Pattern-based purging (implementation depends on storage adapter)
      keysToPurge = await this.getKeysByPattern(options.pattern);
    } else if (options.keys && options.keys.length > 0) {
      // Specific keys provided
      keysToPurge = options.keys;
    } else {
      return {
        success: false,
        purgedKeys: [],
        message: 'No purge target specified',
      };
    }
    
    if (keysToPurge.length === 0) {
      return {
        success: true,
        purgedKeys: [],
        message: 'No keys found to purge',
      };
    }
    
    // Execute cache purge
    try {
      const success = await storageAdapter.purgeCdnCache(keysToPurge);
      
      if (success) {
        console.log(`✓ Purged ${keysToPurge.length} keys from CDN cache`);
        return {
          success: true,
          purgedKeys: keysToPurge,
          message: `Successfully purged ${keysToPurge.length} items from CDN cache`,
          cdnProvider: storageAdapter.type,
        };
      } else {
        return {
          success: false,
          purgedKeys: [],
          message: 'CDN cache purge failed',
          cdnProvider: storageAdapter.type,
        };
      }
    } catch (error) {
      console.error('CDN cache purge error:', error);
      return {
        success: false,
        purgedKeys: [],
        message: error instanceof Error ? error.message : 'Unknown error during cache purge',
        cdnProvider: storageAdapter.type,
      };
    }
  }
  
  /**
   * Purge cache for a specific course
   * @param courseId - Course ID to purge
   * @returns Purge result
   */
  async purgeCourseCache(courseId: string): Promise<CdnPurgeResult> {
    return this.purgeCache({ courseId });
  }
  
  /**
   * Purge cache for specific asset URLs
   * @param urls - Array of asset URLs to purge
   * @returns Purge result
   */
  async purgeUrls(urls: string[]): Promise<CdnPurgeResult> {
    // Convert URLs to storage keys
    const keys = urls.map(url => this.urlToStorageKey(url)).filter(Boolean) as string[];
    
    if (keys.length === 0) {
      return {
        success: false,
        purgedKeys: [],
        message: 'No valid URLs provided',
      };
    }
    
    return this.purgeCache({ keys });
  }
  
  /**
   * Get CDN status and statistics
   * @returns CDN information
   */
  async getCdnStatus(): Promise<{
    enabled: boolean;
    provider: string;
    healthy: boolean;
  }> {
    const storageAdapter = await StorageFactory.getAdapter();
    const healthy = await storageAdapter.healthCheck();
    
    return {
      enabled: storageAdapter.cdnEnabled,
      provider: storageAdapter.type,
      healthy,
    };
  }
  
  /**
   * Get all storage keys for a course's assets
   * @param courseId - Course ID
   * @returns Array of storage keys
   */
  private async getCourseAssetKeys(courseId: string): Promise<string[]> {
    try {
      // Get course from database
      const course = await storage.getCourse(courseId);
      
      if (!course) {
        console.warn(`Course ${courseId} not found`);
        return [];
      }
      
      // If course has a specific storage key, use that
      if ((course as any).storageKey) {
        return [(course as any).storageKey];
      }
      
      // Otherwise, generate pattern for all course assets
      // This includes both the package and extracted assets
      return [
        `courses/${courseId}/*`, // Wildcard pattern for all course assets
      ];
    } catch (error) {
      console.error(`Error getting asset keys for course ${courseId}:`, error);
      return [];
    }
  }
  
  /**
   * Get storage keys matching a pattern
   * @param pattern - Pattern to match (e.g., 'courses/*/index.html')
   * @returns Array of matching storage keys
   */
  private async getKeysByPattern(pattern: string): Promise<string[]> {
    // For now, return the pattern itself
    // In production, you might want to list and filter objects from storage
    return [pattern];
  }
  
  /**
   * Convert a CDN URL to storage key
   * @param url - Full CDN URL
   * @returns Storage key or null if invalid
   */
  private urlToStorageKey(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash from pathname to get storage key
      return urlObj.pathname.replace(/^\/+/, '');
    } catch (error) {
      console.error('Invalid URL:', url);
      return null;
    }
  }
  
  /**
   * Estimate cache hit rate based on CDN analytics (if available)
   * This is a placeholder for future integration with CDN analytics APIs
   */
  async getCacheHitRate(): Promise<{
    hitRate: number;
    dataPoints: number;
    lastUpdated: Date;
  }> {
    // TODO: Integrate with CloudFlare Analytics API or CloudFront metrics
    // For now, return placeholder data
    return {
      hitRate: 0,
      dataPoints: 0,
      lastUpdated: new Date(),
    };
  }
  
  /**
   * Get CDN bandwidth usage (if available)
   * This is a placeholder for future integration with CDN analytics APIs
   */
  async getBandwidthUsage(): Promise<{
    totalBytes: number;
    period: string;
    lastUpdated: Date;
  }> {
    // TODO: Integrate with CDN provider's bandwidth metrics
    return {
      totalBytes: 0,
      period: '24h',
      lastUpdated: new Date(),
    };
  }
}

// Export singleton instance
export const cdnService = new CdnService();
