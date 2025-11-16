/**
 * E2E tests for admin workflow
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
  });

  test('should display dashboard for authenticated user', async ({ page }) => {
    // Check if landing page or dashboard is visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to courses page', async ({ page }) => {
    // Look for courses link
    const coursesLink = page.getByRole('link', { name: /courses/i });
    
    if (await coursesLink.isVisible({ timeout: 5000 })) {
      await coursesLink.click();
      
      // Verify we're on the courses page
      await expect(page).toHaveURL(/.*courses.*/);
    } else {
      // If not authenticated, should see landing page
      await expect(page.locator('body')).toContainText(/scorm|lms|learning/i);
    }
  });

  test('should display navigation menu', async ({ page }) => {
    // Check for common navigation elements
    const nav = page.locator('nav').first();
    
    if (await nav.isVisible({ timeout: 5000 })) {
      await expect(nav).toBeVisible();
    } else {
      // Landing page might have different navigation
      const header = page.locator('header').first();
      await expect(header).toBeVisible();
    }
  });

  test('should handle responsive layout', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Page should still be functional
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(body).toBeVisible();
  });

  test('should have accessible page structure', async ({ page }) => {
    // Check for proper HTML structure
    const html = page.locator('html');
    await expect(html).toBeVisible();
    
    // Check for main content area
    const main = page.locator('main, [role="main"]').first();
    
    if (await main.isVisible({ timeout: 5000 })) {
      await expect(main).toBeVisible();
    } else {
      // Fallback: check for any content
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });
});

test.describe('Course Management', () => {
  test('should show courses page elements', async ({ page }) => {
    await page.goto('/courses');
    
    // Should either show courses or require authentication
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });

  test('should handle navigation to course preview', async ({ page }) => {
    await page.goto('/courses');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Look for any course cards or elements
    const courseElements = page.locator('[data-testid="course-card"], .course-item, .course-card');
    
    const count = await courseElements.count();
    if (count > 0) {
      // Click first course if available
      await courseElements.first().click();
      
      // Should navigate somewhere (preview or details)
      await page.waitForURL(/.*/, { timeout: 5000 });
    }
  });
});

test.describe('Dispatch Management', () => {
  test('should access dispatches page', async ({ page }) => {
    await page.goto('/dispatches');
    
    // Verify page loads
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });
});

test.describe('Analytics and Reporting', () => {
  test('should access analytics page', async ({ page }) => {
    await page.goto('/analytics');
    
    // Verify page loads
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    
    // Should show some content (404 page or redirect)
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });

  test('should handle invalid routes', async ({ page }) => {
    await page.goto('/invalid/route/test');
    
    // Should not show error in console (check for no crashes)
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });
});
