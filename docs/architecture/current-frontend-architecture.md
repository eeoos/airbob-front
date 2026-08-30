# Airbob Frontend Architecture

> Status: canonical current-state source of truth  
> Baseline: U4 commit `f5222d5`, followed by the U6 Router, U5 session, U19 structural UI, U7 auth/wishlist, U8 Search, U9 Detail/Review, and U10 booking-payment cutovers
> Current migration state: the app Router/session/overlay runtime and the feature-owned auth, wishlist, Search, Accommodation Detail, reservation-create, Review, and booking-payment slices are active
> Recorded: 2026-08-30 KST

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
- App route codecs are the durable authority for migrated route views. Wishlist,
  Search, and Accommodation Detail controllers receive decoded URL props and do
  not mirror committed route state into local durable state. Transient review
  results use an exact typed one-shot history-state codec.
- `src/workflows/booking-payment/**` is the sole checkout, payment-request,
  confirmation, and reconciliation writer. Browser checkout/callback records and
  legacy marker hits are correlation or recovery inputs only; owned reservation
  detail plus backend confirmation/payment status are the terminal authority.
- The payment-success credential boundary lives in the stable app-provider
  lifetime above session authentication and the keyed QueryClient subtree. It
  captures a valid Toss tuple in route-lifetime memory only and removes every
  success query from native and React Router history before session bootstrap or
  `RequireAuth` may inspect the location.
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
| Resumable authentication intent | `src/workflows/auth-intent/**`, composed by `src/app/providers/AppProviders.tsx` | A memory-only provider outside the keyed Query subtree holds only the latest validated primitive intent. Search and Accommodation adapters atomically claim it with a captured session scope; old-generation callbacks never resume Wishlist, reservation, or coupon work. |
| Server-state client | `src/app/session/SessionProvider.tsx`, `src/platform/query/createQueryClient.ts` | Each session generation receives a new QueryClient. Leaving an authenticated identity also remounts the provider subtree. `src/query/QueryProvider.tsx` and `sessionCacheBoundary.ts` are rollback/test compatibility surfaces, not production owners. |
| Authentication feature | `src/features/auth/{api,model,ports,ui}/**`, `src/screens/auth/**` | Login and signup routes render the owned controller/screen. Session owns login identity transitions; the feature owns signup transport and form behavior through injected commands. `AuthContext` remains only as a compatibility projection/delegation boundary until its final consumers move in U22. |
| Routing and shell metadata | `src/app/router/definitions.ts`, `manifest.ts`, `lazyRoutes.tsx`, `paths.ts` | Component-free policy and 15 literal lazy adapter entries are the active production manifest. |
| Application shells | `src/app/shells/**` | Browse, form, transaction, editor, and bare shells render exactly one `main`; `PageShell` is a labelled nested section and cannot accept a `main` role. `AppHeader` remains the active header renderer. |
| Overlay runtime | `src/app/overlays/OverlayProvider.tsx`, `src/shared/ui/overlayRuntime.ts` | One app-owned, statically declared `#airbob-portal-root` hosts Dialog and Toast. The provider owns Dialog stack order, topmost Escape/backdrop policy, nested body lock, inactive-layer semantics, and focus restoration while preserving the existing Dialog/Toast props. |
| API transport and envelope | `src/platform/http/**`, exposed through `src/api/client.ts` and `src/api/response.ts` | One credentialed Axios instance; migrated and legacy error surfaces are intentionally separate. Migrated multipart commands declare their body encoding so the shared JSON default cannot serialize `FormData`. |
| Browser platform boundary | `src/platform/config/**`, `storage/**`, `integrations/**`, `assets/**`, `browser/**`, `session/**` | Owns public environment input, browser storage access, external SDK globals/scripts, image URL resolution, isolated new-tab navigation, exact current-history-entry validation, auth-error signaling, and the non-PII cross-tab channel. |
| Wishlist feature and workflow | `src/features/wishlist/**`, `src/workflows/wishlist-membership/**`, `src/screens/wishlist/**` | Feature-owned API/model/scoped read options feed a URL-prop-only screen controller. Search, Detail, and Wishlist lazy adapters mount one route-scoped provider inside the current QueryClient generation, so the writer is disposed on route departure without entering the initial app chunk. Its subject/epoch-fenced command runner owns collection/membership create, add, remove, delete, memo-save, and recently-viewed removal. App composition sends Search and Detail updates only to their owning scoped cache projections. |
| Search feature | `src/app/router/routes/SearchRoute.tsx`, `src/screens/search/**`, `src/features/search/**` | The app adapter alone owns codec parsing, page push, map-bounds replace, booking-safe detail URLs, auth-intent claim, and workflow composition. `SearchController` derives request/map/view state; feature-owned API/wire mappers and scoped Query options own server reads, cancellation, and stale-result fencing. `SearchScreen` is props-only. SearchBar receives a typed route port and its reducer owns draft/popover/IME interaction only. |
| Accommodation Detail and reservation create | `src/app/router/routes/AccommodationDetailRoute.tsx`, `src/screens/accommodation-detail/**`, `src/features/accommodations/detail/**`, `src/workflows/booking-payment/reservation-create/**` | The app adapter owns typed booking URL state, exact history-entry/session leases, auth-intent claim, checkout handoff, Wishlist composition, and recently-viewed injection. The independently ratcheted `accommodations/detail` scope owns camelCase models, queries, cache projections, coupon adapters, and detail UI; anonymous projections always mask server Wishlist membership. Screen-local review-feed, recently-viewed, coupon-command, reservation-command, and gallery hooks keep the controller compositional, and the review feed advances one cursor only after its modal sentinel becomes visible. Reservation create uses same-Promise single-flight and a conservative terminal lock, including when a route generation interrupts an already-sent command. Before its POST and again before handoff commit, the aggregate blocks a second reservation while an exact checkout/callback pair still requires payment recovery; the active documents are preserved and the user returns to reason-only reconciliation. |
| Booking checkout and payment | `src/app/router/PaymentCallbackCredentialBoundary.tsx`, `src/app/router/routes/{ReservationConfirmRoute,PaymentSuccessRoute,PaymentFailRoute}.tsx`, `src/screens/{reservation-confirm,payment-result}/**`, `src/features/reservations/payment/**`, `src/workflows/booking-payment/{checkout,confirmation}/**` | One aggregate owns the versioned checkout/callback repositories, callback claim/replay bootstrap, Toss request policy, confirmation, and status reconciliation. A payment-success-specific boundary in the stable app-provider lifetime parses the external tuple into route-lifetime memory, blocks session/auth children until both histories are credential-free, survives the authenticated QueryClient generation replacement, and releases its claim on route departure without remounting the session/query runtime. App adapters claim exact route/session generations, consume the minimal history handle, and compose props-only screens. Gateway request requires a current subject-owned checkout with no persisted callback; any callback phase returns to confirmation/reconciliation recovery and can never remount payment request. `received` proves no confirm POST boundary was crossed; ownership preflight runs first, `confirming` is durably written immediately before the sole POST, and later phases reconcile only. Document-free server replay retains its scrubbed tuple in the success route when ownership lookup is temporarily unavailable, retries preflight in place, and starts reconciliation only after exact server ownership is verified. Confirmation/reconciliation additionally verifies the authenticated guest reservation and exact reservation/order/amount/resource tuple before confirm/status I/O. Only backend confirm or exact payment status can publish success. Retryable or pending results retain owned records for reconciliation, while only exact joined invalid/terminal/session boundaries purge them. |
| Review read and submission | `src/app/router/routes/ReviewCreateRoute.tsx`, `src/screens/review-create/**`, `src/features/reservations/{api,model,queries}/reviewableReservation*`, `src/features/reviews/**`, `src/workflows/review-submission/**` | A minimal camelCase reservation read model prevents legacy reservation DTOs from reaching the screen. One create/upload workflow makes post-create terminals irreversible, preserves real multipart `FormData`, suppresses stale navigation/publication, and terminal-locks ambiguous create outcomes rather than repeating a possible committed POST. Image-only upload failure remains typed partial success. Reviews is a strict architecture root. |
| Remaining domain state and orchestration | unmigrated `src/features/**` slices | Legacy TanStack Query hooks, route containers, global API/DTO facades, and workflow hooks coexist until their named U12-U13/U21 cutovers. |
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
`AuthContext`, legacy path/query helpers, and five assigned feature route
bodies remain active compatibility adapters until their named U12-U13/U21-U22
cutovers.

