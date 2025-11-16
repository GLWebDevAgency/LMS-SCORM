import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';

/**
 * Security middleware configuration
 * Implements enterprise-grade security headers and protections
 */

/**
 * Helmet configuration for security headers
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite in development
        "'unsafe-eval'", // Required for Vite in development
        "https://cdn.jsdelivr.net", // For external libraries
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for styled components
        "https://fonts.googleapis.com",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:",
      ],
      connectSrc: [
        "'self'",
        "ws:", // WebSocket for HMR in development
        "wss:",
      ],
      frameSrc: ["'self'"], // Allow iframes from same origin (for SCORM player)
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  
  // Strict Transport Security (HTTPS enforcement)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // Prevent clickjacking
  frameguard: {
    action: 'deny',
  },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // XSS protection
  xssFilter: true,
  
  // DNS prefetch control
  dnsPrefetchControl: {
    allow: false,
  },
  
  // Referrer policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
});

/**
 * Custom security middleware for additional checks
 */
export function additionalSecurity() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent caching of sensitive data
    if (req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Add Permissions Policy (formerly Feature Policy)
    res.setHeader('Permissions-Policy', 
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );
    
    next();
  };
}

/**
 * IP whitelist middleware for admin endpoints
 */
export function ipWhitelist(allowedIPs: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    // Allow localhost in development
    if (process.env.NODE_ENV !== 'production' && 
        (clientIP.includes('127.0.0.1') || clientIP.includes('::1'))) {
      return next();
    }
    
    // Check if IP is in whitelist
    const isAllowed = allowedIPs.some(allowedIP => clientIP.includes(allowedIP));
    
    if (!isAllowed) {
      console.warn(`[SECURITY] Blocked request from non-whitelisted IP: ${clientIP}`);
      return res.status(403).json({
        error: 'IP_NOT_ALLOWED',
        message: 'Your IP address is not authorized to access this resource.',
      });
    }
    
    next();
  };
}

/**
 * User Agent validation middleware
 */
export function validateUserAgent() {
  return (req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.get('user-agent');
    
    // Block requests with no user agent (potential bots)
    if (!userAgent) {
      return res.status(403).json({
        error: 'USER_AGENT_REQUIRED',
        message: 'Valid User-Agent header is required.',
      });
    }
    
    // Block known bad user agents
    const blockedAgents = [
      'sqlmap',
      'nikto',
      'masscan',
      'nmap',
      'acunetix',
    ];
    
    const isBlocked = blockedAgents.some(agent => 
      userAgent.toLowerCase().includes(agent)
    );
    
    if (isBlocked) {
      console.warn(`[SECURITY] Blocked suspicious user agent: ${userAgent}`);
      return res.status(403).json({
        error: 'BLOCKED_USER_AGENT',
        message: 'Access denied.',
      });
    }
    
    next();
  };
}

/**
 * Request size validation middleware
 */
export function validateRequestSize(maxSizeMB: number = 512) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (contentLength > maxSizeBytes) {
      return res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: `Request size exceeds maximum allowed size of ${maxSizeMB}MB.`,
      });
    }
    
    next();
  };
}

/**
 * Sanitize input middleware
 */
export function sanitizeInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Sanitize query parameters
    if (req.query) {
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = sanitizeString(req.query[key] as string);
        }
      }
    }
    
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    next();
  };
}

/**
 * Sanitize a string to prevent XSS
 */
function sanitizeString(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized: any = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  
  return sanitized;
}
