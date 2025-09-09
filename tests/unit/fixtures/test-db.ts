import { Kysely, SqliteDialect } from 'kysely';
import type { DB } from '@/db/schema';
import { createMigrator } from '@/db/migrations/provider';

// Controls whether DB-backed tests run. In constrained sandboxes, native
// better-sqlite3 may be unavailable. Set DB_NATIVE=1 to enable these tests.
export const DB_NATIVE_ENABLED = process.env.DB_NATIVE === '1';

export async function createInMemoryDb(): Promise<Kysely<DB>> {
  const SQLite = (await import('better-sqlite3')).default as any;
  const dialect = new SqliteDialect({ database: new SQLite(':memory:') });
  const db = new Kysely<DB>({ dialect });
  const migrator = createMigrator(db);
  await migrator.migrateToLatest();
  return db;
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
    if (db) await db.destroy();
    db = null;
  });
  return () => {
    if (!db) throw new Error('Test DB not initialized yet');
    return db;
  };
}

