# Airbob Frontend Architecture

> Status: canonical current-state source of truth  
> Baseline: `07a1fdf` (`fix(frontend): harden cross-feature state boundaries`)  
> Current migration state: U4 platform foundation cut over
> Recorded: 2026-08-29 KST

This document describes the frontend that is reachable in production at the
baseline above. It is the only document that defines the current architecture.
The migration plan describes the target; the ownership matrix records cutover
state; older freeze and plan documents are historical evidence only.

## Scope and invariants

- The frontend is a React browser SPA backed by the existing `/api/v1` REST
  contract.
- Backend endpoints, request/response fields, cookie semantics, database, and
  server authorization are outside frontend ownership.
- Current route paths and user-visible flows are compatibility contracts during
  the architecture migration.
- There must be one active writer for every mutable workflow.
- A migrated slice switches to one new writer and removes the old writer in the
  same atomic cutover before the slice is considered complete. A read-only
  compatibility surface may remain only when the ownership matrix names its
  rollback purpose and later removal unit.
- Airbnb visual redesign begins only after the architecture design-entry gate;
  it is not part of the structure migration.

## Runtime composition

```text
src/index.tsx
  ErrorBoundary
    QueryProvider
      AuthProvider
        App
          Router
            MainLayout + Header
              lazy feature route
            bare lazy route
```

Current owners:

| Concern | Current owner | Notes |
| --- | --- | --- |
| React root and providers | `src/index.tsx` | Provider ordering is fixed by the root. |
| Server-state client | `src/platform/query/createQueryClient.ts`, exposed through `src/query/**` | One process-wide QueryClient; the legacy import remains a facade. |
| Authentication | `src/contexts/AuthContext.tsx`, `src/features/auth/**` | Boolean-facing context backed by `/auth/me`. |
| Routing and shell metadata | `src/routes/**` | Paths, auth, layout, header metadata and lazy entries are centralized. |
| Main application shell | `src/layouts/MainLayout.tsx`, `src/layouts/AppHeader/**` | Header imports feature app-shell seams. |
| API transport and envelope | `src/platform/http/**`, exposed through `src/api/client.ts` and `src/api/response.ts` | One credentialed Axios instance; migrated and legacy error surfaces are intentionally separate. |
| Browser platform boundary | `src/platform/config|storage|integrations|assets/**` | Owns public environment input, browser storage access, external SDK globals/scripts, and image URL resolution. |
| Domain server state and orchestration | `src/features/**` | TanStack Query hooks, route containers, mappers, and workflow hooks coexist. |
| Domain-free UI | `src/shared/ui/**` | Tested primitives; adoption is incomplete. |
| Shared styling values | `src/styles/tokens.css` | CSS Modules still contain feature-local literals. |
| Browser smoke | `scripts/smoke/frontend-smoke.mjs` | Live backend, browser, credentials, and stable IDs are external prerequisites. |
| Deterministic browser characterization | `playwright.config.ts`, `tests/e2e/**` | Loopback production app plus an exact synthetic HTTPS `.invalid` API origin, synthetic session/API fixtures, and default-deny network. |
| Static architecture ratchets | `.dependency-cruiser.cjs`, `knip.json`, `stylelint.config.mjs`, `architecture-ratchet.json` | Target/migrated surfaces fail on graph, reachability, and design-policy regressions while measured legacy debt remains visible. |

## Route inventory

`src/routes/routeDefinitions.ts` owns route policy and
`src/routes/routeConfig.tsx` owns the exhaustive direct lazy mapping.

