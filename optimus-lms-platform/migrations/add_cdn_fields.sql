-- Migration: Add CDN-related fields to courses table
-- This migration adds support for CDN storage with CloudFlare R2 and AWS S3+CloudFront

-- Add storageKey column for CDN storage path/key
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- Add cdnEnabled column to track CDN status per course
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS cdn_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN courses.storage_key IS 'CDN storage key/path for the course package (e.g., courses/{courseId}/package.zip)';
COMMENT ON COLUMN courses.cdn_enabled IS 'Whether CDN is enabled for this course (true = CDN, false = local storage)';

-- Create index for CDN-enabled courses for efficient querying
CREATE INDEX IF NOT EXISTS idx_courses_cdn_enabled ON courses(cdn_enabled) WHERE cdn_enabled = true;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added storage_key and cdn_enabled columns to courses table';
END $$;
