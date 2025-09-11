# Waypoint/Trail App — Storage‑First Design Spec (Ionic Required)

This document defines the architecture, data model, and UI for an offline‑first waypoint/trail application built with Vue 3 + Pinia + Ionic and SQLite (Capacitor) via Kysely. It is intended for contributors and code‑generating agents. Keep all section headings and code fences intact when editing this spec.

## Overview

Bold Explorer is an offline‑first trail and waypoint recorder:

- GPS HUD with compass (Magnetic/True), live bearing and distance, plus Follow‑Trail mode that advances to the next waypoint.
- Quick “Record New Trail” callout on GPS page; FAB “+” records waypoints to either the trail or standalone based on scope.
- Waypoints: nearby list (by distance), search, create/rename/delete, attach to trails.
- Trails: create/rename/delete; manage ordered waypoints (attach existing via wizard, add new, move up/down, detach); export to GPX.
- Collections: group waypoints and trails; bulk add via Multi‑Select Wizard; export to GPX.
- Settings: units, compass mode, audio cues; Debug page for diagnostics.
- Tech: Ionic Vue + Pinia; SQLite via Kysely; DI via Pinia plugin; works fully offline.

## Tech Stack (authoritative)

- UI: Ionic Framework components (mandatory), Vue 3, Pinia
- Database: SQLite via `@capacitor-community/sqlite` with Kysely (`capacitor-sqlite-kysely` dialect)
- Query Builder & Migrations: Kysely (bundled migrations)
- Filesystem: `@capacitor/filesystem` (GPX import/export, backups)
- Preferences: `@capacitor/preferences` (persisted via Pinia store)
- Location/Sensors: `@capacitor/geolocation`; Heading compass via Capacitor plugin (see “Compass Usage”)
- Testing: Vitest + better-sqlite3 (in-memory SQLite)

## Scripts

Run from project root and use pnpm.

```
corepack enable
pnpm install

# Dev server (copies sql.js WASM, then Vite)
pnpm dev

# Type-check and production build
pnpm build

# Preview production build
pnpm preview

# Tests
pnpm test:unit
pnpm test:e2e

# Lint
pnpm lint
```

## Directory Layout (fixed)

```
src/
  db/
    schema.ts
    migrations/provider.ts
    factory.ts               # createAppDb/createTestDb/initAppDb (DI seam)
  data/
    repositories/
      trails.repo.ts
      waypoints.repo.ts
      collections.repo.ts
      auto-waypoints.repo.ts
    storage/
      gpx/gpx.service.ts     # GPX import/export via Filesystem
  components/
    PageHeaderToolbar.vue    # Sticky header actions (Debug/Settings)
    MultiSelectWizard.vue    # Reusable multi-select modal (attach items)
  plugins/
    repositories.ts          # builds repos from initAppDb(); installs Pinia plugin
    actions.ts               # provide global actions service
    heading/                 # Capacitor Heading plugin registration
      index.ts
  stores/
    useTrails.ts
    useWaypoints.ts
    useCollections.ts
    usePrefs.ts              # Settings/preferences store (persists via Capacitor Preferences)
  pages/
    GpsPage.vue
    WaypointsPage.vue
    TrailsPage.vue
    CollectionsPage.vue
    SettingsPage.vue
    DebugPage.vue
  router/
    index.ts
  main.ts
  types/
    multi-select.ts          # Wizard config and item types
```

Why data/storage (not top‑level storage)

All persistence concerns live under `data/` (SQL repos and file I/O). This keeps data access and DI/testing patterns in one place.

## Database Schema (normalized, offline‑first)

Conventions

- Column names: snake_case
- Timestamps: ISO‑8601 strings stored as TEXT
- Primary keys: INTEGER autoincrement

Tables (TypeScript view)

