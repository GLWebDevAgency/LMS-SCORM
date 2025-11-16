/**
 * Unit tests for licenseEnforcement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LicenseEnforcementService } from './licenseEnforcement';
import { storage } from './storage';
import { db } from './db';
import { 
  createTestTenant, 
  createTestDispatch, 
  createTestCourse 
} from '../tests/helpers/fixtures';

// Mock storage
vi.mock('./storage', () => ({
  storage: {
    getDispatch: vi.fn(),
    getTenant: vi.fn(),
    getCourse: vi.fn(),
  }
}));

// Mock db
vi.mock('./db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    execute: vi.fn(),
  }
}));

describe('LicenseEnforcementService', () => {
  let service: LicenseEnforcementService;

  beforeEach(() => {
    service = new LicenseEnforcementService();
    vi.clearAllMocks();
  });

  describe('canAccessDispatch', () => {
    it('should allow access when no constraints are set', async () => {
      const dispatch = createTestDispatch({
        maxUsers: null,
        maxCompletions: null,
        expiresAt: null,
      });
      const tenant = createTestTenant({
        maxDispatchUsers: null,
        maxCompletions: null,
        globalExpiration: null,
      });

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      // Mock db queries for usage stats
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny access when dispatch has expired', async () => {
      const expiredDate = new Date(Date.now() - 86400000); // Yesterday
      const dispatch = createTestDispatch({
        expiresAt: expiredDate,
      });
      const tenant = createTestTenant();

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should deny access when max users reached at dispatch level', async () => {
      const dispatch = createTestDispatch({
        maxUsers: 5,
      });
      const tenant = createTestTenant();

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      // Mock 5 users already exist
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([{ count: 0 }]) // hasUserAccess check
          .mockResolvedValueOnce([{ count: 5 }]) // dispatch users
          .mockResolvedValueOnce([{ count: 0 }]) // dispatch completions
          .mockResolvedValueOnce([{ count: 5 }]) // tenant users
          .mockResolvedValueOnce([{ count: 0 }]), // tenant completions
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'newuser@example.com');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum users exceeded');
    });

    it('should allow access when user already has access even if max users reached', async () => {
      const dispatch = createTestDispatch({
        maxUsers: 5,
      });
      const tenant = createTestTenant();

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      // Mock user already has access
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([{ count: 1 }]) // hasUserAccess check - user exists
          .mockResolvedValueOnce([{ count: 5 }]) // dispatch users
          .mockResolvedValueOnce([{ count: 0 }]) // dispatch completions
          .mockResolvedValueOnce([{ count: 5 }]) // tenant users
          .mockResolvedValueOnce([{ count: 0 }]), // tenant completions
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'existinguser@example.com');

      expect(result.allowed).toBe(true);
    });

    it('should deny access when max completions reached', async () => {
      const dispatch = createTestDispatch({
        maxCompletions: 10,
      });
      const tenant = createTestTenant();

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      // Mock 10 completions already exist
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([{ count: 0 }]) // hasUserAccess check
          .mockResolvedValueOnce([{ count: 5 }]) // dispatch users
          .mockResolvedValueOnce([{ count: 10 }]) // dispatch completions
          .mockResolvedValueOnce([{ count: 5 }]) // tenant users
          .mockResolvedValueOnce([{ count: 10 }]), // tenant completions
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum completions exceeded');
    });

    it('should enforce tenant constraints over dispatch constraints', async () => {
      const dispatch = createTestDispatch({
        maxUsers: 100, // Dispatch allows 100
      });
      const tenant = createTestTenant({
        maxDispatchUsers: 10, // But tenant limits to 10
      });

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      // Mock 10 tenant-level users
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([{ count: 0 }]) // hasUserAccess check
          .mockResolvedValueOnce([{ count: 5 }]) // dispatch users
          .mockResolvedValueOnce([{ count: 0 }]) // dispatch completions
          .mockResolvedValueOnce([{ count: 10 }]) // tenant users - at limit
          .mockResolvedValueOnce([{ count: 0 }]), // tenant completions
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'newuser@example.com');

      expect(result.allowed).toBe(false);
      expect(result.constraints.effective.maxUsers).toBe(10);
    });

    it('should return correct usage statistics', async () => {
      const dispatch = createTestDispatch();
      const tenant = createTestTenant();

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn()
          .mockResolvedValueOnce([{ count: 0 }]) // hasUserAccess check
          .mockResolvedValueOnce([{ count: 5 }]) // dispatch users
          .mockResolvedValueOnce([{ count: 3 }]) // dispatch completions
          .mockResolvedValueOnce([{ count: 15 }]) // tenant users
          .mockResolvedValueOnce([{ count: 8 }]), // tenant completions
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.usage.dispatchStats.uniqueUsers).toBe(5);
      expect(result.usage.dispatchStats.totalCompletions).toBe(3);
      expect(result.usage.tenantStats.uniqueUsers).toBe(15);
      expect(result.usage.tenantStats.totalCompletions).toBe(8);
    });

    it('should handle null values in constraints', async () => {
      const dispatch = createTestDispatch({
        maxUsers: null,
        maxCompletions: null,
        expiresAt: null,
      });
      const tenant = createTestTenant({
        maxDispatchUsers: null,
        maxCompletions: null,
        globalExpiration: null,
      });

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.allowed).toBe(true);
      expect(result.constraints.effective.maxUsers).toBeNull();
      expect(result.constraints.effective.maxCompletions).toBeNull();
    });

    it('should throw error if dispatch not found', async () => {
      vi.mocked(storage.getDispatch).mockResolvedValue(null);

      await expect(
        service.canAccessDispatch('nonexistent', 'user@example.com')
      ).rejects.toThrow('Dispatch not found');
    });

    it('should throw error if tenant not found', async () => {
      const dispatch = createTestDispatch();
      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(null);

      await expect(
        service.canAccessDispatch(dispatch.id, 'user@example.com')
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('constraint precedence', () => {
    it('should use dispatch constraint when tenant constraint is null', async () => {
      const dispatch = createTestDispatch({
        maxUsers: 50,
      });
      const tenant = createTestTenant({
        maxDispatchUsers: null,
      });

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.constraints.effective.maxUsers).toBe(50);
    });

    it('should prefer tenant constraint over dispatch constraint', async () => {
      const dispatch = createTestDispatch({
        maxUsers: 100,
      });
      const tenant = createTestTenant({
        maxDispatchUsers: 20,
      });

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.constraints.effective.maxUsers).toBe(20);
      expect(result.constraints.dispatch.maxUsers).toBe(100);
      expect(result.constraints.tenant.maxUsers).toBe(20);
    });
  });

  describe('expiration handling', () => {
    it('should allow access when expiration is in the future', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const dispatch = createTestDispatch({
        expiresAt: futureDate,
      });
      const tenant = createTestTenant();

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.allowed).toBe(true);
    });

    it('should prefer earlier expiration date', async () => {
      const soonDate = new Date(Date.now() + 3600000); // 1 hour
      const laterDate = new Date(Date.now() + 86400000); // 1 day
      
      const dispatch = createTestDispatch({
        expiresAt: laterDate,
      });
      const tenant = createTestTenant({
        globalExpiration: soonDate,
      });

      vi.mocked(storage.getDispatch).mockResolvedValue(dispatch as any);
      vi.mocked(storage.getTenant).mockResolvedValue(tenant as any);
      
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await service.canAccessDispatch(dispatch.id, 'user@example.com');

      expect(result.constraints.effective.expiresAt).toEqual(soonDate);
    });
  });
});
