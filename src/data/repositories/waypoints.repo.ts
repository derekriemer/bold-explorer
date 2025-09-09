import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type { DB, Waypoint } from '@/db/schema';
import { sqlDistanceMetersForAlias, fetchWaypointsWithDistance } from '@/utils/geo';
import type { LatLng } from '@/types/latlng';

const RAD = 0.017453292519943295;

export class WaypointsRepo {
  constructor(private db: Kysely<DB>) {}

  all(): Promise<Selectable<Waypoint>[]> {
    return this.db.selectFrom('waypoint').selectAll().execute();
  }

  async create(input: { name: string; lat: number; lon: number; elev_m?: number | null }): Promise<number> {
    // Defensive validation for coordinate ranges
    const validLat = Number.isFinite(input.lat) && input.lat >= -90 && input.lat <= 90;
    const validLon = Number.isFinite(input.lon) && input.lon >= -180 && input.lon <= 180;
    if (!validLat || !validLon) {
      throw new Error('Invalid coordinates: latitude must be in [-90, 90], longitude in [-180, 180]');
    }
    const res = await this.db
      .insertInto('waypoint')
      .values({
        name: input.name,
        lat: input.lat,
        lon: input.lon,
        elev_m: input.elev_m ?? null,
        created_at: new Date().toISOString()
      })
      .returning('id')
      .executeTakeFirst();
    return Number(res!.id);
  }

  async addToTrail(input: { trailId: number; name: string; lat: number; lon: number; elev_m?: number | null; position?: number }): Promise<{ waypointId: number; position: number }> {
    // Avoid transaction on web/sql.js driver to prevent private field binding issues
    const waypointId = await this.create(input);
    const position = await this.attachToTrail(this.db, input.trailId, waypointId, input.position);
    return { waypointId, position };
  }

  private async attachToTrail(db: Kysely<DB>, trailId: number, waypointId: number, position?: number) {
    const now = new Date().toISOString();
    if (position == null) {
      const next = await db
        .selectFrom('trail_waypoint')
        .where('trail_id', '=', trailId)
        .select(sql`coalesce(max(position),0) + 1`.as('pos'))
        .executeTakeFirst();
      position = Number(next?.pos ?? 1);
    } else {
      await db
        .updateTable('trail_waypoint')
        .set({ position: sql`position + 1` })
        .where('trail_id', '=', trailId)
        .where('position', '>=', position)
        .execute();
    }
    await db
      .insertInto('trail_waypoint')
      .values({ trail_id: trailId, waypoint_id: waypointId, position, created_at: now })
      .execute();
    return position;
  }

  async attach(trailId: number, waypointId: number, position?: number): Promise<number> {
    return this.attachToTrail(this.db, trailId, waypointId, position);
  }

  forTrail(trailId: number): Promise<Selectable<Waypoint>[]> {
    return this.db
      .selectFrom('trail_waypoint as tw')
      .innerJoin('waypoint as w', 'w.id', 'tw.waypoint_id')
      .select(['w.id', 'w.name', 'w.description', 'w.lat', 'w.lon', 'w.elev_m', 'w.created_at'])
      .where('tw.trail_id', '=', trailId)
      .orderBy('tw.position')
      .execute();
  }

  async setPosition(trailId: number, waypointId: number, position: number): Promise<void> {
    await this.db.transaction().execute(async (trx: Kysely<DB>) => {
      const current = await trx
        .selectFrom('trail_waypoint')
        .select('position')
        .where('trail_id', '=', trailId)
        .where('waypoint_id', '=', waypointId)
        .executeTakeFirst();
      if (!current) return;
      const a = current.position;
      const b = position;
      if (a < b) {
        await trx
          .updateTable('trail_waypoint')
          .set({ position: sql`position - 1` })
          .where('trail_id', '=', trailId)
          .where('position', '>', a)
          .where('position', '<=', b)
          .execute();
      } else if (a > b) {
        await trx
          .updateTable('trail_waypoint')
          .set({ position: sql`position + 1` })
          .where('trail_id', '=', trailId)
          .where('position', '>=', b)
          .where('position', '<', a)
          .execute();
      }
      await trx
        .updateTable('trail_waypoint')
        .set({ position: b })
        .where('trail_id', '=', trailId)
        .where('waypoint_id', '=', waypointId)
        .execute();
    });
  }

  async detach(trailId: number, waypointId: number): Promise<void> {
    await this.db.transaction().execute(async (trx: Kysely<DB>) => {
      const row = await trx
        .selectFrom('trail_waypoint')
        .select('position')
        .where('trail_id', '=', trailId)
        .where('waypoint_id', '=', waypointId)
        .executeTakeFirst();
      if (!row) return;
      const removed = row.position;
      await trx
        .deleteFrom('trail_waypoint')
        .where('trail_id', '=', trailId)
        .where('waypoint_id', '=', waypointId)
        .execute();
      await trx
        .updateTable('trail_waypoint')
        .set({ position: sql`position - 1` })
        .where('trail_id', '=', trailId)
        .where('position', '>', removed)
        .execute();
    });
  }

  rename(id: number, name: string): Promise<void> {
    return this.db.updateTable('waypoint').set({ name }).where('id', '=', id).execute().then(() => {});
  }

  async remove(id: number): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('trail_waypoint').where('waypoint_id', '=', id).execute();
      await trx.deleteFrom('collection_waypoint').where('waypoint_id', '=', id).execute();
      await trx.deleteFrom('waypoint').where('id', '=', id).execute();
    });
  }

  async forLocation(center: LatLng, radiusM: number, opts?: { trailId?: number; limit?: number; includeDistance?: boolean }): Promise<Array<Selectable<Waypoint> & { distance_m?: number }>> {
    const degLat = radiusM / 111320;
    const degLon = radiusM / (111320 * Math.cos(center.lat * RAD));
    const base = this.db
      .selectFrom('waypoint as w')
      .$if(!!opts?.trailId, (qb: any) =>
        qb.innerJoin('trail_waypoint as tw', 'tw.waypoint_id', 'w.id').where('tw.trail_id', '=', opts!.trailId!)
      )
      .where('w.lat', '>=', center.lat - degLat)
      .where('w.lat', '<=', center.lat + degLat)
      .where('w.lon', '>=', center.lon - degLon)
      .where('w.lon', '<=', center.lon + degLon);

    const distanceExpr = sqlDistanceMetersForAlias('w', center);

    const rows = await base
      .select([
        'w.id', 'w.name', 'w.description', 'w.lat', 'w.lon', 'w.elev_m', 'w.created_at',
        ...(opts?.includeDistance ? [distanceExpr] : [])
      ])
      .$if(!!opts?.includeDistance, (qb: any) => qb.orderBy('distance_m'))
      .$if(!opts?.includeDistance, (qb: any) => qb.orderBy('w.id'))
      .execute();

    const nearby = opts?.includeDistance ? rows.filter((r: any) => (r as any).distance_m <= radiusM) : rows;
    return opts?.limit ? nearby.slice(0, opts.limit) : nearby;
  }

  async withDistanceFrom(center: LatLng, opts?: { trailId?: number; limit?: number }): Promise<Array<Selectable<Waypoint> & { distance_m: number }>> {
    return fetchWaypointsWithDistance(this.db, center, opts);
  }
}
