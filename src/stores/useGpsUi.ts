/**
 * Track per-session UI state for the GPS page, including selection scope and compass alignment.
 */
import { defineStore } from 'pinia';
import type { LocationQuery, LocationQueryValue } from 'vue-router';

const SCOPE_VALUES = ['waypoint', 'trail', 'collection'] as const;
export type GpsUiScope = (typeof SCOPE_VALUES)[number];

interface GpsUiState {
  scope: GpsUiScope;
  selectedWaypointId: number | null;
  selectedTrailId: number | null;
  selectedCollectionId: number | null;
  alignmentActive: boolean;
  alignmentBearingDeg: number | null;
  alignmentLastBearingDeg: number | null;
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

/** Normalize an angle to the [0, 360) range or return null if invalid. */
function normalizeBearing(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const mod = ((value % 360) + 360) % 360;
  return Number.isFinite(mod) ? mod : null;
}

export const useGpsUiStore = defineStore('gpsUi', {
  state: (): GpsUiState => ({
    scope: 'waypoint',
    selectedWaypointId: null,
    selectedTrailId: null,
    selectedCollectionId: null,
    alignmentActive: false,
    alignmentBearingDeg: null,
    alignmentLastBearingDeg: null,
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
    /**
     * Start compass alignment using an optional seed value or the last stored bearing.
     */
    beginAlignment(seed: number | null | undefined) {
      const normalized = normalizeBearing(seed ?? this.alignmentLastBearingDeg);
      this.alignmentActive = true;
      this.alignmentBearingDeg = normalized;
      if (normalized != null) {
        this.alignmentLastBearingDeg = normalized;
      }
    },
    /** Update the active alignment bearing and persist it as the last-used value. */
    setAlignmentBearing(next: number | null | undefined) {
      const normalized = normalizeBearing(next);
      this.alignmentBearingDeg = normalized;
      if (normalized != null) {
        this.alignmentLastBearingDeg = normalized;
      }
    },
    /** Clear the active alignment session while preserving the last-used value. */
    endAlignment() {
      this.alignmentActive = false;
      this.alignmentBearingDeg = null;
    },
    /** Forget the last-used alignment value. */
    clearAlignmentHistory() {
      this.alignmentLastBearingDeg = null;
    },
    reset() {
      this.scope = 'waypoint';
      this.clearTargets();
      this.alignmentActive = false;
      this.alignmentBearingDeg = null;
      this.alignmentLastBearingDeg = null;
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
