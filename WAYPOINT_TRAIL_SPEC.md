Waypoint/Trail App — Storage‑First Design Spec (Ionic Required)

This document defines the architecture, data model, and UI for an offline‑first waypoint/trail application built with Vue 3 + Pinia + Ionic and SQLite (Capacitor) via Kysely. It is intended for contributors and code‑generating agents. Follow the structure and acceptance criteria precisely.

Tech Stack (authoritative)

UI: Vue 3, Ionic Framework components (mandatory), Pinia

Database: SQLite via @capacitor-community/sqlite with Kysely dialect capacitor-sqlite-kysely

Query Builder & Migrations: Kysely (bundled migrations)

Filesystem: @capacitor/filesystem (GPX import/export, backups)

Preferences: @capacitor/preferences

Location/Sensors: @capacitor/geolocation (and platform compass APIs as needed)

Testing: Vitest + better-sqlite3 (in-memory SQLite)

Dependency Injection (DI) is mandatory at:

DB layer (app DB vs. test DB)

Repository layer (stores receive repos via provide/inject through a composable)

Directory Layout (fixed)

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
      prefs/preferences.service.ts
  plugins/
    repositories.ts          # builds repos from initAppDb(), installs Pinia plugin
  stores/
    useTrails.ts
    useWaypoints.ts
    useCollections.ts
  pages/
    GpsPage.vue
    WaypointsPage.vue
    TrailsPage.vue
    CollectionsPage.vue
  router/
    index.ts
  main.ts

Why data/storage (not top‑level storage)

All persistence concerns live under data/ (SQL repos, file I/O, preferences). This keeps data access and DI/testing patterns in one place.

Database Schema (normalized, offline‑first)

Conventions

Column names: snake_case

Timestamps: ISO‑8601 strings stored as TEXT

Primary keys: INTEGER autoincrement

Tables

trail(id INTEGER PK, name TEXT NOT NULL, description TEXT NULL, created_at TEXT NOT NULL)

waypoint (id INTEGER PK, name TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, elev_m REAL NULL, description TEXT NULLm created_at TEXT NOT NULL)— elev_m = elevation in meters (nullable)

trail_waypoint (ordered link of waypoints inside a trail)(id INTEGER PK, trail_id INTEGER NOT NULL REFERENCES trail(id), waypoint_id INTEGER NOT NULL REFERENCES waypoint(id), position INTEGER NOT NULL, created_at TEXT NOT NULL)Indexes: (trail_id), (waypoint_id), (trail_id, position)

auto_waypoint (non‑viewable, belongs to a trail; internal cues)(id INTEGER PK, trail_id INTEGER NOT NULL REFERENCES trail(id), name TEXT NULL, segment_index INTEGER NOT NULL, offset_m REAL NOT NULL, lat REAL NULL, lon REAL NULL, created_at TEXT NOT NULL)Indexes: (trail_id), (trail_id, segment_index)— segment_index: 1‑based segment between ordered waypoints of the trail (between positions k and k+1)— offset_m: meters from the start of that segment— lat/lon optional (may be computed or cached)

collection(id INTEGER PK, name TEXT NOT NULL, description TEXT NULL, created_at TEXT NOT NULL)

collection_waypoint(id INTEGER PK, collection_id INTEGER NOT NULL REFERENCES collection(id), waypoint_id INTEGER NOT NULL REFERENCES waypoint(id), created_at TEXT NOT NULL)Indexes: (collection_id), (waypoint_id)

collection_trail(id INTEGER PK, collection_id INTEGER NOT NULL REFERENCES collection(id), trail_id INTEGER NOT NULL REFERENCES trail(id), created_at TEXT NOT NULL)Indexes: (collection_id), (trail_id)

Notes

Waypoints are independent; trail order is defined in trail_waypoint only.

auto_waypoint rows are not shown in standard UI lists; they exist for internal navigation/voice cues.

Migrations

Implement Kysely bundled migrations (no filesystem I/O):

001_trail → create trail

002_waypoint → create waypoint (with elev_m, no trail_id)

003_trail_waypoint → create link + indexes

004_collections → create collection, collection_waypoint, collection_trail + indexes

