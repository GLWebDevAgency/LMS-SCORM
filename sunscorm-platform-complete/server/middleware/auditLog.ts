import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

/**
 * Audit logging middleware for tracking sensitive operations
 * Logs user actions for security, compliance, and debugging purposes
 */

export interface AuditLogEntry {
  userId: number | null;
  tenantId: number | null;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

// Actions that should be audited
const AUDITABLE_ACTIONS = {
  // Authentication
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGE: 'auth.password_change',
  
  // User management
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  ROLE_CHANGE: 'user.role_change',
  
  // Course management
  COURSE_UPLOAD: 'course.upload',
  COURSE_UPDATE: 'course.update',
  COURSE_DELETE: 'course.delete',
  COURSE_EXPORT: 'course.export',
  
  // Dispatch management
  DISPATCH_CREATE: 'dispatch.create',
  DISPATCH_UPDATE: 'dispatch.update',
  DISPATCH_DELETE: 'dispatch.delete',
  DISPATCH_USER_ADD: 'dispatch.user_add',
  DISPATCH_USER_REMOVE: 'dispatch.user_remove',
  
  // License management
  LICENSE_UPDATE: 'license.update',
  LICENSE_EXCEED: 'license.exceed',
  
  // API keys
  API_KEY_CREATE: 'api_key.create',
  API_KEY_DELETE: 'api_key.delete',
  API_KEY_ROTATE: 'api_key.rotate',
  
  // Data access
  DATA_EXPORT: 'data.export',
  DATA_IMPORT: 'data.import',
  
  // Security events
  UNAUTHORIZED_ACCESS: 'security.unauthorized_access',
  PERMISSION_DENIED: 'security.permission_denied',
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
};

/**
 * Log an audit entry to storage
 */
async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    // In production, this would write to a dedicated audit log table
    // For now, we log to console and could extend to database
    const logEntry = {
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    };
    
    console.log('[AUDIT]', JSON.stringify(logEntry));
    
    // TODO: Implement database storage for audit logs
    // await storage.createAuditLog(logEntry);
  } catch (error) {
    console.error('[AUDIT] Failed to log audit entry:', error);
    // Don't throw - audit logging should not break the application
  }
}

/**
 * Extract user and tenant info from request
 */
function extractUserInfo(req: any): { userId: number | null; tenantId: number | null } {
  return {
    userId: req.user?.id || null,
    tenantId: req.user?.tenantId || null,
  };
}

/**
 * Middleware to audit specific actions
 */
export function auditAction(action: string, resource: string) {
  return async (req: any, res: Response, next: NextFunction) => {
    const { userId, tenantId } = extractUserInfo(req);
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    
    // Store original send method
    const originalSend = res.send;
    let success = true;
    let errorMessage: string | undefined;
    
    // Intercept response to determine success/failure
    res.send = function (body: any) {
      if (res.statusCode >= 400) {
        success = false;
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          errorMessage = parsed.message || parsed.error;
        } catch (e) {
          errorMessage = 'Unknown error';
        }
      }
      
      // Log the audit entry
      logAudit({
        userId,
        tenantId,
        action,
        resource,
        resourceId: req.params.id || req.params.courseId || req.params.dispatchId,
        ipAddress,
        userAgent,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          // Don't log sensitive data like passwords
          body: sanitizeBody(req.body),
        },
        timestamp: new Date(),
        success,
        errorMessage,
      }).catch(err => console.error('[AUDIT] Failed to log:', err));
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}

/**
 * Remove sensitive fields from request body
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'creditCard'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Middleware to automatically audit all state-changing operations
 */
export function autoAudit() {
  return async (req: any, res: Response, next: NextFunction) => {
    // Only audit non-GET requests
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    
    // Determine action based on method and path
    let action = 'unknown';
    let resource = 'unknown';
    
    if (req.path.includes('/auth')) {
      action = AUDITABLE_ACTIONS.LOGIN;
      resource = 'authentication';
    } else if (req.path.includes('/courses')) {
      if (req.method === 'POST') action = AUDITABLE_ACTIONS.COURSE_UPLOAD;
      else if (req.method === 'PUT') action = AUDITABLE_ACTIONS.COURSE_UPDATE;
      else if (req.method === 'DELETE') action = AUDITABLE_ACTIONS.COURSE_DELETE;
      resource = 'course';
    } else if (req.path.includes('/dispatches')) {
      if (req.method === 'POST') action = AUDITABLE_ACTIONS.DISPATCH_CREATE;
      else if (req.method === 'PUT') action = AUDITABLE_ACTIONS.DISPATCH_UPDATE;
      else if (req.method === 'DELETE') action = AUDITABLE_ACTIONS.DISPATCH_DELETE;
      resource = 'dispatch';
    }
    
    // Apply audit action middleware
    return auditAction(action, resource)(req, res, next);
  };
}

export { AUDITABLE_ACTIONS };
