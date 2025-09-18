
/** ─────────────────────────────────────────────────────────────────────────────
 *  Lat/Lon branded types with safe factories, guards, and asserts.
 *  - Brands are compile-time only; at runtime these are plain numbers.
 *  - Prefer factories (`makeLat`, `makeLon`) to create safe values.
 *  - Use `toLatLng` to build a validated LatLng from raw numbers (or brands).
 *  - Guards (`isLat`, `isLon`, `isLatLng`) are handy for narrowing.
 *  - Asserts throw TypeError with helpful messages.
 *  ───────────────────────────────────────────────────────────────────────────*/

//////////////////////
// Brands & Types  //
////////////////////

declare const latBrand: unique symbol;
declare const lonBrand: unique symbol;

export type Lat = number & { readonly [latBrand]: true };  // [-90, 90]
export type Lon = number & { readonly [lonBrand]: true };  // [-180, 180]

export interface LatLng
{
  lat: Lat;
  lon: Lon;
}

//////////////////////
// Range Constants //
////////////////////

export const LAT_MIN = -90 as const;
export const LAT_MAX = 90 as const;
export const LON_MIN = -180 as const;
export const LON_MAX = 180 as const;

//////////////////////
// Predicates      //
////////////////////

/** True if n is within latitude range. Narrows to Lat inside true branch. */
export function isLat (n: number): n is Lat
{
  return Number.isFinite(n) && n >= LAT_MIN && n <= LAT_MAX;
}

/** True if n is within longitude range. Narrows to Lon inside true branch. */
export function isLon (n: number): n is Lon
{
  return Number.isFinite(n) && n >= LON_MIN && n <= LON_MAX;
}

/** True if v is a valid LatLng (shape + ranges). Narrows v to LatLng. */
export function isLatLng (v: unknown): v is LatLng
{
  if (!v || typeof v !== "object") return false;
  const { lat, lon } = v as { lat: number; lon: number };
  return isLat(lat) && isLon(lon);
}

//////////////////////
// Asserts         //
////////////////////

export function assertLat (n: number): asserts n is Lat
{
  if (!isLat(n))
  {
    throw new TypeError(`Latitude out of range: ${ n }. Expected ${ LAT_MIN }..${ LAT_MAX }`);
  }
}

export function assertLon (n: number): asserts n is Lon
{
  if (!isLon(n))
  {
    throw new TypeError(`Longitude out of range: ${ n }. Expected ${ LON_MIN }..${ LON_MAX }`);
  }
}

export function assertLatLng (v: unknown): asserts v is LatLng
{
  if (!isLatLng(v))
  {
    throw new TypeError(
      `Invalid LatLng. 'lat' must be ${ LAT_MIN }..${ LAT_MAX } and 'lon' must be ${ LON_MIN }..${ LON_MAX }`
    );
  }
}

//////////////////////
// Factories       //
////////////////////

/**
 * Construct a branded latitude after validating range.
 * This is the *ONLY* sanctioned way to create a lat.
 * Use this whenever you want to ensure only safe latitudes flow through.
 */
export function makeLat (n: number): Lat
{
  assertLat(n);
  return n as Lat;
}

/**
 * Construct a branded longitude after validating range.
 * This is the *ONLY* sanctioned way to create a Lon.
 * Use this whenever you want to ensure only safe longitudes flow through.
 */
export function makeLon (n: number): Lon
{
  assertLon(n);
  return n as Lon;
}

/**
 * Build a LatLng from either raw numbers or already-branded values.
 * Throws TypeError if validation fails.
 */
export function toLatLng (lat: number | Lat, lon: number | Lon): LatLng
{
  // Fast-path: if already branded, trust and return
  if (isLat(lat) && isLon(lon))
  {
    return { lat, lon };
  }
  // Otherwise validate+brand
  const brandedLat = makeLat(lat as number);
  const brandedLon = makeLon(lon as number);
  return { lat: brandedLat, lon: brandedLon };
}

//////////////////////
// Parsing helpers //
////////////////////

/**
 * Parse/validate from unknown, e.g., external input.
 * Accepts numbers or numeric strings for convenience (optional).
 * Throws TypeError on failure.
 */
export function parseLatLng (v: unknown): LatLng
{
  if (!v || typeof v !== "object")
  {
    throw new TypeError("LatLng must be an object with { lat, lon }");
  }
  let { lat, lon } = v as { lat: unknown; lon: unknown };

  // Optional coercion: allow numeric strings like "40.01"
  if (typeof lat === "string" && lat.trim() !== "") lat = Number(lat);
  if (typeof lon === "string" && lon.trim() !== "") lon = Number(lon);

  if (typeof lat !== "number" || typeof lon !== "number")
  {
    throw new TypeError("LatLng lat/lon must be numbers");
  }

  return toLatLng(lat, lon);
}

/**
 * Try-parse variant that returns `null` instead of throwing.
 * Useful at boundaries (e.g., form inputs).
 */
export function tryParseLatLng (v: unknown): LatLng | null
{
  try
  {
    return parseLatLng(v);
  } catch
  {
    return null;
  }
}
