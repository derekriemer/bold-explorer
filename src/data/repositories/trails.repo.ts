import type { Kysely, Selectable } from 'kysely';
import type { DB, Trail } from '@/db/schema';

// codex: Class and public surfaces docstrings.
//codex: transactions around create

export class TrailsRepo {
  constructor(private db: Kysely<DB>) {}

  all(): Promise<Selectable<Trail>[]> {
    return this.db.selectFrom('trail').selectAll().execute();
  }

  async create(input: { name: string; description?: string | null }): Promise<number> {
    const res = await this.db
      .insertInto('trail')
      .values({
        name: input.name,
        description: input.description ?? null,
        created_at: new Date().toISOString(),
      })
      .returning('id')
      .executeTakeFirst();
    return Number(res!.id);
  }

  rename(id: number, name: string): Promise<void> {
    return this.db
      .updateTable('trail')
      .set({ name })
      .where('id', '=', id)
      .execute()
      .then(() => {});
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
