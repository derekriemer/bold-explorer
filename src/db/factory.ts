import { Kysely, SqliteDialect } from 'kysely';
import CapacitorSQLiteKyselyDialect from 'capacitor-sqlite-kysely';
import { SQLiteConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import type { DB } from './schema';
import { createMigrator } from './migrations/provider';

async function migrate(db: Kysely<DB>) {
  const migrator = createMigrator(db);
  await migrator.migrateToLatest();
}

export async function createAppDb() {
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
