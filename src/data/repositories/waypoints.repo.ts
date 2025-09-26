import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type { DB, Waypoint } from '@/db/schema';
import { fetchWaypointsWithDistance } from '@/utils/geo';
import { assertLatLng } from '@/types/latlng';
import type { LatLng } from '@/types/latlng';

type WaypointCreateInput = {
  name: string;
  latLng: LatLng;
  elev_m?: number | null;
};

type WaypointAddToTrailInput = WaypointCreateInput & {
  trailId: number;
  position?: number;
};

/**
 * Data access layer for waypoint records, including creation, trail attachment,
 * ordering, and geo-distance queries. All public mutations validate coordinates
 * via branded {@link LatLng} values to prevent invalid writes.
 */
export class WaypointsRepo {
  constructor(private db: Kysely<DB>) {}

  /**
   * Fetch every waypoint in insertion order.
   */
  all(): Promise<Selectable<Waypoint>[]> {
    return this.db.selectFrom('waypoint').selectAll().execute();
  }

  /**
   * Insert a waypoint with validated coordinates, returning the new primary key.
   *
   * @throws TypeError if {@link LatLng} validation fails.
   */
  async create(input: WaypointCreateInput): Promise<number> {
    assertLatLng(input.latLng);
    return this.db.transaction().execute(async (trx) => {
      return this.insertWaypoint(trx, input);
    });
  }

  /**
   * Create a waypoint and attach it to the specified trail inside a single transaction.
   */
  async addToTrail(
    input: WaypointAddToTrailInput
  ): Promise<{ waypointId: number; position: number }> {
    assertLatLng(input.latLng);
    return this.db.transaction().execute(async (trx) => {
      const waypointId = await this.insertWaypoint(trx, input);
      const position = await this.attachToTrail(trx, input.trailId, waypointId, input.position);
      return { waypointId, position };
    });
  }