005_auto_waypoint → create auto_waypoint + indexes

Run the migrator in both createAppDb() and createTestDb().

DB Factory (DI seam)

createAppDb(): use capacitor-sqlite-kysely + @capacitor-community/sqlite; run migrator; return Kysely<DB>

createTestDb(): use SqliteDialect + better-sqlite3(':memory:'); run migrator; return Kysely<DB>. Every call produces a new DB, DO NOT MEMOIZE TEST INFRA.

initAppDb(): memoized singleton for app runtime (prevents duplicate connections/migration runs)

Repository Layer (DI into stores; no Vue imports)

Repositories accept a Kysely<DB> (or a transaction instance). Multi‑table operations must be transactional.

TrailsRepo

all(): Promise<Trail[]>

create(input: { name: string; description?: string | null }): Promise<number>

rename(id: number, name: string): Promise<void>

remove(id: number): Promise<void>Transactional cascade: delete dependent rows in trail_waypoint, collection_trail, auto_waypoint.

WaypointsRepo

all(): Promise<Waypoint[]>

create(input: { name: string; lat: number; lon: number; elev_m?: number | null }): Promise<number>

addToTrail(input: { trailId: number; name: string; lat: number; lon: number; elev_m?: number | null; position?: number }): Promise<{ waypointId: number; position: number }>Transactional: insert waypoint + link; if position omitted, append after current max

attach(trailId: number, waypointId: number, position?: number): Promise<number> (append if null)

forTrail(trailId: number): Promise<Waypoint[]> *(ordered by trail_waypoint.position; ****excludes ***auto_waypoint**********************)

setPosition(trailId: number, waypointId: number, position: number): Promise<void>

detach(trailId: number, waypointId: number): Promise<void>

rename(id: number, name: string): Promise<void>

remove(id: number): Promise<void>Transactional cascade: delete from trail_waypoint, collection_waypoint, then waypoint.

forLocation(center: { lat: number; lon: number }, radiusM: number, opts?: { trailId?: number; limit?: number; includeDistance?: boolean }): Promise<Array<Waypoint & { distance_m?: number }>>Returns waypoints within radius (meters), optionally restricted to a trail, sorted by ascending distance when includeDistance=true.

AutoWaypointsRepo

forTrail(trailId: number): Promise<AutoWaypoint[]>

create(input: { trailId: number; name?: string | null; segment_index: number; offset_m: number; lat?: number | null; lon?: number | null }): Promise<number>

rename(id: number, name: string | null): Promise<void>

setOffset(id: number, segment_index: number, offset_m: number): Promise<void>

remove(id: number): Promise<void>

CollectionsRepo

all(): Promise<Collection[]>

create(input: { name: string; description?: string | null }): Promise<number>

addWaypoint(collectionId: number, waypointId: number): Promise<void>

removeWaypoint(collectionId: number, waypointId: number): Promise<void>

addTrail(collectionId: number, trailId: number): Promise<void>

removeTrail(collectionId: number, trailId: number): Promise<void>

contents(collectionId: number): Promise<{ waypoints: Waypoint[]; trails: Trail[] }> (ordered waypoints returned via appropriate joins)

Position Semantics (authoritative)

Table: trail_waypointColumn: position INTEGER NOT NULLMeaning: The 1‑based ordinal slot of a waypoint within a trail’s ordered list (scoped by trail_id).

Invariants & Constraints

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

Operations (required repo behavior)

All are transactional, and positions must be contiguous (1..N) after each operation.

Append (no position provided): compute position = 1 + COALESCE(MAX(position), 0) for the given trail_id and insert.

**Insert at position **p (shift down >= p):

UPDATE trail_waypoint
SET position = position + 1
WHERE trail_id = :trailId AND position >= :p;

INSERT INTO trail_waypoint(trail_id, waypoint_id, position, created_at)
VALUES (:trailId, :waypointId, :p, :now);

Reorder from a → b:

-- If a < b (moving down): pull [a+1..b] up by 1
UPDATE trail_waypoint
SET position = position - 1
WHERE trail_id = :trailId AND position > :a AND position <= :b;

