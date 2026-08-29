# Frontend Ownership and Cutover Matrix

> Operational registry for the migration described by the active plan.  
> Baseline state: U4 commit `f5222d5`.
> Current cutover state: U6 app Router, route codecs, and semantic shells active.
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

| Slice | Current/old owner | Target/new owner | Current active owner at U6 | Read compatibility | Rollback reader/artifact | Removal condition |
| --- | --- | --- | --- | --- | --- | --- |
| Route manifest | rollback-only `src/routes/routeDefinitions.ts` and `routeConfig.tsx`; active legacy navigation helpers in `src/routes/paths.ts` | `src/app/router/**` | App definitions + manifest + 15 lazy adapters | Fourteen adapters read one exact assigned legacy route body; legacy consumers still use the parity-checked path copy | Old exhaustive manifest and MainLayout chain | Per-route body switch in U7-U13/U21; old manifest/path aliases removed U22 |
| URL/query | builders in `src/routes/routeQueryContracts.ts`; parsers and mirrored state in feature routes/libs | app codecs under `src/app/router/codecs` and target screens | App path serializers and safe login/payment-fail decoding; legacy feature parsers remain active for unswitched bodies | New codecs accept current canonical query forms; no dual navigation writer | Existing builders/parsers plus captured deep-link corpus | Switch parser/controller with each route; distributed parsers/mirrors removed by U8/U10/U13 and final aliases U22 |
| Query/cache | Platform-created client exposed through `src/query/**`, feature `queryKeys.ts`/hooks, `publicCache.ts`, manual session-root registry | session-scoped Query option factories and feature repositories | current feature hooks/cache helpers on the platform-created singleton | New options may read/refetch the same server resources; no persistent cache migration | Current QueryProvider/hooks and server refetch | U5 switches session lifetime; slice helpers move U7-U13; registry/public seams removed U22 |
| Domain mutation | feature hooks/routes and API wrappers | explicit `src/workflows/**` commands plus feature ports | current feature mutations | Target result may be projected into legacy read caches, but no adapter may repeat the server mutation | Existing route/hook behind unchanged API contract | Switch one workflow in U7/U9/U10/U12/U13; old writer deleted in its switching unit |
| Browser storage | Reservation checkout/index and payment-attempt helpers use the U4 raw-driver compatibility seam; the generic versioned repository is inactive | platform storage plus owned booking-payment repository | current unversioned reservation/payment helpers only | U10 may one-way read only server-validated legacy records | Immutable current helper for pre-cutover; immutable U10 repository for U11 rollback | Legacy checkout/marker writer and raw compatibility seam removed U10; v1 gateway artifact removed U11 after rollback proof |
| Shell/overlay | rollback-only MainLayout plus active AppHeader, current Dialog/Toast/body locks | `src/app/shells/**` and OverlayProvider runtime | Five app shells + current AppHeader; legacy local overlay owners | Existing Dialog public API remains while consumers move | Old MainLayout/main-bare mapping | Shells active U6; overlay runtime U19; consumers move U7-U14; old layouts/seams removed U22 |
| Screen | feature route containers mixing orchestration and presentation | `src/screens/**` props-only screens with app route controllers | App compatibility adapter → assigned legacy route body | Adapter translates current URL/state into legacy props without a second workflow writer | Assigned legacy body and old manifest | Per-route characterization passes and controller/screen switches; old body deleted in U7-U13/U21 |

## Route ownership

At U6 all fifteen app route adapters are the active lazy entries. Fourteen pass
typed Router inputs into exactly one assigned legacy body; NotFound is fully
app-owned. The body column remains legacy until its named screen slice cuts over.

