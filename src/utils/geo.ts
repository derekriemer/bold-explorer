const RAD = Math.PI / 180;

export function haversineDistanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
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

export function initialBearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
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

