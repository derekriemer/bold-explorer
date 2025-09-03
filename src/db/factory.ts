import { Kysely, SqliteDialect } from 'kysely';
import { CapacitorSQLiteDialect } from 'capacitor-sqlite-kysely';
import { SQLiteConnection, CapacitorSQLite } from '@capacitor-community/sqlite';
import SQLite from 'better-sqlite3';
import type { DB } from './schema';
import { createMigrator } from './migrations/provider';

async function migrate(db: Kysely<DB>) {
  const migrator = createMigrator(db);
  await migrator.migrateToLatest();
}

export async function createAppDb() {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const dialect = new CapacitorSQLiteDialect({ sqlite, database: 'app.db' });
  const db = new Kysely<DB>({ dialect });
  await migrate(db);
  return db;
}

export async function createTestDb() {
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
