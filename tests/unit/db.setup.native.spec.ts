import { describe, it, expect } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import type { DB } from '@/db/schema';
import { createMigrator } from '@/db/migrations/provider';

const DB_NATIVE_ENABLED = process.env.DB_NATIVE === '1';

let BetterSqlite3: any = null;
let NATIVE_AVAILABLE = false;
try {
  BetterSqlite3 = (await import('better-sqlite3')).default as any;
  NATIVE_AVAILABLE = true;
} catch {
  NATIVE_AVAILABLE = false;
}

async function createNativeInMemoryDb(): Promise<Kysely<DB>> {
  if (!NATIVE_AVAILABLE || !BetterSqlite3) {
    throw new Error('better-sqlite3 not available');
  }
  const dialect = new SqliteDialect({ database: new BetterSqlite3(':memory:') });
  const db = new Kysely<DB>({ dialect });
  const migrator = createMigrator(db);
  await migrator.migrateToLatest();
  return db;
}

describe.skipIf(!DB_NATIVE_ENABLED || !NATIVE_AVAILABLE)('DB Setup (native better-sqlite3)', () => {
  it('measures native create + migrations time', async () => {
    const start = Date.now();
    const db = await createNativeInMemoryDb();
    const end = Date.now();
    // eslint-disable-next-line no-console
    console.log(`[native-setup] took ${end - start} ms`);
    await db.destroy();
    expect(end - start).toBeGreaterThanOrEqual(0);
  });
});
