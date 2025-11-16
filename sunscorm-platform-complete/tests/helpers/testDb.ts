/**
 * Test database utilities for setup, teardown, and data management
 */

import { db } from '../../server/db';
import { users, tenants, courses, dispatches, dispatchUsers } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Clear all test data from database tables
 */
export async function clearDatabase() {
  await db.delete(dispatchUsers);
  await db.delete(dispatches);
  await db.delete(courses);
  await db.delete(users);
  await db.delete(tenants);
}

/**
 * Reset database sequence counters
 */
export async function resetSequences() {
  // Reset any auto-increment sequences if needed
  // This ensures consistent test data IDs
}

/**
 * Setup test database with initial state
 */
export async function setupTestDatabase() {
  await clearDatabase();
  await resetSequences();
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase() {
  await clearDatabase();
}

/**
 * Create a test transaction that can be rolled back
 */
export async function withTestTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  // Start transaction
  await db.execute(sql`BEGIN`);
  
  try {
    const result = await callback();
    await db.execute(sql`ROLLBACK`);
    return result;
  } catch (error) {
    await db.execute(sql`ROLLBACK`);
    throw error;
  }
}

/**
 * Count records in a table
 */
export async function countRecords(table: any): Promise<number> {
  const result = await db.select({ count: sql`count(*)` }).from(table);
  return Number(result[0].count);
}
