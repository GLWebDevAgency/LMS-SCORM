import { describe, it, expect } from 'vitest';
import { CdnService } from './cdnService';

describe('CdnService', () => {
  let cdnService: CdnService;
  
  beforeAll(() => {
    cdnService = new CdnService();
  });
  
  it('should get CDN status', async () => {
    const status = await cdnService.getCdnStatus();
    
    expect(status).toBeDefined();
    expect(typeof status.enabled).toBe('boolean');
    expect(status.provider).toBeDefined();
    expect(typeof status.healthy).toBe('boolean');
  });
  
  it('should handle purge cache with no targets gracefully', async () => {
    const result = await cdnService.purgeCache({});
    
    expect(result).toBeDefined();
    // When CDN is not enabled (local storage), returns success with no targets
    // When CDN is enabled, would return error for no targets
    expect(typeof result.success).toBe('boolean');
    expect(result.message).toBeDefined();
  });
  
  it('should return success when CDN not enabled', async () => {
    // For local storage, purge should succeed (no-op)
    const result = await cdnService.purgeCache({
      keys: ['test/file.zip']
    });
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
  
  it('should purge URLs', async () => {
    const urls = [
      'https://cdn.example.com/courses/123/package.zip',
      'https://cdn.example.com/courses/456/package.zip',
    ];
    
    const result = await cdnService.purgeUrls(urls);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
  
  it('should handle invalid URLs gracefully', async () => {
    const urls = ['not-a-valid-url', ''];
    
    const result = await cdnService.purgeUrls(urls);
    
    expect(result).toBeDefined();
  });
  
  it('should get cache hit rate', async () => {
    const hitRate = await cdnService.getCacheHitRate();
    
    expect(hitRate).toBeDefined();
    expect(typeof hitRate.hitRate).toBe('number');
    expect(typeof hitRate.dataPoints).toBe('number');
    expect(hitRate.lastUpdated).toBeInstanceOf(Date);
  });
  
  it('should get bandwidth usage', async () => {
    const bandwidth = await cdnService.getBandwidthUsage();
    
    expect(bandwidth).toBeDefined();
    expect(typeof bandwidth.totalBytes).toBe('number');
    expect(typeof bandwidth.period).toBe('string');
    expect(bandwidth.lastUpdated).toBeInstanceOf(Date);
  });
  
  it('should convert URL to storage key correctly', () => {
    const service = cdnService as any;
    
    const url = 'https://cdn.example.com/courses/123/package.zip';
    const key = service.urlToStorageKey(url);
    
    expect(key).toBe('courses/123/package.zip');
  });
  
  it('should handle invalid URL in urlToStorageKey', () => {
    const service = cdnService as any;
    
    const invalidUrl = 'not-a-url';
    const key = service.urlToStorageKey(invalidUrl);
    
    expect(key).toBeNull();
  });
});
