# Airbob Frontend Architecture

> Status: canonical current-state source of truth  
> Refactor starting baseline: `cfdb1e470b6fa4461f15a3472797d238d762503e` (`cfdb1e4`)
> Read-only backend contract target: `b2ec09a3cdc8cf86877edf5f222c6a5cd6c2afd1` (`b2ec09a`)
> Current migration state: app routing/session/overlay ownership, every feature-owned API/model boundary, and every current route screen are active; legacy global roots are retired; Vite owns build/dev, Vitest owns unit/integration execution, TypeScript owns explicit browser/test/tooling/Playwright environments, native flat-config ESLint owns local source feedback, Knip 6 globally blocks production-unused files/value exports/type exports/duplicate exports and proves dependency placement, and Prettier 3.9 owns formatter-scoped active-tree layout without CRA runtime or lint dependencies
> Recorded: 2026-09-01 KST

This document describes the current frontend as it evolves from the starting
baseline above. It is the only document that defines the current architecture.
The [2026-09-01 contract-alignment plan](../plans/2026-09-01-001-refactor-local-backend-contract-alignment-plan.md)
describes the target; the ownership matrix records cutover state. The
2026-08-29 overhaul plan and older freeze/plan documents are historical evidence
only.

## Scope and invariants

- The frontend is a React browser SPA backed by the existing `/api/v1` REST
  contract.
- Backend endpoints, request/response fields, cookie semantics, database, and
  server authorization are outside frontend ownership.
- Current route paths and user-visible flows remain behavior contracts during
  the remaining toolchain and design-foundation migration.
- There must be one active writer for every mutable workflow.
- A migrated slice switches to one new writer and removes the old writer in the
  same atomic cutover before the slice is considered complete. Rollback uses an
  immutable build or Git commit, never a second live source owner.
- Wishlist collection/membership create, add, remove, delete, memo-save, and
  recently-viewed removal have exactly one mutation writer under
  `src/workflows/wishlist-membership/**`; app composition may project scoped
  cache results but cannot issue a second network mutation.
- App route codecs are the durable authority for migrated route views. Wishlist,
  Search, and Accommodation Detail controllers receive decoded URL props and do
  not mirror committed route state into local durable state. Transient review
  results use an exact typed one-shot history-state codec.
- `src/workflows/booking-payment/**` is the sole checkout, payment-request,
  confirmation, and reconciliation writer. Browser checkout/callback records and
  the scrubbed in-memory callback claim are correlation or recovery inputs only;
  owned reservation detail plus backend confirmation/payment status are the
  terminal authority.
- `src/workflows/listing-editor/**` is the sole Accommodation Editor mutation
  writer. It captures one route/session lease, shares one exact active Promise,
  journals committed phases, and locks uncertain mutations instead of blindly
  repeating a possibly committed request.
- `src/workflows/host-listing-management/**` is the sole host listing
  publish/unpublish/delete writer. Concurrent intents share the first active
  Promise, uncertain exact commands remain terminal, and a different command
  may proceed only after the active command settles.
- The payment-success credential boundary lives in the stable app-provider
  lifetime above session authentication and the keyed QueryClient subtree. It
  captures a valid Toss tuple in route-lifetime memory only and removes every
  success query from native and React Router history before session bootstrap or
  `RequireAuthenticatedRoute` may inspect the location.
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
              AuthIntentStableBoundary
                AuthIntentProvider (memory-only stable boundary)
                  AuthFeatureCommandProvider (session command injection)
                    keyed QueryClientProvider
                      App
                      U6 app route tree
                        semantic route-frame shell
                          optional header from app/header
                          one main landmark
                            lazy app route adapter
                              WishlistMembershipProvider on Search/Detail/Wishlist only
                              owned controller/screen