```ts
export interface Trail {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Waypoint {
  id: number;
  name: string;
  lat: number;
  lon: number;
  elev_m: number | null;
  description: string | null;
  created_at: string;
}

export interface TrailWaypoint {
  id: number;
  trail_id: number;
  waypoint_id: number;
  position: number;        // 1‑based within trail
  created_at: string;
}

export interface AutoWaypoint {
  id: number;
  trail_id: number;
  name: string | null;
  segment_index: number;   // 1..N-1 between ordered waypoints
  offset_m: number;        // meters from start of segment
  lat: number | null;
  lon: number | null;
  created_at: string;
}

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CollectionWaypoint {
  id: number;
  collection_id: number;
  waypoint_id: number;
  created_at: string;
}

export interface CollectionTrail {
  id: number;
  collection_id: number;
  trail_id: number;
  created_at: string;
}
```

Notes

- Waypoints are independent; trail order is defined in `trail_waypoint` only.
- `auto_waypoint` rows are not shown in user lists; they exist for internal navigation/voice cues.

## Migrations

Implement Kysely bundled migrations (no filesystem I/O):

- `001_trail` → create trail
- `002_waypoint` → create waypoint (with elev_m, no trail_id)
- `003_trail_waypoint` → create link + indexes
- `004_collections` → create collection, collection_waypoint, collection_trail + indexes
- `005_auto_waypoint` → create auto_waypoint + indexes

Run the migrator in both `createAppDb()` and `createTestDb()`.

## DB Factory (DI seam)

- `createAppDb()`: use capacitor-sqlite-kysely + `@capacitor-community/sqlite`; run migrator; return `Kysely<DB>`
- `createTestDb()`: use SqliteDialect + `better-sqlite3(':memory:')`; run migrator; return `Kysely<DB>` (fresh instance every call)
- `initAppDb()`: memoized singleton for app runtime (prevents duplicate connections/migration runs)

## Dependency Injection (Repositories Plugin)

Repositories accept a `Kysely<DB>` (or a transaction instance). Multi‑table operations are transactional where required.

Pinia plugin installs repositories for stores via `pinia.use(() => ({ $repos }))`.

```ts
// plugins/repositories.ts
export async function installRepositories(pinia: Pinia) {
  const db = await initAppDb();
  const repos = markRaw({
    trails: new TrailsRepo(db),
    waypoints: new WaypointsRepo(db),
    collections: new CollectionsRepo(db),
    autoWaypoints: new AutoWaypointsRepo(db)
  });
  pinia.use(() => ({ $repos: repos }));
}

// main.ts
const pinia = createPinia();
await installRepositories(pinia);
```

## Position Semantics (authoritative)

Table: `trail_waypoint`  
Column: `position INTEGER NOT NULL`

Meaning: The 1‑based ordinal slot of a waypoint within a trail’s ordered list (scoped by `trail_id`).

Invariants & Constraints

```
-- Prevent duplicates of the same waypoint in a trail
CREATE UNIQUE INDEX uq_trail_waypoint_pair
  ON trail_waypoint(trail_id, waypoint_id);

-- Guarantee only one item per ordinal slot in a trail
CREATE UNIQUE INDEX uq_trail_waypoint_trail_pos
  ON trail_waypoint(trail_id, position);

-- Fast listings & lookups
CREATE INDEX idx_trail_waypoint_trail      ON trail_waypoint(trail_id);
CREATE INDEX idx_trail_waypoint_wp         ON trail_waypoint(waypoint_id);
CREATE INDEX idx_trail_waypoint_trail_pos  ON trail_waypoint(trail_id, position);
```

Operations (repository behavior)

- Append (no position provided): insert at `MAX(position)+1` for the given trail.
- Insert at position p (shift down `>= p`).
- Reorder a → b (shift intervening range, then set moved row to b).
- Detach (remove link, then close gap by shifting `> removedPos` up by 1).

## Auto Waypoints & Segments

`auto_waypoint` rows belong to a trail and describe internal cues per segment:

