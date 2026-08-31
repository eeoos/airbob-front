# Frontend Migration Rules

> Operational supplement to
> [`current-frontend-architecture.md`](./current-frontend-architecture.md).
> It does not redefine the current architecture or the target plan.

These rules apply to every frontend architecture implementation unit.

## 1. Preserve external contracts

- Do not change backend endpoints, methods, request/response fields, response
  envelope, cookie credentials, or server-authoritative validation.
- Preserve route paths and current query names during parity migration.
- Preserve current user-flow outcomes unless the active plan explicitly assigns
  a defect to the unit.
- Do not mix Airbnb visual redesign with an ownership cutover.

## 2. Characterize before cutover

Before changing a route or mutable workflow:

1. Identify its current production entry and active writer in
   [`frontend-ownership-matrix.md`](./frontend-ownership-matrix.md).
2. Add or identify focused tests for its current behavior, error terminals,
   stale completion, and navigation/storage handoff.
3. Record known behavior gaps separately. A skipped target contract is not
   verified coverage.
4. Confirm which browser data record, Query root, URL codec, or external SDK the
   slice consumes.

## 3. Keep one active writer

- Reservation create, wishlist mutation, review create, payment confirm, image
  delete/upload/save/publish, and logout cleanup must each have one active
  writer at runtime.
- Never shadow-write through the old and new implementation.
- Read compatibility is allowed only for route queries and persisted browser
  records that must survive refresh or rollback.
- Compatibility readers must name their owner, rollback purpose, and removal
  unit in the ownership matrix before they are added.

## 4. Cut over one owner at a time

A slice follows this lifecycle:

```text
characterize
  -> introduce port/adapter
  -> add narrowly scoped read compatibility if required
  -> switch one route or workflow owner
  -> run focused/static/build/browser verification
  -> remove legacy writer and exports
  -> enable strict boundary rule for that slice
```

The repository must remain buildable and behaviorally usable after each owner
switch. A directory move without a production consumer switch is not a
completed migration.

## 5. Enforce dependency direction

Target runtime direction:

```text
app -> route adapters, screens, workflows, features, platform, shared
screens -> workflows, features, shared
workflows -> feature public ports, platform, shared
features -> platform, shared
platform -> shared
```

App composition reaches a feature only through `ui/**`, `ports/**`, or the
`public.ts`/`public.tsx` at the root of its declared ownership scope. This also
applies to independently ratcheted nested scopes such as
`accommodations/detail` and `accommodations/listing-editor`; parent and sibling
scopes do not become public by proximity. Those are deliberate, narrow
composition surfaces; `components`, hooks, models, API adapters, and
compatibility barrels remain private.

Forbidden target edges:

- feature to feature
- workflow to workflow
- screen to screen or screen to app
- platform to feature
- shared to an upper layer
- layout/shell to broad feature barrel

During migration, a legacy edge is allowed only when the ownership matrix names
the exact compatibility reader and its removal unit. Migrated slices have zero
exceptions.

`architecture-ratchet.json` is the single strict-promotion registry. Add a
feature only in its production cutover commit and only when dependency-cruiser,
Knip, and Stylelint all report zero target errors for it. Never add a known
violation snapshot or file ignore to claim that a slice is migrated. The exact
registry accepts only existing feature roots with production source, and CI
compares it with Git history so a live feature cannot be downgraded. It is
monotonic until U22 removes the registered feature root. The exact tool owners
and U3 baseline live in
[`tests/architecture/dependency-rules.md`](../../tests/architecture/dependency-rules.md).
New or renamed feature roots must be registered in their creation/rename commit.
A parent feature cannot claim production source owned by a declared nested
feature, and removal of a retired nested scope must preserve historical
comparison until the root is gone. Feature source must be a real directory tree,
not a symbolic-link alias.

## 6. Assign state to one authority

| State kind                         | Authority                                     |
| ---------------------------------- | --------------------------------------------- |
| Direct-load/history state          | Route codec and URL                           |
| Server resources                   | TanStack Query                                |
| Viewer identity and async lifetime | App session subject/epoch                     |
| Payment/editor transaction         | Typed reducer and workflow command runner     |
| Draft focus/popover/hover state    | Local component or narrow interaction reducer |

Do not mirror Query or URL values into React state. Do not store server data in
browser storage when a reload can safely refetch it.

## 7. Treat browser data as a contract

- Every persisted record must appear in
  [`frontend-browser-data-inventory.md`](./frontend-browser-data-inventory.md).
- A new record requires purpose, minimal field allowlist, PII class, stable
  subject owner where relevant, schema version, creation/expiry, validation,
  cleanup, and logging/artifact policy.
- Browser callback URLs, route state, storage, and dedupe markers are hints, not
  payment authority.
- Do not commit credentials, stable QA identifiers, auth state, payment keys, or
  raw user PII to docs, fixtures, screenshots, traces, or logs.

## 8. Migrate API and integration access through ports

- Platform owns environment exposure, Axios transport, envelope normalization,
  browser storage access, and Google/Daum/Toss global integration.
- A feature adapter owns the backend method/path/query/body and wire mapper for
  its capability.
- Screens and shared UI do not import Axios, QueryClient mutation APIs,
  `process.env`, `sessionStorage`, or browser SDK globals.
- SDK replacement is separate from workflow replacement. Specifically, payment
  behavior moves behind the current Toss v1 adapter before the npm v2 adapter is
  installed as the sole runtime.

## 9. Replace tests only after equivalent protection exists

- Dependency graph rules belong to dependency-cruiser.
- Production reachability and runtime/development dependency classification
  belong to Knip.
- CSS policy belongs to Stylelint.
- Transition-all, z-index, focus-visible, and token-equivalent literal checks
  that the current Stylelint contract does not yet express remain focused Vitest owners
  and consume the same strict feature registry.
- Local code and import feedback belongs to ESLint.
- Mechanical layout of active source, tests, configuration, and compact current
  documentation belongs to Prettier plus EditorConfig. The three wide
  architecture registries remain hand-maintained to prevent whole-row churn;
  generated artifacts, npm's lockfile, local tool state, binary assets, and
  historical plans keep their existing owners.
- ESLint environments are explicit: browser production, Vitest, Playwright,
  Node ESM, and Node CommonJS scopes may not inherit each other's globals.
  CRA/Jest presets and graph/reachability/CSS duplicates are forbidden.
- User behavior belongs to unit/integration/Playwright tests.

A source-string contract can be deleted only after the replacement tool fails
on a representative forbidden fixture and passes on the intended structure.

## 10. Close every implementation unit

Before declaring a slice complete:

- focused behavior tests pass;
- the full static gate and production build pass;
- `npm run verify:architecture` passes with the slice in the strict registry;
- applicable deterministic browser scenarios pass;
- the manifest points to one active route adapter;
- the mutable workflow has one writer;
- the old route, writer, barrel, and compatibility export are removed;
- the migrated slice has no boundary-rule exception;
- Knip retains its canonical entry/project coverage, explicit plugin ownership,
  global dependency scans, and every error-level rule except cycles, which
  remain dependency-cruiser-owned;
- `npm run format:check` passes without formatting excluded owners;
- the ownership matrix and canonical architecture document match production;
- residual live-backend or sandbox scope is marked unverified, not passed.

Do not weaken a gate to make a unit green. If an external fixture or deploy
owner blocks verification, record the missing authority and stop that cutover
without broadening frontend permissions.