| ID | Path | Auth | Shell | Active adapter | Active body |
| --- | --- | --- | --- | --- | --- |
| home | `/` | public | browse | `app/router/routes/HomeRoute.tsx` | `features/home/HomeRoute.tsx` |
| search | `/search` | public | browse/search header | `app/router/routes/SearchRoute.tsx` | `screens/search/SearchController.tsx` → `SearchScreen.tsx` |
| accommodation-detail | `/accommodations/:id` | public | browse | `app/router/routes/AccommodationDetailRoute.tsx` | `screens/accommodation-detail/AccommodationDetailController.tsx` → `AccommodationDetailScreen.tsx` |
| accommodation-confirm | `/accommodations/:id/confirm` | protected | transaction | `app/router/routes/ReservationConfirmRoute.tsx` | `screens/reservation-confirm/ReservationConfirmController.tsx` → `ReservationConfirmScreen.tsx` |
| accommodation-edit | `/accommodations/:id/edit` | protected | editor | `app/router/routes/AccommodationEditRoute.tsx` | `features/accommodations/edit/AccommodationEditRoute.tsx` |
| wishlist | `/wishlist` | protected | browse | `app/router/routes/WishlistRoute.tsx` | `screens/wishlist/WishlistController.tsx` |
| profile | `/profile` | protected | browse | `app/router/routes/ProfileRoute.tsx` | `features/profile/ProfileRoute.tsx` |
| host-reservation-detail | `/profile/host/reservations/:reservationUid` | protected | transaction | `app/router/routes/HostReservationDetailRoute.tsx` | `features/reservations/HostReservationDetailRoute.tsx` |
| reservation-detail | `/reservations/:reservationUid` | protected | transaction | `app/router/routes/ReservationDetailRoute.tsx` | `features/reservations/ReservationDetailRoute.tsx` |
| reservation-review | `/reservations/:reservationUid/review` | protected | form | `app/router/routes/ReviewCreateRoute.tsx` | `screens/review-create/ReviewCreateController.tsx` → `ReviewCreateScreen.tsx` |
| payment-success | `/reservations/:reservationUid/success` | protected | transaction | `app/router/routes/PaymentSuccessRoute.tsx` | `screens/payment-result/PaymentResultController.tsx` → `PaymentResultScreen.tsx` |
| payment-fail | `/reservations/:reservationUid/fail` | protected | transaction | `app/router/routes/PaymentFailRoute.tsx` | `screens/payment-result/PaymentResultController.tsx` → `PaymentResultScreen.tsx` |
| login | `/login` | public | form/hidden header | `app/router/routes/LoginRoute.tsx` | `screens/auth/AuthController.tsx` |
| signup | `/signup` | public | form/hidden header | `app/router/routes/SignupRoute.tsx` | `screens/auth/AuthController.tsx` |
| not-found | `*` | public | bare/hidden header | `app/router/routes/NotFoundRoute.tsx` | none |

