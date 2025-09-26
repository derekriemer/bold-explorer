import type { Kysely } from 'kysely';
import type { DB } from '@/db/schema';
import { createTestDb } from '@/db/factory';

// Enable DB-backed tests only when required web storage APIs exist.
// jeep-sqlite on web needs IndexedDB/localForage.
export function webDbAvailable() {
  return typeof (globalThis as any).indexedDB !== 'undefined';
}

export async function createInMemoryDb(): Promise<Kysely<DB>> {
  return createTestDb();
}

// Defines a per-test lifecycle for an in-memory DB.
// Usage:
//   const getDb = defineDbLifecycle();
//   it('...', async () => { const db = getDb(); ... })
export function defineDbLifecycle() {
  let db: Kysely<DB> | null = null;
  // vitest provides global beforeEach/afterEach
  beforeEach(async () => {
    db = await createInMemoryDb();
  });
  afterEach(async () => {
    if (db) {
      await db.destroy();
    }
    db = null;
  });
  return () => {
    if (!db) {
      throw new Error('Test DB not initialized yet');
    }
    return db;
  };
}
