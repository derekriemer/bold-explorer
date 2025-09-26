import { computed, type Ref } from 'vue';
import type { GpsUiScope } from '@/stores/useGpsUi';
import { isLatLng, toLatLng, type LatLng } from '@/types';

type CoordInput = LatLng | { lat: number; lon: number };
type NamedCoord = CoordInput & { id: number; name: string };
type Scope = GpsUiScope;

/**
 * Manage target selection between a single waypoint and the next waypoint in a trail.
 * Accepts sources for waypoints and trail waypoints and computes a single target.
 */
function toSafeLatLng(coord: CoordInput): LatLng {
  return isLatLng(coord) ? coord : toLatLng(coord.lat, coord.lon);
}

type TargetProviders = {
  waypoint: {
    items: Ref<NamedCoord[]>;
    selectedId: Ref<number | null>;
  };
  trail: {
    items: Ref<NamedCoord[]>;
    currentIndex?: Ref<number | null | undefined>;
  };
  collection: {
    items: Ref<NamedCoord[]>;
    currentIndex?: Ref<number | null | undefined>;
  };
};

export function useTarget(args: { scope: Ref<Scope>; providers: TargetProviders }) {
  const pickByIndex = (list: NamedCoord[], idx: number | null | undefined) => {
    const safeIndex = typeof idx === 'number' && idx >= 0 ? idx : 0;
    return list[safeIndex] ?? null;
  };

  const targetCoord = computed<LatLng | null>(() => {
    switch (args.scope.value) {
      case 'waypoint': {
        const { items, selectedId } = args.providers.waypoint;
        const t = items.value.find((w) => w.id === selectedId.value);
        return t ? toSafeLatLng(t) : null;
      }
      case 'trail': {
        const { items, currentIndex } = args.providers.trail;
        const t = pickByIndex(items.value, currentIndex?.value ?? 0);
        return t ? toSafeLatLng(t) : null;
      }
      case 'collection': {
        const { items, currentIndex } = args.providers.collection;
        const t = pickByIndex(items.value, currentIndex?.value ?? 0);
        return t ? toSafeLatLng(t) : null;
      }
      default:
        return null;
    }
  });

  const targetName = computed<string | null>(() => {
    switch (args.scope.value) {
      case 'waypoint': {
        const { items, selectedId } = args.providers.waypoint;
        const t = items.value.find((w) => w.id === selectedId.value);
        return t?.name ?? null;
      }
      case 'trail': {
        const { items, currentIndex } = args.providers.trail;
        const t = pickByIndex(items.value, currentIndex?.value ?? 0);
        return t?.name ?? null;
      }
      case 'collection': {
        const { items, currentIndex } = args.providers.collection;
        const t = pickByIndex(items.value, currentIndex?.value ?? 0);
        return t?.name ?? null;
      }
      default:
        return null;
    }
  });

  function clear(): void {
    args.providers.waypoint.selectedId.value = null;
  }

  return {
    targetCoord,
    targetName,
    clear,
  } as const;
}
