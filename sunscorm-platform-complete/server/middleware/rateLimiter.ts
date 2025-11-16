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
  max: 100, // Limit each IP to 100 requests per windowMs
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
  max: 5, // Limit each IP to 5 login attempts per windowMs
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
  max: 20, // Limit each IP to 20 uploads per hour
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
  max: 10, // Limit each user to 10 API key operations per day
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
  delayAfter: 50, // Allow 50 requests per windowMs without slowing down
  delayMs: (hits) => hits * 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 5000, // Maximum delay of 5 seconds
});

// Export configuration for external use
export const rateLimitConfig = {
  standard: { windowMs: 15 * 60 * 1000, max: 100 },
  auth: { windowMs: 15 * 60 * 1000, max: 5 },
  upload: { windowMs: 60 * 60 * 1000, max: 20 },
  apiKey: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
};
