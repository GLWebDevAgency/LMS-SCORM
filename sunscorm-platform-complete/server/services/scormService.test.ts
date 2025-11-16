/**
 * Unit tests for scormService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  findSCORMEntryPoint, 
  getSCORMManifest, 
  extractFileFromZip,
  getContentType 
} from './scormService';
import { 
  createScorm12Package, 
  createScorm2004Package, 
  createInvalidScormPackage,
  createCorruptedZipFile,
  cleanupTestFiles 
} from '../../tests/helpers/scormPackages';

describe('scormService', () => {
  let testPackagePaths: string[] = [];

  afterEach(async () => {
    // Clean up test packages
    for (const path of testPackagePaths) {
      cleanupTestFiles(path);
    }
    testPackagePaths = [];
  });

  describe('findSCORMEntryPoint', () => {
    it('should find entry point from SCORM 1.2 manifest', async () => {
      const zipPath = await createScorm12Package('Test Course');
      testPackagePaths.push(zipPath);

      const entryPoint = await findSCORMEntryPoint(zipPath);
      expect(entryPoint).toBe('index.html');
    });

    it('should find entry point from SCORM 2004 manifest', async () => {
      const zipPath = await createScorm2004Package('Test Course');
      testPackagePaths.push(zipPath);

      const entryPoint = await findSCORMEntryPoint(zipPath);
      expect(entryPoint).toBe('index.html');
    });

    it('should fallback to index.html when manifest is invalid', async () => {
      const zipPath = await createInvalidScormPackage();
      testPackagePaths.push(zipPath);

      const entryPoint = await findSCORMEntryPoint(zipPath);
      // Should fallback to finding HTML files
      expect(entryPoint).toMatch(/\.html?$/);
    });

    it('should throw error for corrupted ZIP', async () => {
      const zipPath = await createCorruptedZipFile();
      testPackagePaths.push(zipPath);

      await expect(findSCORMEntryPoint(zipPath)).rejects.toThrow();
    });
  });

  describe('getSCORMManifest', () => {
    it('should parse SCORM 1.2 manifest correctly', async () => {
      const zipPath = await createScorm12Package('SCORM 1.2 Test');
      testPackagePaths.push(zipPath);

      const manifest = await getSCORMManifest(zipPath);
      expect(manifest).toBeTruthy();
      expect(manifest?.version).toBe('scorm_1_2');
      expect(manifest?.title).toBe('SCORM 1.2 Test');
      expect(manifest?.entryPoint).toBe('index.html');
    });

    it('should parse SCORM 2004 manifest correctly', async () => {
      const zipPath = await createScorm2004Package('SCORM 2004 Test');
      testPackagePaths.push(zipPath);

      const manifest = await getSCORMManifest(zipPath);
      expect(manifest).toBeTruthy();
      expect(manifest?.version).toBe('scorm_2004');
      expect(manifest?.title).toBe('SCORM 2004 Test');
      expect(manifest?.entryPoint).toBe('index.html');
    });

    it('should handle invalid manifests gracefully', async () => {
      const zipPath = await createInvalidScormPackage();
      testPackagePaths.push(zipPath);

      const manifest = await getSCORMManifest(zipPath);
      // Should still return some manifest data even if invalid
      expect(manifest).toBeTruthy();
    });
  });

  describe('extractFileFromZip', () => {
    it('should extract manifest file from ZIP', async () => {
      const zipPath = await createScorm12Package();
      testPackagePaths.push(zipPath);

      const manifest = await extractFileFromZip(zipPath, 'imsmanifest.xml');
      expect(manifest).toBeTruthy();
      expect(manifest.toString('utf8')).toContain('<?xml version');
      expect(manifest.toString('utf8')).toContain('manifest');
    });

    it('should extract HTML file from ZIP', async () => {
      const zipPath = await createScorm12Package();
      testPackagePaths.push(zipPath);

      const html = await extractFileFromZip(zipPath, 'index.html');
      expect(html).toBeTruthy();
      expect(html.toString('utf8')).toContain('<!DOCTYPE html>');
    });

    it('should throw error for non-existent file', async () => {
      const zipPath = await createScorm12Package();
      testPackagePaths.push(zipPath);

      await expect(
        extractFileFromZip(zipPath, 'nonexistent.html')
      ).rejects.toThrow('File not found in ZIP');
    });
  });

  describe('getContentType', () => {
    it('should return correct content type for HTML files', () => {
      expect(getContentType('index.html')).toBe('text/html');
      expect(getContentType('page.htm')).toBe('text/html');
    });

    it('should return correct content type for JavaScript files', () => {
      expect(getContentType('script.js')).toBe('application/javascript');
    });

    it('should return correct content type for CSS files', () => {
      expect(getContentType('styles.css')).toBe('text/css');
    });

    it('should return correct content type for image files', () => {
      expect(getContentType('image.png')).toBe('image/png');
      expect(getContentType('image.jpg')).toBe('image/jpeg');
      expect(getContentType('image.jpeg')).toBe('image/jpeg');
      expect(getContentType('image.gif')).toBe('image/gif');
    });

    it('should return default content type for unknown extensions', () => {
      expect(getContentType('file.unknown')).toBe('application/octet-stream');
    });

    it('should be case-insensitive', () => {
      expect(getContentType('INDEX.HTML')).toBe('text/html');
      expect(getContentType('SCRIPT.JS')).toBe('application/javascript');
    });
  });

  describe('caching behavior', () => {
    it('should use cache for repeated requests to same ZIP', async () => {
      const zipPath = await createScorm12Package();
      testPackagePaths.push(zipPath);

      // First call - should extract
      const entryPoint1 = await findSCORMEntryPoint(zipPath);
      
      // Second call - should use cache
      const entryPoint2 = await findSCORMEntryPoint(zipPath);
      
      expect(entryPoint1).toBe(entryPoint2);
    });
  });

  describe('error handling', () => {
    it('should handle missing ZIP file', async () => {
      await expect(
        findSCORMEntryPoint('/nonexistent/path.zip')
      ).rejects.toThrow();
    });

    it('should handle corrupted manifest XML', async () => {
      const zipPath = await createInvalidScormPackage();
      testPackagePaths.push(zipPath);

      // Should not throw, but return fallback values
      const manifest = await getSCORMManifest(zipPath);
      expect(manifest).toBeTruthy();
    });
  });
});