  private async attachToTrail(
    db: Kysely<DB>,
    trailId: number,
    waypointId: number,
    position?: number
  ) {
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

  /**
   * Attach an existing waypoint to a trail, shifting neighboring positions as needed.
   */
  async attach(trailId: number, waypointId: number, position?: number): Promise<number> {
    return this.db.transaction().execute(async (trx) => {
      return this.attachToTrail(trx, trailId, waypointId, position);
    });
  }

  /**
   * List waypoints for a trail ordered by their positional index.
   */
  forTrail(trailId: number): Promise<Selectable<Waypoint>[]> {
    return this.db
      .selectFrom('trail_waypoint as tw')
      .innerJoin('waypoint as w', 'w.id', 'tw.waypoint_id')
      .select(['w.id', 'w.name', 'w.description', 'w.lat', 'w.lon', 'w.elev_m', 'w.created_at'])
      .where('tw.trail_id', '=', trailId)
      .orderBy('tw.position')
      .execute();
  }

  /**
   * Update the positional index for a waypoint within a trail, compacting the remaining rows.
   */
  async setPosition(trailId: number, waypointId: number, position: number): Promise<void> {
    await this.db.transaction().execute(async (trx: Kysely<DB>) => {
      const current = await trx
        .selectFrom('trail_waypoint')
        .select('position')
        .where('trail_id', '=', trailId)
        .where('waypoint_id', '=', waypointId)
        .executeTakeFirst();
      if (!current) {
        return;
      }
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

  /**
   * Detach a waypoint from a trail and collapse higher positions to fill the gap.
   */
  async detach(trailId: number, waypointId: number): Promise<void> {
    await this.db.transaction().execute(async (trx: Kysely<DB>) => {
      const row = await trx
        .selectFrom('trail_waypoint')
        .select('position')
        .where('trail_id', '=', trailId)
        .where('waypoint_id', '=', waypointId)
        .executeTakeFirst();
      if (!row) {
        return;
      }
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

  /**
   * Rename a waypoint by primary key.
   */
  rename(id: number, name: string): Promise<void> {
    return this.db
      .updateTable('waypoint')
      .set({ name })
      .where('id', '=', id)
      .execute()
      .then(() => {});
  }

  /**
   * Apply partial updates to a waypoint. Coordinate changes require a validated {@link LatLng}.
   */
  async update(
    id: number,
    patch: {
      name?: string;
      latLng?: LatLng;
      elev_m?: number | null;
      description?: string | null;
    }
  ): Promise<void> {
    const upd: any = {};
    if (patch.name != null) {
      upd.name = patch.name;
    }
    if (patch.latLng != null) {
      assertLatLng(patch.latLng);
      upd.lat = patch.latLng.lat;
      upd.lon = patch.latLng.lon;
    }
    if (patch.elev_m !== undefined) {
      upd.elev_m = patch.elev_m;
    }
    if (patch.description !== undefined) {
      upd.description = patch.description;
    }
    if (Object.keys(upd).length === 0) {
      return;
    }
    await this.db.updateTable('waypoint').set(upd).where('id', '=', id).execute();
  }

  /**
   * Remove a waypoint and clean up join-table references.
   */
  async remove(id: number): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('trail_waypoint').where('waypoint_id', '=', id).execute();
      await trx.deleteFrom('collection_waypoint').where('waypoint_id', '=', id).execute();
      await trx.deleteFrom('waypoint').where('id', '=', id).execute();
    });
  }

  /**
   * Fetch waypoints ordered by distance from a given center using a portable, index‑friendly algorithm.
   *
   * Algorithm (portable across SQLite builds that lack trig functions):
   * 1) Compute a geographic bounding box (bbox) around `center` for a default radius (~50 km).
   *    - Convert meters → degrees using METERS_PER_DEG_LAT and cos(latitude) for longitude span.
   *    - Clamp latitude to [-90, 90].
   *    - Longitude handling:
   *       • If near the poles (|cos(lat)| < EPS_COS_LAT_POLE) or span ≥ 180°, skip lon filter entirely.
   *       • If the bbox crosses the anti‑meridian, express lon filter as (lon >= min OR lon <= max).
   * 2) Run a SQL query constrained by the bbox using the composite index (idx_waypoint_lat_lon).
   *    - Apply a coarse ORDER BY: |lat - centerLat|, then cyclic |lon - centerLon| to bring nearest candidates first.
   *    - Limit the candidate count (e.g., ~3× requested limit) to reduce JS work.
   * 3) In JS, compute exact great‑circle distances (haversine) for the candidates, sort ascending, and slice to `limit`.
   *
   * Rationale: SQLite on native/web often lacks trig functions; computing exact distances in JS guarantees
   * consistency. The bbox + coarse sort keep the candidate set small and ordered, so the final JS sort is cheap.
   * I probably could just ignore bounds checks, most likely app not used at poles or on a ship in the ocean where the constraints matter, but might as well do it correctly.
   *
   * Complexity: O(log N + K log K), where N is total waypoints and K is candidate count (typically small).
   *
   * @param center Geographic center (degrees) to center the distance search.
   * @param opts Optional filters: `trailId` to restrict to a trail; `limit` for max results (post‑sort).
   * @returns Array of waypoints augmented with `distance_m` (meters), ordered nearest first.
   */
  async withDistanceFrom(
    center: LatLng,
    opts?: { trailId?: number; limit?: number }
  ): Promise<Array<Selectable<Waypoint> & { distance_m: number }>> {
    return fetchWaypointsWithDistance(this.db, center, opts);
  }

  private async insertWaypoint(db: Kysely<DB>, input: WaypointCreateInput): Promise<number> {
    const res = await db
      .insertInto('waypoint')
      .values({
        name: input.name,
        lat: input.latLng.lat,
        lon: input.latLng.lon,
        elev_m: input.elev_m ?? null,
        created_at: new Date().toISOString(),
      })
      .returning('id')
      .executeTakeFirst();
    return Number(res!.id);
  }
}