| ID | Path | Auth | Shell | Current production module |
| --- | --- | --- | --- | --- |
| home | `/` | public | main | `src/features/home/HomeRoute.tsx` |
| search | `/search` | public | main/search header | `src/features/search/SearchRoute.tsx` |
| accommodation-detail | `/accommodations/:id` | public | main | `src/features/accommodations/AccommodationDetailRoute.tsx` |
| accommodation-confirm | `/accommodations/:id/confirm` | protected | main | `src/features/reservations/ReservationConfirmRoute.tsx` |
| accommodation-edit | `/accommodations/:id/edit` | protected | main | `src/features/accommodations/edit/AccommodationEditRoute.tsx` |
| wishlist | `/wishlist` | protected | main | `src/features/wishlist/WishlistRoute.tsx` |
| profile | `/profile` | protected | main | `src/features/profile/ProfileRoute.tsx` |
| host-reservation-detail | `/profile/host/reservations/:reservationUid` | protected | main | `src/features/reservations/HostReservationDetailRoute.tsx` |
| reservation-detail | `/reservations/:reservationUid` | protected | main | `src/features/reservations/ReservationDetailRoute.tsx` |
| reservation-review | `/reservations/:reservationUid/review` | protected | main | `src/features/reviews/ReviewCreateRoute.tsx` |
| payment-success | `/reservations/:reservationUid/success` | protected | main | `src/features/reservations/PaymentSuccessRoute.tsx` |
| payment-fail | `/reservations/:reservationUid/fail` | protected | main | `src/features/reservations/PaymentFailRoute.tsx` |
| login | `/login` | public | bare | `src/features/auth/LoginRoute.tsx` |
| signup | `/signup` | public | bare | `src/features/auth/SignupRoute.tsx` |
| not-found | `*` | public | bare | `src/routes/NotFoundRoute.tsx` |

All 15 entries are lazy. Route-only `src/features/*/index.ts` barrels are not
used by production routing and remain compatibility artifacts enforced by
historical source-contract tests.

## Current state ownership

| State | Current authority | Current synchronization |
| --- | --- | --- |
| Route path and builder | `src/routes/paths.ts` | `routeTo` builders and Router navigation. |
| Route query shape | `src/routes/routeQueryContracts.ts` | Builders are central; parsing/normalization remains distributed in feature `lib` modules. |
| Search state | URL plus `useSearchResults`, SearchBar hooks, map refs, and bottom-sheet state | Effects and request tokens keep URL, Query, map, and UI aligned. |
| Profile/Wishlist route view | URL plus mirrored React state | Effects copy parsed URL state into local state. |
| Server resources | TanStack Query feature hooks | Feature `queryKeys.ts`, public cache helpers, and direct `setQueriesData`. |
| Viewer identity | `AuthContext` and auth query | `sessionLifecycle` and auth-error events clear selected caches. |
| Checkout recovery | Router state and `sessionStorage` | `reservationCheckoutState.ts` stores the fallback document and UID index. |
| Payment confirm dedupe | In-memory map and `sessionStorage` marker | `paymentConfirmationAttemptRegistry.ts`. |
| Accommodation editor | Local state, refs, Query data, and several hooks | Explicit session/operation fences are spread across detail, image, save, and controller hooks. |
| Ephemeral UI | Component-local state | Popovers, focus, hover, dialogs, and menu state. |

Detailed browser persistence and privacy properties are recorded in
[`frontend-browser-data-inventory.md`](./frontend-browser-data-inventory.md).

## API and external integrations

### API boundary

- `src/platform/http/client.ts` creates the only credentialed production Axios
  instance. `src/api/client.ts` is the compatibility facade; the unused Axios
  v2 instance no longer exists.
- `src/platform/http/envelope.ts` and `errors.ts` own the migrated
  `AppError` boundary. `src/api/request.ts` and `response.ts` preserve the
  existing `ApiClientError`, raw Axios failure identity, nullable-command, and
  authentication-event contracts for legacy consumers.
- Domain wrappers under `src/api/*.ts` own current methods, URLs, query/body
  shapes, and global wire DTO imports from `src/types/**`.
- UI components and route containers are kept away from direct API and wire-DTO
  imports by dependency-cruiser rules with failing fixtures.
- Wire payload fields are TypeScript types; arbitrary domain payloads are not
  runtime-decoded today.