- `segment_index` identifies a segment between two adjacent positions (if positions are 1..N, segments are 1..N‑1).
- `offset_m` measures meters from the start of that segment.

If future requirements need auto waypoints to follow specific waypoint pairs across reorders, extend the model (e.g., store `from_waypoint_id`, `to_waypoint_id`) and update during reorders.

## Distance and Bearing (portable algorithms)

High‑level approach (portable across platforms, no SQL trigonometry required):

- Compute a geographic bounding box around a center using meters→degrees and `cos(latitude)` for longitude span.
- Use the bbox to prefilter candidates via index (`idx_waypoint_lat_lon` on `(lat, lon)`).
- Apply a coarse ORDER BY (|Δlat| then cyclic |Δlon|) to bring likely nearest first.
- Compute exact great‑circle distance in JavaScript (Haversine); sort ascending and take the requested `limit`.
- Compute initial bearing in JavaScript using spherical trigonometry; display as degrees 0..360.

Helpers in `src/utils/geo.ts` implement these steps:

- `computeBbox(center, radiusM)` → `{ latMin, latMax, lonMin, lonMax, needsLonFilter, crossing }`
- `sqlCoarseOrderExprsForCenter(center)` → ORDER BY expressions for coarse proximity
- `haversineDistanceMeters(a, b)`
- `initialBearingDeg(a, b)`
- `fetchWaypointsWithDistance(db, center, opts)` → end‑to‑end nearest fetch (bbox + coarse sort + JS distance)

`WaypointsRepo.withDistanceFrom(center, opts)` delegates to `fetchWaypointsWithDistance` for consistent cross‑platform results.

## Storage Services (data/storage)

GPX Service — `gpx.service.ts`

```ts
export function exportTrailToGpx(trailId: number, opts?: { includeAuto?: boolean }): Promise<FileInfo>
export function exportCollectionToGpx(collectionId: number, opts?: { includeAuto?: boolean }): Promise<FileInfo>
export function importGpx(fileUri: string): Promise<{ createdWaypoints: number[]; createdTrails: number[] }>
```

## Ionic UI & Navigation

Router & Shell

- Tabs layout using `IonTabs` with `IonTabBar` (slot="bottom").
- Tabs: GPS, Waypoints, Trails, Collections, Settings, Debug.
- Pages share a sticky header toolbar (`PageHeaderToolbar.vue`) with Settings and Debug buttons.

Pages

### 1) GPS Page (`GpsPage.vue`)

Purpose: Navigation HUD with compass and distance/bearing to the current target; Follow‑Trail mode advances through the selected trail’s waypoints.

Core UI:

- IonHeader with segmented controls: [Waypoint | Trail]
- Trail scope: select a trail; show current/next waypoint and Start/Stop follow
- Waypoint scope: select waypoint
- Telemetry card: compass header, Distance, Bearing; position readout
- FAB “+” marks current position as a waypoint or trail waypoint (based on scope)
- When Trail scope selected and none chosen: callout to “Record New Trail” to create and select a new trail

Compass Usage:

- Uses a Capacitor Heading plugin (`plugins/heading`) to stream heading readings and apply declination via `setLocation`.
- Preference `compassMode` (`'magnetic' | 'true'`) controls whether the UI shows Magnetic North or True North.
- The header text toggles the mode (compact control); values persist via `usePrefsStore`.
- Bearing to target is computed in JS (`initialBearingDeg`) from current GPS position and target coordinate.

### 2) Waypoints Page (`WaypointsPage.vue`)

Purpose: Nearby list, create/edit/delete, attach to trails.

Core UI:

- Search + list, sliding actions (Attach / Rename / Delete)
- Import/Export placeholders
- Live location toggle to auto-sort by proximity

Behavior:

- Create → `WaypointsRepo.create()`; Attach → `WaypointsRepo.attach()` (or `addToTrail()` when creating + attach)
- Delete → `WaypointsRepo.remove()` (cascades link rows)
- Nearby list uses `withDistanceFrom()`

