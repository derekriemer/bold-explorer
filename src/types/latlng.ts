// Geographic coordinate types and guards
// lat: [-90, 90], lon: [-180, 180]
export interface LatLng {
  lat: number;
  lon: number;
}

export function isLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== 'object') return false;
  const { lat, lon } = v as any;
  return (
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180
  );
}

export function assertLatLng(v: unknown): asserts v is LatLng {
  if (!isLatLng(v)) {
    throw new Error('Invalid LatLng: lat must be [-90,90] and lon [-180,180]');
  }
}