```

Current owners:

| Concern | Current owner | Notes |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React root and providers | `src/index.tsx`, `src/app/providers/AppProviders.tsx` | The one React root injects the reservation session-cleanup port; `AppProviders` mounts one `OverlayProvider` around the single `SessionProvider` and no provider creates another React root. |
| Session and authentication lifetime | `src/app/session/**`, `src/features/auth/ports/sessionPort.ts`, `src/platform/session/**` | One explicit reducer owns bootstrap, authenticated revalidation, anonymous revocation, retryable errors, subject/epoch, provider-local auth command serialization, cancellation, focus/401 handling, and cross-tab invalidation. |
| Resumable authentication intent | `src/workflows/auth-intent/**`, composed by `src/app/providers/AppProviders.tsx` | A memory-only provider outside the keyed Query subtree holds only the latest validated primitive intent. Search and Accommodation adapters atomically claim it with a captured session scope; old-generation callbacks never resume Wishlist, reservation, or coupon work. |
| Server-state client | `src/app/session/SessionProvider.tsx`, `src/platform/query/createQueryClient.ts` | Each session generation receives a new QueryClient. Leaving an authenticated identity remounts the provider subtree; feature Query options carry explicit subject/epoch scopes. |
| Authentication feature | `src/features/auth/{api,model,ports,ui}/**`, `src/screens/auth/**` | Login and signup routes render the owned controller/screen. Session owns login identity transitions; the feature owns signup transport and form behavior through the injected auth-command boundary. |
| Routing and shell metadata | `src/app/router/definitions.ts`, `manifest.ts`, `lazyRoutes.tsx`, `paths.ts` | Component-free policy and 15 literal lazy adapter entries are the active production manifest. |
| Application header | `src/app/header/**` | `Header` and `UserMenu` are app-composition owners; they consume feature public UI/ports and are injected into route frames. |
| Application shells | `src/app/shells/**` | Browse, form, transaction, editor, and bare shells are route-frame-only owners and render exactly one `main`; nested page structure uses ordinary labelled sections instead of a second shell abstraction. |
| Overlay runtime | `src/app/overlays/OverlayProvider.tsx`, `src/shared/ui/overlayRuntime.ts` | One app-owned `#airbob-portal-root` hosts Dialog and route Toast. Modal and local non-modal registrations share topmost Escape order; only modals lock scroll and isolate the app. Dialog owns focus containment, explicit initial focus, inactive-layer semantics, and focus-lineage restoration. |
| API transport and envelope | `src/platform/http/**` | One native browser transport and one `AppError` envelope boundary. Credentialed `fetch` owns ordinary JSON and multipart requests; progress-reporting multipart uploads alone use credentialed `XMLHttpRequest`. Feature adapters consume the boundary directly, and the browser owns every `FormData` content boundary. |
| Browser platform boundary | `src/platform/config/**`, `storage/**`, `integrations/**`, `assets/**`, `browser/**`, `session/**` | Owns public environment input, browser storage access, external SDK globals/scripts, image URL resolution, isolated new-tab navigation, exact current-history-entry validation, auth-error signaling, and the non-PII cross-tab channel. |
| Wishlist feature and workflow | `src/features/wishlist/**`, `src/workflows/wishlist-membership/**`, `src/screens/wishlist/**` | Feature-owned API/model/scoped read options feed a URL-prop-only screen controller. Search, Detail, and Wishlist lazy adapters mount one route-scoped provider inside the current QueryClient generation, so the writer is disposed on route departure without entering the initial app chunk. Its subject/epoch-fenced command runner owns collection/membership create, add, remove, delete, memo-save, and recently-viewed removal. App composition sends Search and Detail updates only to their owning scoped cache projections. |
| Search feature | `src/app/router/routes/SearchRoute.tsx`, `src/screens/search/**`, `src/features/search/**` | The app adapter alone owns codec parsing, page push, map-bounds replace, booking-safe detail URLs, auth-intent claim, and workflow composition. `SearchController` derives request/map/view state; feature-owned API/wire mappers and scoped Query options own server reads, cancellation, and stale-result fencing. `SearchScreen` is props-only. SearchBar receives a typed route port and its reducer owns draft/popover/IME interaction only. |
| Accommodation Detail and reservation create | `src/app/router/routes/AccommodationDetailRoute.tsx`, `src/screens/accommodation-detail/**`, `src/features/accommodations/detail/**`, `src/workflows/booking-payment/reservation-create/**` | The app adapter owns typed booking URL state, exact history-entry/session leases, auth-intent claim, checkout handoff, Wishlist composition, and recently-viewed injection. The independently ratcheted `accommodations/detail` scope owns camelCase models, queries, cache projections, coupon adapters, and detail UI; anonymous projections always mask server Wishlist membership. Screen-local review-feed, recently-viewed, coupon-command, reservation-command, and gallery hooks keep the controller compositional, and the review feed advances one cursor only after its modal sentinel becomes visible. Reservation create uses same-Promise single-flight and a conservative terminal lock, including when a route generation interrupts an already-sent command. Before its POST and again before handoff commit, the aggregate blocks a second reservation while an exact checkout/callback pair still requires payment recovery; the active documents are preserved and the user returns to reason-only reconciliation. |
| Booking checkout and payment | `src/app/router/PaymentCallbackCredentialBoundary.tsx`, `src/app/router/routes/{ReservationConfirmRoute,PaymentSuccessRoute,PaymentFailRoute}.tsx`, `src/screens/{reservation-confirm,payment-result}/**`, `src/features/reservations/payment/**`, `src/workflows/booking-payment/{checkout,confirmation}/**` | One aggregate owns the versioned checkout/callback repositories, callback claim/replay bootstrap, Toss request policy, confirmation, and status reconciliation. A payment-success-specific boundary in the stable app-provider lifetime parses the external tuple into route-lifetime memory, blocks session/auth children until both histories are credential-free, survives the authenticated QueryClient generation replacement, and releases its claim on route departure without remounting the session/query runtime. App adapters claim exact route/session generations, consume the minimal history handle, and compose props-only screens. Gateway request requires a current subject-owned checkout with no persisted callback; any callback phase returns to confirmation/reconciliation recovery and can never remount payment request. `received` proves no confirm POST boundary was crossed; ownership preflight runs first, `confirming` is durably written immediately before the sole POST, and later phases reconcile only. Document-free server replay retains its scrubbed tuple in the success route when ownership lookup is temporarily unavailable, retries preflight in place, and starts reconciliation only after exact server ownership is verified. Confirmation/reconciliation additionally verifies the authenticated guest reservation and exact reservation/order/amount/resource tuple before confirm/status I/O. Only backend confirm or exact payment status can publish success. Retryable or pending results retain owned records for reconciliation, while only exact joined invalid/terminal/session boundaries purge them. |
| Review read and submission | `src/app/router/routes/ReviewCreateRoute.tsx`, `src/screens/review-create/**`, `src/features/reservations/{api,model,queries}/reviewableReservation*`, `src/features/reviews/**`, `src/workflows/review-submission/**` | A minimal camelCase reservation read model prevents legacy reservation DTOs from reaching the screen. One create/upload workflow makes post-create terminals irreversible, preserves real multipart `FormData`, suppresses stale navigation/publication, and terminal-locks ambiguous create outcomes rather than repeating a possible committed POST. Image-only upload failure remains typed partial success. Reviews is a strict architecture root. |
| Accommodation Editor | `src/app/router/routes/AccommodationEditRoute.tsx`, `src/screens/accommodation-edit/**`, `src/features/accommodations/listing-editor/**`, `src/workflows/listing-editor/**` | The independently ratcheted `accommodations/listing-editor` scope owns the editor API, camelCase models, ports, and scoped Query projection. The app adapter owns resource/session/route provenance and injects profile publication, Daum postcode, and image URL ports. The controller hydrates one typed workflow instance and supplies only view data and callbacks to the props-only screen. The workflow owns single-flight save/publish, stale completion fences, immediate delete reconciliation, ordered upload/update/publish phases, and terminal uncertainty locks. The deleted `features/accommodations/edit/**` tree and global editor API methods cannot become a second writer. |
| Profile and reservation reads | `src/app/router/routes/{ProfileRoute,ReservationDetailRoute,HostReservationDetailRoute}.tsx`, `src/screens/{profile,reservation-detail}/**`, `src/features/{profile,reservations}/**` | App codecs are the sole Profile URL authority. Controllers consume subject/epoch-scoped Query options with explicit guest/host audience keys, cancellation, camelCase models, and props-only screens. Listing editor and host actions publish through scoped Profile/reservation cache projections. |
| Host listing management | `src/workflows/host-listing-management/**`, composed by `src/app/router/routes/ProfileRoute.tsx` | One route/session-leased writer owns publish, unpublish, and delete. API success and cache-publication failure are represented separately so the UI never repeats a possibly applied exact command. |
| Legacy global roots | none | `src/{api,components,contexts,hooks,layouts,query,routes,types,utils}` are absent and executable gates prevent reintroduction. |
| Domain-free UI | `src/shared/ui/**` | Tested primitives own Dialog, Toast, DatePicker, semantic navigation/action cards, shared non-modal overlay registration, and a typed `Icon`/glyph registry. Test-only `PageShell`, `ListingCard`, and `OverlaySurface` abstractions and all compatibility wrappers are removed. |
| Shared styling and brand assets | `src/shared/styles/**`, `src/shared/assets/**` | Global CSS imports primitive, semantic, then component tokens in one explicit order. The responsive manifest and JS `matchMedia` policy agree at the 1024px boundary; the production wordmark is manifest-owned and public PWA icons use real Airbob artwork. Vite is configured to transform the owned custom-media aliases, but `cfdb1e4` has no production alias consumer; raw media migration and built-CSS proof remain 2026-09-01 plan U15 work. Detail/editor amenity code and label registries are also still duplicated; U14 will consolidate semantics while preserving their current context-specific glyphs. |
| Build, development, and static deployment | `vite.config.ts`, root `index.html`, `vercel.json` | Vite 8 is the sole `dev`/`build`/`preview` owner on Node 22.13+ or Node 24 and retains `build/`, `build/static/`, the `/api` development proxy, CSS Modules, custom-media transforms, public assets, production JavaScript source maps, development CSS source maps, and route-level lazy chunks. The supported browser floor is Vite 8's pinned `baseline-widely-available` target (Chrome/Edge 111, Firefox 114, Safari/iOS 16.4); the old dynamic CRA Browserslist query is removed rather than implying a legacy bundle. Native ESM TypeScript config is checked by its own Node-only compiler project and exercised through Vite's resolver, ESLint, Knip, and hostile production builds. Vercel checks real files before the SPA fallback, serves hashed `/static/*` assets with immutable caching, and forces `index.html` to revalidate. |
| Compiler environments | `tsconfig.json`, `tsconfig.test.json`, `tsconfig.tooling.json`, `tsconfig.e2e.json` | TypeScript 5.9 gives production source only DOM/Vite types and separately grants Vitest, Node tooling, and Playwright their exact globals. `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUncheckedSideEffectImports`, and `erasableSyntaxOnly` are blocking. A local ambient declaration in the environment adapter exposes only the five compile-time properties that Vite explicitly substitutes; Node types never enter the browser project. |
| Local source lint environments | `eslint.config.mjs`, `tests/architecture/verify-eslint-config.mjs` | ESLint 9.39 uses native flat config and current TypeScript, React, stable Hooks, accessibility, Vitest, Testing Library, jest-dom, and Playwright plugins. Browser, Vitest/DOM/Node, Playwright/Node, ESM Node, and CommonJS Node scopes receive distinct globals; Jest globals and CRA presets are absent. Local binding/import feedback and executable process/storage/SDK/script/native-HTTP capability restrictions remain ESLint-owned, while import direction/cycles, production reachability/dependency declarations, and CSS policy remain exclusively dependency-cruiser, Knip, and Stylelint owned. Retired Axios imports and direct `fetch`/`XMLHttpRequest` use outside `src/platform/http/**` are executable failures. Unused disable directives and unused inline configs are errors; active suppressions require a narrow, reviewable reason. React Compiler-only ref/effect/memo adoption rules are explicitly outside this cutover so they cannot silently force semantic rewrites of established overlay/session/payment runtimes. |
| Mechanical formatting | `.prettierrc.json`, `.editorconfig`, `.prettierignore`, `tests/architecture/verify-prettier-config.mjs` | Prettier 3.9 is the sole layout owner for active source, tests, configuration, and compact current documentation. EditorConfig fixes UTF-8, LF, final newlines, and two-space indentation. This registry, the browser-data inventory, and the ownership matrix retain compact hand-maintained tables to avoid whole-row churn; generated build/test artifacts, npm's lockfile, local tool state, binary assets, archived docs, and historical superpowers plans are also outside Prettier ownership. `format:check` is part of the canonical architecture gate. |
| Unit and integration tests | `vitest.config.ts`, `src/test/setup.ts`, colocated `*.test.*` and `*.spec.*` files | Vitest 4 and jsdom share the Vite module graph, run files with one worker and ordered hooks, expose Vitest globals with explicit TypeScript/ESLint ownership, and use non-scoped CSS Module names only inside tests. The setup owns jest-dom matchers and portal cleanup; native `fetch`/`XMLHttpRequest` behavior and React Router use real browser/package contracts rather than virtual production-module shims. Vite's test mode performs no browser-public environment substitution. `npm run test:ci:no-cache` is the current evidence and enforces coverage floors of 87/79/89/89 for statements/branches/functions/lines without duplicating volatile suite counts here. `react-scripts`, `@types/jest`, global Jest aliases, virtual real-module mocks, and `requireActual` shims are absent. |
| Browser smoke | `scripts/smoke/frontend-smoke.mjs` | Live backend, browser, credentials, and stable IDs are external prerequisites. |
| Deterministic browser characterization | `playwright.config.ts`, `tests/e2e/**` | Loopback production app plus an exact synthetic HTTPS `.invalid` API origin, synthetic session/API fixtures, and default-deny network. |
| Static architecture gates | `.dependency-cruiser.cjs`, `knip.json`, `stylelint.config.mjs`, `architecture-ratchet.json` | The production graph and Knip reachability/export surface are globally strict. The feature registry remains the monotonic owner for migrated dependency/style policy while measured legacy CSS debt stays visible. |

## Route inventory

`src/app/router/definitions.ts` owns route policy and
`src/app/router/lazyRoutes.tsx` owns the exhaustive direct lazy adapter mapping.
`src/app/router/RequireAuthenticatedRoute.tsx` owns protected-route state and
safe return targets. Every route adapter delegates to an app/screen-owned body;
there is no legacy route manifest, path/query copy, layout, or route body.

| ID | Path | Auth | Shell | Active adapter | Active body |
| ----------------------- | -------------------------------------------- | --------- | -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| home | `/` | public | browse | `app/router/routes/HomeRoute.tsx` | `screens/home/HomeScreen.tsx` |
| search | `/search` | public | browse/search header | `app/router/routes/SearchRoute.tsx` | `screens/search/SearchController.tsx` → `SearchScreen.tsx` |
| accommodation-detail | `/accommodations/:id` | public | browse | `app/router/routes/AccommodationDetailRoute.tsx` | `screens/accommodation-detail/AccommodationDetailController.tsx` → `AccommodationDetailScreen.tsx` |
| accommodation-confirm | `/accommodations/:id/confirm` | protected | transaction | `app/router/routes/ReservationConfirmRoute.tsx` | `screens/reservation-confirm/ReservationConfirmController.tsx` → `ReservationConfirmScreen.tsx` |
| accommodation-edit | `/accommodations/:id/edit` | protected | editor | `app/router/routes/AccommodationEditRoute.tsx` | `screens/accommodation-edit/AccommodationEditController.tsx` → `AccommodationEditScreen.tsx` |
| wishlist | `/wishlist` | protected | browse | `app/router/routes/WishlistRoute.tsx` | `screens/wishlist/WishlistController.tsx` |
| profile | `/profile` | protected | browse | `app/router/routes/ProfileRoute.tsx` | `screens/profile/ProfileController.tsx` → `ProfileScreen.tsx` |
| host-reservation-detail | `/profile/host/reservations/:reservationUid` | protected | transaction | `app/router/routes/HostReservationDetailRoute.tsx` | `screens/reservation-detail/ReservationDetailController.tsx` → `ReservationDetailScreen.tsx` |
| reservation-detail | `/reservations/:reservationUid` | protected | transaction | `app/router/routes/ReservationDetailRoute.tsx` | `screens/reservation-detail/ReservationDetailController.tsx` → `ReservationDetailScreen.tsx` |
| reservation-review | `/reservations/:reservationUid/review` | protected | form | `app/router/routes/ReviewCreateRoute.tsx` | `screens/review-create/ReviewCreateController.tsx` → `ReviewCreateScreen.tsx` |
| payment-success | `/reservations/:reservationUid/success` | protected | transaction | `app/router/routes/PaymentSuccessRoute.tsx` | `screens/payment-result/PaymentResultController.tsx` → `PaymentResultScreen.tsx` |
| payment-fail | `/reservations/:reservationUid/fail` | protected | transaction | `app/router/routes/PaymentFailRoute.tsx` | `screens/payment-result/PaymentResultController.tsx` → `PaymentResultScreen.tsx` |
| login | `/login` | public | form/hidden header | `app/router/routes/LoginRoute.tsx` | `screens/auth/AuthController.tsx` |
| signup | `/signup` | public | form/hidden header | `app/router/routes/SignupRoute.tsx` | `screens/auth/AuthController.tsx` |
| not-found | `*` | public | bare/hidden header | `app/router/routes/NotFoundRoute.tsx` | `screens/not-found/NotFoundScreen.tsx` |

All 15 entries are lazy. Each is a literal import and remains a separate
route-level adapter entry. `src/app/header/**` owns Header/UserMenu composition, while
`src/app/shells/**` owns route framing and the sole `main` landmark contract.
The retired legacy source roots are absent from src.

## Current state ownership

| State | Current authority | Current synchronization |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route path and builder | `src/app/router/paths.ts` | Every route and card URL is built through `routeTo`; no second path table exists. |
| Route query shape | `src/app/router/codecs/**` | Canonical parse/serialize contracts exist at the app boundary. Login return, Wishlist, Search, Profile, Accommodation booking, typed review completion, Payment Success callback, and Payment Fail reason consume them now. Profile direct loads and back/forward navigation derive their view directly from the codec without mirrored durable state. Before authentication renders, the payment credential boundary parses the external tuple, replace-scrubs native history, synchronizes React Router with null state, and retains the claim in memory only. The success adapter delegates exact claim/replay policy to the booking-payment workflow; the fail route serializes only a typed reason. |
| Search state | App `searchCodec` output, feature Query state, SearchBar interaction reducer, bottom-sheet state, and map instance refs | The URL is the committed destination/date/guest/bounds/page authority. Query owns result/loading/error/cancellation, the reducer owns input draft/active overlay/IME state only, and map/SDK objects remain integration-local and disposable. |
| Wishlist route view | `wishlistCodec` output passed by the app adapter | The URL is the sole durable view authority; `WishlistController` derives index/detail/recently-viewed state without mirroring it into React state. |
| Profile route view | App `profileCodec` output passed by the app adapter | The URL is the sole durable guest/host tab and filter authority; the controller owns only transient sort, dialog, pending, and dismissed-error state. |
| Server resources | Session generation QueryClient plus feature-owned TanStack Query options | U5 physically replaces and clears the client at an identity boundary. Wishlist, Search, Accommodation Detail/coupons, Reviews, Profile host listings, and guest/host reservation reads include subject/epoch keys/meta and forward cancellation. Guest/host audience and filter identity are explicit key inputs, and app composition reconciles only the captured scope through owning projections. |
| Viewer identity | `SessionProvider` explicit reducer state | A non-PII subject and monotonic epoch define identity lifetime. Consumers use `useSession` or narrow injected feature-command ports; no mirrored auth context exists. |
| Checkout recovery | `airbob:booking-payment-v1:checkout` plus a typed history handle | One static, subject-owned versioned record retains the exact checkout allowlist for 60 minutes; the history entry carries only purpose/version/operation ID and is replace-consumed. Foreign, expired, malformed, wrong-purpose/version, unknown-field, route-mismatched, and operation-mismatched inputs fail closed. A handoff mismatch that may reference another current checkout preserves it. Missing or unusable state is cleared and opens guest trips rather than inviting another reservation command. Retired input never triggers migration or backend recovery. Name and email never enter the record. |
| Payment callback and confirm dedupe | stable-lifetime in-memory pre-auth claim, `airbob:booking-payment-v1:callback`, and the confirmation workflow instance | The pre-auth claim exists only for the scrubbed success-route lifetime but survives the session QueryClient generation switch. A subject-owned sensitive callback record with a sliding 15-minute TTL then retains the exact tuple and the `received`, `confirming`, or `reconciling` phase; every successful callback write first refreshes the joined checkout's longer 60-minute lifetime. A fresh callback joined to the current checkout starts at confirm-capable `received`; existing `confirming` and `reconciling` records are reconciliation-only. Exact concurrent commands share one active Promise; a possibly sent confirm is never repeated and later attempts reconcile. Reopening confirm while any joined callback exists routes to reason-only recovery without mounting the gateway. Retired browser markers are ignored. |
| Cross-tab session signal | `src/platform/session/sessionBroadcast.ts` | A same-origin BroadcastChannel exchanges only an exact non-PII transition envelope and drives invalidate-before-revalidate handling. |
| Accommodation editor | One `listing-editor` workflow instance with an explicit state machine, operation journal, committed baseline revision, and route/session lease | The app route composes external ports; the controller owns React view derivation; the workflow serializes delete/save/publish commands, rejects stale completions, and exposes typed hydration, retryable, denied, invalid, and uncertainty-locked terminals. |
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
- An identity boundary advances the epoch, clears the current owned
  `airbob:booking-payment-v1:` checkout/callback namespace and purge-deletes
  exact retired payment-prefix keys without reading them through the injected
  booking-payment cleanup port, cancels and clears the previous
  QueryClient, and creates a new subject/epoch generation before publishing the
  next viewer. When an authenticated identity is fenced, a generation key
  remounts the QueryClient subtree so late mutation callbacks from the old tree
  cannot write into the new viewer's client. When no authenticated identity is
  present, the anonymous/error client is instead cancelled, cleared, and
  re-scoped in place; a failed login can therefore retain its modal intent,
  inputs, and exact error. A successful viewer probe replaces and remounts that
  client only after payment cleanup completes. Current-namespace and retired-key
  cleanup each retry one partial/storage-failed pass; a final non-cleared result is
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
- The former feature session hook/lifecycle and global Query roots are deleted.
  `SessionProvider` plus `createQueryClient` are the only client-lifetime owners.

The U5 generation boundary is the physical owner for every feature Query. Each
feature now supplies scoped keys/meta, cancellation, read adapters, and narrow
cache projections. Wishlist, Search, Accommodation Detail/coupons/Reviews,
booking-payment, Accommodation Editor, Profile, and guest/host reservation reads
capture explicit subject/epoch/resource identity. Every command workflow checks
its route/session lease before UI, cache, storage, or navigation publication.
There is no production `userScopedQueryRoots` registry, singleton QueryClient,
function-identity scope inference, global Query facade, or rollback reader.

## API and external integrations

### API boundary

- `src/platform/http/clientCore.ts` owns the transport factory and native
  request mechanics. The thin `src/platform/http/client.ts` browser adapter
  injects the public API base URL, `fetch`, and `XMLHttpRequest`, and exposes the
  only production singleton. Ordinary requests use credentialed `fetch`;
  multipart uploads that report progress alone use credentialed
  `XMLHttpRequest`. Feature API adapters import the singleton boundary directly.
- `src/platform/http/envelope.ts` and `errors.ts` own the migrated
  `AppError` boundary. Raw browser transport failures do not cross into features,
  screens, or application composition.
- Auth, Wishlist, Search, Accommodation Detail/coupons, Accommodation Editor,
  Profile host listings, reservation reads/create/payment, and Review methods, wire types, and
  mappers are owned by
  `src/features/auth/{api,model}/**`,
  `src/features/wishlist/{api,model}/**`,
  `src/features/search/{api,model}/**`,
  `src/features/accommodations/detail/{api,model}/**`,
  `src/features/accommodations/listing-editor/**`,
  `src/features/reservations/{api,model}/**`,
  `src/features/reservations/payment/{api,model,ports}/**`, and
  `src/features/reviews/{api,model}/**`. The global API and DTO roots are
  deleted. Host listing commands use the parent-owned
  `src/features/accommodations/api/hostListingActionsApi.ts` transport only
  through the host-listing-management workflow and never import the nested
  editor owner.
- UI components and route containers are kept away from direct API and wire-DTO
  imports by dependency-cruiser rules with failing fixtures.
- Wire payload fields are TypeScript types; arbitrary domain payloads are not
  runtime-decoded today.

### External browser contracts

| Integration | Current owner | Runtime form |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Maps/Places | `src/platform/integrations/{googleMaps,googlePlaces,useGoogleMapsScript}.ts` plus Search-owned Places hook | Exact HTTPS singleton loader, typed terminal states, validated runtime access, lazy Places activation, and bounded SDK/DOM resource cleanup. The unused global hook facades are deleted. |
| Daum postcode | `src/platform/integrations/daumPostcode.ts`, injected into the editor by `src/app/router/routes/AccommodationEditRoute.tsx` | Lazy exact HTTPS loader, callback validation, and abortable open operation; the props-only screen never imports the browser integration. |
| Toss Payments | `src/platform/integrations/tossPaymentsV2.ts`, adapted by `src/workflows/booking-payment/checkout/paymentGateway.ts` | Pinned official npm SDK v2 behind the unchanged `PaymentGatewayPort`. The adapter owns one bounded, client-key-scoped load, initializes the direct payment window with `ANONYMOUS`, and maps the existing request to `CARD`/`KRW`; a route-owned gateway lease reuses that client and destroys its launcher on route departure. The workflow adapter owns safe error policy and duplicate-request fencing. The retired v1 source is removed; immutable Git commit `408d303` and its Vercel deployment are the U10 comparison/rollback target. |
| CloudFront images | `src/platform/assets/imageUrl.ts` | Validated HTTPS asset host; consumers import the platform owner or receive a narrow injected resolver. |
| Environment | `src/platform/config/env.ts`, `publicRuntimeConfigCore.ts`, `publicRuntimeConfig.ts`, `vite.config.ts`, `scripts/architecture/validate-public-build-env.mjs` | `publicRuntimeConfigCore.ts` owns pure validation and config creation from an injected browser-environment value. The thin `publicRuntimeConfig.ts` browser adapter reads mode plus four explicitly mapped browser-public values while preserving the existing `REACT_APP_*` deployment names. Vite consumes validated build-only `PUBLIC_URL` as its asset base; preflight permits only empty, single-slash root-relative, or absolute HTTPS asset bases with percent-free safe paths. Runtime and build validation reject percent encoding and server-secret key shapes in every public exposure; Google Maps also uses a browser-key-safe character set. |

`src/platform/storage/sessionStorageDriverCore.ts` owns the injectable storage
driver factory, while the thin `sessionStorageDriver.ts` browser adapter exposes
the only production `sessionStorage` singleton. The platform storage boundary
also owns the generic versioned envelope engine. The booking-payment aggregate
is its active domain writer through that named storage driver: static
checkout/callback slots carry purpose, version, privacy/PII classification,
stable subject, creation/expiry, exact field allowlists, invalid-record purge,
and session/route fences.
The active aggregate has no pre-U10 reader, migration branch, or
confirmed-marker consumer. Residual retired values are ignored for recovery;
exact retired-prefix keys are purge-deleted without reading their contents at
identity and terminal cleanup boundaries. Only the current versioned namespace
participates in checkout and callback recovery.

## Current dependency boundaries

Feature ownership boundaries are closed. Production contains no feature-owned
`appShell.ts` or `publicCache.ts` files, and dependency-cruiser rejects every
feature-to-peer production import regardless of its filename. Cross-feature
composition belongs to app adapters and workflows consuming feature-owned
public ports and scoped cache projections.

The former AuthContext-owned `auth -> reservations` cleanup edge is gone. The
app root now composes the session owner with the reservation cleanup public port
without making either feature own the other.

Consequences:

- Search and Accommodation Detail receive Wishlist commands at app composition
  and own their cache projections; neither screen imports a private peer surface.
- The former Accommodation/Review and Accommodation Editor/Profile feature
  cycles and the Detail compatibility
  projection are deleted. Reviews is a strict migrated feature root, while
  Accommodation Detail and Accommodation Editor are independently enforced as
  the nested `accommodations/detail` and `accommodations/listing-editor`
  ownership scopes. The editor publishes reconciled listing results to Profile
  only through an app-injected public port.
- `src/app/header/**` imports Search only through `features/search/ui/**`, Auth through its
  public surface, and accommodation draft creation through a narrow port; it no
  longer pulls the accommodation action modal through a broad app-shell seam.
- Every top-level and declared nested feature scope has no feature-peer imports,
  and the current source graph is acyclic with no dependency warnings or errors.
- The active `src/app/shells/ShellFrame.tsx` is the sole production `main` owner.

The architecture registry supplies executable ownership for this graph. Every
discovered top-level and declared nested feature scope is in the migrated registry;
feature-to-peer imports and reintroduced global API/DTO roots fail fixtures.
Global strict-production Knip reachability/export enforcement, global
full-development and strict-production dependency classification, strict
Stylelint, architecture tools, strict ESLint, typecheck, and deterministic
interaction/browser coverage pass. Production-unused files, value exports, type
exports, and duplicate exports are all zero without a target preprocessor,
per-file ignore, artificial entry, or test-only production consumer.
`architecture-ratchet.json` promotes a feature scope to strict
dependency and style enforcement in its cutover commit; it does not narrow the
global Knip gate. The registry rejects missing/test-only roots and live
downgrades against the PR base;
JavaScript, JSX, and MJS share the same strict lint/reachability coverage as
TypeScript, including production `.web.mjs` modules through the `.mjs` suffix.
Unused, unlisted, or misclassified runtime/development packages are globally
blocking without a historical baseline. New or renamed feature roots must enter the
registry atomically, and current discovery must equal the registry in both
directions; parent features cannot borrow nested-feature source to pass
promotion. Knip's source coverage and error-level rules are canonical, and this
private app forbids optional/peer runtime dependency sections and install-graph
redirection. Dependency declarations use registry semver only; aliases,
tags, URLs, local paths, and Git specs are rejected. Feature ownership also
rejects symbolic links, so a renamed slice cannot escape strict promotion by
aliasing its old implementation.

The hostile production-build verifier measures the Vite initial JavaScript graph
as the entry plus every document module-preload rather than reporting only the
smaller-looking `index-*` file. Retiring Axios in favor of the native platform
transport reduces that graph without changing the API contract. Root
`frontend-bundle-budgets.json` is the single executable source for the initial
graph and lazy-route budgets; the verifier prints current measurements and
fails any overage. The same command verifies every registered lazy route's
incremental static-import graph and its JavaScript source map, rejects unresolved
custom-media syntax, and scans built JavaScript/maps for forbidden public-config
canaries. Vite 8 does not emit separate production CSS map assets in this
pipeline, so the contract states that limitation instead of claiming nonexistent
parity. The executable final budget, rather than this measured snapshot, remains
the blocking source of truth.

### Static deployment and rollback contract

- The checked-in Vercel configuration runs the canonical build and deploys
  `build/`. Its SPA rewrite is evaluated after the deployment filesystem, so
  public files and hashed `/static/*` chunks are never replaced by `index.html`.
- Hashed files use `Cache-Control: public, max-age=31536000, immutable` and
  `index.html` uses `public, max-age=0, must-revalidate`. A fresh document
  therefore receives current chunk references while content-addressed assets
  may be cached safely.
- Keep the last known-good commit-specific deployment and its Git identity.
  Rollback restores that immutable deployment/alias as one unit; do not combine
  HTML from one deployment with chunks from another or rebuild an old commit
  under a new, unrecorded environment.
- Vercel's retained deployment URL proves that the old build can still serve
  its own assets, but a plain Vite SPA does not by itself pin an already-open
  production-alias tab to that deployment. The pre-opened-tab lazy-chunk check,
  Preview deep links, OCI, and Toss sandbox remain live deployment evidence and
  are explicitly deferred while the backend is unavailable.

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
- Profile guest/host modes, filters, and wishlist views restored from their URLs.
- Guest and host reservation list/detail navigation, pagination, status display,
  cancellation/review actions, and host listing publish/unpublish/delete flows.

## Remaining migration delta and target owner

This table is architectural scope, not implementation progress. Active cutover
status lives in [`frontend-ownership-matrix.md`](./frontend-ownership-matrix.md).

| Delta | Planned owner |
| --------------------------------------------------------------------------------------- | ------------- |
| Detail/availability and current quote → checkout → payment-operation contract alignment | 2026-09-01 plan U2–U3 |
| Deterministic payment matrix and real local-backend profile evidence | 2026-09-01 plan U11–U12 |
| Editor commands, semantic amenity catalog, PageContainer and responsive/runtime-token ownership | 2026-09-01 plan U13–U15 |

## Verification contracts

Current local and CI commands are defined in `package.json` and
`.github/workflows/frontend.yml`:

- `npm run typecheck`
- `npm run test:ci:no-cache`
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
- `npm run lint:dependencies`
- `npm run lint:styles`
- `npm run format:check`
- `npm run audit:production`
- `npm run verify:architecture`
- `npm run report:architecture`
- `npm run verify:structure`
- `npm run verify:browser`
- `npm run verify:pre-redesign`
- `npm run verify:design-ready`
- `npm run smoke:frontend:preflight`
- `npm run verify:live-integration`

The deterministic browser suite proves the current synthetic flow matrix; it
does not prove a live backend, Google Maps, Toss sandbox, or seeded dynamic-route
behavior. `verify:design-ready` and `verify:pre-redesign` are the same offline
design-entry gate. `verify:live-integration` is separate; fixture omissions and
unavailable external services remain deferred and unverified.

## Document authority

| Document | Authority |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| This document | Current production architecture and unresolved delta. |
| `frontend-ownership-matrix.md` | Mutable cutover owner registry. |
| `frontend-migration-rules.md` | Execution rules for every migration slice. |
| `frontend-browser-data-inventory.md` | Browser persistence, ownership, PII, TTL, and cleanup inventory. |
| `tests/architecture/dependency-rules.md` | Executable static-rule owners, global production reachability/export policy, strict feature promotion, and tool transition. |
| `docs/plans/2026-09-01-001-refactor-local-backend-contract-alignment-plan.md` | Active target architecture and implementation units. |
| `docs/qa/2026-09-01-frontend-architecture-independent-read-only-reaudit.md` | Current independent audit evidence for the frontend/backend revisions above. |
| `docs/plans/2026-08-29-001-refactor-frontend-architecture-overhaul-plan.md` | Superseded historical plan; not executable. |
| `docs/qa/frontend-architecture-smoke.ko.md` | Live-only Vercel/OCI/Maps/Toss sandbox runbook. |
| `frontend-architecture-freeze.ko.md` | Superseded July snapshot. |
| `frontend-structure-refactor.md` | Superseded July outcome record. |
| `docs/superpowers/plans/**` | Superseded historical plans; not executable. |

When documents disagree about the current frontend, this document wins. When
the production graph changes, update this document and the ownership matrix in
the same migration unit.
