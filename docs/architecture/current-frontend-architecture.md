# Airbob Frontend Architecture

> Status: canonical current-state source of truth  
> Baseline: U4 commit `f5222d5`, followed by the U6 Router, U5 session, U19 structural UI, and U7 auth/wishlist cutovers
> Current migration state: the app Router/session/overlay runtime and the feature-owned auth and wishlist slices are active
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
- Wishlist collection/membership create, add, remove, delete, memo-save, and
  recently-viewed removal have exactly one mutation writer under
  `src/workflows/wishlist-membership/**`; compatibility adapters may project
  cache reads but cannot issue network mutations.
- App route codecs are the durable authority for migrated route views. The
  Wishlist controller receives decoded URL props and does not mirror them into
  local state.
- Airbnb visual redesign begins only after the architecture design-entry gate;
  it is not part of the structure migration.

## Runtime composition

```text
src/index.tsx
  ErrorBoundary
    BrowserRouter (stable across session generations)
      AppProviders
        OverlayProvider (one portal root + dialog stack)
          SessionProvider
            useSessionController (explicit state + transitions)
            provider-local physical auth command queue
            useSessionQueryLifetime (subject/epoch generations)
            useSessionExternalSync (tab/focus/auth signals)
            SessionContext
              AuthIntentProvider (memory-only stable boundary)
                keyed QueryClientProvider
                  AuthProvider (thin compatibility adapter + auth command injection)
                    App
                      U6 app route tree
                        semantic app shell
                          optional AppHeader
                          one main landmark
                            lazy app route adapter
                              WishlistMembershipProvider on Search/Detail/Wishlist only
                              owned controller/screen or assigned legacy route body
```

Current owners:

| Concern | Current owner | Notes |
| --- | --- | --- |
| React root and providers | `src/index.tsx`, `src/app/providers/AppProviders.tsx` | The one React root injects the reservation session-cleanup port; `AppProviders` mounts one `OverlayProvider` around the single `SessionProvider` and no provider creates another React root. |
| Session and authentication lifetime | `src/app/session/**`, `src/features/auth/ports/sessionPort.ts`, `src/platform/session/**` | One explicit reducer owns bootstrap, authenticated revalidation, anonymous revocation, retryable errors, subject/epoch, provider-local auth command serialization, cancellation, focus/401 handling, and cross-tab invalidation. |
| Resumable authentication intent | `src/workflows/auth-intent/**`, composed by `src/app/providers/AppProviders.tsx` | A memory-only provider outside the keyed Query subtree holds only the latest validated primitive intent. A new authenticated route adapter atomically claims it with a captured session scope; old-generation callbacks never resume domain work. Search and accommodation compatibility bodies consume typed data ports until their U8/U9 replacements. |
| Server-state client | `src/app/session/SessionProvider.tsx`, `src/platform/query/createQueryClient.ts` | Each session generation receives a new QueryClient. Leaving an authenticated identity also remounts the provider subtree. `src/query/QueryProvider.tsx` and `sessionCacheBoundary.ts` are rollback/test compatibility surfaces, not production owners. |
| Authentication feature | `src/features/auth/{api,model,ports,ui}/**`, `src/screens/auth/**` | Login and signup routes render the owned controller/screen. Session owns login identity transitions; the feature owns signup transport and form behavior through injected commands. `AuthContext` remains only as a compatibility projection/delegation boundary until its final consumers move in U22. |
| Routing and shell metadata | `src/app/router/definitions.ts`, `manifest.ts`, `lazyRoutes.tsx`, `paths.ts` | Component-free policy and 15 literal lazy adapter entries are the active production manifest. |
| Application shells | `src/app/shells/**` | Browse, form, transaction, editor, and bare shells render exactly one `main`; `PageShell` is a labelled nested section and cannot accept a `main` role. `AppHeader` remains the active header renderer. |
| Overlay runtime | `src/app/overlays/OverlayProvider.tsx`, `src/shared/ui/overlayRuntime.ts` | One app-owned, statically declared `#airbob-portal-root` hosts Dialog and Toast. The provider owns Dialog stack order, topmost Escape/backdrop policy, nested body lock, inactive-layer semantics, and focus restoration while preserving the existing Dialog/Toast props. |
| API transport and envelope | `src/platform/http/**`, exposed through `src/api/client.ts` and `src/api/response.ts` | One credentialed Axios instance; migrated and legacy error surfaces are intentionally separate. |
| Browser platform boundary | `src/platform/config/**`, `storage/**`, `integrations/**`, `assets/**`, `browser/**`, `session/**` | Owns public environment input, browser storage access, external SDK globals/scripts, image URL resolution, isolated new-tab navigation, exact current-history-entry validation, auth-error signaling, and the non-PII cross-tab channel. |
| Wishlist feature and workflow | `src/features/wishlist/**`, `src/workflows/wishlist-membership/**`, `src/screens/wishlist/**` | Feature-owned API/model/scoped read options feed a URL-prop-only screen controller. Search, Detail, and Wishlist lazy adapters mount one route-scoped provider inside the current QueryClient generation, so the writer is disposed on route departure without entering the initial app chunk. Its subject/epoch-fenced command runner owns collection/membership create, add, remove, delete, memo-save, and recently-viewed removal; duplicate targets share work, membership mutations for one accommodation execute through an ordered lane, and a create→add retry verifies the created list's server membership before another add. A lost create response remains ambiguous because the client has no created ID to reconcile; true exactly-once recovery requires a backend idempotency or status contract and is outside this frontend-only cutover. Search/detail receive a temporary injected command/scope compatibility port until U8/U9. |
| Remaining domain state and orchestration | unmigrated `src/features/**` slices | Legacy TanStack Query hooks, route containers, global API/DTO facades, and workflow hooks coexist until their named U8-U13/U21 cutovers. |
| Domain-free UI | `src/shared/ui/**` | Tested primitives; adoption is incomplete. |
| Shared styling values | `src/styles/tokens.css`, `src/shared/styles/custom-media.css`, `src/shared/styles/responsive.ts` | A canonical responsive manifest and JS `matchMedia` policy agree at the 1024px boundary. CRA cannot transform custom media, so unresolved production alias consumers are blocked until U16; CSS Modules still contain contract-checked literals and feature-local values. |
| Browser smoke | `scripts/smoke/frontend-smoke.mjs` | Live backend, browser, credentials, and stable IDs are external prerequisites. |
| Deterministic browser characterization | `playwright.config.ts`, `tests/e2e/**` | Loopback production app plus an exact synthetic HTTPS `.invalid` API origin, synthetic session/API fixtures, and default-deny network. |
| Static architecture ratchets | `.dependency-cruiser.cjs`, `knip.json`, `stylelint.config.mjs`, `architecture-ratchet.json` | Target/migrated surfaces fail on graph, reachability, and design-policy regressions while measured legacy debt remains visible. |

