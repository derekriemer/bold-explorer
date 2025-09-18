# Bold Explorer (Ionic + Vue 3)

Offline‑first waypoint/trail app built with Ionic Vue, Pinia, and SQLite via Capacitor + Kysely.

## Overview

Bold Explorer is a trail and waypoint navigation app for the blind designed to work fully offline.

- GPS HUD with compass (Magnetic/True), bearing and distance to target, and Follow‑Trail mode that advances to the next waypoint.
- “Record New Trail” callout on GPS when Trail scope selected; FAB “+” records waypoints to a trail or standalone based on scope.
- Waypoints: nearby list by distance, search, create/rename/delete, attach to trails.
- Trails: create/rename/delete; manage ordered waypoints (attach existing via wizard, add new, move up/down, detach); export to GPX.
- Collections: group waypoints and trails; bulk add via Multi‑Select Wizard; export to GPX.
- Settings: units, compass mode, audio cues; Debug page for diagnostics. Sticky header provides quick Settings/Debug.
- Tech: Ionic Vue + Pinia; SQLite via Kysely; DI via Pinia plugin; Capacitor for Filesystem/Preferences/Geolocation/Heading. Works on android and organization works on web, in theory works on IOS.

See `WAYPOINT_TRAIL_SPEC.md` for the architecture and detailed behavior.

## Style Guide

For page organization, coding conventions, and RxJS patterns, see the project Style Guide:

- STYLE_GUIDE.md

## Repository Layout

- `src/`
  - components/: Components that are used throughout the app in various pages.
  - composables: Small utilities used in components or pages that make doing things possible, have their own lifecycle hooks from vue.
  - `db/`: Kysely schema, migrations provider, DB factory (`createAppDb`, `createTestDb`, `initAppDb`). Some DB helpers exist for native and web based testing, for various reasons.
  - `data/repositories/`: Trails, Waypoints, Collections, Auto-Waypoints (transactional, position logic).
  - data/streams: streams that can be used to hook into data sources. These are build with rxjs. Providers provide data to a stream using a light weight interface.
  - data/ stores: Storage utilities like file writing, and services for gpx handling.
  - `plugins/`: Repositories DI plugin (provides `$repos` to Pinia stores).
  - `stores/`: `useTrails`, `useWaypoints`, `useCollections` (no SQL in stores/pages).
  - `components/`: common widgets like `PageHeaderToolbar.vue`, `MultiSelectWizard.vue`.
  - `pages/`: `GpsPage.vue`, `WaypointsPage.vue`, `TrailsPage.vue`, `CollectionsPage.vue`, `SettingsPage.vue`, `DebugPage.vue`.
  - `router/`: Tabbed routes under `/tabs/*`.
- `tests/`: Vitest unit tests and Cypress e2e scaffolding.

## Prerequisites

- Node.js 18+ (20+ recommended) and pnpm via Corepack.
- Capacitor tooling and platform SDKs (Android Studio for Android builds).
- Note: The project pins a specific subset of versions for specific packages, capacitor and capacitor/sqlite do not handle the latest versions gracefully.

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

You need to first install an android toolchain. Once installed the following should work.

- The author recommends also installing or making gradel available on the path. This enables pnpm cap build android, or pnpm cap run android to work.
- If not using android studio's runtime tools, you need to make sure you are using the jre android toolchains need, which is _not_ the latest jdk from Oracle. As of September 2025, that's jdk17.

useful commands:

- Build web and sync native:
  - `pnpm build`
  - `pnpm cap sync android`
- Open in Android Studio: (author does not open it this way, but it may work on your platform)
  - `pnpm cap open android`

Notes

- If you develop in both Windows and WSL, run `pnpm install` separately in each environment so platform-specific optional dependencies (e.g., Rollup native, Capacitor binaries) are correct.
- capacitor cli is a dev dep, so that pnpm cap works.

## Testing

- Unit (Vitest): `pnpm test:unit`
- E2E (Cypress): `pnpm test:e2e`
- A test harness exists that lets you benchmark the speed of indexeddb vs. native better-sqlite backed tests for repos. I haven't decided on an approach yet.

Conventions

- Instructions tell agents to keep `testing_plan.md` up-to-date; check items as tests are added and passing. Humans should do this as well.
- DB-backed unit tests use an in-memory SQLite created via `createTestDb()`. Fixtures set up and tear down the db per test lifecycle.

Recommended test patterns (from the spec):

- Often prefer to avoid mocks; fake the next layer down the stack to minimize runtime and provide data consistency.
- Store tests: inject in-memory fake repositories.
- Repository tests: use `createTestDb()` (in-memory SQLite via Kysely) and assert transactional/ordering behavior.

## Design Spec

- The design is in `WAYPOINT_TRAIL_SPEC.md` (schema, migrations, repo APIs, UI expectations). Update the spec to reflect the latest code as the project evolves.

## Troubleshooting

- Rollup optional binary errors across environments: remove `node_modules`, ensure you’re in the target environment (Windows vs WSL), and run `pnpm install` again.
- We need to pin some specific versions to get capacitor to work correctly, ensure your package manager handles the overrides.
- Native typings: If working on a test using native db, add `@types/better-sqlite3` if TypeScript complains about the driver type in tests.
