import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type { DB, Trail } from '@/db/schema';

export class TrailsRepo {
  constructor(private db: Kysely<DB>) {}

  all(): Promise<Selectable<Trail>[]> {
    return this.db.selectFrom('trail').selectAll().execute();
  }

  async create(input: { name: string; description?: string | null }): Promise<number> {
    await this.db
      .insertInto('trail')
      .values({
        name: input.name,
        description: input.description ?? null,
        created_at: new Date().toISOString()
      })
      .execute();
    const rows = await sql<{ id: number }>`select last_insert_rowid() as id`.execute(this.db as any);
    const id = Array.isArray(rows) ? (rows[0] as any)?.id : (rows as any)?.rows?.[0]?.id;
    return Number(id ?? 0);
  }

  rename(id: number, name: string): Promise<void> {
    return this.db.updateTable('trail').set({ name }).where('id', '=', id).execute().then(() => {});
  }

  async remove(id: number): Promise<void> {
    await this.db.transaction().execute(async (trx: Kysely<DB>) => {
      await trx.deleteFrom('trail_waypoint').where('trail_id', '=', id).execute();
      await trx.deleteFrom('collection_trail').where('trail_id', '=', id).execute();
      await trx.deleteFrom('auto_waypoint').where('trail_id', '=', id).execute();
      await trx.deleteFrom('trail').where('id', '=', id).execute();
    });
  }
}