## Route inventory

`src/app/router/definitions.ts` owns route policy and
`src/app/router/lazyRoutes.tsx` owns the exhaustive direct lazy adapter mapping.
The former `src/routes/Router.tsx` and `routeConfig.tsx` composition roots are
deleted. `src/routes/routeDefinitions.ts`, matching/shell metadata, and
`MainLayout` are unreachable rollback artifacts. `src/routes/RequireAuth.tsx`,
`AuthContext`, legacy path/query helpers, and eleven assigned feature route
bodies remain active compatibility adapters until their named U8-U13/U21-U22
cutovers.

| ID | Path | Auth | Shell | Active adapter | Active body |
| --- | --- | --- | --- | --- | --- |
| home | `/` | public | browse | `app/router/routes/HomeRoute.tsx` | `features/home/HomeRoute.tsx` |
| search | `/search` | public | browse/search header | `app/router/routes/SearchRoute.tsx` | `features/search/SearchRoute.tsx` |
| accommodation-detail | `/accommodations/:id` | public | browse | `app/router/routes/AccommodationDetailRoute.tsx` | `features/accommodations/AccommodationDetailRoute.tsx` |
| accommodation-confirm | `/accommodations/:id/confirm` | protected | transaction | `app/router/routes/AccommodationConfirmRoute.tsx` | `features/reservations/ReservationConfirmRoute.tsx` |
| accommodation-edit | `/accommodations/:id/edit` | protected | editor | `app/router/routes/AccommodationEditRoute.tsx` | `features/accommodations/edit/AccommodationEditRoute.tsx` |
| wishlist | `/wishlist` | protected | browse | `app/router/routes/WishlistRoute.tsx` | `screens/wishlist/WishlistController.tsx` |
| profile | `/profile` | protected | browse | `app/router/routes/ProfileRoute.tsx` | `features/profile/ProfileRoute.tsx` |
| host-reservation-detail | `/profile/host/reservations/:reservationUid` | protected | transaction | `app/router/routes/HostReservationDetailRoute.tsx` | `features/reservations/HostReservationDetailRoute.tsx` |
| reservation-detail | `/reservations/:reservationUid` | protected | transaction | `app/router/routes/ReservationDetailRoute.tsx` | `features/reservations/ReservationDetailRoute.tsx` |
| reservation-review | `/reservations/:reservationUid/review` | protected | form | `app/router/routes/ReservationReviewRoute.tsx` | `features/reviews/ReviewCreateRoute.tsx` |
| payment-success | `/reservations/:reservationUid/success` | protected | transaction | `app/router/routes/PaymentSuccessRoute.tsx` | `features/reservations/PaymentSuccessRoute.tsx` |
| payment-fail | `/reservations/:reservationUid/fail` | protected | transaction | `app/router/routes/PaymentFailRoute.tsx` | `features/reservations/PaymentFailRoute.tsx` |
| login | `/login` | public | form/hidden header | `app/router/routes/LoginRoute.tsx` | `screens/auth/AuthController.tsx` |
| signup | `/signup` | public | form/hidden header | `app/router/routes/SignupRoute.tsx` | `screens/auth/AuthController.tsx` |
| not-found | `*` | public | bare/hidden header | `app/router/routes/NotFoundRoute.tsx` | none |

