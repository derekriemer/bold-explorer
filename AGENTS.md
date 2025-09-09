# Repository Guidelines

## Project Structure & Module Organization

- Root app: `bold_explorer/` (Ionic Vue + Vite).
- Source: `bold_explorer/src/` with `components/`, `views/`, `router/`, `theme/`.
- Routing: `bold_explorer/src/router/index.ts` with tab routes (`/tabs/tab1` etc.).
- Public assets: `bold_explorer/public/`.
- Tests: unit in `bold_explorer/tests/unit/` (`*.spec.ts`), e2e in `bold_explorer/tests/e2e/` (`specs/*.cy.ts`).
- Tooling/config: `vite.config.ts`, `tsconfig.json`, `.eslintrc.cjs`, `cypress.config.ts`, `capacitor.config.ts`.

## Build, Test, and Development Commands

Run from `bold_explorer/` and use pnpm:

- Setup: `corepack enable` then `pnpm install`.
- Dependencies: use pnpm only; always commit `pnpm-lock.yaml` for reproducible installs. Do not use npm, Yarn, or Bun without explicit user approval.
- `pnpm dev`: Start Vite dev server (Ionic Vue app).
- `pnpm build`: Type-check with `vue-tsc`, then build to `dist/`.
- `pnpm preview`: Serve the production build locally.
- `pnpm test:unit`: Run Vitest unit tests (jsdom env).
- `pnpm test:e2e`: Run Cypress end-to-end tests.
- `pnpm lint`: Lint with ESLint.

## Coding Style & Naming Conventions

- Language: TypeScript + Vue 3 SFCs (`<script setup lang="ts">`).
- Indentation: 2 spaces; keep lines focused and readable.
- Components/views: PascalCase file names (e.g., `TabsPage.vue`, `Tab1Page.vue`).
- Imports: Use alias `@` for `src/` (e.g., `@/views/Tab1Page.vue`).
- Lint rules: Vue 3 essential + TypeScript recommended; fix warnings before submitting.
- Types: Avoid using any unless absolutely necessary, ask an expert user for typing help if you require it.

## Testing Guidelines

- Unit tests: place under `tests/unit/`, name `*.spec.ts`.
- E2E tests: add Cypress specs under `tests/e2e/specs/`, name `*.cy.ts`.
- Run locally: `pnpm test:unit` and `pnpm test:e2e`.
- Aim for meaningful assertions (rendered text, route changes, and component behavior). Keep tests fast and deterministic.

## Commit & Pull Request Guidelines

- Commits: imperative subject + thorough body. Explain why, what changed, how it was implemented, and how it was verified. Use Conventional Commits (`feat:`, `fix:`, `chore:`) and group related changes.
- Example message:
  - Subject: `fix(router): correct default tab redirect`
  - Body: rationale, key code paths, migration notes, and test evidence (e.g., commands run, screenshots).
- PRs: include a detailed description, screenshots for UI changes, and linked issues (e.g., `Closes #12`).
- Checks: ensure `build`, `lint`, and all tests pass locally before requesting review.

### guidelines for when to run a commit.

- Let the user review the changes you did before committing, ask if the user wants to commit these changes instead of just going out and committing.
- Do _not_ `git addd --all` or `git add -a`, instead, prefer figuring out which files changed and adding the files that are specific to a feature. This is much safer than adding potentially unrelated changes.

### Commit message formatting (preferred)

- Prefer a here‑doc over multiple `-m` flags for multi‑line commit messages. This keeps complex bodies readable and easy to review in the terminal history.

Example:

```
git add -A && git commit -F - <<'MSG'
feat(waypoints): MVP Waypoints page with search and actions

Add search, sliding actions (attach/rename/delete), and toolbar buttons.
Stub GPX import/export pending storage service wiring.

Verification: built with pnpm, manual flows exercised.
MSG
```

## Security & Configuration Tips

- Do not commit secrets. Use local env files (`.env.local` is ignored) and Capacitor platform configs per environment.
- Mobile builds: Capacitor outputs to `android/` or `ios/` (not tracked). After web build, run native sync as needed.

## Agent-Specific Instructions

- When collaborating live with the user, commit after each discrete bug fix, feature, or chore.
- Treat a prompt starting with `BUG:`, `FEAT:`, or `CHORE:` as a strong hint to commit using the matching Conventional Commit type (`fix:`, `feat:`, `chore:`).
- Commit messages must be thorough: imperative subject plus descriptive body covering motivation, approach, side effects, and verification.
- Example:

  - `git add -A && git commit -m "chore: align lint settings with Vue 3" -m "Explain rule changes, affected files, and local test/lint results."`
  - Or using the preferred here‑doc style for multi‑line bodies (recommended):

    ```
    git add -A && git commit -F - <<'MSG'
    chore(lint): align settings with Vue 3

    Explain rule changes, affected files, and local test/lint results.
    MSG
    ```

### Testing TODOs

- Use `testing_plan.md` as the canonical checklist for unit tests.
- Before finishing a task that adds logic, add/extend tests and check the corresponding boxes in `testing_plan.md`.
- Keep the list current; if plans change, update items rather than leaving them unchecked without context.
- Run `pnpm test:unit` locally and ensure green before checking boxes.
