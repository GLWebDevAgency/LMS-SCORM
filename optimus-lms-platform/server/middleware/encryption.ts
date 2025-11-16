import crypto from 'crypto';

/**
 * Encryption utilities for sensitive data at rest
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment or generate one
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    console.warn('[ENCRYPTION] Using default key - NOT SAFE FOR PRODUCTION');
    return crypto.scryptSync('default-key-not-safe', 'salt', KEY_LENGTH);
  }
  
  // Derive key from password using PBKDF2
  const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'default-salt', 'utf8');
  return crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a string value
 * Returns base64 encoded: iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('[ENCRYPTION] Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract iv, authTag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[ENCRYPTION] Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a value (one-way, for passwords or API keys)
 * Uses SHA-256
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Hash a value with salt (for passwords)
 * Uses PBKDF2
 */
export function hashWithSalt(value: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hashedValue = crypto.pbkdf2Sync(
    value,
    useSalt,
    ITERATIONS,
    KEY_LENGTH,
    'sha256'
  ).toString('hex');
  
  return {
    hash: hashedValue,
    salt: useSalt
  };
}

/**
 * Verify a hashed value
 */
export function verifyHash(value: string, hashedValue: string, salt: string): boolean {
  const { hash } = hashWithSalt(value, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(hashedValue, 'hex')
  );
}

/**
 * Generate a secure random token
 */
export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Mask sensitive data for logging
 * Shows first and last few characters
 */
export function maskSensitiveData(data: string, showChars: number = 4): string {
  if (data.length <= showChars * 2) {
    return '*'.repeat(data.length);
  }
  
  const start = data.substring(0, showChars);
  const end = data.substring(data.length - showChars);
  const masked = '*'.repeat(Math.max(0, data.length - showChars * 2));
  
  return `${start}${masked}${end}`;
}

/**
 * Field-level encryption for database
 * Encrypts specific fields in an object
 */
export function encryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...data };
  
  for (const field of fieldsToEncrypt) {
    if (encrypted[field] && typeof encrypted[field] === 'string') {
      encrypted[field] = encrypt(encrypted[field] as string) as any;
    }
  }
  
  return encrypted;
}

/**
 * Field-level decryption for database
 */
export function decryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...data };
  
  for (const field of fieldsToDecrypt) {
    if (decrypted[field] && typeof decrypted[field] === 'string') {
      try {
        decrypted[field] = decrypt(decrypted[field] as string) as any;
      } catch (error) {
        console.error(`[ENCRYPTION] Failed to decrypt field ${String(field)}`);
        // Keep original value if decryption fails
      }
    }
  }
  
  return decrypted;
}

/**
 * Generate encryption key for .env file
 */
export function generateEncryptionKey(): { key: string; salt: string } {
  const key = crypto.randomBytes(32).toString('hex');
  const salt = crypto.randomBytes(32).toString('hex');
  
  return { key, salt };
}

// Example usage in documentation:
// const { key, salt } = generateEncryptionKey();
// console.log('Add to .env file:');
// console.log(`ENCRYPTION_KEY=${key}`);
// console.log(`ENCRYPTION_SALT=${salt}`);
