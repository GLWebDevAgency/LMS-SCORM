/**
 * Encryption tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  encrypt,
  decrypt,
  hash,
  hashWithSalt,
  verifyHash,
  generateToken,
  maskSensitiveData,
  encryptFields,
  decryptFields,
  generateEncryptionKey,
} from './encryption';

describe('Encryption and Decryption', () => {
  it('should encrypt and decrypt a string', () => {
    const plaintext = 'sensitive data';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(encrypted).not.toBe(plaintext);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', () => {
    const plaintext = 'test data';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    
    // Different due to random IV
    expect(encrypted1).not.toBe(encrypted2);
    
    // But both decrypt to same value
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it('should handle empty strings', () => {
    const plaintext = '';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should handle special characters', () => {
    const plaintext = 'Test!@#$%^&*()_+-=[]{}|;:,.<>?/~`\n\t';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should handle unicode characters', () => {
    const plaintext = 'Hello 世界 🌍 مرحبا';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should produce base64 encoded output', () => {
    const plaintext = 'test';
    const encrypted = encrypt(plaintext);
    
    // Base64 regex
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe('Hashing', () => {
  it('should hash a string consistently', () => {
    const value = 'password123';
    const hash1 = hash(value);
    const hash2 = hash(value);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it('should produce different hashes for different values', () => {
    const hash1 = hash('password1');
    const hash2 = hash('password2');
    
    expect(hash1).not.toBe(hash2);
  });

  it('should hash with salt', () => {
    const value = 'password';
    const { hash: hash1, salt: salt1 } = hashWithSalt(value);
    const { hash: hash2, salt: salt2 } = hashWithSalt(value);
    
    // Different salts produce different hashes
    expect(hash1).not.toBe(hash2);
    expect(salt1).not.toBe(salt2);
  });

  it('should verify hashed values', () => {
    const value = 'password123';
    const { hash: hashedValue, salt } = hashWithSalt(value);
    
    expect(verifyHash(value, hashedValue, salt)).toBe(true);
    expect(verifyHash('wrongpassword', hashedValue, salt)).toBe(false);
  });

  it('should use provided salt', () => {
    const value = 'password';
    const customSalt = 'my-custom-salt';
    
    const { hash: hash1, salt: salt1 } = hashWithSalt(value, customSalt);
    const { hash: hash2, salt: salt2 } = hashWithSalt(value, customSalt);
    
    expect(salt1).toBe(customSalt);
    expect(salt2).toBe(customSalt);
    expect(hash1).toBe(hash2); // Same salt = same hash
  });
});

describe('Token Generation', () => {
  it('should generate random tokens', () => {
    const token1 = generateToken();
    const token2 = generateToken();
    
    expect(token1).not.toBe(token2);
    expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
  });

  it('should generate tokens of specified length', () => {
    const token16 = generateToken(16);
    const token64 = generateToken(64);
    
    expect(token16).toHaveLength(32); // 16 bytes = 32 hex
    expect(token64).toHaveLength(128); // 64 bytes = 128 hex
  });

  it('should produce hex output', () => {
    const token = generateToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
  });
});

describe('Sensitive Data Masking', () => {
  it('should mask sensitive data', () => {
    const data = 'sk_1234567890abcdef';
    const masked = maskSensitiveData(data);
    
    expect(masked).toContain('sk_1');
    expect(masked).toContain('cdef');
    expect(masked).toContain('****');
  });

  it('should mask short strings completely', () => {
    const data = 'short';
    const masked = maskSensitiveData(data);
    
    expect(masked).toBe('*****');
  });

  it('should handle custom show chars', () => {
    const data = 'abcdefghijklmnop';
    const masked = maskSensitiveData(data, 2);
    
    expect(masked).toMatch(/^ab.*op$/);
  });

  it('should handle empty strings', () => {
    const masked = maskSensitiveData('');
    expect(masked).toBe('');
  });
});

describe('Field-Level Encryption', () => {
  it('should encrypt specified fields', () => {
    const data = {
      publicField: 'public data',
      secretField: 'secret data',
      anotherSecret: 'another secret',
    };
    
    const encrypted = encryptFields(data, ['secretField', 'anotherSecret']);
    
    expect(encrypted.publicField).toBe('public data');
    expect(encrypted.secretField).not.toBe('secret data');
    expect(encrypted.anotherSecret).not.toBe('another secret');
  });

  it('should decrypt encrypted fields', () => {
    const data = {
      publicField: 'public data',
      secretField: 'secret data',
    };
    
    const encrypted = encryptFields(data, ['secretField']);
    const decrypted = decryptFields(encrypted, ['secretField']);
    
    expect(decrypted.secretField).toBe('secret data');
  });

  it('should handle missing fields gracefully', () => {
    const data = {
      field1: 'value1',
    };
    
    const encrypted = encryptFields(data, ['field1', 'field2' as any]);
    expect(encrypted.field1).not.toBe('value1');
  });

  it('should preserve non-string fields', () => {
    const data = {
      stringField: 'string',
      numberField: 123,
      boolField: true,
      nullField: null,
    };
    
    const encrypted = encryptFields(data, ['stringField', 'numberField']);
    
    expect(encrypted.stringField).not.toBe('string');
    expect(encrypted.numberField).toBe(123); // Not encrypted (not a string)
    expect(encrypted.boolField).toBe(true);
    expect(encrypted.nullField).toBe(null);
  });
});

describe('Key Generation', () => {
  it('should generate encryption keys', () => {
    const { key, salt } = generateEncryptionKey();
    
    expect(key).toHaveLength(64); // 32 bytes hex
    expect(salt).toHaveLength(64); // 32 bytes hex
    expect(key).toMatch(/^[a-f0-9]+$/);
    expect(salt).toMatch(/^[a-f0-9]+$/);
  });

  it('should generate unique keys', () => {
    const result1 = generateEncryptionKey();
    const result2 = generateEncryptionKey();
    
    expect(result1.key).not.toBe(result2.key);
    expect(result1.salt).not.toBe(result2.salt);
  });
});
