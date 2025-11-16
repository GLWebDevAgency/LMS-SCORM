import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AssetService } from './assetService';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import archiver from 'archiver';

describe('AssetService', () => {
  let assetService: AssetService;
  let testDir: string;
  let testZipPath: string;
  
  beforeAll(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), 'asset-service-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a test ZIP file with SCORM content
    testZipPath = path.join(testDir, 'test-course.zip');
    await createTestZip(testZipPath);
    
    assetService = new AssetService();
  });
  
  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test directory:', error);
    }
  });
  
  it('should get storage info', async () => {
    const info = await assetService.getStorageInfo();
    
    expect(info).toBeDefined();
    expect(info.type).toBeDefined();
    expect(typeof info.cdnEnabled).toBe('boolean');
    expect(typeof info.healthy).toBe('boolean');
  });
  
  it('should upload course package', async () => {
    const courseId = 'test-course-' + Date.now();
    
    const result = await assetService.uploadCoursePackage(
      testZipPath,
      courseId,
      {
        fileName: 'test-course.zip',
        metadata: {
          title: 'Test Course',
          scormType: 'scorm_1_2',
        }
      }
    );
    
    expect(result).toBeDefined();
    expect(result.storageKey).toContain(courseId);
    expect(result.cdnUrl).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);
    expect(typeof result.cdnEnabled).toBe('boolean');
  });
  
  it('should get course asset URL', async () => {
    const storageKey = 'courses/test-123/package.zip';
    const url = await assetService.getCourseAssetUrl(storageKey);
    
    expect(url).toBeDefined();
    expect(url).toContain(storageKey);
  });
  
  it('should get signed asset URL', async () => {
    const storageKey = 'courses/test-123/package.zip';
    const signedUrl = await assetService.getSignedAssetUrl(storageKey, 3600);
    
    expect(signedUrl).toBeDefined();
    expect(signedUrl).toBeTruthy();
  });
  
  it('should detect correct content types', () => {
    const service = assetService as any;
    
    expect(service.getContentType('index.html')).toBe('text/html');
    expect(service.getContentType('style.css')).toBe('text/css');
    expect(service.getContentType('script.js')).toBe('application/javascript');
    expect(service.getContentType('image.png')).toBe('image/png');
    expect(service.getContentType('video.mp4')).toBe('video/mp4');
    expect(service.getContentType('package.zip')).toBe('application/zip');
    expect(service.getContentType('unknown.xyz')).toBe('application/octet-stream');
  });
  
  it('should apply correct cache control headers', () => {
    const service = assetService as any;
    
    // HTML files should have shorter cache
    expect(service.getCacheControl('index.html')).toContain('max-age=3600');
    
    // Assets should have long cache
    expect(service.getCacheControl('style.css')).toContain('max-age=31536000');
    expect(service.getCacheControl('script.js')).toContain('immutable');
    expect(service.getCacheControl('image.png')).toContain('immutable');
  });
  
  it('should format bytes correctly', () => {
    const service = assetService as any;
    
    expect(service.formatBytes(0)).toBe('0 Bytes');
    expect(service.formatBytes(1024)).toBe('1 KB');
    expect(service.formatBytes(1024 * 1024)).toBe('1 MB');
    expect(service.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });
});

/**
 * Helper function to create a test ZIP file with SCORM structure
 */
async function createTestZip(zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => resolve());
    archive.on('error', (err: Error) => reject(err));
    
    archive.pipe(output);
    
    // Add SCORM manifest
    archive.append(`<?xml version="1.0"?>
<manifest identifier="com.test.course" version="1.0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="default_org">
    <organization identifier="default_org">
      <title>Test Course</title>
      <item identifier="item_1" identifierref="resource_1">
        <title>Lesson 1</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource_1" type="webcontent" href="index.html">
      <file href="index.html"/>
      <file href="style.css"/>
      <file href="script.js"/>
    </resource>
  </resources>
</manifest>`, { name: 'imsmanifest.xml' });
    
    // Add index.html
    archive.append(`<!DOCTYPE html>
<html>
<head>
  <title>Test Course</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Test SCORM Course</h1>
  <script src="script.js"></script>
</body>
</html>`, { name: 'index.html' });
    
    // Add CSS
    archive.append('body { font-family: sans-serif; }', { name: 'style.css' });
    
    // Add JS
    archive.append('console.log("SCORM course loaded");', { name: 'script.js' });
    
    archive.finalize();
  });
}
