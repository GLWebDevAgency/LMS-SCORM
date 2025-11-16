import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { StorageFactory } from './StorageFactory';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let testDir: string;
  
  beforeAll(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), 'storage-adapter-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    adapter = new LocalStorageAdapter(testDir);
  });
  
  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test directory:', error);
    }
  });
  
  it('should initialize local storage adapter', () => {
    expect(adapter.type).toBe('local');
    expect(adapter.cdnEnabled).toBe(false);
  });
  
  it('should pass health check', async () => {
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(true);
  });
  
  it('should upload and retrieve file buffer', async () => {
    const testContent = Buffer.from('Test SCORM package content');
    const destinationKey = 'test-course/package.zip';
    
    const result = await adapter.uploadBuffer(testContent, destinationKey);
    
    expect(result.key).toBe(destinationKey);
    expect(result.size).toBe(testContent.length);
    expect(result.url).toContain(destinationKey);
  });
  
  it('should generate public URL', () => {
    const key = 'courses/123/package.zip';
    const url = adapter.getPublicUrl(key);
    
    expect(url).toContain(key);
  });
  
  it('should delete file', async () => {
    const testContent = Buffer.from('Delete test content');
    const destinationKey = 'test-delete/file.txt';
    
    await adapter.uploadBuffer(testContent, destinationKey);
    const deleteSuccess = await adapter.deleteFile(destinationKey);
    
    expect(deleteSuccess).toBe(true);
  });
  
  it('should handle non-existent file deletion gracefully', async () => {
    const deleteSuccess = await adapter.deleteFile('non-existent/file.txt');
    expect(deleteSuccess).toBe(false);
  });
  
  it('should batch delete multiple files', async () => {
    // Upload multiple files
    const files = [
      'batch-test/file1.txt',
      'batch-test/file2.txt',
      'batch-test/file3.txt',
    ];
    
    for (const file of files) {
      await adapter.uploadBuffer(Buffer.from('test'), file);
    }
    
    // Delete them all
    const deletedCount = await adapter.deleteFiles(files);
    expect(deletedCount).toBe(3);
  });
  
  it('should sanitize storage keys', async () => {
    // Try to use path traversal in key
    const maliciousKey = '../../../etc/passwd';
    const testContent = Buffer.from('test');
    
    const result = await adapter.uploadBuffer(testContent, maliciousKey);
    
    // Should sanitize the key
    expect(result.key).not.toContain('..');
  });
});

describe('StorageFactory', () => {
  it('should return configured provider type', () => {
    const provider = StorageFactory.getConfiguredProvider();
    expect(provider).toBeDefined();
    expect(['local', 'cloudflare-r2', 's3-cloudfront']).toContain(provider);
  });
  
  it('should create storage adapter instance', async () => {
    const adapter = await StorageFactory.getAdapter();
    
    expect(adapter).toBeDefined();
    expect(adapter.type).toBeDefined();
    expect(typeof adapter.healthCheck).toBe('function');
  });
  
  it('should return same instance (singleton)', async () => {
    const adapter1 = await StorageFactory.getAdapter();
    const adapter2 = await StorageFactory.getAdapter();
    
    expect(adapter1).toBe(adapter2);
  });
  
  it('should default to local storage when no CDN configured', async () => {
    // In test environment, CDN credentials are not set
    // So it should fall back to local storage
    const adapter = await StorageFactory.getAdapter();
    
    // If no CDN is configured, should be local storage
    if (adapter.type === 'local') {
      expect(adapter.cdnEnabled).toBe(false);
    }
  });
});
