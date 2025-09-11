// Geodesy references (general):
// - Haversine formula: Wikipedia — spherical distance; widely used approximation.
// - Chris Veness, Movable Type Scripts — practical JS implementations and explanations for distance/bearing.
// - GIS StackExchange — patterns for bounding boxes, anti‑meridian handling, polar edge cases.
// - Snyder, “Map Projections — A Working Manual” — background on geodesy approximations.
// Notes:
// - We use a constant mean Earth radius (EARTH_R) for short‑range distances.
// - Bounding boxes convert meters→degrees with METERS_PER_DEG_LAT and scale longitude by cos(latitude).
// - Anti‑meridian crossings are handled with an OR lon predicate; longitudes normalized to [-180, 180].
// - Near the poles (|cos(lat)| ~ 0), longitude filtering is skipped.

import type { Kysely, Selectable } from 'kysely';
import { sql } from 'kysely';
import type { DB, Waypoint } from '@/db/schema';
import type { LatLng } from '@/types/latlng';
import { assertLatLng } from '@/types/latlng';

// Degrees-to-radians conversion (1° = PI/180 rad)
export const DEG_TO_RAD = Math.PI / 180;
// Mean Earth radius in meters (spherical approximation)
export const EARTH_R = 6_371_000;
// Mean meters per degree latitude at Earth's surface (~111.32 km)
export const METERS_PER_DEG_LAT = 111_320;
// Default bounding-box radius for candidate selection (~50 km)
export const DEFAULT_BBOX_RADIUS_M = 50_000;
// Cosine threshold to consider we're effectively at the pole (skip lon filtering)
export const EPS_COS_LAT_POLE = 1e-6;

/**
 * Compute great‑circle distance between two lat/lon points using the haversine formula.
 *
 * - Inputs are degrees. Internally converts to radians.
 * - Uses a spherical Earth model with mean radius EARTH_R. For sub‑10 km distances this is a
 *   good approximation for most applications.
 * - Returns meters.
 */
export function haversineDistanceMeters (a: LatLng, b: LatLng): number
{
  const R = EARTH_R;
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  const c = 2 * Math.asin(Math.sqrt(h));
  return R * c;
}

export function initialBearingDeg (a: LatLng, b: LatLng): number
{
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) / DEG_TO_RAD; // in degrees
  return (brng + 360) % 360;
}

export function deltaHeadingDeg (heading: number, bearing: number): number
{
  const d = (heading - bearing + 540) % 360 - 180; // range [-180, 180)
  return d;
}

// Kysely SQL helper: compute haversine distance in meters for a table alias
// Example: sqlDistanceMetersForAlias('w', {lat, lon}) -> RawBuilder<number> as 'distance_m'
export function sqlDistanceMetersForAlias (alias: string, center: LatLng)
{
  // Defend against identifier injection: only allow simple SQL identifiers
  // (letters/underscore start, then letters/digits/underscore). Callers pass
  // a constant like 'w' in current usage.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias))
  {
    throw new Error('Invalid SQL alias');
  }
  assertLatLng(center);
  const latRef = sql.ref(`${ alias }.lat`);
  const lonRef = sql.ref(`${ alias }.lon`);
  return sql<number>`
    ${ 2 * EARTH_R } * asin(
      sqrt(
        pow(sin((${ DEG_TO_RAD } * (${ latRef } - ${ center.lat })) / 2.0), 2) +
        cos(${ DEG_TO_RAD } * ${ center.lat }) * cos(${ DEG_TO_RAD } * ${ latRef }) *
        pow(sin((${ DEG_TO_RAD } * (${ lonRef } - ${ center.lon })) / 2.0), 2)
      )
    )
  `.as('distance_m');
}

// Compute bbox bounds for a radius (meters) around a center point.
// Handles latitude clamp and detects anti-meridian crossing. Also indicates whether a lon filter is needed.
export function computeBbox (center: LatLng, radiusM = DEFAULT_BBOX_RADIUS_M)
{
  const degLat = radiusM / METERS_PER_DEG_LAT;
  const latMin = Math.max(-90, center.lat - degLat);
  const latMax = Math.min(90, center.lat + degLat);

  const cosLat = Math.cos(center.lat * DEG_TO_RAD);
  let needsLonFilter = true;
  let crossing = false;
  let lonMin = -180;
  let lonMax = 180;
  if (Math.abs(cosLat) < EPS_COS_LAT_POLE)
  {
    needsLonFilter = false; // near poles: longitude is not meaningful for narrowing
  } else
  {
    const degLon = radiusM / (METERS_PER_DEG_LAT * cosLat);
    if (degLon >= 180)
    {
      needsLonFilter = false; // covers the globe
    } else
    {
      const lonMinRaw = center.lon - degLon;
      const lonMaxRaw = center.lon + degLon;
      crossing = lonMinRaw < -180 || lonMaxRaw > 180;
      const norm = (x: number) => ((x + 180) % 360 + 360) % 360 - 180;
      lonMin = crossing ? norm(lonMinRaw) : lonMinRaw;
      lonMax = crossing ? norm(lonMaxRaw) : lonMaxRaw;
    }
  }
  return { latMin, latMax, lonMin, lonMax, needsLonFilter, crossing };
}