-- If a > b (moving up): push [b..a-1] down by 1
UPDATE trail_waypoint
SET position = position + 1
WHERE trail_id = :trailId AND position >= :b AND position < :a;

-- Place the moved row at b
UPDATE trail_waypoint
SET position = :b
WHERE trail_id = :trailId AND waypoint_id = :waypointId;

Detach (remove link & close gap):

-- Fetch removed position first (SELECT position ...)
DELETE FROM trail_waypoint
WHERE trail_id = :trailId AND waypoint_id = :waypointId;

UPDATE trail_waypoint
SET position = position - 1
WHERE trail_id = :trailId AND position > :removedPos;

Why not SQLite auto‑increment per trail?

SQLite’s AUTOINCREMENT applies only to a single INTEGER PRIMARY KEY and cannot maintain per‑group sequences like (trail_id). Triggers are possible, but to keep logic explicit and portable, repositories compute next position inside a transaction (append = MAX(position)+1).

Kysely append sketch:

const next = await trx
  .selectFrom('trail_waypoint')
  .select(({ fn }) => fn.coalesce(fn.max('position'), 0).as('maxpos'))
  .where('trail_id', '=', trailId)
  .executeTakeFirst()
  .then(r => Number(r?.maxpos ?? 0) + 1)

await trx.insertInto('trail_waypoint')
  .values({ trail_id: trailId, waypoint_id, position: next, created_at: nowIso() })
  .execute()

Auto Waypoints & Segments

Table: auto_waypoint— segment_index identifies a segment between two adjacent positions in a trail (if positions are 1..N, segments are 1..N‑1).— offset_m is the distance (meters) from the start of that segment.— Reorders can change which pair of waypoints a segment_index refers to; accepted by design for simplicity and speed.

If future requirements need auto waypoints to follow specific waypoint pairs across reorders, extend the model (e.g., store from_waypoint_id, to_waypoint_id) and update during reorders.

Nearby Search (Haversine)

API (WaypointsRepo)

forLocation(
  center: { lat: number; lon: number },
  radiusM: number,
  opts?: { trailId?: number; collection_id?: number; limit?: number; includeDistance?: boolean }
): Promise<Array<Waypoint & { distance_m?: number }>>

Implementation approach

Bounding box prefilter (cheap rectangle) in app code:

degLat = radiusM / 111320

degLon = radiusM / (111320 * cos(centerLatRad))

Prefilter: WHERE lat BETWEEN lat0−degLat AND lat0+degLat AND lon BETWEEN lon0−degLon AND lon0+degLon

Precise distance with Haversine in SQL for final filter & sort.

Constants

RAD = 0.017453292519943295 (deg→rad)

EARTH_R = 6371000 (meters)

Recommended index

CREATE INDEX idx_waypoint_lat_lon ON waypoint(lat, lon);

Kysely/raw SQL sketch (with optional trail filter):

const RAD = 0.017453292519943295
const R   = 6371000

// optional INNER JOIN to restrict to a trail
const base = db.selectFrom('waypoint as w')
  .$if(!!opts?.trailId, qb =>
    qb.innerJoin('trail_waypoint as tw', 'tw.waypoint_id', 'w.id')
      .where('tw.trail_id', '=', opts!.trailId!)
  )
  // bounding box prefilter
  .where('w.lat', '>=', lat0 - degLat)
  .where('w.lat', '<=', lat0 + degLat)
  .where('w.lon', '>=', lon0 - degLon)
  .where('w.lon', '<=', lon0 + degLon)

// Haversine (meters)
const distanceExpr = sql<number>`
  ${2 * R} * asin(
    sqrt(
      pow(sin((${RAD} * (w.lat - ${lat0})) / 2.0), 2) +
      cos(${RAD} * ${lat0}) * cos(${RAD} * w.lat) *
      pow(sin((${RAD} * (w.lon - ${lon0})) / 2.0), 2)
    )
  )
`.as('distance_m')

