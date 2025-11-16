import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import type { Request, Response } from 'express';

/**
 * Rate limiter configuration for different endpoint types
 * Implements enterprise-grade rate limiting to prevent abuse and DDoS attacks
 */

// Standard API rate limiter - applies to most endpoints
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : 100, // High limit in dev, 100 in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 900)
    });
  }
});

// Strict limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 5, // High limit in dev, 5 in production
  skipSuccessfulRequests: true, // Don't count successful requests
  message: 'Too many authentication attempts, please try again later.',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      retryAfter: 900
    });
  }
});

// Upload rate limiter - more lenient due to large file sizes
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 1000 : 20, // High limit in dev, 20 in production
  skipFailedRequests: true, // Don't count failed uploads
  message: 'Too many upload attempts, please try again later.',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Upload limit reached. Please try again later.',
      retryAfter: 3600
    });
  }
});

// API key generation rate limiter
export const apiKeyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: process.env.NODE_ENV === 'development' ? 10000 : 10, // High limit in dev, 10 in production
  message: 'Too many API key operations, please try again tomorrow.',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'API_KEY_RATE_LIMIT_EXCEEDED',
      message: 'API key operation limit reached. Please try again tomorrow.',
      retryAfter: 86400
    });
  }
});

// Slow down middleware for gradual response time increase
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: process.env.NODE_ENV === 'development' ? 10000 : 50, // High threshold in dev, 50 in production
  delayMs: (hits) => process.env.NODE_ENV === 'development' ? 0 : hits * 100, // No delay in dev, 100ms per hit in production
  maxDelayMs: process.env.NODE_ENV === 'development' ? 0 : 5000, // No delay in dev, max 5s in production
});

// Export configuration for external use
export const rateLimitConfig = {
  standard: { windowMs: 15 * 60 * 1000, max: 100 },
  auth: { windowMs: 15 * 60 * 1000, max: 5 },
  upload: { windowMs: 60 * 60 * 1000, max: 20 },
  apiKey: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
};