All 15 entries are lazy. Each is a literal import and remains a separate
route-level adapter entry. Five adapters cross one exact,
architecture-enforced bridge to their assigned legacy body; Login, Signup,
Wishlist, Search, Accommodation Detail, Reservation Confirm, Review, Payment
Success, Payment Fail, and NotFound are
app/screen-owned. Remaining route-only `src/features/*/index.ts` barrels are
not used by production routing and remain cleanup artifacts for U22.

The remaining rollback-only route chain is `src/routes/routeDefinitions.ts`,
`routeMatching.ts`, `routeShell.ts`, the old NotFound route, and
`src/layouts/MainLayout*`; the former Router and routeConfig roots are gone.
Still-active compatibility code is deliberately narrower:
`src/layouts/AppHeader/**`, `src/routes/RequireAuth.tsx`, legacy path/query
helpers, and the five assigned feature route bodies. Calling all of
`src/routes` or `src/layouts` rollback-only would be incorrect.

## Current state ownership

| State | Current authority | Current synchronization |
| --- | --- | --- |
| Route path and builder | `src/app/router/paths.ts` | Active app adapters use `routeTo`; `src/routes/paths.ts` remains an independently tested compatibility copy for legacy consumers. |
| Route query shape | `src/app/router/codecs/**` | Canonical parse/serialize contracts exist at the app boundary. Login return, Wishlist, Search, Accommodation booking, typed review completion, Payment Success callback, and Payment Fail reason consume them now; Profile retains its legacy parser until U13. Before authentication renders, the payment credential boundary parses the external tuple, replace-scrubs native history, synchronizes React Router with null state, and retains the claim in memory only. The success adapter delegates exact claim/replay policy to the booking-payment workflow; the fail route serializes only a typed reason. |
| Search state | App `searchCodec` output, feature Query state, SearchBar interaction reducer, bottom-sheet state, and map instance refs | The URL is the committed destination/date/guest/bounds/page authority. Query owns result/loading/error/cancellation, the reducer owns input draft/active overlay/IME state only, and map/SDK objects remain integration-local and disposable. |
| Wishlist route view | `wishlistCodec` output passed by the app adapter | The URL is the sole durable view authority; `WishlistController` derives index/detail/recently-viewed state without mirroring it into React state. |
| Profile route view | URL plus mirrored React state | Effects still copy parsed URL state into local state until U13. |
| Server resources | Session generation QueryClient plus feature-owned TanStack Query options | U5 physically replaces and clears the client at an identity boundary. Wishlist, Search, Accommodation Detail/coupons, and Reviews include subject/epoch keys/meta and forward cancellation; app composition reconciles Wishlist membership through each owning projection. Unmigrated feature keys/public cache helpers remain until their slice cutovers. |
| Viewer identity | `SessionProvider` explicit reducer state | A non-PII subject and monotonic epoch define identity lifetime. `AuthContext` is a read/delegation adapter only; the old `useSessionQuery` and `sessionLifecycle` owners are deleted. |
| Checkout recovery | `airbob:booking-payment-v1:checkout` plus a typed history handle | One static, subject-owned versioned record retains the exact checkout allowlist for 60 minutes; the history entry carries only purpose/version/operation ID and is replace-consumed. Foreign, expired, malformed, wrong-purpose/version, unknown-field, route-mismatched, and operation-mismatched inputs fail closed. A stale or malformed current-format handle redirects without deleting the newer stored checkout or entering legacy migration. Name and email never enter the record. Server-verified legacy input may be migrated once, then is deleted; retryable verification failures preserve the unchanged legacy pair. |
| Payment callback and confirm dedupe | stable-lifetime in-memory pre-auth claim, `airbob:booking-payment-v1:callback`, and the confirmation workflow instance | The pre-auth claim exists only for the scrubbed success-route lifetime but survives the session QueryClient generation switch. A subject-owned sensitive callback record with a sliding 15-minute TTL then retains the exact tuple and `received|confirming|reconciling` phase; every successful callback write first refreshes the joined checkout's longer 60-minute lifetime. `received` is confirm-capable, while `confirming` and `reconciling` are reconciliation-only. Exact concurrent commands share one active Promise; a possibly sent confirm is never repeated and later attempts reconcile. Reopening confirm while any joined callback exists routes to reason-only recovery without mounting the gateway. A consumed legacy confirmed marker is persisted as `reconciling` and cannot publish success. |
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
- An identity boundary advances the epoch, clears the owned checkout/callback
  namespace plus exact legacy checkout/index/payment-marker prefixes through the
  injected booking-payment cleanup port, cancels and clears the previous
  QueryClient, and creates a new subject/epoch generation before publishing the
  next viewer. When an authenticated identity is fenced, a generation key
  remounts the QueryClient subtree so late mutation callbacks from the old tree
  cannot write into the new viewer's client. When no authenticated identity is
  present, the anonymous/error client is instead cancelled, cleared, and
  re-scoped in place; a failed login can therefore retain its modal intent,
  inputs, and exact error. A successful viewer probe replaces and remounts that
  client only after payment cleanup completes. Current and legacy namespaces each retry
  one partial/storage-failed cleanup pass; a final non-cleared result is
  propagated and leaves the session transition fail-closed instead of publishing
  a new identity over residual payment state.
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
removal. U8 adds normalized Search request keys, scope meta, AbortSignal
propagation, owned membership projection, and a mounted A→B late-response
fence. U9 adds scoped Accommodation Detail/coupon/review reads plus
route/session-fenced reservation and review command workflows. U10 adds exact
route/session leases and abortable ownership/payment reads to the booking-payment
aggregate. U12-U13 must add the same feature-owned option factories and command fences to the remaining
slices; U22 removes the rollback compatibility surfaces.

