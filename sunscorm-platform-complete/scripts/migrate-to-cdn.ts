#!/usr/bin/env tsx

/**
 * CDN Migration Script
 * Migrates existing courses from local storage to CDN (CloudFlare R2 or AWS S3+CloudFront)
 * 
 * Usage:
 *   npm run migrate-to-cdn              # Migrate all courses
 *   npm run migrate-to-cdn -- --dry-run # Preview migration without making changes
 *   npm run migrate-to-cdn -- --course=course-id-123  # Migrate specific course
 */

import { storage } from '../server/storage';
import { assetService } from '../server/services/assetService';
import { StorageFactory } from '../server/services/storage/StorageFactory';
import { LocalStorageAdapter } from '../server/services/storage/LocalStorageAdapter';
import fs from 'fs/promises';
import path from 'path';

interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ courseId: string; error: string }>;
}

interface MigrationOptions {
  dryRun: boolean;
  courseId?: string;
  force: boolean;
}

async function migrateCourse(course: any, options: MigrationOptions): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log(`\n📦 Processing course: ${course.title} (${course.id})`);
    
    // Skip if already on CDN and not forcing
    if (course.cdnEnabled && !options.force) {
      console.log('  ℹ️  Already on CDN, skipping...');
      return { success: false, error: 'Already on CDN' };
    }
    
    // Check if course file exists locally
    const localPath = course.storagePath;
    if (!localPath || localPath.startsWith('http')) {
      console.log('  ⚠️  Course file not found locally or already remote, skipping...');
      return { success: false, error: 'Not in local storage' };
    }
    
    try {
      await fs.access(localPath);
    } catch {
      console.log(`  ❌ Course file not found at ${localPath}`);
      return { success: false, error: 'File not found' };
    }
    
    // Get file stats
    const stats = await fs.stat(localPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  📊 File size: ${sizeInMB} MB`);
    
    if (options.dryRun) {
      console.log('  🔍 DRY RUN: Would upload to CDN and update database');
      return { success: true };
    }
    
    // Upload to CDN
    console.log('  ⬆️  Uploading to CDN...');
    const uploadResult = await assetService.uploadCoursePackage(
      localPath,
      course.id,
      {
        fileName: course.fileName || path.basename(localPath),
        metadata: {
          title: course.title,
          scormType: course.scormType,
          migratedAt: new Date().toISOString(),
        }
      }
    );
    
    console.log(`  ✅ Uploaded to CDN: ${uploadResult.cdnUrl}`);
    
    // Update database
    await storage.updateCourse(course.id, {
      storageKey: uploadResult.storageKey,
      cdnEnabled: true,
      // Keep original storagePath as backup reference
    });
    
    console.log('  💾 Database updated');
    console.log(`  🎉 Migration successful!`);
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ❌ Migration failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

async function main() {
  console.log('🚀 CDN Migration Script\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    courseId: args.find(arg => arg.startsWith('--course='))?.split('=')[1],
    force: args.includes('--force'),
  };
  
  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  if (options.force) {
    console.log('⚠️  FORCE MODE - Will re-migrate courses already on CDN\n');
  }
  
  // Check CDN configuration
  console.log('🔧 Checking CDN configuration...');
  const storageProvider = StorageFactory.getConfiguredProvider();
  
  if (storageProvider === 'local') {
    console.error('❌ Error: CDN not configured!');
    console.error('   Set STORAGE_PROVIDER to "cloudflare-r2" or "s3-cloudfront" in .env');
    process.exit(1);
  }
  
  const storageAdapter = await StorageFactory.getAdapter();
  const isHealthy = await storageAdapter.healthCheck();
  
  if (!isHealthy) {
    console.error('❌ Error: CDN health check failed!');
    console.error('   Please verify your CDN credentials and configuration.');
    process.exit(1);
  }
  
  console.log(`✅ CDN configured: ${storageProvider}\n`);
  
  // Get courses to migrate
  let courses;
  if (options.courseId) {
    const course = await storage.getCourse(options.courseId);
    if (!course) {
      console.error(`❌ Course not found: ${options.courseId}`);
      process.exit(1);
    }
    courses = [course];
    console.log(`📋 Migrating single course: ${course.title}\n`);
  } else {
    courses = await storage.getCourses();
    console.log(`📋 Found ${courses.length} courses to process\n`);
  }
  
  const stats: MigrationStats = {
    total: courses.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  
  // Migrate each course
  for (const course of courses) {
    const result = await migrateCourse(course, options);
    
    if (result.success) {
      stats.successful++;
    } else if (result.error === 'Already on CDN' || result.error === 'Not in local storage') {
      stats.skipped++;
    } else {
      stats.failed++;
      stats.errors.push({
        courseId: course.id,
        error: result.error || 'Unknown error',
      });
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total courses:     ${stats.total}`);
  console.log(`✅ Successful:     ${stats.successful}`);
  console.log(`⏭️  Skipped:        ${stats.skipped}`);
  console.log(`❌ Failed:         ${stats.failed}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(({ courseId, error }) => {
      console.log(`  - ${courseId}: ${error}`);
    });
  }
  
  console.log('='.repeat(60) + '\n');
  
  if (options.dryRun) {
    console.log('🔍 DRY RUN completed. Run without --dry-run to perform actual migration.');
  } else if (stats.successful > 0) {
    console.log('🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test course launches to verify CDN URLs');
    console.log('   2. Monitor CDN hit rates in Admin Dashboard');
    console.log('   3. Consider purging old local files after verification');
  }
  
  // Exit with error code if there were failures
  if (stats.failed > 0) {
    process.exit(1);
  }
}

// Run migration
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