// Build SQL expressions for coarse ordering by proximity components.
// Returns expressions for |Δlat| and cyclic |Δlon| suitable for ORDER BY.
export function sqlCoarseOrderExprsForCenter (center: LatLng)
{
  const absLat = sql`abs(w.lat - ${ center.lat })`;
  const absDeltaLon = sql`abs(w.lon - ${ center.lon })`;
  const absLonCyclic = sql`CASE WHEN ${ absDeltaLon } > 180 THEN 360 - ${ absDeltaLon } ELSE ${ absDeltaLon } END`;
  return { absLat, absLonCyclic } as const;
}

// Portable helper: fetch waypoints and compute distance in JS.
// Uses bbox + coarse ORDER BY then computes exact haversine and applies final sort/limit.
/**
 * Fetch waypoints ordered by distance from a given center using a portable, index‑friendly algorithm.
 *
 * Algorithm (portable across SQLite builds that lack trig functions):
 * 1) Compute a geographic bounding box (bbox) around `center` for a radius (default ~50 km).
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
 *
 * Complexity: O(log N + K log K), where N is total waypoints and K is candidate count (typically small).
 *
 * @param db Open Kysely database handle.
 * @param center Geographic center (degrees) to measure distance from.
 * @param opts Optional: `trailId` to restrict to a trail; `limit` for max results (post‑sort);
 *             `radiusM` to adjust candidate bbox radius (meters, default DEFAULT_BBOX_RADIUS_M).
 * @returns Array of waypoints augmented with `distance_m` (meters), ordered nearest first.
 */
export async function fetchWaypointsWithDistance (
  db: Kysely<DB>,
  center: LatLng,
  opts?: { trailId?: number; limit?: number; radiusM?: number }
): Promise<Array<Selectable<Waypoint> & { distance_m: number }>>
{
  const { latMin, latMax, lonMin, lonMax, needsLonFilter, crossing } = computeBbox(center, opts?.radiusM ?? DEFAULT_BBOX_RADIUS_M);

  let base = db
    .selectFrom('waypoint as w')
    .$if(!!opts?.trailId, (qb: any) =>
      qb.innerJoin('trail_waypoint as tw', 'tw.waypoint_id', 'w.id').where('tw.trail_id', '=', opts!.trailId!)
    )
    .where('w.lat', '>=', latMin)
    .where('w.lat', '<=', latMax);

  if (needsLonFilter)
  {
    if (crossing)
    {
      // Anti-meridian crossing: longitudes wrap, so express as (lon >= min OR lon <= max)
      base = base.where((eb) => eb.or([
        eb('w.lon', '>=', lonMin),
        eb('w.lon', '<=', lonMax)
      ]));
    } else
    {
      base = base.where('w.lon', '>=', lonMin).where('w.lon', '<=', lonMax);
    }
  }

  const candidateLimit = opts?.limit ? Math.max(opts.limit * 3, opts.limit + 25) : undefined;
  const { absLat, absLonCyclic } = sqlCoarseOrderExprsForCenter(center);

  const rows = await base
    .select(['w.id', 'w.name', 'w.description', 'w.lat', 'w.lon', 'w.elev_m', 'w.created_at'])
    .orderBy(absLat)
    .orderBy(absLonCyclic)
    .$if(!!candidateLimit, (qb: any) => qb.limit(candidateLimit!))
    .execute();

  const mapped = (rows as any[]).map((w) => ({
    ...w,
    distance_m: haversineDistanceMeters(center, { lat: w.lat, lon: w.lon })
  })) as Array<Selectable<Waypoint> & { distance_m: number }>;
  mapped.sort((a, b) => a.distance_m - b.distance_m);
  return opts?.limit ? mapped.slice(0, opts.limit) : mapped;
}
