# Frontend Structure Refactor (Historical Outcome)

> Status: **superseded on 2026-08-29**. This report records the July 2026 structure pass; it is
> not the current architecture specification or the completion gate for the new overhaul.

Use [current-frontend-architecture.md](current-frontend-architecture.md) as the single current-state
source. Migration policy and cutover state live in
[frontend-migration-rules.md](frontend-migration-rules.md) and
[frontend-ownership-matrix.md](frontend-ownership-matrix.md). The active plan and all superseded
plans are catalogued in [frontend-refactor-plan-index.md](../archive/frontend-refactor-plan-index.md).

## Historical outcome

The July pass kept feature-first lazy routing, CSS Modules, TanStack Query, and existing backend/API
contracts. It removed a temporary `src/pages/**` adapter layer, centralized portions of route-query
ownership, introduced `appShell.ts` and `publicCache.ts` compatibility seams, tightened lint and
static architecture tests, and added an environment-dependent browser smoke harness.

The recorded 176-suite/884-test pass, zero strict-lint result, and production build were observations
from 2026-07-06. They are not proof of current HEAD. Likewise, the historical decision to defer
CRA-to-Vite and the `appShell.ts`/`publicCache.ts` boundaries must not be treated as permanent target
architecture; their current compatibility and removal conditions are tracked in the ownership matrix.