const rows = await base
  .select([
    'w.id', 'w.name', 'w.lat', 'w.lon', 'w.elev_m', 'w.created_at',
    ...(opts?.includeDistance ? [distanceExpr] : []),
  ])
  .$if(!!opts?.includeDistance, qb => qb.orderBy('distance_m', 'asc'))
  .$if(!opts?.includeDistance, qb => qb.orderBy('w.id', 'asc'))
  .execute()

const nearby = opts?.includeDistance
  ? rows.filter(r => r.distance_m! <= radiusM)
  : rows // or compute client‑side if distances weren’t selected

return opts?.limit ? nearby.slice(0, opts.limit) : nearby

Storage Services (data/storage)

GPX Service — gpx.service.ts

exportTrailToGpx(trailId: number, opts?: { includeAuto?: boolean }): Promise<FileInfo>Default: includeAuto = false

exportCollectionToGpx(collectionId: number, opts?: { includeAuto?: boolean }): Promise<FileInfo>

importGpx(fileUri: string): Promise<{ createdWaypoints: number[]; createdTrails: number[] }>Transactional: insert waypoints/trails and link rows

Preferences Service — preferences.service.ts

getUnits()/setUnits(value: "metric" | "imperial")

getCompassMode()/setCompassMode(value: "magnetic" | "true")

getAudioCuesEnabled()/setAudioCuesEnabled(value: boolean)

Ionic UI & Navigation

Router & Shell

Tabs layout using IonTabs with IonTabBar slot="bottom" and large touch targets (≥48×48 dp).Tabs: GPS, Waypoints, Trails, Collections.

Each page uses standard IonPage → IonHeader (IonToolbar, Title) → IonContent.

Accessibility (required)

Every actionable control has accessible names/labels (programmatic, not visual‑only).

Avoid placeholder‑only forms; use aria-label or ion-label.

Ensure keyboard operability and visible focus indicators.

Screen‑reader friendly announcements for critical events (e.g., “Next waypoint updated”).

Respect user preferences (audio cues, units) via Preferences service.

Pages

1) GPS Page (GpsPage.vue)

Purpose: Navigation HUD with compass and distance/heading to current selection; “Follow Trail” mode shows next waypoint cues.

Core UI (Ionic):

IonHeader with segmented controls: [Waypoint | Trail] selection scope

Selection pickers:

Waypoint: IonItem + IonSelect (searchable list optional)

Trail: IonItem + IonSelect + current/next waypoint readout

Compass/telemetry:

Large readouts in IonCard blocks: Heading, Bearing, Distance, Delta (heading − bearing)

Actions:

IonButton Start Following / Stop

IonToggle Audio Cues

IonButton Recenter/Calibrate

Optional FAB (IonFab) for quick Mark waypoint (creates a waypoint at current location and optionally attaches to selected trail)

Behavior:

Uses Geolocation to update heading/location.

In “Follow Trail,” computes current segment from trail_waypoint order; auto‑advance to next waypoint when within threshold; announce changes.

Does not display or edit auto_waypoint rows; internal cues may be used for audio timing.

Data:

Reads useWaypoints (selected waypoint), useTrails (selected trail, ordered waypoints). Preferences: units, compass mode, audio cues.

2) Waypoints Page (WaypointsPage.vue)

Purpose: Browse, create, edit waypoints; attach/detach to trails; export/import via GPX.

Core UI (Ionic):

IonSearchbar (filter by name)

IonList of waypoints (name, coords, optional elevation)

IonItemSliding with IonItemOptions:

Attach to Trail (picker)

Rename

Delete

Toolbar actions:

Add Waypoint (uses current GPS or manual entry)

Import GPX

Export Selected (optional)

Behavior:

Create → WaypointsRepo.create()

Attach → WaypointsRepo.attach() (or addToTrail() when creating + attach)

Delete → WaypointsRepo.remove() (cascades link rows)

Import/Export uses GPX service.

3) Trails Page (TrailsPage.vue)

Purpose: Manage trails and the ordered sequence of waypoints.

Core UI (Ionic):

Trail list: IonList with Create, Rename, Delete

Trail detail (split view or modal):

Ordered waypoints as IonReorderGroup + IonItem with handle to drag (updates position)

Add existing waypoint (picker) or Add New & Attach

Detach waypoint

