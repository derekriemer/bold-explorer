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
  // On web, ensure the jeep-sqlite web component is registered and the store is initialized
  if (Capacitor.getPlatform() === 'web') {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (!customElements.get('jeep-sqlite')) {
        // If the app loads the component via index.html CDN script, this will already be defined.
        // Otherwise, append the element so the plugin can bind to it.
        const el = document.createElement('jeep-sqlite');
        document.body.appendChild(el);
        await (customElements as any).whenDefined?.('jeep-sqlite');
      }
    }
    try {
      // Serve sql-wasm.wasm from our app public assets at /sqljs
      await (CapacitorSQLite as any).setWasmPath?.('/sqljs');
    } catch {}
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
