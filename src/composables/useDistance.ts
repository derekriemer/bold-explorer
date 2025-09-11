import { computed, type Ref } from 'vue';
import { haversineDistanceMeters } from '@/utils/geo';

export type Units = 'metric' | 'imperial';

// 1 meter = ~3.28084 feet; 1 mile = 5280 feet
export function formatDistance(distanceM: number | null, units: Units): string {
  if (distanceM == null) return '—';
  if (units === 'imperial') {
    const feet = distanceM * 3.28084;
    return feet >= 528 ? `${(feet / 5280).toFixed(2)} mi` : `${feet.toFixed(0)} ft`;
  }
  return distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${distanceM.toFixed(0)} m`;
}

export function useDistance(position: Ref<{ lat: number; lon: number } | null>, units: Ref<Units>) {
  const distanceTo = (target: { lat: number; lon: number } | null): number | null =>
    position.value && target ? haversineDistanceMeters(position.value, target) : null;

  const sorterFrom = (center: { lat: number; lon: number }) =>
    (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
      haversineDistanceMeters(center, a) - haversineDistanceMeters(center, b);

  const format = (d: number | null) => formatDistance(d, units.value);

  return { distanceTo, sorterFrom, format, units: computed(() => units.value) };
}
