  # Bold Explorer (Ionic + Vue 3)

Offline-first waypoint/trail app built with Ionic Vue, Pinia, and SQLite via Capacitor + Kysely.

Bold Explorer lets you create trails and waypoints, work fully offline, and leverage device features (GPS, filesystem, preferences). Data is stored locally using SQLite through Capacitor, with queries written via Kysely for type safety and parameterization.

## Overview
- UI: Ionic Framework components with Vue 3 and Pinia.
- Data: SQLite (Capacitor) with Kysely query builder and bundled migrations.
- Filesystem/Prefs/Sensors: Capacitor Filesystem, Preferences, Geolocation.
- Spec: See WAYPOINT_TRAIL_SPEC.md for the authoritative data model and behavior.

## Repository Layout
- `src/`
  - `db/`: Kysely schema, migrations provider, DB factory (`createAppDb`, `createTestDb`, `initAppDb`).
  - `data/repositories/`: Trails, Waypoints, Collections, Auto-Waypoints (transactional, position logic).
  - `plugins/`: Repositories DI plugin (provides `$repos` to Pinia stores).
  - `stores/`: `useTrails`, `useWaypoints`, `useCollections` (no SQL in stores/pages).
  - `pages/`: `GpsPage.vue`, `WaypointsPage.vue`, `TrailsPage.vue`, `CollectionsPage.vue`.
  - `router/`: Tabbed routes under `/tabs/*`.
- `tests/`: Vitest unit tests and Cypress e2e scaffolding.

## Prerequisites
- Node.js 18+ (20+ recommended) and pnpm via Corepack.
- Capacitor tooling and platform SDKs (Android Studio for Android builds).

## Setup
- Enable pnpm and install deps
  - `corepack enable`
  - `pnpm install`
- Start dev server
  - `pnpm dev`

## Scripts
- `pnpm dev`: Vite dev server (Ionic Vue app).
- `pnpm build`: Type-check with `vue-tsc`, then Vite build to `dist/`.
- `pnpm preview`: Serve the production build locally.
- `pnpm test:unit`: Vitest unit tests (jsdom env).
- `pnpm test:e2e`: Cypress end-to-end tests.
- `pnpm lint`: ESLint (Vue 3 + TS rules).

## Security & Data Safety
- SQL injection hardening: all queries use Kysely parameter binding. The `sqlDistanceMetersForAlias` helper validates SQL aliases (identifier whitelist) and enforces coordinate ranges for safety.
- Coordinate types: use the `LatLng` interface (`src/types/latlng.ts`) for any `{ lat, lon }` inputs. A runtime guard `assertLatLng` ensures lat ∈ [-90, 90] and lon ∈ [-180, 180].
- Insert IDs: repositories retrieve new IDs using `.returning('id')` for reliable behavior across SQLite drivers (e.g., sql.js / jeep-sqlite).

## Android (Capacitor)
- Add Android platform (one-time):
  - `pnpm exec cap add android`
- Build web and sync native:
  - `pnpm build`
  - `pnpm exec cap sync android`
- Open in Android Studio:
  - `pnpm exec cap open android`

Notes
- If you develop in both Windows and WSL, run `pnpm install` separately in each environment so platform-specific optional dependencies (e.g., Rollup native, Capacitor binaries) are correct.

## Testing
- Unit (Vitest): `pnpm test:unit`
- E2E (Cypress): `pnpm test:e2e`

Conventions
- Keep `testing_plan.md` up-to-date; check items as tests are added and passing.
- DB-backed unit tests use an in-memory SQLite created via `createTestDb()`.

DB benchmark scripts
- `pnpm bench:db` runs web mode by default and prints avg/stdev/median/min/max over 5 runs.
- `pnpm bench:db:web -- --runs 10` runs 10 web runs.
- `pnpm bench:db:native -- --runs 10` runs 10 native runs (requires native better-sqlite3; may need elevation to install/build).
- Add `-v` for verbose mode to print full vitest output per run, especially useful when a run is skipped or fails: `pnpm bench:db -- -v --mode web --runs 3`.
- Note: Web (jeep-sqlite) under jsdom requires IndexedDB; if missing, runs will be skipped. A fake in-memory IndexedDB polyfill is wired for tests when installed.

Run only the A/B tests
- Web (jeep-sqlite) only: `pnpm test:ab:web`
- Native (better-sqlite3) only: `pnpm test:ab:native`
- You can also use the bench script to run a single spec repeatedly and optionally grep a specific test name:
  - `pnpm bench:db -- --mode web --runs 5 --spec tests/unit/waypoints.repo.spec.ts --grep "creates and lists"`

Recommended test patterns (from the spec):
- Store tests: inject in-memory fake repositories.
- Repository tests: use `createTestDb()` (in-memory SQLite via Kysely) and assert transactional/ordering behavior.
- A/B timing: A native variant exists at `tests/unit/waypoints.repo.native.spec.ts` using `better-sqlite3(':memory:')`. Run with `DB_NATIVE=1 pnpm -s test:unit` to compare timing vs the default web (jeep-sqlite) path. In restricted sandboxes, native bindings may require elevation to install/build.

## Design Spec
- The full storage-first design is in `WAYPOINT_TRAIL_SPEC.md` (schema, migrations, repo APIs, UI expectations, and acceptance criteria). Implement features and tests to match the spec.

## Troubleshooting
- Rollup optional binary errors across environments: remove `node_modules`, ensure you’re in the target environment (Windows vs WSL), and run `pnpm install` again.
- Native typings: add `@types/better-sqlite3` if TypeScript complains about the driver type in tests.
