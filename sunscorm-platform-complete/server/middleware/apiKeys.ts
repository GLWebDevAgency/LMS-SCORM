import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

/**
 * API Key Management System
 * Provides secure API key generation, validation, and rotation
 */

export interface ApiKey {
  id: number;
  tenantId: number;
  name: string;
  keyHash: string;
  lastUsed: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  scopes: string[];
  createdAt: Date;
  createdBy: number;
}

/**
 * Generate a secure API key
 * Format: prefix_randomBytes
 */
export function generateApiKey(prefix: string = 'sk'): { key: string; hash: string } {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const key = `${prefix}_${randomBytes}`;
  const hash = hashApiKey(key);
  
  return { key, hash };
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return /^[a-z]{2,}_[a-f0-9]{64}$/.test(key);
}

/**
 * Middleware to authenticate requests using API keys
 */
export function apiKeyAuth(requiredScopes: string[] = []) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      // Extract API key from header
      const apiKey = req.get('X-API-Key') || req.get('Authorization')?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'API_KEY_REQUIRED',
          message: 'API key is required. Include it in X-API-Key header or Authorization header.',
        });
      }
      
      // Validate format
      if (!isValidApiKeyFormat(apiKey)) {
        return res.status(401).json({
          error: 'INVALID_API_KEY_FORMAT',
          message: 'API key format is invalid.',
        });
      }
      
      // Hash the provided key
      const keyHash = hashApiKey(apiKey);
      
      // Look up the key in the database
      // TODO: Implement database lookup
      // const apiKeyRecord = await storage.getApiKeyByHash(keyHash);
      
      // For now, we'll simulate a simple check
      // In production, this would query the database
      const apiKeyRecord: ApiKey | null = null; // Placeholder
      
      if (!apiKeyRecord) {
        return res.status(401).json({
          error: 'INVALID_API_KEY',
          message: 'API key is invalid or has been revoked.',
        });
      }
      
      // Check if key is active
      if (!apiKeyRecord.isActive) {
        return res.status(401).json({
          error: 'API_KEY_INACTIVE',
          message: 'API key has been deactivated.',
        });
      }
      
      // Check expiration
      if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
        return res.status(401).json({
          error: 'API_KEY_EXPIRED',
          message: 'API key has expired.',
        });
      }
      
      // Check scopes
      if (requiredScopes.length > 0) {
        const hasRequiredScopes = requiredScopes.every(scope => 
          apiKeyRecord.scopes.includes(scope)
        );
        
        if (!hasRequiredScopes) {
          return res.status(403).json({
            error: 'INSUFFICIENT_PERMISSIONS',
            message: `API key does not have required permissions: ${requiredScopes.join(', ')}`,
          });
        }
      }
      
      // Update last used timestamp
      // TODO: Implement async update (don't block request)
      // storage.updateApiKeyLastUsed(apiKeyRecord.id).catch(err => 
      //   console.error('Failed to update API key last used:', err)
      // );
      
      // Attach API key info to request
      req.apiKey = apiKeyRecord;
      req.user = {
        id: apiKeyRecord.createdBy,
        tenantId: apiKeyRecord.tenantId,
        isApiKey: true,
      };
      
      next();
    } catch (error) {
      console.error('[API_KEY_AUTH] Error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to validate API key.',
      });
    }
  };
}

/**
 * Create a new API key
 */
export async function createApiKey(params: {
  tenantId: number;
  userId: number;
  name: string;
  scopes: string[];
  expiresInDays?: number;
}): Promise<{ key: string; id: number }> {
  const { key, hash } = generateApiKey('sk');
  
  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  
  // TODO: Implement database storage
  // const apiKeyRecord = await storage.createApiKey({
  //   tenantId: params.tenantId,
  //   name: params.name,
  //   keyHash: hash,
  //   scopes: params.scopes,
  //   expiresAt,
  //   createdBy: params.userId,
  //   isActive: true,
  // });
  
  // For now, return mock data
  const apiKeyRecord = { id: 1 }; // Placeholder
  
  return {
    key, // Only returned once during creation
    id: apiKeyRecord.id,
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(apiKeyId: number, tenantId: number): Promise<void> {
  // TODO: Implement database update
  // await storage.updateApiKey(apiKeyId, { isActive: false }, tenantId);
}

/**
 * Rotate an API key (create new, revoke old)
 */
export async function rotateApiKey(
  oldKeyId: number,
  params: {
    tenantId: number;
    userId: number;
    name: string;
    scopes: string[];
  }
): Promise<{ key: string; id: number }> {
  // Create new key
  const newKey = await createApiKey(params);
  
  // Revoke old key
  await revokeApiKey(oldKeyId, params.tenantId);
  
  return newKey;
}

/**
 * List API keys for a tenant
 */
export async function listApiKeys(tenantId: number): Promise<Partial<ApiKey>[]> {
  // TODO: Implement database query
  // const keys = await storage.getApiKeysByTenant(tenantId);
  
  // Return keys without the hash (security)
  // return keys.map(key => ({
  //   id: key.id,
  //   name: key.name,
  //   lastUsed: key.lastUsed,
  //   expiresAt: key.expiresAt,
  //   isActive: key.isActive,
  //   scopes: key.scopes,
  //   createdAt: key.createdAt,
  // }));
  
  return []; // Placeholder
}

// Available API scopes
export const API_SCOPES = {
  // Course operations
  COURSE_READ: 'course:read',
  COURSE_WRITE: 'course:write',
  COURSE_DELETE: 'course:delete',
  
  // Dispatch operations
  DISPATCH_READ: 'dispatch:read',
  DISPATCH_WRITE: 'dispatch:write',
  DISPATCH_DELETE: 'dispatch:delete',
  
  // Analytics
  ANALYTICS_READ: 'analytics:read',
  
  // xAPI
  XAPI_WRITE: 'xapi:write',
  XAPI_READ: 'xapi:read',
  
  // Admin operations
  ADMIN: 'admin:*',
} as const;