## API and external integrations

### API boundary

- `src/platform/http/client.ts` creates the only credentialed production Axios
  instance. `src/api/client.ts` is the compatibility facade; the unused Axios
  v2 instance no longer exists.
- `src/platform/http/envelope.ts` and `errors.ts` own the migrated
  `AppError` boundary. `src/api/request.ts` and `response.ts` preserve the
  existing `ApiClientError`, raw Axios failure identity, nullable-command, and
  authentication-event contracts for legacy consumers.
- Auth, Wishlist, Search, Accommodation Detail/coupons, reservation-create,
  booking-payment, and
  Review methods, wire types, and mappers are owned by
  `src/features/auth/{api,model}/**`,
  `src/features/wishlist/{api,model}/**`,
  `src/features/search/{api,model}/**`,
  `src/features/accommodations/detail/{api,model}/**`,
  `src/features/reservations/{api,model}/**`,
  `src/features/reservations/payment/{api,model,ports}/**`, and
  `src/features/reviews/{api,model}/**`. The former global Auth/Wishlist/Review/
  recently-viewed wrappers and their migrated DTOs are deleted; unused
  `src/types/auth.ts` remains rollback debt until U22. Search also removed the
  global accommodation search method and search response DTOs; U10 removes the
  global payment wrapper as well. Other domain
  wrappers under `src/api/*.ts` stay compatibility owners until their consumer
  slices move.