### 3) Trails Page (`TrailsPage.vue`)

Purpose: Manage trails and their ordered waypoints; export to GPX.

Core UI:

- Trails list (Create, Rename, Delete)
- Trail detail card with waypoints list; actions: Export GPX, Add Waypoint, Attach Existing (wizard)
- Waypoint actions: Move Up/Down, Detach

Behavior:

- Reorder persists via `WaypointsRepo.setPosition(...)`
- Add/Attach/Detach call corresponding repo methods
- Delete trail cascades link rows and auto waypoints (repo handles tx)

### 4) Collections Page (`CollectionsPage.vue`)

Purpose: Group waypoints and trails into collections; export as GPX.

Core UI:

- Collections list with create/rename/delete
- Collection detail: Waypoints and Trails sections
- “Add Waypoints/Trails” via Multi‑Select Wizard

Behavior:

- Uses `CollectionsRepo` for membership ops
- Export uses GPX service (default excludes auto waypoints)

### 5) Settings Page (`SettingsPage.vue`)

Purpose: Manage user preferences.

Core UI:

- Units (Metric/Imperial)
- Audio Cues (On/Off)
- Compass Mode (True North vs Magnetic)

Behavior:

- Binds to `usePrefsStore`; persists via Capacitor Preferences with versioned migrations

### 6) Debug Page (`DebugPage.vue`)

Purpose: Diagnostics for development/manual testing.

## DI into Vue

- `installRepositories(pinia)` builds repos from `initAppDb()` and installs a Pinia plugin providing `$repos`.
- Stores access repos via `this.$repos`; no SQL in stores/pages.

## Stores (shape)

- `useTrails` — `list` + `refresh/create/rename/remove`
- `useWaypoints` — `byTrail: Record<number, Waypoint[]>`, `loadForTrail/addToTrail/attach/detach/setPosition/rename/remove/withDistanceFrom`
- `useCollections` — `list` + `contents`, `add/remove { waypoint, trail }`
- `usePrefs` — settings/preferences store (`units`, `compassMode`, `audioCuesEnabled`), persisted via Capacitor Preferences with versioned migrations; hydrated on app startup

## Multi‑Select Wizard (UI component)

Purpose: Reusable modal to select multiple items (waypoints or trails) and commit them in bulk. Used by Collections and Trails pages to add members efficiently.

Location: `src/components/MultiSelectWizard.vue` with types in `src/types/multi-select.ts`

Props/Events:

- Props: `open: boolean`, `config: MultiSelectConfig`
- Emits: `update:open` (boolean), `done(addedCount: number)`

`MultiSelectConfig`:

- `title: string` — modal title
- `getItems(): Promise<MultiSelectItem[]>` — provides items; called on open and search reset
- `commit(ids: number[]): Promise<void>` — invoked when user confirms; perform membership writes
- `ctaLabel?: string` — customize commit button label (default: “Add Selected”)

`MultiSelectItem`:

- `{ id: number; label: string; sublabel?: string | null; disabled?: boolean }`

Behavior:

- Search filter; Select All / Clear controls; disabled items cannot be selected
- Shows loading/empty states; items with checkbox selection
- After commit resolves, emits `done(count)` and closes. Caller shows success action/toast.

## Testing Strategy

Rule of thumb: fake only the layer immediately below the unit under test (prefer fakes over mocks).

- Store tests (unit): inject fake repositories (simple in‑memory fakes). Do not mock Kysely/DB. Assert state transitions.
- Repository tests (integration): use the real in‑memory DB from `createTestDb()`; no mocks of Kysely/driver. Assert SQL behavior, ordering, transactions, cascades.
- DB/Migration tests: fake as little as possible (ideally nothing). Run migrator on a fresh in‑memory DB.

Misc: if targeting web, configure the SQLite plugin’s web/WASM adapter.

## Limitations

- Background location on web is limited; native bridges may be required for robust background tracking.

