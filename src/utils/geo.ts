import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type { DB, Waypoint } from '@/db/schema';
import type { LatLng } from '@/types/latlng';
import { assertLatLng } from '@/types/latlng';

// Degrees-to-radians conversion (1° = PI/180 rad)
const RAD = Math.PI / 180;
// Mean Earth radius in meters (spherical approximation)
export const EARTH_R = 6_371_000;

/**
 * Compute great‑circle distance between two lat/lon points using the haversine formula.
 *
 * - Inputs are degrees. Internally converts to radians.
 * - Uses a spherical Earth model with mean radius EARTH_R. For sub‑10 km distances this is a
 *   good approximation for most applications.
 * - Returns meters.
 */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const lat1 = a.lat * RAD;
  const lat2 = b.lat * RAD;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  const c = 2 * Math.asin(Math.sqrt(h));
  return R * c;
}

export function initialBearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = a.lat * RAD;
  const lat2 = b.lat * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) / RAD; // in degrees
  return (brng + 360) % 360;
}

export function deltaHeadingDeg(heading: number, bearing: number): number {
  let d = (heading - bearing + 540) % 360 - 180; // range [-180, 180)
  return d;
}

// Kysely SQL helper: compute haversine distance in meters for a table alias
// Example: sqlDistanceMetersForAlias('w', {lat, lon}) -> RawBuilder<number> as 'distance_m'
export function sqlDistanceMetersForAlias(alias: string, center: LatLng) {
  // Defend against identifier injection: only allow simple SQL identifiers
  // (letters/underscore start, then letters/digits/underscore). Callers pass
  // a constant like 'w' in current usage.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new Error('Invalid SQL alias');
  }
  assertLatLng(center);
  const latRef = sql.ref(`${alias}.lat`);
  const lonRef = sql.ref(`${alias}.lon`);
  return sql<number>`
    ${2 * EARTH_R} * asin(
      sqrt(
        pow(sin((${RAD} * (${latRef} - ${center.lat})) / 2.0), 2) +
        cos(${RAD} * ${center.lat}) * cos(${RAD} * ${latRef}) *
        pow(sin((${RAD} * (${lonRef} - ${center.lon})) / 2.0), 2)
      )
    )
  `.as('distance_m');
}

// High-level helper: fetch waypoints with computed distance from center, ordered ascending.
export async function fetchWaypointsWithDistance(
  db: Kysely<DB>,
  center: LatLng,
  opts?: { trailId?: number; limit?: number }
): Promise<Array<Selectable<Waypoint> & { distance_m: number }>> {
  const distanceExpr = sqlDistanceMetersForAlias('w', center);
  const base = db
    .selectFrom('waypoint as w')
    .$if(!!opts?.trailId, (qb: any) =>
      qb.innerJoin('trail_waypoint as tw', 'tw.waypoint_id', 'w.id').where('tw.trail_id', '=', opts!.trailId!)
    );

  const rows = await base
    .select([
      'w.id', 'w.name', 'w.description', 'w.lat', 'w.lon', 'w.elev_m', 'w.created_at',
      distanceExpr
    ])
    .orderBy('distance_m')
    .$if(!!opts?.limit, (qb: any) => qb.limit(opts!.limit!))
    .execute();

  return rows as Array<Selectable<Waypoint> & { distance_m: number }>;
}
