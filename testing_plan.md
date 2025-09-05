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