Optional: show Auto Waypoints count; manage in a separate management modal

Behavior:

Reorder persists via WaypointsRepo.setPosition(...)

Add/Attach/Detach call corresponding repo methods

Delete trail cascades link rows and auto waypoints (repo handles tx)

4) Collections Page (CollectionsPage.vue)

Purpose: Group waypoints and trails into collections; export collections as GPX.

Core UI (Ionic):

Collections list with create/rename/delete

Collection detail:

Two lists (segments or tabs): Waypoints and Trails

Add/remove members

Export Collection (GPX)

Behavior:

Uses CollectionsRepo for membership ops

Export uses GPX service (default excludes auto waypoints)

Do not implement Favorites yet. Intentionally excluded from this version.

DI into Vue

Plugin (plugins/repositories.ts):await initAppDb() → create repo instances → pinia.use(() => ({ $repos: repos }))

Stores access repos via this.$repos; no SQL in stores/pages

Stores (shape)

useTrails — list + refresh/create/rename/remove

useWaypoints — byTrail: Record<number, Waypoint[]>, loadForTrail/addToTrail/detach/setPosition/rename/remove

useCollections — list + contents, add/remove {waypoint, trail}

Testing Strategy

Rule of thumb: fake only the layer immediately below the unit under test (prefer fakes over mocks).

Store tests (unit): inject fake repositories (simple in‑memory fakes). Do not mock Kysely/DB. Assert state transitions.

Repository tests (integration): use the real in‑memory DB from createTestDb(); no mocks of Kysely/driver. Assert SQL behavior, ordering, transactions, cascades.

DB/Migration tests: fake as little as possible (ideally nothing). Run migrator on a fresh in‑memory DB; optionally simulate legacy waypoint.trail_id for the upgrade.

Suggested helpers

test/utils/db.ts — makeDb(seed_data) (wraps createTestDb()), withRollback(db, fn) (transaction that forces rollback)

test/fakes/*.ts — fakeTrailsRepo(), fakeWaypointsRepo(), fakeCollectionsRepo(), fakeAutoWaypointsRepo() for store tests

Installation Contracts

p
npm add kysely @capacitor-community/sqlite capacitor-sqlite-kysely @capacitor/filesystem @capacitor/preferences @capacitor/geolocation
pnpm add -D better-sqlite3 vitest @types/node

Assumptions:

Capacitor initialized; iOS/Android platforms added.

If targeting web, configure the SQLite plugin’s web/WASM adapter.

Acceptance Criteria

Build & Types

Project compiles; repositories and DB factory contain no Vue imports.

DB

initAppDb() memoized singleton; createTestDb() fresh in‑memory instance.

Migrations run in both environments.

Schema

waypoint has elev_m (nullable) and no trail_id.

trail_waypoint defines ordering with required indexes and uniqueness constraints.

auto_waypoint exists with segment_index, offset_m, optional lat/lon; excluded from standard user lists.

Collections tables and indexes exist.

Repositories

Methods implemented as specified; multi‑table operations transactional.

Position logic maintained by the repo (append/insert/reorder/detach) keeping per‑trail positions contiguous; SQLite is not relied upon for per‑trail sequencing.

WaypointsRepo.forTrail() returns only user waypoints in position order.

WaypointsRepo.forLocation() implements bounding‑box prefilter + Haversine; supports trailId, limit, includeDistance; idx_waypoint_lat_lon exists.

Storage Services

GPX export/import works; exports exclude auto waypoints by default (opt‑in flag exists).

Preferences getters/setters persist typed values.

Ionic UI

Four pages implemented with Ionic components: GPS, Waypoints, Trails, Collections.

Bottom tab bar present; tap targets ≥48×48 dp.

GPS page shows heading, bearing, distance, follow‑trail mode with next‑waypoint advancement and accessible announcements.

Stores

Stores access repos via this.; no SQL in stores/pages.

useWaypoints.addToTrail() refreshes byTrail[trailId] after writes.

Tests

Store tests use fakes for repos (no DB).

Repository tests use the real in‑memory DB (no mocks).

DB/migration tests fake as little as possible.

Non‑Goals

Favorites not implemented in this version.