| Route ID | Current/old owner | Target/new owner | Active at U6 | Compatibility reader | Rollback before target cutover | Removal condition |
| --- | --- | --- | --- | --- | --- | --- |
| home | `src/features/home/HomeRoute.tsx` | `src/app/router/routes/HomeRoute.tsx` + `src/screens/home/HomeScreen.tsx` | app adapter → current/old body | none | Old manifest entry and current body | Target direct-load/lazy parity; remove old in U21 |
| search | `src/features/search/SearchRoute.tsx` | app Search route + `src/screens/search/**` | app adapter → current/old body | Wishlist legacy projection may temporarily read new membership workflow after U7 | Old manifest entry and current URL parser | New URL/Query/map owner green; remove old and search projection adapter in U8 |
| accommodation-detail | `src/features/accommodations/AccommodationDetailRoute.tsx` | app detail route + `src/screens/accommodation-detail/**` | app adapter → current/old body | Wishlist legacy projection after U7 | Old manifest entry and booking handoff | Detail, booking, review, membership parity; remove old/detail projection in U9 |
| accommodation-confirm | `src/features/reservations/ReservationConfirmRoute.tsx` | app confirm route + `src/screens/reservation-confirm/**` | app adapter → current/old body | Legacy checkout record may be one-way read after validation | Old manifest entry, current checkout record, Toss v1 adapter | One payment aggregate and storage contract green; remove old in U10 |
| accommodation-edit | `src/features/accommodations/edit/AccommodationEditRoute.tsx` | app edit route + `src/screens/accommodation-edit/**` | app adapter → current/old body | App path helper validates draft provenance; server detail remains authority | Old manifest entry | Editor transition/order/stale tests green; remove old in U12 |
| wishlist | `src/features/wishlist/WishlistRoute.tsx` | app Wishlist route + `src/screens/wishlist/**` | app adapter → current/old body | Existing URL query decoded by new codec during switch | Old manifest entry | New screen and single mutation writer green; remove old in U7 |
| profile | `src/features/profile/ProfileRoute.tsx` | app Profile route + `src/screens/profile/**` | app adapter → current/old body | Existing URL query decoded by new codec during switch | Old manifest entry | Guest/host URL and panel parity; remove old in U13 |
| host-reservation-detail | `src/features/reservations/HostReservationDetailRoute.tsx` | app host-detail route + reservation-detail screen package | app adapter → current/old body | none | Old manifest entry | Host detail terminals and API mapper parity; remove old in U13 |
| reservation-detail | `src/features/reservations/ReservationDetailRoute.tsx` | app reservation-detail route + `src/screens/reservation-detail/**` | app adapter → current/old body | Current location-state handoff | Old manifest entry | Detail, cancel/review navigation and cache parity; remove old in U13 |
| reservation-review | `src/features/reviews/ReviewCreateRoute.tsx` | app Review route + `src/screens/review-create/**` | app adapter → current/old body | Existing result handoff only | Old manifest entry | Review partial-success workflow green; remove old in U9 |
| payment-success | `src/features/reservations/PaymentSuccessRoute.tsx` | app success route + `src/screens/payment-result/**` | app adapter → current/old body | Validated legacy checkout/marker read only | Old manifest entry, current v1 adapter | Confirmation/reconciliation workflow green; remove old in U10 |
| payment-fail | `src/features/reservations/PaymentFailRoute.tsx` | app fail route + `src/screens/payment-result/**` | app adapter → current/old body | Validated reason plus legacy checkout/marker read only | Old manifest entry, current v1 adapter | Failure/status recovery workflow green; remove old in U10 |
| login | `src/features/auth/LoginRoute.tsx` | `src/app/router/routes/LoginRoute.tsx` + `src/screens/auth/**` | app adapter with safe codec → current/old body | Structured internal return target | Old manifest entry | Session/return/auth screen parity; remove old in U7 |
| signup | `src/features/auth/SignupRoute.tsx` | `src/app/router/routes/SignupRoute.tsx` + `src/screens/auth/**` | app adapter → current/old body | none | Old manifest entry | Signup validation/navigation parity; remove old in U7 |
| not-found | `src/routes/NotFoundRoute.tsx` | app NotFound route + `src/screens/not-found/**` | app-owned adapter/body | none | Old manifest entry/body | Bare-shell/direct-route parity; remove old in U21 |

## Mutable workflow and state ownership

