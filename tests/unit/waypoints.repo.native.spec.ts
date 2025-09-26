import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import type { DB } from '@/db/schema';
import { createMigrator } from '@/db/migrations/provider';
import { WaypointsRepo } from '@/data/repositories/waypoints.repo';

// Old/native path using better-sqlite3(':memory:').
// Gated to run only when DB_NATIVE=1 is set.
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

describe.skipIf(!DB_NATIVE_ENABLED || !NATIVE_AVAILABLE)(
  'WaypointsRepo DB (native better-sqlite3)',
  () => {
    let db: Kysely<DB> | null = null;

    beforeEach(async () => {
      db = await createNativeInMemoryDb();
    });

    afterEach(async () => {
      if (db) {
        await db.destroy();
      }
      db = null;
    });

    it('creates and lists a waypoint (timed)', async () => {
      const start = Date.now();
      const repo = new WaypointsRepo(db as any);
      const id = await repo.create({ name: 'Valid', lat: 12.34, lon: 56.78 });
      expect(id).toBeGreaterThan(0);
      const all = await (db as Kysely<DB>).selectFrom('waypoint').selectAll().execute();
      const end = Date.now();
      // eslint-disable-next-line no-console
      console.log(`[native] create+list took ${end - start} ms`);
      expect(all.length).toBe(1);
      expect(all[0]?.name).toBe('Valid');
    });
  }
);
