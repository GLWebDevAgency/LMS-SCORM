/**
 * Test data fixtures for consistent test data
 */

import { nanoid } from 'nanoid';

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'company_admin' | 'user';
  tenantId: string;
}

export interface TestTenant {
  id: string;
  name: string;
  domain?: string;
  maxDispatchUsers?: number;
  maxCompletions?: number;
  globalExpiration?: Date;
}

export interface TestCourse {
  id: string;
  title: string;
  version: string;
  description: string;
  ownerId: string;
  tenantId: string;
  fileCount: number;
  storagePath: string;
  structure: any;
  scormType: 'scorm_1_2' | 'scorm_2004' | 'aicc' | 'xapi';
}

export interface TestDispatch {
  id: string;
  courseId: string;
  tenantId: string;
  name: string;
  launchToken: string;
  maxUsers?: number;
  maxCompletions?: number;
  expiresAt?: Date;
  status: string;
}

/**
 * Create test tenant data
 */
export function createTestTenant(overrides?: Partial<TestTenant>): TestTenant {
  return {
    id: nanoid(),
    name: 'Test Tenant',
    domain: 'test-tenant.example.com',
    maxDispatchUsers: null,
    maxCompletions: null,
    globalExpiration: null,
    ...overrides,
  };
}

/**
 * Create test user data
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  const id = nanoid();
  return {
    id,
    email: `test-user-${id}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    tenantId: nanoid(),
    ...overrides,
  };
}

/**
 * Create test admin user data
 */
export function createTestAdmin(overrides?: Partial<TestUser>): TestUser {
  return createTestUser({ role: 'admin', ...overrides });
}

/**
 * Create test company admin user data
 */
export function createTestCompanyAdmin(overrides?: Partial<TestUser>): TestUser {
  return createTestUser({ role: 'company_admin', ...overrides });
}

/**
 * Create test course data
 */
export function createTestCourse(overrides?: Partial<TestCourse>): TestCourse {
  const id = nanoid();
  return {
    id,
    title: 'Test SCORM Course',
    version: '1.0',
    description: 'A test SCORM course for unit testing',
    ownerId: nanoid(),
    tenantId: nanoid(),
    fileCount: 5,
    storagePath: `/test/courses/${id}`,
    structure: {
      resources: [],
      organizations: [],
    },
    scormType: 'scorm_1_2',
    ...overrides,
  };
}

/**
 * Create test dispatch data
 */
export function createTestDispatch(overrides?: Partial<TestDispatch>): TestDispatch {
  const id = nanoid();
  return {
    id,
    courseId: nanoid(),
    tenantId: nanoid(),
    name: 'Test Dispatch',
    launchToken: nanoid(),
    maxUsers: null,
    maxCompletions: null,
    expiresAt: null,
    status: 'active',
    ...overrides,
  };
}

/**
 * Create sample SCORM 1.2 manifest XML
 */
export function createScorm12Manifest(title = 'Test Course'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-001" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-001">
    <organization identifier="ORG-001">
      <title>${title}</title>
      <item identifier="ITEM-001" identifierref="RES-001">
        <title>Lesson 1</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-001" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="shared/api.js"/>
    </resource>
  </resources>
</manifest>`;
}

/**
 * Create sample SCORM 2004 manifest XML
 */
export function createScorm2004Manifest(title = 'Test Course'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-001" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="ORG-001">
    <organization identifier="ORG-001">
      <title>${title}</title>
      <item identifier="ITEM-001" identifierref="RES-001">
        <title>Lesson 1</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-001" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;
}

/**
 * Create invalid manifest XML
 */
export function createInvalidManifest(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest>
  <invalid>This is not a valid SCORM manifest</invalid>
</manifest>`;
}
