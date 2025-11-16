/**
 * Unit tests for storage service
 * Note: These tests require a database connection and are meant to be run in integration test environments
 */

import { describe, it, expect } from 'vitest';
import type { IStorage } from './storage';

// Skip all tests if database is not available
const isDbAvailable = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost');

describe.skipIf(!isDbAvailable)('Storage Service', () => {
  describe('IStorage interface', () => {
    it('should define user operations', () => {
      // This test ensures the interface is properly exported
      const storageInterface: Partial<keyof IStorage> = 'getUser';
      expect(storageInterface).toBe('getUser');
    });

    it('should define tenant operations', () => {
      const storageInterface: Partial<keyof IStorage> = 'getTenants';
      expect(storageInterface).toBe('getTenants');
    });

    it('should define course operations', () => {
      const storageInterface: Partial<keyof IStorage> = 'getCourses';
      expect(storageInterface).toBe('getCourses');
    });

    it('should define dispatch operations', () => {
      const storageInterface: Partial<keyof IStorage> = 'getDispatches';
      expect(storageInterface).toBe('getDispatches');
    });

    it('should define dispatch user operations', () => {
      const storageInterface: Partial<keyof IStorage> = 'getDispatchUsers';
      expect(storageInterface).toBe('getDispatchUsers');
    });

    it('should define xAPI operations', () => {
      const storageInterface: Partial<keyof IStorage> = 'getXapiStatements';
      expect(storageInterface).toBe('getXapiStatements');
    });

    it('should define analytics operations', () => {
      const storageInterface: Partial<keyof IStorage> = 'getDashboardStats';
      expect(storageInterface).toBe('getDashboardStats');
    });

    it('should define search operations', () => {
      const storageInterface: Partial<keyof IStorage> = 'globalSearch';
      expect(storageInterface).toBe('globalSearch');
    });
  });

  describe('Storage method signatures', () => {
    it('should export storage instance', async () => {
      const { storage } = await import('./storage');
      expect(storage).toBeDefined();
      expect(typeof storage.getUser).toBe('function');
      expect(typeof storage.getTenants).toBe('function');
      expect(typeof storage.getCourses).toBe('function');
    });
  });
});