All 15 entries are lazy. Each is a literal import and remains a separate
route-level adapter entry. Eleven adapters cross one exact,
architecture-enforced bridge to their assigned legacy body; Login, Signup,
Wishlist, and NotFound are app/screen-owned. Route-only
`src/features/*/index.ts` barrels are not used by production routing and remain
legacy cleanup artifacts for U22.

The remaining rollback-only route chain is `src/routes/routeDefinitions.ts`,
`routeMatching.ts`, `routeShell.ts`, the old NotFound route, and
`src/layouts/MainLayout*`; the former Router and routeConfig roots are gone.
Still-active compatibility code is deliberately narrower:
`src/layouts/AppHeader/**`, `src/routes/RequireAuth.tsx`, legacy path/query
helpers, and the eleven assigned feature route bodies. Calling all of
`src/routes` or `src/layouts` rollback-only would be incorrect.

## Current state ownership

| State | Current authority | Current synchronization |
| --- | --- | --- |
| Route path and builder | `src/app/router/paths.ts` | Active app adapters use `routeTo`; `src/routes/paths.ts` remains an independently tested compatibility copy for legacy consumers. |
| Route query shape | `src/app/router/codecs/**` | Canonical parse/serialize contracts exist at the app boundary. Login return, Wishlist, and payment-fail reason consume them now; Search/Profile/payment-success bodies retain their legacy parsers until U8/U10/U13. |
| Search state | URL plus `useSearchResults`, SearchBar hooks, map refs, and bottom-sheet state | Effects and request tokens keep URL, Query, map, and UI aligned. |
| Wishlist route view | `wishlistCodec` output passed by the app adapter | The URL is the sole durable view authority; `WishlistController` derives index/detail/recently-viewed state without mirroring it into React state. |
| Profile route view | URL plus mirrored React state | Effects still copy parsed URL state into local state until U13. |
| Server resources | Session generation QueryClient plus feature-owned TanStack Query options | U5 physically replaces and clears the client at an identity boundary. Wishlist keys/meta include subject/epoch and are reconciled only through its workflow projection; unmigrated feature keys/public cache helpers remain until their slice cutovers. |
| Viewer identity | `SessionProvider` explicit reducer state | A non-PII subject and monotonic epoch define identity lifetime. `AuthContext` is a read/delegation adapter only; the old `useSessionQuery` and `sessionLifecycle` owners are deleted. |
| Checkout recovery | Router state and `sessionStorage` | `reservationCheckoutState.ts` remains the pre-U10 writer. The injected reservation cleanup port clears checkout documents and UID indexes on every U5 identity boundary, and app composition replaces a currently visible sensitive transaction entry. Older browser-history entries remain unowned legacy input until U9/U10. |
| Payment confirm dedupe | In-memory map, generation counter, and `sessionStorage` marker | `paymentConfirmationAttemptRegistry.ts` remains the pre-U10 writer. Session cleanup clears markers/in-flight entries and advances its generation so a late pre-cleanup confirmation cannot recreate a marker. |
| Cross-tab session signal | `src/platform/session/sessionBroadcast.ts` | A same-origin BroadcastChannel exchanges only an exact non-PII transition envelope and drives invalidate-before-revalidate handling. |
| Accommodation editor | Local state, refs, Query data, and several hooks | Explicit session/operation fences are spread across detail, image, save, and controller hooks. |
| Ephemeral UI | Component-local state plus the app overlay stack | Popovers, hover, menu and dialog-open state stay with their interaction owner. Overlay ordering, topmost dismissal, focus restoration, and scroll locking are memory-only app runtime concerns. |