| Capability | Current/old owner and writer | Target/new owner | Current active owner at U6 | Allowed read compatibility | Rollback/removal condition |
| --- | --- | --- | --- | --- | --- |
| Auth bootstrap/login/logout/401 | `AuthContext.tsx`, `useSessionQuery.ts`, `sessionLifecycle.ts`, auth event bus | `src/app/session/**` with feature auth port | current/old | AuthContext adapter may expose new session during consumer migration | U5 proves states, epoch, cache/storage cleanup; AuthContext removed after last consumer in U22 |
| Protected return target | `RequireAuth` writes structured React Router state; legacy auth body consumes sanitized state | app internal-return codec and Login adapter | App codec validates before the legacy Login body reads | Current structured pathname/search/hash | Old parser/body removed with auth route in U7 |
| Query session cleanup | `src/query/sessionCacheBoundary.ts` manual `userScopedQueryRoots` | App session subject/epoch and scoped Query options | current/old | none | U5 eliminates manual root registry after A→B isolation passes |
| Wishlist mutation | Wishlist hooks and API; cache effects in `wishlistCacheSync.ts` and public cache seams | `src/workflows/wishlist-membership/**` plus feature reconciliation ports | current/old | Read/write compatibility adapter may project new result into legacy Search/Detail caches; it must not issue a second mutation | U7 switches writer; Search branch removed U8, detail branch U9, remaining public seam U22 |
| Search request/navigation | `useSearchResults.ts`, `useSearchRouteController.ts`, SearchBar/map hooks | Search controller, URL codec, Query options, narrow interaction reducer | current/old | Current URL query | U8 switches route/controller and removes legacy route/app-shell leak |
| Reservation create/handoff | `useAccommodationBooking.ts`, `reservationCheckoutHandoff.ts` | booking-payment reservation-create capability | current/old | Existing checkout route state and validated legacy record | U9 proves single-flight and stale route/session fence; old booking writer removed |
| Checkout request | `ReservationConfirmRoute.tsx`, `reservationCheckoutState.ts`, current Toss v1 helper | booking-payment checkout repository/reducer using gateway port | current/old | One-way read of legacy record only when server data proves owner/order/amount | U10 leaves one checkout path and deletes ReservationModal/useReservationPayment; U11 swaps adapter only |
| Payment confirmation/status | success/fail routes, `usePaymentConfirmation.ts`, attempt registry, status hook | booking-payment confirmation reducer/repository | current/old | Validated legacy marker/record for reconciliation only | U10 switches writer and deletes legacy routes/registry after parity; U11 must read U10 records on rollback |
| Toss runtime | `src/platform/integrations/tossPaymentsV1.ts` owns the CDN v1 global; `features/reservations/lib/tossPayments.ts` is the compatibility policy facade; npm v2 is installed but unused | `src/platform/integrations/tossPaymentsV2.ts` behind PaymentGateway | platform-owned CDN v1 adapter | U10 v1 adapter is rollback artifact, never mounted with v2 | U11 sandbox/callback/rollback evidence, then v1 source removed |
| Review create/images | `useReviewCreate.ts`, `ReviewCreateRoute.tsx` | `src/workflows/review-submission/**` | current/old | Existing result navigation state | U9 proves create/upload partial terminal and removes old writer |
| Accommodation editor | edit controller plus detail/images/upload/save hooks and refs | listing-editor reducer/commands/controller | current/old | Existing created-draft route state and server detail | U12 proves operation journal/order/stale fences and removes old writer/types cycle |
| Profile guest/host route view | `ProfileRoute.tsx` URL mirrored to local state | Profile codec + controller/screen | current/old | Existing URL query | U13 removes mirrored state and legacy route |
| Guest/host reservation lists | panels/hooks; `useReservationList.ts` infers scope from fetch function identity | Explicit scoped feature Query options and Profile screen | current/old | none | U13 proves distinct keys under wrapped functions and removes identity inference |
| Host listing mutations | `HostListingsPanel.tsx`, accommodation app-shell modal/public cache | host-listing-management workflow and feature ports | current/old | none | U13 switches writer; appShell/publicCache deleted U22 |
| Dialog/Toast/scroll lock | Shared Dialog plus route-local placement/body lock | App OverlayProvider and current Dialog public API | current/old | Existing Dialog API only | U19 switches runtime owner; U14 migrates all consumers; local owners removed |

## Infrastructure and compatibility ownership

