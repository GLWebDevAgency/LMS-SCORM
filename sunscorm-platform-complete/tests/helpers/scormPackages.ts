/**
 * Helper utilities for creating test SCORM packages
 */

import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { createScorm12Manifest, createScorm2004Manifest, createInvalidManifest } from './fixtures';

/**
 * Create a temporary SCORM 1.2 package ZIP file
 */
export async function createScorm12Package(title = 'Test SCORM 1.2 Course'): Promise<string> {
  const tempDir = path.join('/tmp', `scorm-test-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  const zipPath = path.join(tempDir, 'scorm12.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);
    
    archive.pipe(output);
    
    // Add imsmanifest.xml
    archive.append(createScorm12Manifest(title), { name: 'imsmanifest.xml' });
    
    // Add index.html
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <script src="shared/api.js"></script>
</head>
<body>
  <h1>${title}</h1>
  <p>This is a test SCORM 1.2 course.</p>
  <script>
    if (window.API) {
      window.API.LMSInitialize("");
      window.API.LMSSetValue("cmi.core.lesson_status", "completed");
      window.API.LMSFinish("");
    }
  </script>
</body>
</html>`;
    archive.append(indexHtml, { name: 'index.html' });
    
    // Add shared/api.js
    const apiJs = `// SCORM 1.2 API Mock
window.API = {
  LMSInitialize: function() { return "true"; },
  LMSFinish: function() { return "true"; },
  LMSGetValue: function(element) { return ""; },
  LMSSetValue: function(element, value) { return "true"; },
  LMSCommit: function() { return "true"; },
  LMSGetLastError: function() { return "0"; },
  LMSGetErrorString: function(errorCode) { return ""; },
  LMSGetDiagnostic: function(errorCode) { return ""; }
};`;
    archive.append(apiJs, { name: 'shared/api.js' });
    
    archive.finalize();
  });
}

/**
 * Create a temporary SCORM 2004 package ZIP file
 */
export async function createScorm2004Package(title = 'Test SCORM 2004 Course'): Promise<string> {
  const tempDir = path.join('/tmp', `scorm-test-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  const zipPath = path.join(tempDir, 'scorm2004.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);
    
    archive.pipe(output);
    
    // Add imsmanifest.xml
    archive.append(createScorm2004Manifest(title), { name: 'imsmanifest.xml' });
    
    // Add index.html
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  <p>This is a test SCORM 2004 course.</p>
  <script>
    if (window.API_1484_11) {
      window.API_1484_11.Initialize("");
      window.API_1484_11.SetValue("cmi.completion_status", "completed");
      window.API_1484_11.Terminate("");
    }
  </script>
</body>
</html>`;
    archive.append(indexHtml, { name: 'index.html' });
    
    archive.finalize();
  });
}

/**
 * Create an invalid SCORM package (missing entry point)
 */
export async function createInvalidScormPackage(): Promise<string> {
  const tempDir = path.join('/tmp', `scorm-test-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  const zipPath = path.join(tempDir, 'invalid.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);
    
    archive.pipe(output);
    
    // Add invalid manifest
    archive.append(createInvalidManifest(), { name: 'imsmanifest.xml' });
    
    // Add a file but no proper entry point
    archive.append('<html><body>Invalid</body></html>', { name: 'invalid.html' });
    
    archive.finalize();
  });
}

/**
 * Create a corrupted ZIP file
 */
export async function createCorruptedZipFile(): Promise<string> {
  const tempDir = path.join('/tmp', `scorm-test-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  const zipPath = path.join(tempDir, 'corrupted.zip');
  // Write random bytes that are not a valid ZIP
  fs.writeFileSync(zipPath, Buffer.from('This is not a valid ZIP file'));
  
  return zipPath;
}

/**
 * Clean up temporary test files
 */
export function cleanupTestFiles(filePath: string): void {
  try {
    const dir = path.dirname(filePath);
    if (dir.includes('scorm-test-')) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Failed to cleanup test files:', error);
  }
}
