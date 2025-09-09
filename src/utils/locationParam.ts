// Parses a page/query param for a map center in the form "lat,lon".
// Accepts string or string[] (from Vue Router query) and returns { lat, lon } or null.
export function parseCenterParam(input: string | string[] | undefined | null): { lat: number; lon: number } | null {
  if (input == null) return null;
  const raw = Array.isArray(input) ? input[0] : input;
  if (typeof raw !== 'string') return null;
  const parts = raw.split(',').map(s => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

