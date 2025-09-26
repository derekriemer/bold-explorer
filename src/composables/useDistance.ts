import { computed, type Ref } from 'vue';
import { haversineDistanceMeters } from '@/utils/geo';
import { isLatLng, toLatLng, type LatLng } from '@/types';

export type Units = 'metric' | 'imperial';

// 1 meter = ~3.28084 feet; 1 mile = 5280 feet
export function formatDistance(distanceM: number | null, units: Units): string {
  if (distanceM == null) {
    return '—';
  }
  if (units === 'imperial') {
    const feet = distanceM * 3.28084;
    return feet >= 528 ? `${(feet / 5280).toFixed(2)} mi` : `${feet.toFixed(0)} ft`;
  }
  return distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${distanceM.toFixed(0)} m`;
}

type CoordInput = LatLng | { lat: number; lon: number };

function toSafeLatLng(value: CoordInput): LatLng {
  return isLatLng(value) ? value : toLatLng(value.lat, value.lon);
}

export function useDistance(position: Ref<LatLng | null>, units: Ref<Units>) {
  const distanceTo = (target: CoordInput | null): number | null =>
    position.value && target ? haversineDistanceMeters(position.value, toSafeLatLng(target)) : null;

  const sorterFrom = (center: CoordInput) => {
    const safeCenter = toSafeLatLng(center);
    return (a: CoordInput, b: CoordInput) =>
      haversineDistanceMeters(safeCenter, toSafeLatLng(a)) -
      haversineDistanceMeters(safeCenter, toSafeLatLng(b));
  };

  const format = (d: number | null) => formatDistance(d, units.value);

  return { distanceTo, sorterFrom, format, units: computed(() => units.value) };
}