- UI components and route containers are kept away from direct API and wire-DTO
  imports by dependency-cruiser rules with failing fixtures.
- Wire payload fields are TypeScript types; arbitrary domain payloads are not
  runtime-decoded today.

### External browser contracts

| Integration | Current owner | Runtime form |
| --- | --- | --- |
| Google Maps/Places | `src/platform/integrations/{googleMaps,googlePlaces,useGoogleMapsScript}.ts` plus Search-owned Places hook | Exact HTTPS singleton loader, typed terminal states, validated runtime access, lazy Places activation, and bounded SDK/DOM resource cleanup. The unused global hook facades are deleted. |
| Daum postcode | `src/platform/integrations/daumPostcode.ts` | Lazy exact HTTPS loader, callback validation, and abortable open operation. |
| Toss Payments | `src/platform/integrations/tossPaymentsV2.ts`, adapted by `src/workflows/booking-payment/checkout/paymentGateway.ts` | Pinned official npm SDK v2 behind the unchanged `PaymentGatewayPort`. The adapter owns one bounded, client-key-scoped load, initializes the direct payment window with `ANONYMOUS`, and maps the existing request to `CARD`/`KRW`; a route-owned gateway lease reuses that client and destroys its launcher on route departure. The workflow adapter owns safe error policy and duplicate-request fencing. The retired v1 source is removed; immutable Git commit `408d303` and its Vercel deployment are the U10 comparison/rollback target. |
| CloudFront images | `src/platform/assets/imageUrl.ts` | Validated HTTPS asset host and legacy `src/utils/image.ts` facade. |
| Environment | `src/platform/config/env.ts`, `publicRuntimeConfig.ts`, `scripts/architecture/validate-public-build-env.mjs` | The app adapter reads mode plus four browser-public runtime values. CRA separately consumes build-only `PUBLIC_URL` for HTML/asset paths; preflight permits only empty, single-slash root-relative, or absolute HTTPS asset bases with percent-free safe paths. Runtime and build validation reject percent encoding and server-secret key shapes in every public exposure; Google Maps also uses a browser-key-safe character set. |

