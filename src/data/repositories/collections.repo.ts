import type { Kysely } from 'kysely';
import type { DB, Collection, Waypoint, Trail } from '@/db/schema';

export class CollectionsRepo {
  constructor(private db: Kysely<DB>) {}

  all(): Promise<Collection[]> {
    return this.db.selectFrom('collection').selectAll().execute();
  }

  async create(input: { name: string; description?: string | null }): Promise<number> {
    const res = await this.db
      .insertInto('collection')
      .values({
        name: input.name,
        description: input.description ?? null,
        created_at: new Date().toISOString()
      })
      .returning('id')
      .executeTakeFirst();
    return Number(res!.id);
  }

  addWaypoint(collectionId: number, waypointId: number): Promise<void> {
    return this.db
      .insertInto('collection_waypoint')
      .values({ collection_id: collectionId, waypoint_id: waypointId, created_at: new Date().toISOString() })
      .execute().then(() => {});
  }

  removeWaypoint(collectionId: number, waypointId: number): Promise<void> {
    return this.db
      .deleteFrom('collection_waypoint')
      .where('collection_id', '=', collectionId)
      .where('waypoint_id', '=', waypointId)
      .execute().then(() => {});
  }

  addTrail(collectionId: number, trailId: number): Promise<void> {
    return this.db
      .insertInto('collection_trail')
      .values({ collection_id: collectionId, trail_id: trailId, created_at: new Date().toISOString() })
      .execute().then(() => {});
  }

  removeTrail(collectionId: number, trailId: number): Promise<void> {
    return this.db
      .deleteFrom('collection_trail')
      .where('collection_id', '=', collectionId)
      .where('trail_id', '=', trailId)
      .execute().then(() => {});
  }

  async contents(collectionId: number): Promise<{ waypoints: Waypoint[]; trails: Trail[] }> {
    const waypoints = await this.db
      .selectFrom('collection_waypoint as cw')
      .innerJoin('waypoint as w', 'w.id', 'cw.waypoint_id')
      .select(['w.id', 'w.name', 'w.lat', 'w.lon', 'w.elev_m', 'w.created_at'])
      .where('cw.collection_id', '=', collectionId)
      .orderBy('cw.id')
      .execute();

    const trails = await this.db
      .selectFrom('collection_trail as ct')
      .innerJoin('trail as t', 't.id', 'ct.trail_id')
      .select(['t.id', 't.name', 't.description', 't.created_at'])
      .where('ct.collection_id', '=', collectionId)
      .orderBy('ct.id')
      .execute();

    return { waypoints, trails };
  }
}
