# Bold Explorer Style Guide

This guide defines how we organize Vue pages/components, streams, and related code. It keeps files predictable and easy to navigate during rapid iteration and testing.

## Page Organization (Vue SFCs)

Use the following order in `<script setup lang="ts">` blocks:

1) Imports
   - Group by domain: Vue/Ionic → app stores/services → utils/native → components.
   - Keep types with their import (e.g., `import type { Subscription } from 'rxjs'`).
2) Types
   - Local type aliases, interfaces, and enums used only by the page.
3) Stores/services and platform flags
   - Initialize Pinia stores, service singletons, and platform booleans.
4) UI state (refs)
   - Page‑local refs for selections, toggles, etc.
5) Derived state (computed)
   - Computed values used by the template or handlers (e.g., `targetCoord`, `compassText`).
6) Actions/handlers
   - Methods called by the UI (e.g., `recenter`, `markWaypoint`, `toggleFollow`). Prefer small, single‑purpose functions.
7) Lifecycle
   - `onMounted` to start subscriptions/streams; `onBeforeUnmount` to only detach page‑level subscriptions (do not stop global streams unless the page is the lifecycle owner).
8) Watches
   - Reactive side effects with brief comments (e.g., syncing location to compass for declination).
9) Helpers
   - Local helper functions (e.g., permission prompts). Keep pure when possible for testability.

Annotate functions and important refs/computed with short JSDoc docstrings for clarity and IDE help.

## Streams and Providers

- Prefer centralized streams with provider registries (e.g., `locationStream`, `providerRegistry`).
- Pages subscribe via a lightweight store when they only need current state (`useLocation`).
- Do not stop global streams in individual pages unless the page owns the lifecycle (e.g., Debug). Detach local subscriptions on unmount instead.
- Compass:
  - Use `compassStream` based on a provider registry (`native`/`mock`).
  - Switch true vs magnetic north using `compassStream.setTrueNorth()` without restarting.

## Coding Basics

- Language: TypeScript + Vue 3 SFCs (`<script setup lang="ts">`).
- Indentation: 2 spaces; keep lines concise.
- Naming: Components/views use PascalCase (e.g., `GpsPage.vue`).
- Imports: Use alias `@` for `src/` (e.g., `@/pages/GpsPage.vue`).
- Types: Avoid `any`. If needed, keep it localized and document why.
- Lint: Vue 3 essential + TypeScript recommended; fix warnings before submitting.

## RxJS Patterns

- Keep subscriptions local to the page; detach in `onBeforeUnmount`.
- Use `throttleTime`/`debounceTime` for UI updates (1 Hz for compass readouts).
- Keep providers pluggable and observable via a BehaviorSubject‑based registry.

## Accessibility

- Prefer visible, descriptive text for controls.
- Avoid redundant `aria-label` when visible text exists; it overrides accessible names.
- If a nearby text node labels a control, prefer `aria-labelledby`.
- Keep accessible names in sync with UI and avoid labels that change with state.