`src/platform/storage` owns raw `sessionStorage` access and the generic
versioned envelope engine. The booking-payment aggregate is its active domain
writer through a named storage driver: static checkout/callback slots carry
purpose, version, privacy/PII classification, stable subject, creation/expiry,
exact field allowlists, invalid-record purge, and guarded one-way migration.
Only the dedicated read/cleanup adapter for exact pre-U10 checkout/index/marker
prefixes remains; it cannot write a legacy record or authorize payment.

## Current dependency boundaries

The current freeze prevents private cross-feature imports but permits named
legacy `appShell.ts` and `publicCache.ts` seams for unmigrated slices. After U9,
the remaining production edges through those seams are:

```text
profile -> accommodations, reservations
accommodations/edit -> profile
```

The former AuthContext-owned `auth -> reservations` cleanup edge is gone. The
app root now composes the session owner with the reservation cleanup public port
without making either feature own the other.

Consequences that remain open:

- Search and Accommodation Detail receive Wishlist commands at app composition
  and own their cache projections; neither screen imports a private peer surface.
- The former Accommodation/Review feature cycle and Detail compatibility
  projection are deleted. Reviews is a strict migrated feature root, while
  Accommodation Detail is independently enforced as the nested
  `accommodations/detail` ownership scope without promoting the legacy editor
  or profile action surface.
- Profile, Accommodations, and Accommodation Edit still have a circular
  ownership chain when the edit sub-feature is included.
- Header imports Search only through `features/search/ui/**`, Auth through its
  public surface, and accommodation draft creation through a narrow port; it no
  longer pulls the accommodation action modal through a broad app-shell seam.
- Public compatibility seams remain permitted, while the graph ratchet reports
  them as legacy warnings; the current graph is not yet a DAG.
- The active shell is the sole production `main` owner. The only second source
  owner is rollback-only `src/layouts/MainLayout.tsx`, which remains unreachable
  from the active route tree until U22 removes it.

U3 adds executable ownership for this graph. At the U10 cutover,
dependency-cruiser reports 525 modules and 1,387 dependencies with two legacy
editor cycles and three legacy cross-feature edges: five known warnings and zero
blocking errors. The eight remaining app-adapter bridges recorded at U9 are now
five exact target-to-body exceptions and cannot reach a peer route or private
helper. Target-ratcheted production Knip, strict Stylelint, architecture tools,
and strict ESLint pass; the report-only inventory contains 19 unused rollback/
compatibility files and 107 legacy style warnings across 11 CSS files. The new
booking-payment screens introduce no strict style error.
`architecture-ratchet.json` promotes a feature scope to strict
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

The U9 fixed-environment CRA production build reports a 139.92 kB gzip main
bundle, 0.98 kB below U8. Source-map inspection places Accommodation Detail in
an 8.27 kB lazy route chunk, Review Create in a 5.68 kB lazy route chunk,
Search in a 15.51 kB lazy route chunk, the Wishlist provider in a separate
8.54 kB chunk, and `AccommodationActionModal` in another 6.28 kB chunk; none
enters the Header-owned main chunk. This proves the U9 route/chunk boundary, but
it does not approve the plan's
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
| Remaining feature migration off legacy global API/DTO facades | U12-U13, U22 |
| Remaining feature-owned subject/epoch Query keys/meta and workflow scope capture beyond the active U5 physical generation bridge | U12-U13, U22 |
| Remaining route controller/screen cutover and removal of five exact legacy adapter bridges | U12-U13, U21-U22 |
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
