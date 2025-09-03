# Repository Guidelines

## Project Structure & Module Organization
- Root app: `bold_explorer/` (Ionic Vue + Vite).
- Source: `bold_explorer/src/` with `components/`, `views/`, `router/`, `theme/`.
- Routing: `bold_explorer/src/router/index.ts` with tab routes (`/tabs/tab1` etc.).
- Public assets: `bold_explorer/public/`.
- Tests: unit in `bold_explorer/tests/unit/` (`*.spec.ts`), e2e in `bold_explorer/tests/e2e/` (`specs/*.cy.ts`).
- Tooling/config: `vite.config.ts`, `tsconfig.json`, `.eslintrc.cjs`, `cypress.config.ts`, `capacitor.config.ts`.

## Build, Test, and Development Commands
Run all commands from `bold_explorer/`:
- `npm run dev`: Start Vite dev server (Ionic Vue app).
- `npm run build`: Type-check with `vue-tsc`, then build with Vite to `dist/`.
- `npm run preview`: Serve the production build locally.
- `npm run test:unit`: Run Vitest unit tests (jsdom env).
- `npm run test:e2e`: Run Cypress end-to-end tests.
- `npm run lint`: Lint with ESLint.

## Coding Style & Naming Conventions
- Language: TypeScript + Vue 3 SFCs (`<script setup lang="ts">`).
- Indentation: 2 spaces; keep lines focused and readable.
- Components/views: PascalCase file names (e.g., `TabsPage.vue`, `Tab1Page.vue`).
- Imports: Use alias `@` for `src/` (e.g., `@/views/Tab1Page.vue`).
- Lint rules: Vue 3 essential + TypeScript recommended; fix warnings before submitting.

## Testing Guidelines
- Unit tests: place alongside repo tests in `tests/unit/`, name `*.spec.ts`.
- E2E tests: add Cypress specs under `tests/e2e/specs/`, name `*.cy.ts`.
- Run locally: `npm run test:unit` and `npm run test:e2e`.
- Aim for meaningful assertions (rendered text, route changes, and component behavior). Keep tests fast and deterministic.

## Commit & Pull Request Guidelines
- Commits: concise, imperative mood; group related changes. Prefer Conventional Commit style (e.g., `feat: add Tab3 content`).
- PRs: include a clear description, screenshots for UI changes, and linked issues (e.g., `Closes #12`).
- Checks: ensure `build`, `lint`, and all tests pass locally before requesting review.

## Security & Configuration Tips
- Do not commit secrets. Use local env files (`.env.local` is ignored) and Capacitor platform configs per environment.
- Mobile builds: Capacitor outputs to `android/` or `ios/` (not tracked). After web build, run native sync as needed.

