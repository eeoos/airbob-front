# Frontend Structure Refactor

## Decisions

- Keep feature-first structure with routeConfig loading feature route containers directly.
- Keep CSS Modules and tokenized styling before Airbnb visual redesign.
- Keep TanStack Query as the server-state layer.
- Keep backend/API/DB/server contracts unchanged.
- Defer CRA-to-Vite migration until structure and smoke gates are stable.
- Feature-to-feature route composition uses explicit `appShell.ts` seams; public `index.ts` barrels remain route-container-only for routeConfig.
- Route query ownership moved into `src/routes`; feature route-query imports are no longer allowlisted.
- Presentation DTO imports are closed at the API/UI boundary; feature view models own UI shape after Tasks 1-5.

## Verification Gate

- `verify` remains unchanged and continues to run typecheck, no-cache CI tests, and build.
- `verify` remains the default static local gate and still excludes lint and strict smoke.
- `verify:structure` now runs typecheck, the no-cache CI test suite with `--runInBand`, and `lint:strict`.
- GitHub Actions runs Node 20, `npm ci`, typecheck, no-cache Jest in band, build, and `lint:strict`.
- `smoke:frontend:preflight` validates smoke env names, route fixture IDs, browser binary path, frontend URL, and backend reachability without screenshots.
- `verify:design-ready` remains the explicit browser-backed gate because it needs live credentials, stable reservation UIDs, gstack browse, and seeded search data.
- Task 1-6 focused tests/typecheck and strict lint are now actionable pre-redesign gates.
- Task 7 collapsed the temporary `src/pages/**` adapter layer into feature route containers.

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
- Task 6 reduced compact lint from 71 problems to 0 without weakening lint config.
- `lint:strict` is promoted into `verify:structure`; strict lint is also enforced by frontend CI.

## Full Suite Outcome

- `npm run verify:pre-redesign` passed on 2026-07-06 KST after Task 7 collapsed page adapters.
- Full no-cache CI tests passed with 176 suites and 884 tests.
- The production build passed with existing CRA/Browserslist/baseline-browser-mapping freshness warnings.
- No `react-hooks/exhaustive-deps` warning remained for `src/features/search/hooks/useSearchResults.ts`.

## Remaining Follow-Ups

- Run `npm audit` and prioritize direct dependency upgrades.
- Plan CRA-to-Vite/Vitest migration as a separate branch.
- Keep `verify:design-ready` browser-backed because strict smoke still depends on external QA credentials, route UIDs, browser binary, frontend server, and backend server.

## Architecture Freeze

- Freeze criteria now live in `docs/architecture/frontend-architecture-freeze.ko.md`.
- Future frontend structure audits should start from the freeze criteria instead of restarting a full-app audit.
- Design work should proceed screen-by-screen after `npm run verify:structure` passes.