| Surface | Current owner | Target owner | Cutover/removal |
| --- | --- | --- | --- |
| Route definitions/lazy mapping | `src/app/router/**` active; old `src/routes/Router|routeDefinitions|routeConfig` rollback-only | `src/app/router/**` | U6 owner is active with 15 literal lazy adapters; exact body bridges disappear per slice and old root is removed U22 |
| Axios/envelope/error | `src/platform/http/**` owns the single client and migrated `AppError`; `src/api/client.ts`, `request.ts`, `response.ts` preserve legacy imports/semantics | feature adapters consume the platform boundary directly | U4 platform owner is active; feature adapters move U7-U13; global API root removed U22 |
| Domain API/wire DTO | `src/api/*.ts`, `src/types/**` | `src/features/*/api|model|query` | Move with the consumer slice; global roots/aliases removed U22 |
| Environment | `src/platform/config/**`; `env.ts` is the only app runtime `process.env` reader. The build preflight separately owns CRA's build-only `PUBLIC_URL` asset base. | same platform public-config contract plus explicit build asset-base policy | U4 owner is active; Vite input mapping changes atomically in U16 |
| Google/Daum/Toss globals | `src/platform/integrations/**`; current feature hooks/helpers are compatibility facades | feature ports consume platform integrations | Google/Daum and Toss v1 ownership moved U4; feature screen/workflow facades move U8/U10/U12; Toss SDK changes U11 |
| Image URL boundary | `src/platform/assets/imageUrl.ts` with legacy `src/utils/image.ts` facade | feature asset ports or direct platform boundary | U4 owner is active; facade consumers move by slice and the facade is removed U22 |
| Shared React test harness | `src/test/renderApp.tsx`, `createTestQueryClient.ts` | same test-only boundary | U4 active; production imports are blocked and caller-owned QueryClients/portal roots retain caller lifetime |
| Cross-feature seams | `features/*/appShell.ts`, `publicCache.ts`, route barrels | app composition and workflows/reconciliation ports | Consumers move U7-U13; all seams deleted U22 |
| UI structural runtime | Five app shells active; AppHeader and current Dialog/Toast/component-local responsive logic remain | app shells/overlays and shared responsive policy | Shell runtime active U6; overlay/responsive runtime U19; adopters U14 |
| Tokens/assets/primitives | `src/styles`, `src/shared/ui`, `src/components`, `src/assets` | `src/shared/styles|ui|assets` | U15 migrates actual consumers; empty/unused legacy roots U22 or U15 as assigned |
| Build/dev | CRA `react-scripts` after fail-closed validation for API/asset origins, Toss browser keys, build-only `PUBLIC_URL`, and misplaced server-secret shapes | Vite | U16 retains `build/`, env/proxy/assets/chunk parity and the asset-base allowlist; CRA test remains temporarily |
| Unit/integration runner | CRA Jest | Vitest | U17 uses disjoint ownership inventory; removes Jest/react-scripts after last suite |
| Compiler/lint/format | TypeScript 4.9, CRA ESLint presets, dependency-cruiser 17, Knip 2 target ratchet, Stylelint 16 target ratchet | TypeScript 5.x and current explicit static-tool owners | U3 owns graph/reachability/style policy; U23 upgrades Node/TypeScript/tools together after Vitest and performs the final mechanical format pass |

## U10/U11 payment compatibility matrix

| Runtime | Records it may read | Writer | Rollback expectation |
| --- | --- | --- | --- |
| Pre-U10 legacy | Unversioned checkout/index and confirmed marker | Legacy route/hooks | Baseline only; no forward guarantee before U10 migration reader exists |
| U10 with Toss v1 adapter | New owned/versioned checkout and callback records; server-validated legacy one-way input | booking-payment aggregate only | Immutable U10 build must read its own records |
| U11 with Toss npm v2 | Same U10 repository/schema | booking-payment aggregate through v2 gateway only | SDK swap must not change storage or callback/server-confirm contract |
| U11 rollback to U10 build | U10 records written before rollback | U10 aggregate through v1 gateway | Retryable checkout/callback reconciles through server status; v1/v2 are never active together |

If implementation needs a record shape that breaks this matrix, update the
active plan and browser-data inventory before changing a writer.
