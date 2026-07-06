# Frontend Structure Refactor

## Decisions

- Keep feature-first structure and thin page adapters.
- Keep CSS Modules and tokenized styling before Airbnb visual redesign.
- Keep TanStack Query as the server-state layer.
- Keep backend/API/DB/server contracts unchanged.
- Defer CRA-to-Vite migration until structure and smoke gates are stable.

## Verification Gate

- `verify` remains unchanged and continues to run typecheck, no-cache CI tests, and build.
- `verify:structure` adds lint visibility after typecheck and focused CI tests without promoting strict lint into the default verification gate.
- Task 1-6 focused tests/typecheck passed before this verification cleanup.
- Full browser smoke remains Task 8.

## Lint Outcome

- `npm run lint` failed on 2026-07-06 KST with 81 problems: 74 errors and 7 warnings.
- The remaining lint debt appears pre-existing and is concentrated in test lint rules such as `testing-library/no-node-access`, `testing-library/no-wait-for-multiple-assertions`, `testing-library/render-result-naming-convention`, `jest/no-conditional-expect`, and `import/first`, plus a small set of unused-variable / hook-dependency warnings.
- Broad lint cleanup is intentionally deferred. Task 7 only adds visibility scripts and does not promote `lint:strict` into `verify`.

## Full Suite Outcome

- `npm run test:ci:no-cache -- --runInBand` failed on 2026-07-06 KST with 4 failed suites, 11 failed tests, and 171 passed suites.
- The failure appears to be a pre-existing/base full-suite failure from base `6222794`; Task 7 did not change the failing feature test files.

## Remaining Follow-Ups

- Run `npm audit` and prioritize direct dependency upgrades.
- Plan CRA-to-Vite/Vitest migration as a separate branch.
- Promote `lint:strict` into `verify` after existing lint debt is closed.
