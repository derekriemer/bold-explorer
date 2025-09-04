  # Bold Explorer (Ionic + Vue 3)

Offline-first waypoint/trail app built with Ionic Vue, Pinia, and SQLite via Capacitor + Kysely.

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

Recommended test patterns (from the spec):
- Store tests: inject in-memory fake repositories.
- Repository tests: use `createTestDb()` (in-memory SQLite via Kysely) and assert transactional/ordering behavior.

## Design Spec
- The full storage-first design is in `WAYPOINT_TRAIL_SPEC.md` (schema, migrations, repo APIs, UI expectations, and acceptance criteria). Implement features and tests to match the spec.

## Troubleshooting
- Rollup optional binary errors across environments: remove `node_modules`, ensure you’re in the target environment (Windows vs WSL), and run `pnpm install` again.
- Native typings: add `@types/better-sqlite3` if TypeScript complains about the driver type in tests.

