import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { csrfProtection } from "../csrfProtection";
import { storage } from "../storage";
import { cdnService } from "../services/cdnService";
import { assetService } from "../services/assetService";

/**
 * Admin Routes
 * Administrative endpoints for system management including CDN operations
 * Requires admin role for access
 */

export function registerAdminRoutes(app: Express): void {
  
  /**
   * Middleware to check admin role
   */
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      next();
    } catch (error) {
      console.error("Admin check error:", error);
      res.status(500).json({ message: "Failed to verify admin access" });
    }
  };
  
  /**
   * GET /api/admin/cdn/status
   * Get CDN status and configuration
   */
  app.get('/api/admin/cdn/status', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [cdnStatus, storageInfo] = await Promise.all([
        cdnService.getCdnStatus(),
        assetService.getStorageInfo(),
      ]);
      
      res.json({
        cdn: cdnStatus,
        storage: storageInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("CDN status error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to get CDN status" 
      });
    }
  });
  
  /**
   * POST /api/admin/cdn/purge
   * Purge CDN cache (global or pattern-based)
   * Body: { purgeAll?: boolean, pattern?: string, keys?: string[] }
   */
  app.post('/api/admin/cdn/purge', isAuthenticated, requireAdmin, csrfProtection, async (req: any, res) => {
    try {
      const { purgeAll, pattern, keys } = req.body;
      
      // Validate input
      if (!purgeAll && !pattern && (!keys || keys.length === 0)) {
        return res.status(400).json({ 
          message: "Must specify purgeAll, pattern, or keys" 
        });
      }
      
      // Execute purge
      const result = await cdnService.purgeCache({
        purgeAll,
        pattern,
        keys,
      });
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          purgedKeys: result.purgedKeys,
          cdnProvider: result.cdnProvider,
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      console.error("CDN purge error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to purge CDN cache" 
      });
    }
  });
  
  /**
   * POST /api/admin/cdn/purge/:courseId
   * Purge CDN cache for a specific course
   */
  app.post('/api/admin/cdn/purge/:courseId', isAuthenticated, requireAdmin, csrfProtection, async (req: any, res) => {
    try {
      const { courseId } = req.params;
      
      // Verify course exists
      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Execute purge for course
      const result = await cdnService.purgeCourseCache(courseId);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          courseId,
          purgedKeys: result.purgedKeys,
          cdnProvider: result.cdnProvider,
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      console.error("Course CDN purge error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to purge course CDN cache" 
      });
    }
  });
  
  /**
   * GET /api/admin/cdn/analytics
   * Get CDN analytics and metrics (placeholder for future implementation)
   */
  app.get('/api/admin/cdn/analytics', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const [hitRate, bandwidth] = await Promise.all([
        cdnService.getCacheHitRate(),
        cdnService.getBandwidthUsage(),
      ]);
      
      res.json({
        cacheHitRate: hitRate,
        bandwidth: bandwidth,
        timestamp: new Date().toISOString(),
        note: "Analytics integration coming soon",
      });
    } catch (error) {
      console.error("CDN analytics error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to get CDN analytics" 
      });
    }
  });
  
  /**
   * GET /api/admin/storage/info
   * Get storage provider information
   */
  app.get('/api/admin/storage/info', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const storageInfo = await assetService.getStorageInfo();
      
      res.json({
        ...storageInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Storage info error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to get storage info" 
      });
    }
  });
}
