/**
 * Mock authentication utilities for testing
 */

import { Request, Response, NextFunction } from 'express';

export interface MockUser {
  id: string;
  email: string;
  role: 'admin' | 'company_admin' | 'user';
  tenantId: string;
}

/**
 * Create a mock authenticated request
 */
export function createMockAuthRequest(user: MockUser, overrides?: Partial<Request>): Partial<Request> {
  return {
    user,
    isAuthenticated: () => true,
    session: {
      cookie: {},
      regenerate: (callback: any) => callback(null),
      destroy: (callback: any) => callback(null),
      reload: (callback: any) => callback(null),
      save: (callback: any) => callback(null),
      touch: () => {},
      resetMaxAge: () => {},
      id: 'mock-session-id',
      ...overrides?.session,
    } as any,
    ...overrides,
  };
}

/**
 * Create a mock unauthenticated request
 */
export function createMockUnauthRequest(overrides?: Partial<Request>): Partial<Request> {
  return {
    user: undefined,
    isAuthenticated: () => false,
    session: {
      cookie: {},
      regenerate: (callback: any) => callback(null),
      destroy: (callback: any) => callback(null),
      reload: (callback: any) => callback(null),
      save: (callback: any) => callback(null),
      touch: () => {},
      resetMaxAge: () => {},
      id: 'mock-session-id',
    } as any,
    ...overrides,
  };
}

/**
 * Create a mock response object for testing
 */
export function createMockResponse(): Partial<Response> {
  const res: any = {
    status: function(code: number) {
      this.statusCode = code;
      return this;
    },
    json: function(data: any) {
      this.data = data;
      return this;
    },
    send: function(data: any) {
      this.body = data;
      return this;
    },
    sendStatus: function(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader: function(key: string, value: string) {
      this.headers = this.headers || {};
      this.headers[key] = value;
      return this;
    },
    statusCode: 200,
    data: null,
    body: null,
    headers: {},
  };
  return res;
}

/**
 * Create a mock next function for middleware testing
 */
export function createMockNext(): NextFunction {
  const next: any = (error?: any) => {
    next.called = true;
    next.error = error;
  };
  next.called = false;
  next.error = null;
  return next;
}

/**
 * Mock authentication middleware that always succeeds
 */
export function mockAuthMiddleware(user: MockUser) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.user = user as any;
    next();
  };
}

/**
 * Mock authentication middleware that always fails
 */
export function mockUnauthorizedMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.status(401).json({ error: 'Unauthorized' });
  };
}
