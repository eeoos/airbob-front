# Frontend Ownership and Cutover Matrix

> Operational registry for the migration described by the active plan.  
> Baseline state: U1, production code at `07a1fdf`.  
> Current architecture meaning comes from
> [`current-frontend-architecture.md`](./current-frontend-architecture.md).

This file is deliberately mutable. Each implementation unit updates the rows it
owns in the same change that switches a production consumer. It records runtime
ownership; it is not a substitute for git history or plan progress.

## Registry rules

- **Active** is the only production route entry or mutation writer at this
  revision.
- **Compatibility reader** can read old data but cannot perform a second write.
- **Rollback** names the reader or artifact that makes a revert possible. It is
  never permission to mount old and new writers together.
- **Removal condition** must be satisfied in the named unit before a legacy
  surface is deleted.
- `none` means no compatibility layer exists or is required.

## Core architecture slice registry

The detailed route and workflow tables below refine these seven required owner
classes. No category may be inferred from a historical plan.

| Slice | Current/old owner | Target/new owner | Active writer at U1 | Read compatibility | Rollback reader/artifact | Removal condition |
| --- | --- | --- | --- | --- | --- | --- |
| Route manifest | `src/routes/routeDefinitions.ts`, `routeConfig.tsx`, `paths.ts` | `src/app/router/**` | current/old route manifest | Target adapters may consume current pure route metadata during U6 | Current exhaustive lazy manifest and path builders | Per-route switch in U7-U13/U21; legacy manifest removed U22 after all 15 entries move |
| URL/query | builders in `src/routes/routeQueryContracts.ts`; parsers and mirrored state in feature routes/libs | route-local codecs under `src/app/router`/target screens | current builders plus distributed feature parsers/controllers | New codecs accept current canonical query forms; no dual navigation writer | Existing builders/parsers plus captured deep-link corpus | Switch codec with each route; distributed parsers/mirrors removed by U8/U13 and final aliases U22 |
| Query/cache | `src/query/**`, feature `queryKeys.ts`/hooks, `publicCache.ts`, manual session-root registry | session-scoped Query option factories and feature repositories | current feature hooks/cache helpers | New options may read/refetch the same server resources; no persistent cache migration | Current QueryProvider/hooks and server refetch | U5 switches session lifetime; slice helpers move U7-U13; registry/public seams removed U22 |
| Domain mutation | feature hooks/routes and API wrappers | explicit `src/workflows/**` commands plus feature ports | current feature mutations | Target result may be projected into legacy read caches, but no adapter may repeat the server mutation | Existing route/hook behind unchanged API contract | Switch one workflow in U7/U9/U10/U12/U13; old writer deleted in its switching unit |
| Browser storage | reservation checkout/index and payment-attempt helpers | platform storage plus owned booking-payment repository | current reservation/payment helpers | U10 may one-way read only server-validated legacy records | Immutable current helper for pre-cutover; immutable U10 repository for U11 rollback | Legacy checkout/marker writer removed U10; v1 gateway artifact removed U11 after rollback proof |
| Shell/overlay | `src/layouts/**`, AppHeader feature seams, current Dialog/Toast/body locks | `src/app/shells/**` and OverlayProvider runtime | current layouts/local overlay owners | Existing Dialog public API remains while consumers move | Current main/bare/search-header shell mapping | Shell policy introduced U6, runtime U19, consumers U7-U14; legacy layouts/seams removed U22 |
| Screen | lazy feature route containers mixing orchestration and presentation | `src/screens/**` props-only screens with app route controllers | current feature route modules | Temporary route adapters translate current URL/state and feature results | Current lazy module for the route being switched | Per-route characterization passes and route manifest switches; old screen deleted in U7-U13/U21 |

## Route ownership

At U1 every target entry is planned and every current route listed below remains
the active production entry.