### External browser contracts

| Integration | Current owner | Runtime form |
| --- | --- | --- |
| Google Maps/Places | `src/platform/integrations/googleMaps.ts` | Exact HTTPS script loader and validated runtime access; current hooks are compatibility facades. |
| Daum postcode | `src/platform/integrations/daumPostcode.ts` | Lazy exact HTTPS loader, callback validation, and abortable open operation. |
| Toss Payments | `src/platform/integrations/tossPaymentsV1.ts` | Temporary CDN v1 gateway; the feature helper preserves current user-facing error policy. |
| CloudFront images | `src/platform/assets/imageUrl.ts` | Validated HTTPS asset host and legacy `src/utils/image.ts` facade. |
| Environment | `src/platform/config/env.ts`, `publicRuntimeConfig.ts`, `scripts/architecture/validate-public-build-env.mjs` | The app adapter reads mode plus four browser-public runtime values. CRA separately consumes build-only `PUBLIC_URL` for HTML/asset paths; preflight permits only empty, single-slash root-relative, or absolute HTTPS asset bases with percent-free safe paths. Runtime and build validation reject percent encoding and server-secret key shapes in every public exposure; Google Maps also uses a browser-key-safe character set. |

`src/platform/storage` now owns raw `sessionStorage` access and a generic
versioned repository with purpose, version, privacy/PII classification, stable
subject, TTL, exact field allowlists, invalid-record purge, and guarded one-way
migration. It is not an active checkout/payment writer. The two current
unversioned reservation helpers use a named raw compatibility seam until U10
can activate a server-verified schema without creating a second writer.

## Current dependency boundaries

The current freeze prevents private cross-feature imports but permits
`appShell.ts` and `publicCache.ts`. Production edges through those seams include:

```text
auth -> reservations
search -> auth, wishlist
wishlist -> search
accommodations -> auth, reservations, reviews, wishlist
reviews -> accommodations, reservations
profile -> accommodations, reservations
accommodations/edit -> profile
```

Consequences that remain open:

- Search and Wishlist form a feature-level cycle.
- Accommodations and Reviews form a feature-level cycle.
- Profile, Accommodations, and Accommodation Edit have a circular ownership
  chain when the edit sub-feature is included.
- `features/accommodations/appShell.ts` exports both the header draft hook and a
  modal, which lets an app-shell consumer pull unrelated modal code and CSS into
  the initial graph.
- Public compatibility seams remain permitted, while the graph ratchet reports
  them as legacy warnings; the current graph is not yet a DAG.

U3 adds executable ownership for this graph. At the U4 platform cutover,
dependency-cruiser reports 388 modules and 1,067 edges with two legacy editor
cycles and sixteen legacy cross-feature edges with zero blocking errors. Knip
records sixteen unreachable production
files and six unused runtime packages while target reachability remains clean.
Stylelint records 231 legacy warnings across 60 CSS files while target design
policy has zero errors. `architecture-ratchet.json` promotes a feature to strict
dependency, reachability, and style enforcement in its cutover commit. The
registry rejects missing/test-only roots and live downgrades against the PR base;
JavaScript, JSX, and MJS share the same strict lint/reachability coverage as
TypeScript, including CRA's `.web.mjs` resolution through the `.mjs` suffix.
Existing unused runtime packages remain report-only, while adding a new unused
runtime dependency is blocking. New or renamed feature roots must enter the
registry atomically; parent features cannot borrow nested-feature source to pass
promotion. Knip's source coverage and error-level rules are canonical, and this
private app forbids optional/peer runtime dependency sections that Knip 2 cannot
classify safely. Dependency declarations use registry semver only; aliases,
tags, URLs, local paths, and Git specs are rejected. Feature ownership also
rejects symbolic links, so a renamed slice cannot escape strict promotion by
aliasing its old implementation.

## User flows that must survive cutover

