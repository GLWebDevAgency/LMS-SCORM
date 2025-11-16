# Testing Guide

This document provides comprehensive information about the testing infrastructure for the SCORM LMS platform.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Pipeline](#cicd-pipeline)
- [Coverage Requirements](#coverage-requirements)
- [Test Helpers](#test-helpers)

## Overview

The testing infrastructure consists of three layers:

1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test interaction between multiple components
3. **E2E Tests**: Test complete user workflows using Playwright

**Current Status:**
- Testing framework: Vitest
- E2E framework: Playwright
- Coverage tool: V8
- Target coverage: 80%+

## Test Structure

```
tests/
├── helpers/
│   ├── testDb.ts           # Database utilities
│   ├── fixtures.ts         # Test data generators
│   ├── mockAuth.ts         # Authentication mocking
│   └── scormPackages.ts    # SCORM package helpers
├── integration/
│   ├── scorm-upload.test.ts
│   ├── dispatch-management.test.ts
│   └── course-launch.test.ts
└── e2e/
    ├── admin-workflow.spec.ts
    ├── learner-workflow.spec.ts
    └── multi-tenant.spec.ts

server/
├── services/
│   ├── scormService.test.ts
│   └── launchService.test.ts
└── licenseEnforcement.test.ts
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### With Coverage Report
```bash
npm run test:coverage
```

### E2E Tests with UI
```bash
npm run test:e2e:ui
```

## Writing Tests

### Unit Tests

Unit tests should focus on testing individual functions in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule';

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Integration Tests

Integration tests verify interactions between components:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/testDb';

describe('SCORM Upload Integration', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  it('should complete upload workflow', async () => {
    // Test full workflow
  });
});
```

### E2E Tests

E2E tests use Playwright to test complete user journeys:

```typescript
import { test, expect } from '@playwright/test';

test('admin can upload course', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Upload Course');
  // ... test steps
  await expect(page.locator('.success-message')).toBeVisible();
});
```

## CI/CD Pipeline

The CI/CD pipeline runs automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

### Pipeline Stages

1. **Test**: Runs unit and integration tests
   - Type checking with TypeScript
   - Unit tests with coverage
   - Coverage threshold validation (80%)

2. **Build**: Builds the application
   - Compiles TypeScript
   - Bundles frontend assets
   - Uploads build artifacts

3. **E2E** (only on push to main/develop): Runs end-to-end tests
   - Installs Playwright browsers
   - Runs full E2E test suite
   - Uploads test reports

### Pipeline Configuration

See `.github/workflows/ci.yml` for the complete pipeline configuration.

### Required Environment Variables

- `DATABASE_URL`: PostgreSQL connection string for tests
- `NODE_ENV`: Set to 'test' for test runs
- `CODECOV_TOKEN`: (Optional) Token for uploading coverage reports

## Coverage Requirements

### Minimum Thresholds

- **Overall Coverage**: 80%
- **Services**: 90%
- **Routes**: 85%
- **Critical Paths**: 95%

### Coverage Reports

Coverage reports are generated in:
- Terminal output (text format)
- `coverage/` directory (HTML format)
- `coverage/coverage-final.json` (JSON format for CI)

View HTML coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

### Excluded from Coverage

- UI components (tested via E2E)
- Configuration files
- Type definition files
- Test files themselves
- Node modules

## Test Helpers

### Database Helpers (`tests/helpers/testDb.ts`)

```typescript
import { setupTestDatabase, clearDatabase } from './helpers/testDb';

// Setup clean database
await setupTestDatabase();

// Clear all data
await clearDatabase();
```

### Fixtures (`tests/helpers/fixtures.ts`)

```typescript
import { createTestUser, createTestCourse } from './helpers/fixtures';

const user = createTestUser({ role: 'admin' });
const course = createTestCourse({ title: 'My Test Course' });
```

### Mock Authentication (`tests/helpers/mockAuth.ts`)

```typescript
import { createMockAuthRequest } from './helpers/mockAuth';

const req = createMockAuthRequest({
  id: '123',
  email: 'test@example.com',
  role: 'admin',
  tenantId: 'tenant-1'
});
```

### SCORM Package Helpers (`tests/helpers/scormPackages.ts`)

```typescript
import { createScorm12Package, cleanupTestFiles } from './helpers/scormPackages';

const zipPath = await createScorm12Package('Test Course');
// Use the package...
cleanupTestFiles(zipPath); // Clean up afterwards
```

## Best Practices

### General Guidelines

1. **Isolation**: Tests should be independent and not rely on other tests
2. **Speed**: Keep tests fast - mock external dependencies
3. **Clarity**: Test names should clearly describe what is being tested
4. **Coverage**: Aim for high coverage, but focus on critical paths
5. **Cleanup**: Always clean up test data and resources

### Unit Test Guidelines

- Test one thing per test
- Use descriptive test names
- Mock external dependencies
- Test both success and error cases
- Test edge cases and boundary conditions

### Integration Test Guidelines

- Test realistic workflows
- Use test database with transactions
- Clean up data between tests
- Test multi-step processes
- Verify database state after operations

### E2E Test Guidelines

- Test complete user journeys
- Use page object pattern for reusability
- Wait for elements properly (avoid hardcoded waits)
- Test critical user flows first
- Keep E2E tests stable and reliable

## Troubleshooting

### Tests Failing Locally

1. Ensure database is running:
   ```bash
   # Check if PostgreSQL is running
   pg_isready
   ```

2. Reset test database:
   ```bash
   npm run db:push
   ```

3. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Coverage Not Meeting Threshold

1. Run coverage report to see uncovered lines:
   ```bash
   npm run test:coverage
   open coverage/index.html
   ```

2. Add tests for uncovered code paths

3. Check if files should be excluded from coverage

### E2E Tests Timing Out

1. Increase timeout in `playwright.config.ts`
2. Check if dev server is starting properly
3. Verify BASE_URL is correct
4. Check browser console for errors

### CI Pipeline Failing

1. Check GitHub Actions logs for specific errors
2. Ensure all environment variables are set
3. Verify PostgreSQL service is healthy
4. Check for any hardcoded localhost references

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure tests pass locally
3. Maintain or improve coverage
4. Update this documentation if needed
5. Verify CI pipeline passes

## Support

For questions or issues with testing:
- Check this documentation first
- Review existing tests for examples
- Consult team members
- Create an issue in the repository
