/**
 * Rate limiter tests
 */

import { describe, it, expect } from 'vitest';
import { rateLimitConfig } from './rateLimiter';

describe('Rate Limiter Configuration', () => {
  it('should have standard rate limit configuration', () => {
    expect(rateLimitConfig.standard).toBeDefined();
    expect(rateLimitConfig.standard.windowMs).toBe(15 * 60 * 1000); // 15 minutes
    expect(rateLimitConfig.standard.max).toBe(100);
  });

  it('should have strict auth rate limit', () => {
    expect(rateLimitConfig.auth).toBeDefined();
    expect(rateLimitConfig.auth.windowMs).toBe(15 * 60 * 1000); // 15 minutes
    expect(rateLimitConfig.auth.max).toBe(5); // Strict limit for auth
  });

  it('should have lenient upload rate limit', () => {
    expect(rateLimitConfig.upload).toBeDefined();
    expect(rateLimitConfig.upload.windowMs).toBe(60 * 60 * 1000); // 1 hour
    expect(rateLimitConfig.upload.max).toBe(20);
  });

  it('should have daily API key rate limit', () => {
    expect(rateLimitConfig.apiKey).toBeDefined();
    expect(rateLimitConfig.apiKey.windowMs).toBe(24 * 60 * 60 * 1000); // 24 hours
    expect(rateLimitConfig.apiKey.max).toBe(10);
  });

  it('should have auth limit stricter than standard', () => {
    expect(rateLimitConfig.auth.max).toBeLessThan(rateLimitConfig.standard.max);
  });

  it('should have upload window longer than standard', () => {
    expect(rateLimitConfig.upload.windowMs).toBeGreaterThan(rateLimitConfig.standard.windowMs);
  });
});
