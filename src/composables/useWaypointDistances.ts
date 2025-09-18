import { ref, computed, watch, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import type { Selectable } from 'kysely';
import type { Waypoint } from '@/db/schema';
import type { LatLng } from '@/types/latlng';
import { haversineDistanceMeters } from '@/utils/geo';
import { isLatLng, toLatLng } from '@/types';

type Wp = Selectable<Waypoint>;

export interface UseWaypointDistancesOptions {
  waypoints: Ref<Wp[]> | ComputedRef<Wp[]>;
  gps: Ref<LatLng | null> | ComputedRef<LatLng | null>;
  pinned?: Ref<Set<number>>; // optional: ids to sort first
  throttleMs?: number; // default 800ms
  initialCenter?: LatLng | null; // use once until gps is available
}

export function useWaypointDistances(opts: UseWaypointDistancesOptions) {
  const { waypoints, gps, pinned, throttleMs = 800, initialCenter = null } = opts;

  const distances = ref<Record<number, number>>({});
  let timer: ReturnType<typeof setTimeout> | null = null;

  function toSafeLatLng(value: LatLng | { lat: number; lon: number }): LatLng
  {
    return isLatLng(value) ? value : toLatLng(value.lat, value.lon);
  }

  function compute(center: LatLng | null) {
    if (!center) return;
    const safeCenter = toSafeLatLng(center);
    const map: Record<number, number> = {};
    for (const w of waypoints.value) {
      map[w.id] = haversineDistanceMeters(safeCenter, toLatLng(w.lat, w.lon));
    }
    distances.value = map;
  }

  function scheduleCompute(center: LatLng | null) {
    if (!center) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { compute(center); timer = null; }, Math.max(0, throttleMs));
  }

  // Initial compute if a center was provided
  if (initialCenter) compute(initialCenter);

  // React to GPS updates
  watch(gps, (pos) => {
    if (!pos) return;
    scheduleCompute(pos);
  });

  // React to waypoint membership changes
  watch(
    () => waypoints.value.map(w => w.id).join(','),
    () => {
      // Recompute if we have a current center (gps or initial)
      const center = gps.value ?? initialCenter;
      if (center) scheduleCompute(center);
    }
  );

  onBeforeUnmount(() => { if (timer) clearTimeout(timer); timer = null; });

  const byDistance = computed(() => {
    const map = distances.value;
    const p = pinned?.value ?? new Set<number>();
    const list = waypoints.value.map((w) => ({ ...w, distance_m: map[w.id], pinned: p.has(w.id) }));
    // Sort: pinned first, then by distance (undefined distances go last)
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const da = a.distance_m ?? Number.POSITIVE_INFINITY;
      const db = b.distance_m ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  });

  const refresh = async () => {
    const center = gps.value ?? initialCenter;
    if (center) compute(center);
  };

  return { distances, byDistance, refresh } as const;
}
