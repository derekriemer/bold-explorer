import { ref, computed, type Ref } from 'vue';
import { isLatLng, toLatLng, type LatLng } from '@/types';

type CoordInput = LatLng | { lat: number; lon: number };
type NamedCoord = CoordInput & { id: number; name: string };
export type Scope = 'waypoint' | 'trail';

/**
 * Manage target selection between a single waypoint and the next waypoint in a trail.
 * Accepts sources for waypoints and trail waypoints and computes a single target.
 */
function toSafeLatLng(coord: CoordInput): LatLng
{
  return isLatLng(coord) ? coord : toLatLng(coord.lat, coord.lon);
}

export function useTarget (args: {
  waypoints: Ref<NamedCoord[]>;
  trailWaypoints: Ref<NamedCoord[]>;
  initialScope?: Scope;
})
{
  const scope = ref<Scope>(args.initialScope ?? 'waypoint');
  const selectedWaypointId = ref<number | null>(null);
  const selectedTrailId = ref<number | null>(null);

  const targetCoord = computed<LatLng | null>(() =>
  {
    if (scope.value === 'waypoint')
    {
      const t = args.waypoints.value.find(w => w.id === selectedWaypointId.value);
      return t ? toSafeLatLng(t) : null;
    }
    const t = args.trailWaypoints.value[0] ?? null; // caller may override with follow‑trail index
    return t ? toSafeLatLng(t) : null;
  });

  const targetName = computed<string | null>(() =>
  {
    if (scope.value === 'waypoint')
    {
      const t = args.waypoints.value.find(w => w.id === selectedWaypointId.value);
      return t?.name ?? null;
    }
    return args.trailWaypoints.value[0]?.name ?? null;
  });

  function clear (): void { selectedWaypointId.value = null; }

  return {
    scope,
    selectedWaypointId,
    selectedTrailId,
    targetCoord,
    targetName,
    clear
  } as const;
}
