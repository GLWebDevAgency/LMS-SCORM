/**
 * API Key tests
 */

import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, isValidApiKeyFormat, API_SCOPES } from './apiKeys';

describe('API Key Generation', () => {
  it('should generate a valid API key', () => {
    const { key, hash } = generateApiKey('sk');
    
    expect(key).toMatch(/^sk_[a-f0-9]{64}$/);
    expect(hash).toHaveLength(64); // SHA256 hash length
  });

  it('should generate unique keys', () => {
    const key1 = generateApiKey('sk');
    const key2 = generateApiKey('sk');
    
    expect(key1.key).not.toBe(key2.key);
    expect(key1.hash).not.toBe(key2.hash);
  });

  it('should accept custom prefix', () => {
    const { key } = generateApiKey('pk');
    expect(key).toMatch(/^pk_[a-f0-9]{64}$/);
  });

  it('should generate consistent hashes', () => {
    const { key } = generateApiKey('sk');
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    
    expect(hash1).toBe(hash2);
  });
});

describe('API Key Validation', () => {
  it('should validate correct key format', () => {
    const { key } = generateApiKey('sk');
    expect(isValidApiKeyFormat(key)).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidApiKeyFormat('invalid')).toBe(false);
    expect(isValidApiKeyFormat('sk_short')).toBe(false);
    expect(isValidApiKeyFormat('sk_NOTLOWERCASE12345678901234567890123456789012345678901234567890')).toBe(false);
    expect(isValidApiKeyFormat('')).toBe(false);
  });

  it('should accept valid prefix variations', () => {
    expect(isValidApiKeyFormat('sk_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(true);
    expect(isValidApiKeyFormat('pk_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(true);
  });
});

describe('API Scopes', () => {
  it('should have course operation scopes', () => {
    expect(API_SCOPES.COURSE_READ).toBe('course:read');
    expect(API_SCOPES.COURSE_WRITE).toBe('course:write');
    expect(API_SCOPES.COURSE_DELETE).toBe('course:delete');
  });

  it('should have dispatch operation scopes', () => {
    expect(API_SCOPES.DISPATCH_READ).toBe('dispatch:read');
    expect(API_SCOPES.DISPATCH_WRITE).toBe('dispatch:write');
    expect(API_SCOPES.DISPATCH_DELETE).toBe('dispatch:delete');
  });

  it('should have analytics scopes', () => {
    expect(API_SCOPES.ANALYTICS_READ).toBe('analytics:read');
  });

  it('should have xAPI scopes', () => {
    expect(API_SCOPES.XAPI_READ).toBe('xapi:read');
    expect(API_SCOPES.XAPI_WRITE).toBe('xapi:write');
  });

  it('should have admin wildcard scope', () => {
    expect(API_SCOPES.ADMIN).toBe('admin:*');
  });
});

describe('Hash Security', () => {
  it('should produce different hashes for different keys', () => {
    const key1 = 'sk_' + 'a'.repeat(64);
    const key2 = 'sk_' + 'b'.repeat(64);
    
    const hash1 = hashApiKey(key1);
    const hash2 = hashApiKey(key2);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should produce 256-bit (64 char) hex hashes', () => {
    const { key } = generateApiKey('sk');
    const hash = hashApiKey(key);
    
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
