import { ref, computed, type Ref } from 'vue';

type Coord = { lat: number; lon: number };
type NamedCoord = Coord & { id: number; name: string };
export type Scope = 'waypoint' | 'trail';

/**
 * Manage target selection between a single waypoint and the next waypoint in a trail.
 * Accepts sources for waypoints and trail waypoints and computes a single target.
 */
export function useTarget (args: {
  waypoints: Ref<NamedCoord[]>;
  trailWaypoints: Ref<NamedCoord[]>;
  initialScope?: Scope;
})
{
  const scope = ref<Scope>(args.initialScope ?? 'waypoint');
  const selectedWaypointId = ref<number | null>(null);
  const selectedTrailId = ref<number | null>(null);

  const targetCoord = computed<Coord | null>(() =>
  {
    if (scope.value === 'waypoint')
    {
      const t = args.waypoints.value.find(w => w.id === selectedWaypointId.value);
      return t ? { lat: t.lat, lon: t.lon } : null;
    }
    const t = args.trailWaypoints.value[0] ?? null; // caller may override with follow‑trail index
    return t ? { lat: t.lat, lon: t.lon } : null;
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