| Route ID | Current/old owner | Target/new owner | Active at U1 | Compatibility reader | Rollback before target cutover | Removal condition |
| --- | --- | --- | --- | --- | --- | --- |
| home | `src/features/home/HomeRoute.tsx` | `src/app/router/routes/HomeRoute.tsx` + `src/screens/home/HomeScreen.tsx` | current/old | none | Current manifest entry | Target direct-load/lazy parity; remove old in U21 |
| search | `src/features/search/SearchRoute.tsx` | app Search route + `src/screens/search/**` | current/old | Wishlist legacy projection may temporarily read new membership workflow after U7 | Current manifest entry and URL codec | New URL/Query/map owner green; remove old and search projection adapter in U8 |
| accommodation-detail | `src/features/accommodations/AccommodationDetailRoute.tsx` | app detail route + `src/screens/accommodation-detail/**` | current/old | Wishlist legacy projection after U7 | Current manifest entry and booking handoff | Detail, booking, review, membership parity; remove old/detail projection in U9 |
| accommodation-confirm | `src/features/reservations/ReservationConfirmRoute.tsx` | app confirm route + `src/screens/reservation-confirm/**` | current/old | Legacy checkout record may be one-way read after validation | Current manifest entry, current checkout record, Toss v1 adapter | One payment aggregate and storage contract green; remove old in U10 |
| accommodation-edit | `src/features/accommodations/edit/AccommodationEditRoute.tsx` | app edit route + `src/screens/accommodation-edit/**` | current/old | Existing navigation state and persisted server detail | Current manifest entry | Editor transition/order/stale tests green; remove old in U12 |
| wishlist | `src/features/wishlist/WishlistRoute.tsx` | app Wishlist route + `src/screens/wishlist/**` | current/old | Existing URL query decoded by new codec during switch | Current manifest entry | New screen and single mutation writer green; remove old in U7 |
| profile | `src/features/profile/ProfileRoute.tsx` | app Profile route + `src/screens/profile/**` | current/old | Existing URL query decoded by new codec during switch | Current manifest entry | Guest/host URL and panel parity; remove old in U13 |
| host-reservation-detail | `src/features/reservations/HostReservationDetailRoute.tsx` | app host-detail route + reservation-detail screen package | current/old | none | Current manifest entry | Host detail terminals and API mapper parity; remove old in U13 |
| reservation-detail | `src/features/reservations/ReservationDetailRoute.tsx` | app reservation-detail route + `src/screens/reservation-detail/**` | current/old | none | Current manifest entry | Detail, cancel/review navigation and cache parity; remove old in U13 |
| reservation-review | `src/features/reviews/ReviewCreateRoute.tsx` | app Review route + `src/screens/review-create/**` | current/old | Existing result handoff only | Current manifest entry | Review partial-success workflow green; remove old in U9 |
| payment-success | `src/features/reservations/PaymentSuccessRoute.tsx` | app success route + `src/screens/payment-result/**` | current/old | Validated legacy checkout/marker read only | Current manifest entry, current v1 adapter | Confirmation/reconciliation workflow green; remove old in U10 |
| payment-fail | `src/features/reservations/PaymentFailRoute.tsx` | app fail route + `src/screens/payment-result/**` | current/old | Validated legacy checkout/marker read only | Current manifest entry, current v1 adapter | Failure/status recovery workflow green; remove old in U10 |
| login | `src/features/auth/LoginRoute.tsx` | `src/app/router/routes/LoginRoute.tsx` + `src/screens/auth/**` | current/old | Structured internal return target | Current manifest entry | Session/return/auth screen parity; remove old in U7 |
| signup | `src/features/auth/SignupRoute.tsx` | `src/app/router/routes/SignupRoute.tsx` + `src/screens/auth/**` | current/old | Structured internal return target | Current manifest entry | Signup validation/navigation parity; remove old in U7 |
| not-found | `src/routes/NotFoundRoute.tsx` | app NotFound route + `src/screens/not-found/**` | current/old | none | Current manifest entry | Bare-shell/direct-route parity; remove old in U21 |

## Mutable workflow and state ownership

| Capability | Current/old owner and writer | Target/new owner | Active writer at U1 | Allowed read compatibility | Rollback/removal condition |
| --- | --- | --- | --- | --- | --- |
| Auth bootstrap/login/logout/401 | `AuthContext.tsx`, `useSessionQuery.ts`, `sessionLifecycle.ts`, auth event bus | `src/app/session/**` with feature auth port | current/old | AuthContext adapter may expose new session during consumer migration | U5 proves states, epoch, cache/storage cleanup; AuthContext removed after last consumer in U22 |
| Protected return target | React Router `location.state` read by auth route/RequireAuth | app internal-return codec and route adapter | current/old | Current structured pathname/search/hash | U6 codec rejects external targets; old parser removed with auth route in U7 |
| Query session cleanup | `src/query/sessionCacheBoundary.ts` manual `userScopedQueryRoots` | App session subject/epoch and scoped Query options | current/old | none | U5 eliminates manual root registry after A→B isolation passes |
| Wishlist mutation | Wishlist hooks and API; cache effects in `wishlistCacheSync.ts` and public cache seams | `src/workflows/wishlist-membership/**` plus feature reconciliation ports | current/old | Read/write compatibility adapter may project new result into legacy Search/Detail caches; it must not issue a second mutation | U7 switches writer; Search branch removed U8, detail branch U9, remaining public seam U22 |
| Search request/navigation | `useSearchResults.ts`, `useSearchRouteController.ts`, SearchBar/map hooks | Search controller, URL codec, Query options, narrow interaction reducer | current/old | Current URL query | U8 switches route/controller and removes legacy route/app-shell leak |
| Reservation create/handoff | `useAccommodationBooking.ts`, `reservationCheckoutHandoff.ts` | booking-payment reservation-create capability | current/old | Existing checkout route state and validated legacy record | U9 proves single-flight and stale route/session fence; old booking writer removed |
| Checkout request | `ReservationConfirmRoute.tsx`, `reservationCheckoutState.ts`, current Toss v1 helper | booking-payment checkout repository/reducer using gateway port | current/old | One-way read of legacy record only when server data proves owner/order/amount | U10 leaves one checkout path and deletes ReservationModal/useReservationPayment; U11 swaps adapter only |
| Payment confirmation/status | success/fail routes, `usePaymentConfirmation.ts`, attempt registry, status hook | booking-payment confirmation reducer/repository | current/old | Validated legacy marker/record for reconciliation only | U10 switches writer and deletes legacy routes/registry after parity; U11 must read U10 records on rollback |
| Toss runtime | CDN v1 global in `features/reservations/lib/tossPayments.ts`; npm v2 installed but unused | `src/platform/integrations/tossPaymentsV2.ts` behind PaymentGateway | CDN v1 | U10 v1 adapter is rollback artifact, never mounted with v2 | U11 sandbox/callback/rollback evidence, then v1 source removed |
| Review create/images | `useReviewCreate.ts`, `ReviewCreateRoute.tsx` | `src/workflows/review-submission/**` | current/old | Existing result navigation state | U9 proves create/upload partial terminal and removes old writer |
| Accommodation editor | edit controller plus detail/images/upload/save hooks and refs | listing-editor reducer/commands/controller | current/old | Existing created-draft route state and server detail | U12 proves operation journal/order/stale fences and removes old writer/types cycle |
| Profile guest/host route view | `ProfileRoute.tsx` URL mirrored to local state | Profile codec + controller/screen | current/old | Existing URL query | U13 removes mirrored state and legacy route |
| Guest/host reservation lists | panels/hooks; `useReservationList.ts` infers scope from fetch function identity | Explicit scoped feature Query options and Profile screen | current/old | none | U13 proves distinct keys under wrapped functions and removes identity inference |
| Host listing mutations | `HostListingsPanel.tsx`, accommodation app-shell modal/public cache | host-listing-management workflow and feature ports | current/old | none | U13 switches writer; appShell/publicCache deleted U22 |
| Dialog/Toast/scroll lock | Shared Dialog plus route-local placement/body lock | App OverlayProvider and current Dialog public API | current/old | Existing Dialog API only | U19 switches runtime owner; U14 migrates all consumers; local owners removed |

