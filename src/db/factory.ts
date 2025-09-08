import { Kysely, SqliteDialect } from 'kysely';
import CapacitorSQLiteKyselyDialect from 'capacitor-sqlite-kysely';
import { SQLiteConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import type { DB } from './schema';
import { createMigrator } from './migrations/provider';

async function migrate(db: Kysely<DB>) {
  const migrator = createMigrator(db);
  await migrator.migrateToLatest();
}

export async function createAppDb() {
  // On web, ensure the web store is initialized. The <jeep-sqlite>
  // element is created and configured in main.ts with wasmPath '/sqljs'.
  if (Capacitor.getPlatform() === 'web') {
    try {
      await CapacitorSQLite.initWebStore();
    } catch (e) {
      // Proceed; the dialect may still work once the component is ready.
      // eslint-disable-next-line no-console
      console.warn('CapacitorSQLite.initWebStore failed or not available:', e);
    }
  }
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const dialect = new CapacitorSQLiteKyselyDialect(sqlite, { name: 'app' });
  const db = new Kysely<DB>({ dialect });
  await migrate(db);
  return db;
}

export async function createTestDb() {
  const SQLite = (await import('better-sqlite3')).default as any;
  const dialect = new SqliteDialect({ database: new SQLite(':memory:') });
  const db = new Kysely<DB>({ dialect });
  await migrate(db);
  return db;
}

let appDb: Kysely<DB> | null = null;
export async function initAppDb() {
  if (!appDb) {
    appDb = await createAppDb();
  }
  return appDb;
}