Detailed browser persistence and privacy properties are recorded in
[`frontend-browser-data-inventory.md`](./frontend-browser-data-inventory.md).

## Session and Query lifetime

- The session reducer distinguishes bootstrap/external/identity checking,
  authenticated idle/revalidating/revalidation-error, anonymous
  revocation-verified/unverified, and retryable bootstrap error states. Stale
  completions are rejected by operation ID and epoch.
- `/me` receives the active `AbortSignal`. Login/logout callers are cancelled
  logically when superseded, but a started cookie-mutating transport is not
  aborted: the provider-local queue holds its physical lane until that Promise
  settles, so a later login/logout cannot overtake it and queues never leak
  across provider instances. Login fences the old identity before sending the
  command and both success and failure converge through a fresh `/me` probe.
- A network/timeout rejection cannot prove when the backend finished mutating
  its cookie. Frontend recovery therefore fences, re-probes, and uses paired
  cross-tab/focus recovery; absolute latest-command ordering would require a
  backend idempotency or sequence contract and is outside the frontend-only
  migration authority.
- An identity boundary advances the epoch, clears checkout/index/payment-marker
  state through the injected feature port, cancels and clears the previous
  QueryClient, and creates a new subject/epoch generation before publishing the
  next viewer. When an authenticated identity is fenced, a generation key
  remounts the QueryClient subtree so late mutation callbacks from the old tree
  cannot write into the new viewer's client. When no authenticated identity is
  present, the anonymous/error client is instead cancelled, cleared, and
  re-scoped in place; a failed login can therefore retain its modal intent,
  inputs, and exact error. A successful viewer probe still replaces that client
  and remounts before the authenticated viewer is published.
- `BrowserRouter` and the memory-only auth-intent provider live outside the
  keyed Query generation. An anonymous action registers one immutable,
  primitive-only latest attempt with its exact location key/path. Login failure
  preserves that attempt and its modal form; route departure, modal cancel,
  logout, revocation, or an owning authenticated identity departure clears it.
  After login, the new route adapter atomically claims the attempt together with
  an authenticated subject/epoch scope. Search wishlist and accommodation
  wishlist/reservation/coupon continuations revalidate resource and input data,
  execute at most once, and reject stale session completions before UI,
  storage, cache, error, or navigation publication. No callback, Promise,
  credential, viewer data, or browser-persisted record enters the intent.
- Local logout becomes anonymous immediately. A failed server logout remains
  `revocation: unverified`, retains a safe `AppError`, and renders a security
  notice with a retry action; it never restores the local viewer. The frontend
  does not inspect or delete the backend session cookie.
- Cross-tab messages have exactly `version`, `type`, random tab `sourceId`,
  monotonic `sequence`, and `phase: invalidate|revalidate`. Viewer ID, subject,
  epoch, email, cookie, and credentials never enter the BroadcastChannel
  payload. Same-source, malformed, duplicated, and out-of-order messages are
  ignored. If a newer transition or unrelated 401 arrives during an external
  `/me` probe, that probe is aborted and one fresh checking boundary/probe is
  replayed after the current verification releases.
- `src/features/auth/hooks/useSessionQuery.ts` and
  `src/features/auth/lib/sessionLifecycle.ts` are deleted. The surviving
  `src/query/QueryProvider.tsx` and `sessionCacheBoundary.ts` have no production
  consumer and exist only as rollback/test compatibility until U22.

The U5 generation boundary remains the physical bridge for unmigrated feature
hooks: there is no production `userScopedQueryRoots` registry and no singleton
QueryClient. U7 completes the final R14/R15 pattern for Wishlist: its read keys
and meta carry subject/epoch, every command captures and re-checks that scope,
old-session completions cannot publish cache/UI effects, and one workflow owns
collection/membership create/add/remove/delete, memo-save, and recently-viewed
removal. Review creation has
adopted the scope guard early as well. U8-U13 must add the same feature-owned
option factories and command fences to the remaining slices; U22 removes the
rollback compatibility surfaces.

## API and external integrations

### API boundary

- `src/platform/http/client.ts` creates the only credentialed production Axios
  instance. `src/api/client.ts` is the compatibility facade; the unused Axios
  v2 instance no longer exists.
