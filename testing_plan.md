# Testing Plan TODOs

Use this checklist to build out unit tests incrementally. Prefer fast, deterministic tests. After writing a test suite, check the box and include a brief note in the corresponding commit message. Run tests with `pnpm test:unit`.

Guidance for contributors/agents:

- Keep this list up-to-date. If scope changes, edit items instead of adding redundant ones.
- Check boxes once tests are implemented and passing locally.
- Target pure logic first, then mocked plugins, then UI as feasible.

## Phase 1: Pure Logic

- [x] `tests/unit/utils/geo.spec.ts`
  - [x] haversineDistanceMeters: identical points = 0 m
  - [x] haversineDistanceMeters: ~111,320 m per 1° latitude (tolerance)
  - [x] haversineDistanceMeters: symmetry A→B = B→A
  - [x] initialBearingDeg: cardinal/quadrant cases, wrap to [0,360)
  - [x] deltaHeadingDeg: wrap-around and sign correctness (e.g., 350→10 = -20; 10→350 = 20)
  - [x] security: `sqlDistanceMetersForAlias` rejects unsafe alias strings
- [x] `tests/unit/utils/locationParam.spec.ts`
  - [x] parseCenterParam: valid "lat,lon" parsing
  - [x] parseCenterParam: array input picks first
  - [x] parseCenterParam: rejects invalid formats and ranges
- [x] `tests/unit/services/actions.service.spec.ts`
  - [x] show: defaults, durable vs timed (durationMs null)
  - [x] dismiss: removes and calls onDismiss
  - [x] undo: only when allowed; calls onUndo; removes from undoStack
  - [x] undoLast: LIFO; clears both stacks appropriately
  - [x] clearAll: empties actions and undoStack

## Phase 2: Composables (no native deps)

- [ ] `tests/unit/composables/useFollowTrail.spec.ts`
  - [ ] start/stop: active flag, announcement content
  - [ ] advance when within threshold; no advance when beyond
  - [ ] end-of-trail: announces completion and deactivates
  - [ ] reacts to waypoint array changes without inconsistency

## Phase 3: Repositories (in-memory DB via createTestDb)

- [ ] `tests/unit/data/waypoints.repo.spec.ts` (extend)
  - [ ] addToTrail: returns position; appends when no position given
  - [ ] setPosition: moving up/down reshuffles neighbors; no gaps/dupes
  - [ ] detach: compacts positions and removes relation
  - [ ] forTrail: ordered by position
  - [ ] forLocation: bbox filter; optional distance ordering; limit
- [ ] `tests/unit/data/collections.repo.spec.ts`
  - [ ] add/remove waypoint and trail; contents() reflects state and order

### Running DB-backed unit tests

- Some repository tests require an in-memory SQLite database.
- In constrained sandboxes, native `better-sqlite3` may be unavailable; those tests are skipped by default.
- To enable them locally, run with `DB_NATIVE=1`:
  - Example: `DB_NATIVE=1 pnpm test:unit --run`
- A reusable fixture is provided at `tests/unit/fixtures/test-db.ts` which creates a fresh `:memory:` DB in `beforeEach` and destroys it in `afterEach` for isolation.
- If you prefer a pure web approach, we can switch fixtures to use jeep-sqlite with `sql.js` under a jsdom environment; ask to enable this path.
 - Performance note: Native `better-sqlite3` runs faster than the web (jeep-sqlite + sql.js) path. For performance-sensitive tests, consider running the native variant (may require elevated permissions to install native bindings in some environments). An example native spec is provided at `tests/unit/waypoints.repo.native.spec.ts`.

## Phase 4: Lightweight Component

- [ ] `tests/unit/components/PositionReadout.spec.ts`
  - [ ] lat/lon precision formatting
  - [ ] elevation and accuracy unit conversions
  - [ ] fallback “—” when missing data

## Phase 5: Mocked Capacitor

- [ ] `tests/unit/composables/useCompass.spec.ts`
  - [ ] requestPermission: granted/denied flows
  - [ ] orientation listener: heading normalization [0..360)
  - [ ] stop: removes listener
- [ ] `tests/unit/composables/useGeolocation.spec.ts` (optional / later)
  - [ ] start/stop: watchPosition wiring and clearWatch
  - [ ] recenter: sets current; handles options and errors gracefully

Notes

- Defer e2e tests until core flows stabilize.
- For mocked Capacitor modules, stub methods on the plugin objects and restore after tests.
