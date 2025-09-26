import type { Kysely, Selectable } from 'kysely';
import type { DB, AutoWaypoint } from '@/db/schema';

export class AutoWaypointsRepo {
  constructor(private db: Kysely<DB>) {}

  forTrail(trailId: number): Promise<Selectable<AutoWaypoint>[]> {
    return this.db
      .selectFrom('auto_waypoint')
      .selectAll()
      .where('trail_id', '=', trailId)
      .execute();
  }

  async create(input: {
    trailId: number;
    name?: string | null;
    segment_index: number;
    offset_m: number;
    lat?: number | null;
    lon?: number | null;
  }): Promise<number> {
    const res = await this.db
      .insertInto('auto_waypoint')
      .values({
        trail_id: input.trailId,
        name: input.name ?? null,
        segment_index: input.segment_index,
        offset_m: input.offset_m,
        lat: input.lat ?? null,
        lon: input.lon ?? null,
        created_at: new Date().toISOString(),
      })
      .returning('id')
      .executeTakeFirst();
    return Number(res!.id);
  }

  rename(id: number, name: string | null): Promise<void> {
    return this.db
      .updateTable('auto_waypoint')
      .set({ name })
      .where('id', '=', id)
      .execute()
      .then(() => {});
  }

  setOffset(id: number, segment_index: number, offset_m: number): Promise<void> {
    return this.db
      .updateTable('auto_waypoint')
      .set({ segment_index, offset_m })
      .where('id', '=', id)
      .execute()
      .then(() => {});
  }

  remove(id: number): Promise<void> {
    return this.db
      .deleteFrom('auto_waypoint')
      .where('id', '=', id)
      .execute()
      .then(() => {});
  }
}
