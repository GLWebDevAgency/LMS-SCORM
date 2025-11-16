/**
 * Integration tests for dispatch management workflow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storage } from '../../server/storage';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/testDb';
import { createTestTenant, createTestCourse, createTestUser, createTestDispatch } from '../helpers/fixtures';

describe('Dispatch Management Integration', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  describe('Dispatch Creation', () => {
    it('should create a dispatch with license limits', async () => {
      // Create tenant
      const tenant = createTestTenant();
      const createdTenant = await storage.createTenant(tenant);

      // Create user
      const user = createTestUser({ tenantId: createdTenant.id });
      await storage.upsertUser(user);

      // Create course
      const course = createTestCourse({
        ownerId: user.id,
        tenantId: createdTenant.id,
      });
      const createdCourse = await storage.createCourse(course);

      // Create dispatch with limits
      const dispatch = createTestDispatch({
        courseId: createdCourse.id,
        tenantId: createdTenant.id,
        maxUsers: 10,
        maxCompletions: 50,
      });
      const createdDispatch = await storage.createDispatch(dispatch);

      expect(createdDispatch).toBeTruthy();
      expect(createdDispatch.id).toBeDefined();
      expect(createdDispatch.maxUsers).toBe(10);
      expect(createdDispatch.maxCompletions).toBe(50);
      expect(createdDispatch.courseId).toBe(createdCourse.id);
    });

    it('should prevent duplicate active dispatches for the same course', async () => {
      // Create tenant and course
      const tenant = createTestTenant();
      const createdTenant = await storage.createTenant(tenant);
      
      const user = createTestUser({ tenantId: createdTenant.id });
      await storage.upsertUser(user);

      const course = createTestCourse({
        ownerId: user.id,
        tenantId: createdTenant.id,
      });
      const createdCourse = await storage.createCourse(course);

      // Create first dispatch
      const dispatch1 = createTestDispatch({
        courseId: createdCourse.id,
        tenantId: createdTenant.id,
        name: 'First Dispatch',
      });
      await storage.createDispatch(dispatch1);

      // Check for active dispatch
      const activeDispatch = await storage.findActiveDispatch(
        createdCourse.id,
        createdTenant.id
      );
      expect(activeDispatch).toBeTruthy();
    });

    it('should allow creating dispatch after disabling previous one', async () => {
      // Create tenant and course
      const tenant = createTestTenant();
      const createdTenant = await storage.createTenant(tenant);
      
      const user = createTestUser({ tenantId: createdTenant.id });
      await storage.upsertUser(user);

      const course = createTestCourse({
        ownerId: user.id,
        tenantId: createdTenant.id,
      });
      const createdCourse = await storage.createCourse(course);

      // Create and disable first dispatch
      const dispatch1 = createTestDispatch({
        courseId: createdCourse.id,
        tenantId: createdTenant.id,
        name: 'First Dispatch',
      });
      const created1 = await storage.createDispatch(dispatch1);
      await storage.softDeleteDispatch(created1.id);

      // Create second dispatch - should succeed
      const dispatch2 = createTestDispatch({
        courseId: createdCourse.id,
        tenantId: createdTenant.id,
        name: 'Second Dispatch',
      });
      const created2 = await storage.createDispatch(dispatch2);

      expect(created2).toBeTruthy();
      expect(created2.id).not.toBe(created1.id);
    });
  });

  describe('Dispatch Users', () => {
    it('should add users to a dispatch', async () => {
      // Setup
      const tenant = createTestTenant();
      const createdTenant = await storage.createTenant(tenant);
      
      const user = createTestUser({ tenantId: createdTenant.id });
      await storage.upsertUser(user);

      const course = createTestCourse({
        ownerId: user.id,
        tenantId: createdTenant.id,
      });
      const createdCourse = await storage.createCourse(course);

      const dispatch = createTestDispatch({
        courseId: createdCourse.id,
        tenantId: createdTenant.id,
      });
      const createdDispatch = await storage.createDispatch(dispatch);

      // Add user to dispatch
      const dispatchUser = {
        dispatchId: createdDispatch.id,
        email: 'learner@example.com',
        launchToken: 'test-token-123',
      };
      const createdDispatchUser = await storage.createDispatchUser(dispatchUser);

      expect(createdDispatchUser).toBeTruthy();
      expect(createdDispatchUser.dispatchId).toBe(createdDispatch.id);
      expect(createdDispatchUser.email).toBe('learner@example.com');

      // Verify we can retrieve dispatch users
      const users = await storage.getDispatchUsers(createdDispatch.id);
      expect(users.length).toBe(1);
      expect(users[0].email).toBe('learner@example.com');
    });

    it('should retrieve dispatch user by token', async () => {
      // Setup
      const tenant = createTestTenant();
      const createdTenant = await storage.createTenant(tenant);
      
      const user = createTestUser({ tenantId: createdTenant.id });
      await storage.upsertUser(user);

      const course = createTestCourse({
        ownerId: user.id,
        tenantId: createdTenant.id,
      });
      const createdCourse = await storage.createCourse(course);

      const dispatch = createTestDispatch({
        courseId: createdCourse.id,
        tenantId: createdTenant.id,
      });
      const createdDispatch = await storage.createDispatch(dispatch);

      const launchToken = 'unique-token-456';
      const dispatchUser = {
        dispatchId: createdDispatch.id,
        email: 'user@example.com',
        launchToken,
      };
      await storage.createDispatchUser(dispatchUser);

      // Retrieve by token
      const foundUser = await storage.getDispatchUserByToken(launchToken);
      expect(foundUser).toBeTruthy();
      expect(foundUser?.launchToken).toBe(launchToken);
      expect(foundUser?.email).toBe('user@example.com');
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should isolate dispatches by tenant', async () => {
      // Create two tenants
      const tenant1 = createTestTenant({ name: 'Tenant 1' });
      const tenant2 = createTestTenant({ name: 'Tenant 2' });
      const createdTenant1 = await storage.createTenant(tenant1);
      const createdTenant2 = await storage.createTenant(tenant2);

      // Create users for each tenant
      const user1 = createTestUser({ tenantId: createdTenant1.id });
      const user2 = createTestUser({ tenantId: createdTenant2.id });
      await storage.upsertUser(user1);
      await storage.upsertUser(user2);

      // Create courses for each tenant
      const course1 = createTestCourse({
        ownerId: user1.id,
        tenantId: createdTenant1.id,
        title: 'Tenant 1 Course',
      });
      const course2 = createTestCourse({
        ownerId: user2.id,
        tenantId: createdTenant2.id,
        title: 'Tenant 2 Course',
      });
      const createdCourse1 = await storage.createCourse(course1);
      const createdCourse2 = await storage.createCourse(course2);

      // Create dispatches for each tenant
      const dispatch1 = createTestDispatch({
        courseId: createdCourse1.id,
        tenantId: createdTenant1.id,
      });
      const dispatch2 = createTestDispatch({
        courseId: createdCourse2.id,
        tenantId: createdTenant2.id,
      });
      await storage.createDispatch(dispatch1);
      await storage.createDispatch(dispatch2);

      // Verify tenant 1 only sees their dispatches
      const tenant1Dispatches = await storage.getDispatches(createdTenant1.id);
      expect(tenant1Dispatches.length).toBe(1);
      expect(tenant1Dispatches[0].tenantId).toBe(createdTenant1.id);

      // Verify tenant 2 only sees their dispatches
      const tenant2Dispatches = await storage.getDispatches(createdTenant2.id);
      expect(tenant2Dispatches.length).toBe(1);
      expect(tenant2Dispatches[0].tenantId).toBe(createdTenant2.id);
    });
  });
});