- Protected route to login and back to the original pathname, query, and hash.
- Search direct load, refresh, pagination, map bounds, and browser history.
- Wishlist membership agreement across search, accommodation detail, recently
  viewed, and wishlist screens.
- Anonymous wishlist or booking intent resumed after successful login.
- Accommodation detail to reservation creation to checkout handoff.
- Toss callback validation, server confirm, cache invalidation, and reservation
  detail navigation.
- Retryable or ambiguous confirmation preserved for status reconciliation.
- Review creation with image-upload partial failure.
- Accommodation draft hydration, image reconciliation, save, and publish order.
- Profile guest/host modes and wishlist views restored from their URLs.

## Known unresolved delta and target owner

This table is architectural scope, not implementation progress. Active cutover
status lives in [`frontend-ownership-matrix.md`](./frontend-ownership-matrix.md).

| Delta | Planned owner |
| --- | --- |
| Per-feature migration off legacy global API/DTO facades and activation of the owned checkout repository | U7-U13, U10, U22 |
| Explicit session subject/epoch and cache lifetime | U5 |
| App route adapters, query codecs, and shells | U6 |
| Auth intent and wishlist membership workflow | U7 |
| Search/Header/Maps screen migration | U8 |
| Accommodation detail, reservation create, and review workflow | U9 |
| Single checkout/payment aggregate | U10 |
| Toss npm v2 runtime adapter | U11 |
| Listing editor transaction reducer | U12 |
| Profile, reservation, and host-management screens | U13 |
| Interaction accessibility and responsive adoption | U14 |
| Tokens, primitives, icons, assets, and feature CSS | U15 |
| Vite build/dev owner | U16 |
| Vitest owner | U17 |
| Final design-entry gate | U18 |
| Structural overlay/responsive runtime | U19 |
| Remaining small route entries | U21 |
| Compatibility and runtime DAG closure | U22 |
| TypeScript, lint, dependency, and formatting modernization | U23 |

## Verification contracts

Current local and CI commands are defined in `package.json` and
`.github/workflows/frontend.yml`:

- `npm run typecheck`
- `npm run test:ci:no-cache -- --runInBand`
- `npm run lint:strict`
- `npm run build`
- `npm run test:public-config-build`
- `npm run test:e2e:artifact-policy`
- `npm run typecheck:e2e`
- `npm run test:e2e:characterization`
- `npm run lint:e2e`
- `npm run test:architecture-rules`
- `npm run lint:architecture`
- `npm run lint:dead-code`
- `npm run lint:styles`
- `npm run verify:architecture`
- `npm run report:architecture`
- `npm run verify:structure`
- `npm run verify:pre-redesign`
- `npm run smoke:frontend:preflight`
- `npm run verify:design-ready`

The deterministic browser suite proves the current synthetic flow matrix; it
does not prove a live backend, Google Maps, Toss sandbox, or seeded dynamic-route
behavior. Dated smoke evidence in the QA document is historical; fixture
omissions are unverified, not passing coverage.

## Document authority

| Document | Authority |
| --- | --- |
| This document | Current production architecture and unresolved delta. |
| `frontend-ownership-matrix.md` | Mutable cutover owner registry. |
| `frontend-migration-rules.md` | Execution rules for every migration slice. |
| `frontend-browser-data-inventory.md` | Browser persistence, ownership, PII, TTL, and cleanup inventory. |
| `tests/architecture/dependency-rules.md` | Executable static-rule owners, measured debt, strict promotion, and tool transition. |
| Active plan under `docs/plans/` | Target architecture and implementation units. |
| `docs/qa/frontend-architecture-smoke.ko.md` | Live smoke operation and historical evidence. |
| `frontend-architecture-freeze.ko.md` | Superseded July snapshot. |
| `frontend-structure-refactor.md` | Superseded July outcome record. |
| `docs/superpowers/plans/**` | Superseded historical plans; not executable. |

When documents disagree about the current frontend, this document wins. When
the production graph changes, update this document and the ownership matrix in
the same migration unit.
