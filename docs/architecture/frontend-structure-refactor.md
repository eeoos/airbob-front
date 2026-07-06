# Frontend Structure Refactor

## Decisions

- Keep feature-first structure and thin page adapters.
- Keep CSS Modules and tokenized styling before Airbnb visual redesign.
- Keep TanStack Query as the server-state layer.
- Keep backend/API/DB/server contracts unchanged.
- Defer CRA-to-Vite migration until structure and smoke gates are stable.
- Feature-to-feature route composition uses explicit `appShell.ts` seams; public `index.ts` barrels remain route-container-only for page adapters.

## Verification Gate

- `verify` remains unchanged and continues to run typecheck, no-cache CI tests, and build.
- `verify` remains the default static local gate and still excludes lint and strict smoke.
- `verify:structure` adds lint visibility after typecheck and the no-cache CI test suite with `--runInBand`, without promoting strict lint into the default verification gate.
- `verify:design-ready` remains the explicit browser-backed gate because it needs live credentials, stable reservation UIDs, gstack browse, and seeded search data.
- Task 1-6 focused tests/typecheck passed before this verification cleanup.
- Full browser smoke remains Task 8.

## Post-Audit Follow-Up

- Search query cache keys are based on preserved search params only.
- Review query keys live under `accommodationQueryKeys`.
- Payment success invalidates guest reservation detail and list caches before redirect.
- Profile-to-reservation composition uses `features/reservations/appShell`.
- Shared UI and MainLayout CSS are enrolled in token ownership checks.
- Smoke artifacts can be redirected to a temp report root during harness tests.

## Lint Outcome

- The full-audit baseline was 81 problems: 74 errors and 7 warnings.
- `npm run lint -- --format compact` failed on 2026-07-06 KST with 70 problems: 64 errors and 6 warnings.
- The remaining lint debt is lower than the audit baseline and is concentrated in `testing-library/no-node-access` (32), `testing-library/render-result-naming-convention` (15), `testing-library/no-wait-for-multiple-assertions` (8), `@typescript-eslint/no-unused-vars` (5), `jest/no-conditional-expect` (4), `testing-library/no-container` (3), `import/first` (2), and `no-template-curly-in-string` (1).
- Broad lint cleanup is intentionally deferred. `lint:strict` is not promoted into `verify` while lint visibility still fails.

## Full Suite Outcome

- `npm run verify:pre-redesign` passed on 2026-07-06 KST after the full-audit hardening follow-ups.
- Full no-cache CI tests passed with 178 suites and 871 tests.
- The production build passed with existing CRA/Browserslist/baseline-browser-mapping freshness warnings.
- No `react-hooks/exhaustive-deps` warning remained for `src/features/search/hooks/useSearchResults.ts`.

## Remaining Follow-Ups

- Run `npm audit` and prioritize direct dependency upgrades.
- Plan CRA-to-Vite/Vitest migration as a separate branch.
- Promote `lint:strict` into `verify` after existing lint debt is closed.