- `src/platform/http/envelope.ts` and `errors.ts` own the migrated
  `AppError` boundary. `src/api/request.ts` and `response.ts` preserve the
  existing `ApiClientError`, raw Axios failure identity, nullable-command, and
  authentication-event contracts for legacy consumers.
- Auth and Wishlist methods, wire types, and mappers are owned by
  `src/features/auth/{api,model}/**` and
  `src/features/wishlist/{api,model}/**`. The former `src/api/auth.ts`,
  `src/api/wishlist.ts`, `src/types/wishlist.ts`, and
  `src/types/recentlyViewed.ts` are deleted; unused `src/types/auth.ts` remains
  rollback debt until U22. Other domain wrappers under `src/api/*.ts` stay
  compatibility owners until their consumer slices move;
  `src/api/recentlyViewed.ts` is a temporary U9 facade to the Wishlist feature
  adapter.
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

The current freeze prevents private cross-feature imports but permits named
legacy `appShell.ts` and `publicCache.ts` seams for unmigrated slices. Production
edges through those seams include:

```text
search -> auth, wishlist
accommodations -> auth, reservations, reviews, wishlist
reviews -> accommodations, reservations
profile -> accommodations, reservations
accommodations/edit -> profile
```

The former AuthContext-owned `auth -> reservations` cleanup edge is gone. The
app root now composes the session owner with the reservation cleanup public port
without making either feature own the other.

Consequences that remain open:

- Search and Accommodation Detail still consume Wishlist UI through temporary
  injected compatibility ports, but Wishlist no longer imports either feature
  and has no cross-feature dependency exception.
- Accommodations and Reviews form a feature-level cycle.
- Profile, Accommodations, and Accommodation Edit have a circular ownership
  chain when the edit sub-feature is included.
- `features/accommodations/appShell.ts` exports both the header draft hook and a
  modal, which lets an app-shell consumer pull unrelated modal code and CSS into
  the initial graph.
- Public compatibility seams remain permitted, while the graph ratchet reports
  them as legacy warnings; the current graph is not yet a DAG.
- The active shell is the sole production `main` owner. The only second source
  owner is rollback-only `src/layouts/MainLayout.tsx`, which remains unreachable
  from the active route tree until U22 removes it.

U3 adds executable ownership for this graph. At the U7 Auth/Wishlist cutover,
dependency-cruiser reports 469 modules and 1,253 edges with two legacy editor
cycles and thirteen legacy cross-feature edges: 15 warnings and zero blocking
errors. The eleven remaining app-adapter bridges are exact target-to-body
exceptions and cannot reach a peer route or private helper. Knip reports 25
unreachable legacy/rollback production files while the migrated Auth/Wishlist
roots and target reachability remain clean.
Stylelint records 229 legacy warnings across 25 CSS files while target design
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

The U7 CRA production build reports a 141.97 kB gzip main bundle. The Wishlist
UI, queries, cache projection, and command runner remain outside it in a 7.26 kB
shared lazy chunk reached only by Search, Detail, and Wishlist route adapters.
This proves the U7 route-chunk boundary, but it does not approve the plan's
final 131.4 kB main-budget target; U15/U18 still own measured global reduction
and the executable bundle budget.

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

## Remaining migration delta and target owner

This table is architectural scope, not implementation progress. Active cutover
status lives in [`frontend-ownership-matrix.md`](./frontend-ownership-matrix.md).

| Delta | Planned owner |
| --- | --- |
| Remaining feature migration off legacy global API/DTO facades and activation of the owned checkout repository | U8-U13, U10, U22 |
| Remaining feature-owned subject/epoch Query keys/meta and workflow scope capture beyond the active U5 physical generation bridge | U8-U13, U22 |
| Remaining route controller/screen cutover and removal of eleven exact legacy adapter bridges | U8-U13, U21-U22 |
| Search and Accommodation compatibility ports/cache projection for the owned auth-intent and Wishlist workflows | U8-U9 |
| Search/Header/Maps screen migration | U8 |
| Accommodation detail, reservation create, and review workflow | U9 |
| Single checkout/payment aggregate | U10 |
| Owner-scoped, one-shot checkout/payment history entries that reject replay after an identity transition | U9-U10 (release gate before these routes ship) |
| Toss npm v2 runtime adapter | U11 |
| Listing editor transaction reducer | U12 |
| Profile, reservation, and host-management screens | U13 |
| Interaction accessibility and full responsive adoption across remaining consumers | U14 |
| Tokens, primitives, icons, assets, and feature CSS | U15 |
| Vite build/dev owner | U16 |
| Vitest owner | U17 |
| Final design-entry gate | U18 |
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
