/**
 * Unit tests for launchService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateLaunchFile } from './launchService';

describe('launchService', () => {
  const testLaunchLinksDir = path.join('/tmp', 'test-launch-links');

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testLaunchLinksDir)) {
      fs.mkdirSync(testLaunchLinksDir, { recursive: true });
    }
    // Mock the uploads directory
    vi.spyOn(process, 'cwd').mockReturnValue('/tmp');
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testLaunchLinksDir)) {
      fs.rmSync(testLaunchLinksDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('generateLaunchFile', () => {
    it('should generate launch.html file with correct token', async () => {
      const dispatchId = 'test-dispatch-123';
      const launchToken = 'test-token-456';
      
      // Set PUBLIC_DOMAIN for testing
      process.env.PUBLIC_DOMAIN = 'https://test.example.com';

      await generateLaunchFile(dispatchId, launchToken);

      const filePath = path.join(testLaunchLinksDir, `dispatch-${dispatchId}.html`);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain(launchToken);
      expect(content).toContain('test.example.com');
    });

    it('should use PUBLIC_DOMAIN from environment', async () => {
      const dispatchId = 'test-dispatch-456';
      const launchToken = 'test-token-789';
      const publicDomain = 'https://custom.example.com';
      
      process.env.PUBLIC_DOMAIN = publicDomain;

      await generateLaunchFile(dispatchId, launchToken);

      const filePath = path.join(testLaunchLinksDir, `dispatch-${dispatchId}.html`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      expect(content).toContain(publicDomain);
      expect(content).toContain(`/launch/${launchToken}`);
    });

    it('should fallback to REPLIT_DOMAINS if PUBLIC_DOMAIN not set', async () => {
      const dispatchId = 'test-dispatch-789';
      const launchToken = 'test-token-abc';
      
      delete process.env.PUBLIC_DOMAIN;
      process.env.REPLIT_DOMAINS = 'app.replit.dev,app.replit.app';

      await generateLaunchFile(dispatchId, launchToken);

      const filePath = path.join(testLaunchLinksDir, `dispatch-${dispatchId}.html`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      expect(content).toContain('app.replit.dev');
    });

    it('should use fallback domain if neither PUBLIC_DOMAIN nor REPLIT_DOMAINS set', async () => {
      const dispatchId = 'test-dispatch-fallback';
      const launchToken = 'test-token-fallback';
      
      delete process.env.PUBLIC_DOMAIN;
      delete process.env.REPLIT_DOMAINS;

      await generateLaunchFile(dispatchId, launchToken);

      const filePath = path.join(testLaunchLinksDir, `dispatch-${dispatchId}.html`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      expect(content).toContain('yourscormplatform.replit.app');
    });

    it('should create directory if it does not exist', async () => {
      const dispatchId = 'test-dispatch-newdir';
      const launchToken = 'test-token-newdir';
      
      // Remove directory
      if (fs.existsSync(testLaunchLinksDir)) {
        fs.rmSync(testLaunchLinksDir, { recursive: true, force: true });
      }

      process.env.PUBLIC_DOMAIN = 'https://test.example.com';
      await generateLaunchFile(dispatchId, launchToken);

      const filePath = path.join(testLaunchLinksDir, `dispatch-${dispatchId}.html`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should overwrite existing launch file', async () => {
      const dispatchId = 'test-dispatch-overwrite';
      const launchToken1 = 'test-token-old';
      const launchToken2 = 'test-token-new';
      
      process.env.PUBLIC_DOMAIN = 'https://test.example.com';

      // Create first file
      await generateLaunchFile(dispatchId, launchToken1);
      const filePath = path.join(testLaunchLinksDir, `dispatch-${dispatchId}.html`);
      const content1 = fs.readFileSync(filePath, 'utf8');
      expect(content1).toContain(launchToken1);

      // Overwrite with second file
      await generateLaunchFile(dispatchId, launchToken2);
      const content2 = fs.readFileSync(filePath, 'utf8');
      expect(content2).toContain(launchToken2);
      expect(content2).not.toContain(launchToken1);
    });

    it('should generate valid HTML structure', async () => {
      const dispatchId = 'test-dispatch-html';
      const launchToken = 'test-token-html';
      
      process.env.PUBLIC_DOMAIN = 'https://test.example.com';
      await generateLaunchFile(dispatchId, launchToken);

      const filePath = path.join(testLaunchLinksDir, `dispatch-${dispatchId}.html`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for basic HTML structure
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html');
      expect(content).toContain('</html>');
      expect(content).toContain('<head');
      expect(content).toContain('</head>');
      expect(content).toContain('<body');
      expect(content).toContain('</body>');
    });

    it('should handle special characters in token', async () => {
      const dispatchId = 'test-dispatch-special';
      const launchToken = 'test-token-with-special-chars-123_abc';
      
      process.env.PUBLIC_DOMAIN = 'https://test.example.com';
      await generateLaunchFile(dispatchId, launchToken);

      const filePath = path.join(testLaunchLinksDir, `dispatch-${dispatchId}.html`);
      const content = fs.readFileSync(filePath, 'utf8');
      
      expect(content).toContain(launchToken);
    });
  });

  describe('launch token validation', () => {
    it('should generate unique tokens for different dispatches', async () => {
      process.env.PUBLIC_DOMAIN = 'https://test.example.com';
      
      const dispatch1 = 'dispatch-1';
      const dispatch2 = 'dispatch-2';
      const token1 = 'unique-token-1';
      const token2 = 'unique-token-2';

      await generateLaunchFile(dispatch1, token1);
      await generateLaunchFile(dispatch2, token2);

      const file1 = fs.readFileSync(
        path.join(testLaunchLinksDir, `dispatch-${dispatch1}.html`),
        'utf8'
      );
      const file2 = fs.readFileSync(
        path.join(testLaunchLinksDir, `dispatch-${dispatch2}.html`),
        'utf8'
      );

      expect(file1).toContain(token1);
      expect(file1).not.toContain(token2);
      expect(file2).toContain(token2);
      expect(file2).not.toContain(token1);
    });
  });
});
