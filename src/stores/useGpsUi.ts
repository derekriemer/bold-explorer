import { defineStore } from 'pinia';
import type { LocationQuery, LocationQueryValue } from 'vue-router';

const SCOPE_VALUES = ['waypoint', 'trail', 'collection'] as const;
export type GpsUiScope = (typeof SCOPE_VALUES)[number];

interface GpsUiState {
  scope: GpsUiScope;
  selectedWaypointId: number | null;
  selectedTrailId: number | null;
  selectedCollectionId: number | null;
  _hydratedFromRoute: boolean;
}

function coerceScope(value: unknown): GpsUiScope | null {
  if (typeof value !== 'string') return null;
  return SCOPE_VALUES.includes(value as GpsUiScope) ? (value as GpsUiScope) : null;
}

function coerceId(value: unknown): number | null {
  if (value == null) return null;
  const asNumber = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function firstQueryValue(value: LocationQueryValue | LocationQueryValue[] | null | undefined): string | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? firstQueryValue(value[0]) : null;
  }
  if (value == null) return null;
  return value;
}

export const useGpsUiStore = defineStore('gpsUi', {
  state: (): GpsUiState => ({
    scope: 'waypoint',
    selectedWaypointId: null,
    selectedTrailId: null,
    selectedCollectionId: null,
    _hydratedFromRoute: false
  }),
  actions: {
    setScope(next: GpsUiScope) {
      this.scope = next;
    },
    selectWaypoint(id: number | null) {
      this.selectedWaypointId = id ?? null;
    },
    selectTrail(id: number | null) {
      this.selectedTrailId = id ?? null;
    },
    selectCollection(id: number | null) {
      this.selectedCollectionId = id ?? null;
    },
    clearTargets() {
      this.selectedWaypointId = null;
      this.selectedTrailId = null;
      this.selectedCollectionId = null;
    },
    reset() {
      this.scope = 'waypoint';
      this.clearTargets();
      this._hydratedFromRoute = false;
    },
    hydrateFromRoute(route: { query: LocationQuery }, opts?: { force?: boolean }) {
      if (!opts?.force && this._hydratedFromRoute) return;

      const { query } = route;
      const scopeQuery = firstQueryValue(query.scope ?? null);
      const waypointQuery = firstQueryValue(query.waypoint ?? query.waypointId ?? null);
      const trailQuery = firstQueryValue(query.trail ?? query.trailId ?? null);
      const collectionQuery = firstQueryValue(query.collection ?? query.collectionId ?? null);

      const scoped = coerceScope(scopeQuery);
      if (scoped) {
        this.scope = scoped;
      }

      const waypointId = coerceId(waypointQuery);
      if (waypointId != null) {
        this.selectedWaypointId = waypointId;
      }

      const trailId = coerceId(trailQuery);
      if (trailId != null) {
        this.selectedTrailId = trailId;
      }

      const collectionId = coerceId(collectionQuery);
      if (collectionId != null) {
        this.selectedCollectionId = collectionId;
      }

      this._hydratedFromRoute = true;
    }
  }
});