## Infrastructure and compatibility ownership

| Surface | Current owner | Target owner | Cutover/removal |
| --- | --- | --- | --- |
| Route definitions/lazy mapping | `src/routes/**` | `src/app/router/**` | U6 introduces pure definitions/mapping; route entries move per slice; legacy root removed U22 |
| Axios/envelope/error | `src/api/client.ts`, `request.ts`, `response.ts` | `src/platform/http/**` | U4 introduces facade; feature adapters move U7-U13; global API root removed U22 |
| Domain API/wire DTO | `src/api/*.ts`, `src/types/**` | `src/features/*/api|model|query` | Move with the consumer slice; global roots/aliases removed U22 |
| Environment | direct `process.env.REACT_APP_*` | `src/platform/config/**` | U4 adapter first; Vite input mapping U16; no direct consumer after U22 |
| Google/Daum/Toss globals | shared/feature hooks and `public/index.html` | `src/platform/integrations/**` | Google/Daum U4/U8/U12; Toss workflow U10 and SDK U11 |
| Cross-feature seams | `features/*/appShell.ts`, `publicCache.ts`, route barrels | app composition and workflows/reconciliation ports | Consumers move U7-U13; all seams deleted U22 |
| UI structural runtime | MainLayout, current Dialog/Toast, component-local responsive logic | app shells/overlays and shared responsive policy | Shell definitions U6, runtime U19, adopters U14 |
| Tokens/assets/primitives | `src/styles`, `src/shared/ui`, `src/components`, `src/assets` | `src/shared/styles|ui|assets` | U15 migrates actual consumers; empty/unused legacy roots U22 or U15 as assigned |
| Build/dev | CRA `react-scripts` | Vite | U16 retains `build/`, env/proxy/assets/chunk parity; CRA test remains temporarily |
| Unit/integration runner | CRA Jest | Vitest | U17 uses disjoint ownership inventory; removes Jest/react-scripts after last suite |
| Compiler/lint/format | TypeScript 4.9 and CRA ESLint presets | TypeScript 5.x and explicit static-tool owners | U23 after Vitest; formatting is final mechanical pass |

## U10/U11 payment compatibility matrix

| Runtime | Records it may read | Writer | Rollback expectation |
| --- | --- | --- | --- |
| Pre-U10 legacy | Unversioned checkout/index and confirmed marker | Legacy route/hooks | Baseline only; no forward guarantee before U10 migration reader exists |
| U10 with Toss v1 adapter | New owned/versioned checkout and callback records; server-validated legacy one-way input | booking-payment aggregate only | Immutable U10 build must read its own records |
| U11 with Toss npm v2 | Same U10 repository/schema | booking-payment aggregate through v2 gateway only | SDK swap must not change storage or callback/server-confirm contract |
| U11 rollback to U10 build | U10 records written before rollback | U10 aggregate through v1 gateway | Retryable checkout/callback reconciles through server status; v1/v2 are never active together |

If implementation needs a record shape that breaks this matrix, update the
active plan and browser-data inventory before changing a writer.
