# Airbob Post-Merge Frontend Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-07-06 `main` merge 결과를 기준으로 Airbnb 스타일 시각 리팩토링에 들어가기 전에 남은 프론트 구조 예외를 닫고, URL/query, Query cache, DTO/view model, shared UI, token, smoke 검증 경계를 green gate로 만든다.

**Architecture:** `routes/*`는 URL path, query contract, auth/layout shell metadata를 소유한다. `pages/*`는 임시 adapter 계층으로 유지하되 feature 내부로 침투하지 않는다. `features/*`는 route container, domain hook, Query key, view model, feature UI를 소유한다. Cross-feature 접근은 `appShell.ts`와 `publicCache.ts`로만 허용한다. `src/api/*`는 Axios client와 API envelope unwrap만 담당한다. `shared/ui/*`와 `styles/tokens.css`는 Airbnb 스타일을 받기 전 semantic primitive와 token contract를 먼저 소유한다.

**Tech Stack:** React 19, TypeScript 4.9, React Router 7, TanStack Query 5, Axios, CRA/react-scripts, Jest, React Testing Library, CSS Modules, gstack smoke wrapper.

---

## Audit Baseline

- Local `main` matched `origin/main` at merge commit `f009ec0` from PR #8.
- Work branch for this plan: `codex/frontend-post-merge-audit-plan-20260706`.
- `npm run typecheck`: passed.
- `npm run test:ci:no-cache -- --runInBand src/routes/route-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts src/styles/tokens.test.ts src/verification-gate.test.ts`: passed, 4 suites and 54 tests.
- `npm run verify:pre-redesign`: passed, 178 suites and 871 tests, then production build passed.
- `npm run lint -- --format compact`: failed with 70 problems.
- `npm run smoke:frontend:strict`: failed before browser launch because `AIRBOB_QA_EMAIL`, `AIRBOB_QA_PASSWORD`, and `GSTACK_BROWSE_BIN` were not set.
- Build warnings remain for stale `baseline-browser-mapping` and stale `caniuse-lite`.

## Architecture Report

### Current Frontend Structure

- `src/App.tsx` delegates to `src/routes/Router.tsx`.
- `src/routes/routeDefinitions.ts` owns `path`, `requiresAuth`, `layout`, and `headerMode`.
- `src/layouts/MainLayout.tsx` consumes route shell metadata through `getRouteShellForPathname`.
- `src/routes/routeConfig.tsx` still lazy-loads `src/pages/**`.
- Most `src/pages/**` files are thin adapters into feature route containers.
- `src/features/**` owns route screens, domain hooks, Query keys, view models, feature CSS modules, and route-local UI.
- `src/shared/ui/**` already contains `Button`, `Card`, `ClickableCard`, `CounterStepper`, `Dialog`, `IconButton`, `ListingCard`, `OverlaySurface`, `PageShell`, `StateView`, `StatusBadge`, `Tabs`, `TextField`, and `ToastHost`.
- `src/api/**` owns Axios clients and API response envelope handling.
- `src/query/sessionCacheBoundary.ts` owns session clear and refresh cache roots.
- `src/styles/tokens.css`, `src/styles/tokens.test.ts`, and `src/styles/design-system-contracts.test.ts` provide partial pre-design token guardrails.

### Major Problems

- Route/query ownership is still split. `src/routes/paths.ts` imports four feature route-query modules, and `src/routes/route-boundary-contracts.test.ts` keeps an allowlist of length 4.
- `src/routes/routeConfig.tsx` points to `pages/**` while real route logic lives in `features/**`, so route ownership has two visible surfaces.
- Reservation checkout start logic exists in both `src/features/accommodations/hooks/useAccommodationBooking.ts` and `src/features/reservations/hooks/useReservationPayment.ts`.
- `src/features/reviews/hooks/useReviewCreate.ts` loads reservation detail through `reservationApi.getMyReservationDetail` while invalidating Query caches after review creation.
- `src/features/accommodations/hooks/useAccommodationReviews.ts` mixes first-page `useQuery`, manual Query reads, and local cursor/review state.
- Presentation DTO exceptions remain in `src/api/ui-api-boundary-contracts.test.ts` for `AccommodationBookingCardSections`, `AccommodationActionModal`, `ReservationModal`, and `HostListingsPanel`.
- Shared primitives exist, but `PageShell` and `ListingCard` are not broadly adopted by production feature screens.
- High-risk UI surfaces remain large: `SearchBar.tsx` is 509 lines, `useMapSelectionInfoWindow.ts` is 443 lines, `AccommodationBookingCardSections.tsx` is 480 lines, and `useAccommodationBooking.ts` is 557 lines.
- Token ownership is partial. `SearchRoute.module.css` has `outline: none !important`, `PaymentSuccessRoute.module.css` has raw `#ff385c`, and map InfoWindow/control styles are inline vendor-adjacent style strings.
- `verify:structure` cannot be used as a green gate while `npm run lint` fails with 70 problems.
- There is no repo-local CI workflow under `.github`.
- `README.md` only documents manual setup commands and omits `verify:pre-redesign`, `verify:design-ready`, and smoke env flow.
- Two historical plan files are zero bytes: `docs/superpowers/plans/2026-07-02-airbob-code-architecture-rebuild.ko.md` and `docs/superpowers/plans/2026-07-02-airbob-pre-design-architecture.ko.md`.

### Refactoring Risk Zones

- Search: header search sync, query canonicalization, map drag state, bottom sheet, wishlist modal handoff, auth modal handoff, Google Maps InfoWindow HTML, and new-tab detail navigation.
- Accommodation detail: gallery, description modal, booking date/guest picker, coupon selection, auth-required wishlist/review actions, reservation CTA, and sticky booking sidebar.
- Booking and payment: checkout session fallback, Toss success/fail callback parsing, idempotent payment confirmation, cache invalidation before redirect, and fail recovery reason.
- Review creation: reservation detail loading, image upload partial success, review list invalidation, and navigation back to reservation detail.
- Profile and reservations: guest/host tab query state, reservation status sorting, host reservation detail, listing action modal, and mobile responsive layout.
- Wishlist: index/detail/recently-viewed route state, memo dialog, delete flows, recently viewed removal, and search membership cache reconciliation.
- Auth: `RequireAuth` return path, `LoginRoute` redirect behavior, session query refresh, and global auth error event throttling.

### Flows To Preserve

- Unauthenticated protected route redirects to login and returns after successful login.
- Search query submission updates `routeTo.search` and preserves booking/date/guest query state into accommodation detail.
- Search result card opens detail with route builder output and preserves wishlist membership behavior.
- Accommodation detail booking creates a reservation, stores checkout handoff, and routes to confirm.
- Reservation confirm calls Toss with success/fail URLs from `routeTo.paymentSuccess` and `routeTo.paymentFail`.
- Payment success validates callback, confirms payment, invalidates reservation caches, clears checkout state, and redirects to reservation detail.
- Payment fail displays supported fail reasons and lets the user return to profile or reservation detail.
- Review creation loads reservation context, handles partial image upload success, invalidates review/reservation data, and navigates to reservation detail.
- Profile tabs preserve guest/host mode and tab query state.
- Wishlist view preserves index, detail, and recently viewed flows.
- Strict smoke keeps home, search, wishlist, profile host listings, accommodation detail, accommodation edit, reservation detail, and host reservation detail coverage honest through explicit env prerequisites.

### Recommended Architecture Direction

- Move all route query contracts into `src/routes`, not into feature libs.
- Keep feature route containers router-aware, but keep reusable hooks and components domain-focused.
- Treat public barrels as route-container-only unless a file is explicitly named `appShell.ts` or `publicCache.ts`.
- Replace presentation DTO imports with feature view models before changing visible UI.
- Consolidate reservation checkout into one handoff module before touching booking/payment styling.
- Align review and reservation reads with TanStack Query before changing review UI.
- Convert manual cursor state to one Query-backed pagination pattern for reviews.
- Adopt shared primitives where the component shape is already stable; avoid a broad visual rewrite until semantics and token ownership are tested.
- Make lint and browser smoke actionable gates instead of optional status notes.

### Verdict

Do not start a full Airbnb-style visual redesign immediately. The app is much more stable than the previous baseline, and `verify:pre-redesign` is green, but route/query allowlists, DTO allowlists, reservation/review query inconsistencies, partial token ownership, and non-green lint still create too much regression risk for a broad design pass. Start with the structure cleanup tasks below, then run design work route by route after the green gates are explicit.

## Files And Ownership

Create:

- `src/routes/routeQueryContracts.ts` - typed route query contracts and builders for search, accommodation booking, wishlist, profile, and payment fail.
- `src/routes/routeQueryContracts.test.ts` - unit tests for route query contract builders and payment fail reason parsing.
- `src/features/reservations/lib/reservationCheckoutHandoff.ts` - one reservation checkout start helper shared by booking and reservation modal flows.
- `src/features/reservations/lib/reservationCheckoutHandoff.test.ts` - tests for checkout handoff, session fallback, and navigation input.
- `src/features/reservations/hooks/useReservationDetailQuery.ts` - small Query-backed reservation detail hook reusable by review creation.
- `src/features/reservations/hooks/useReservationDetailQuery.test.ts` - Query key and loading-state coverage for the reusable reservation detail hook.
- `src/features/accommodations/lib/accommodationReviewsPagination.ts` - pure helpers for review cursor pagination state if `useInfiniteQuery` is not used directly.
- `src/features/accommodations/lib/accommodationReviewsPagination.test.ts` - cursor merge and stale-page regression coverage if the helper is created.
- `src/features/profile/lib/hostListingViewModel.ts` - host listing presentation model.
- `src/features/reservations/lib/reservationModalViewModel.ts` - reservation modal presentation model.
- `src/features/accommodations/lib/accommodationBookingSectionsViewModel.ts` - booking sections presentation model.
- `src/components/ErrorBoundary/ErrorBoundary.test.tsx` - semantic and token coverage for the app error boundary.
- `.github/workflows/frontend.yml` - static frontend verification workflow.

Modify:

- `src/routes/paths.ts`
- `src/routes/route-boundary-contracts.test.ts`
- `src/routes/paths.test.ts`
- `src/features/search/lib/searchRouteQuery.ts`
- `src/features/search/lib/searchParams.ts`
- `src/features/search/lib/searchParams.test.ts`
- `src/features/profile/lib/profileRouteQuery.ts`
- `src/features/profile/lib/profileRouteState.ts`
- `src/features/profile/lib/profileRouteState.test.ts`
- `src/features/wishlist/lib/wishlistRouteQuery.ts`
- `src/features/wishlist/lib/wishlistRouteState.ts`
- `src/features/wishlist/lib/wishlistRouteState.test.ts`
- `src/features/reservations/lib/paymentRouteState.ts`
- `src/features/reservations/lib/paymentRouteState.test.ts`
- `src/features/reservations/PaymentFailRoute.tsx`
- `src/pages/Reservations/PaymentFail.tsx`
- `src/features/accommodations/hooks/useAccommodationBooking.ts`
- `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`
- `src/features/reservations/hooks/useReservationPayment.ts`
- `src/features/reservations/hooks/useReservationPayment.test.ts`
- `src/features/reservations/components/ReservationModal/ReservationModal.tsx`
- `src/features/reservations/components/ReservationModal/ReservationModal.test.tsx`
- `src/features/reviews/hooks/useReviewCreate.ts`
- `src/features/reviews/hooks/useReviewCreate.test.ts`
- `src/features/accommodations/hooks/useAccommodationReviews.ts`
- `src/features/accommodations/hooks/useAccommodationReviews.test.ts`
- `src/features/accommodations/components/AccommodationReviewsSection.tsx`
- `src/features/accommodations/components/AccommodationReviewsSection.test.tsx`
- `src/api/ui-api-boundary-contracts.test.ts`
- `src/features/accommodations/components/AccommodationBookingCardSections.tsx`
- `src/features/accommodations/components/AccommodationBookingCard.test.tsx`
- `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx`
- `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.test.tsx`
- `src/features/profile/HostListingsPanel.tsx`
- `src/features/profile/HostListingsPanel.test.tsx`
- `src/features/accommodations/components/AccommodationHero.tsx`
- `src/features/accommodations/components/AccommodationHero.test.tsx`
- `src/features/search/SearchRoute.module.css`
- `src/features/search/SearchRoute.test.tsx`
- `src/features/search/components/SearchAccommodationCard.tsx`
- `src/features/search/components/SearchAccommodationCard.test.tsx`
- `src/features/search/components/SearchMap/lib/infoWindowContent.ts`
- `src/features/search/components/SearchMap/lib/infoWindowContent.test.ts`
- `src/features/search/components/SearchMap/lib/mapExpandControl.ts`
- `src/features/search/components/SearchMap/lib/mapExpandControl.test.ts`
- `src/features/reservations/PaymentSuccessRoute.module.css`
- `src/features/reservations/PaymentSuccessRoute.test.tsx`
- `src/components/DatePicker/DatePicker.module.css`
- `src/components/DatePicker/DatePicker.test.tsx`
- `src/components/ErrorBoundary/ErrorBoundary.module.css`
- `src/components/ErrorBoundary/ErrorBoundary.test.tsx`
- `src/styles/tokens.test.ts`
- `src/styles/design-system-contracts.test.ts`
- `src/verification-gate.test.ts`
- `scripts/smoke/frontend-smoke.mjs`
- `docs/architecture/frontend-structure-refactor.md`
- `docs/qa/frontend-architecture-smoke.ko.md`
- `README.md`
- `package.json`

Do not modify:

- Backend API routes, response envelopes, DB schema, or server behavior.
- Toss Payments SDK contract or callback parameter names.
- Real QA credentials or live reservation identifiers in committed files.
- `src/api/client.ts` base URL/proxy behavior unless an auth-event test requires a minimal refactor.
- Existing public route path strings in `ROUTE_PATHS`.

## Task 1: Close Route Query Ownership

**Goal:** Remove the route-to-feature import allowlist and make `src/routes` the only owner of typed route query builders.

- [ ] Create `src/routes/routeQueryContracts.ts` with route query types and builders currently spread across feature libs.

Use this exact contract shape:

```ts
import { appendDefinedSearchParam } from "./routeQuery";

type RouteParamValue = string | number;

export type AccommodationBookingRouteQuery = {
  checkIn?: RouteParamValue;
  checkOut?: RouteParamValue;
  adultOccupancy?: RouteParamValue;
  childOccupancy?: RouteParamValue;
  infantOccupancy?: RouteParamValue;
  petOccupancy?: RouteParamValue;
};

export type SearchRouteQuery = AccommodationBookingRouteQuery & {
  destination?: RouteParamValue;
  page?: RouteParamValue;
  lat?: RouteParamValue;
  lng?: RouteParamValue;
  topLeftLat?: RouteParamValue;
  topLeftLng?: RouteParamValue;
  bottomRightLat?: RouteParamValue;
  bottomRightLng?: RouteParamValue;
};

export type WishlistRouteView = "index" | "recently-viewed" | "wishlist-detail";

export type WishlistRouteQuery =
  | { id: RouteParamValue; view?: never }
  | { id?: never; view: "recently-viewed" }
  | { id?: undefined; view?: undefined };

export type ProfileRouteMode = "guest" | "host";
export type ProfileGuestRouteTab = "trips" | "upcoming" | "past" | "cancelled";
export type ProfileHostRouteTab =
  | "listings"
  | "listings-published"
  | "listings-draft"
  | "listings-unpublished"
  | "reservations"
  | "reservations-upcoming"
  | "reservations-past"
  | "reservations-cancelled";
export type ProfileRouteTab = ProfileGuestRouteTab | ProfileHostRouteTab;
export type ProfileRouteQuery =
  | { mode?: "guest"; tab?: ProfileGuestRouteTab }
  | { mode: "host"; tab?: ProfileHostRouteTab };

export type PaymentFailReason = "confirm-failed" | "invalid-callback";
export type PaymentFailRouteQuery = { reason?: PaymentFailReason };

export const parsePaymentFailReason = (
  reason: string | null,
): PaymentFailReason | undefined => {
  if (reason === "confirm-failed" || reason === "invalid-callback") {
    return reason;
  }

  return undefined;
};

export const buildAccommodationBookingRouteSearchParams = (
  query?: AccommodationBookingRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "checkIn", query?.checkIn);
  appendDefinedSearchParam(params, "checkOut", query?.checkOut);
  appendDefinedSearchParam(params, "adultOccupancy", query?.adultOccupancy);
  appendDefinedSearchParam(params, "childOccupancy", query?.childOccupancy);
  appendDefinedSearchParam(params, "infantOccupancy", query?.infantOccupancy);
  appendDefinedSearchParam(params, "petOccupancy", query?.petOccupancy);

  return params;
};
```

- [ ] Add the remaining builders in the same file: `buildSearchRouteSearchParams`, `buildWishlistRouteQuerySearchParams`, `buildProfileRouteQuerySearchParams`, and `buildPaymentFailRouteSearchParams`.
- [ ] Update `src/routes/paths.ts` to import all query builders and query types from `./routeQueryContracts`.
- [ ] Update `src/features/search/lib/searchParams.ts` to import `SearchRouteQuery` from `../../../routes/routeQueryContracts`.
- [ ] Update `src/features/profile/lib/profileRouteState.ts` to import profile route query types from `../../../routes/routeQueryContracts`.
- [ ] Update `src/features/wishlist/lib/wishlistRouteState.ts` to import wishlist route query types from `../../../routes/routeQueryContracts`.
- [ ] Update `src/features/reservations/PaymentFailRoute.tsx` and `src/pages/Reservations/PaymentFail.tsx` to use `PaymentFailReason` and `parsePaymentFailReason` from route contracts or `src/routes/paths.ts`.
- [ ] Remove route-query exports from `src/features/search/lib/searchRouteQuery.ts`, `src/features/profile/lib/profileRouteQuery.ts`, and `src/features/wishlist/lib/wishlistRouteQuery.ts` after all imports move.
- [ ] Remove payment fail query types and builders from `src/features/reservations/lib/paymentRouteState.ts`; keep checkout date, Toss success, and payment request state helpers there.
- [ ] Move payment fail query tests from `src/features/reservations/lib/paymentRouteState.test.ts` into `src/routes/routeQueryContracts.test.ts`.
- [ ] Update `src/routes/route-boundary-contracts.test.ts` so `allowedRouteFeatureImportPatterns` is removed and route files have zero feature imports.
- [ ] Run:

```bash
npm run test:ci:no-cache -- --runInBand src/routes/routeQueryContracts.test.ts src/routes/paths.test.ts src/routes/route-boundary-contracts.test.ts src/routes/navigation-contracts.test.ts src/features/search/lib/searchParams.test.ts src/features/profile/lib/profileRouteState.test.ts src/features/wishlist/lib/wishlistRouteState.test.ts src/features/reservations/lib/paymentRouteState.test.ts
npm run typecheck
```

**Commit:** `refactor: centralize frontend route query contracts`

## Task 2: Unify Reservation Checkout Handoff

**Goal:** One checkout-start path should build reservation checkout state, save session fallback, and navigate to confirmation.

- [ ] Create `src/features/reservations/lib/reservationCheckoutHandoff.ts`.
- [ ] Move shared pieces from `src/features/accommodations/hooks/useAccommodationBooking.ts` and `src/features/reservations/hooks/useReservationPayment.ts` into the new helper.
- [ ] Keep coupon-aware booking behavior from `useAccommodationBooking.ts`.
- [ ] Update `useAccommodationBooking.ts` to call the helper instead of duplicating reservation create and checkout storage.
- [ ] Update `useReservationPayment.ts` to call the same helper.
- [ ] Update `ReservationModal.tsx` so the modal path cannot drift from the accommodation booking path.
- [ ] Add helper tests in `reservationCheckoutHandoff.test.ts` for:
  - reservation API create request input
  - checkout state written with reservation UID
  - session fallback written before navigation
  - `routeTo.accommodationConfirm` navigation state
  - coupon id preserved when present
- [ ] Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/accommodations/hooks/useAccommodationBooking.test.tsx src/features/reservations/hooks/useReservationPayment.test.ts src/features/reservations/lib/reservationCheckoutState.test.ts src/features/reservations/lib/reservationCheckoutHandoff.test.ts src/features/reservations/components/ReservationModal/ReservationModal.test.tsx src/features/reservations/ReservationConfirmRoute.test.tsx
npm run typecheck
```

**Commit:** `refactor: unify reservation checkout handoff`

## Task 3: Align Review And Accommodation Review Data With Query

**Goal:** Review creation and accommodation reviews should use Query-owned data paths instead of mixing direct API calls with manual cache mirrors.

- [ ] Create `src/features/reservations/hooks/useReservationDetailQuery.ts` around `reservationQueryKeys.guestReservationDetail`.
- [ ] Update `src/features/reviews/hooks/useReviewCreate.ts` to consume the Query-backed reservation detail hook.
- [ ] Preserve review image upload partial success behavior from `useReviewCreate.ts`.
- [ ] Update `useReviewCreate.test.ts` to assert the reservation detail query key and cache invalidation behavior.
- [ ] Convert `src/features/accommodations/hooks/useAccommodationReviews.ts` to `useInfiniteQuery` if the component API can stay stable.
- [ ] If `useInfiniteQuery` forces excessive component churn, create `accommodationReviewsPagination.ts` as a pure cursor helper and keep the hook public API stable while removing duplicated cursor state.
- [ ] Keep `accommodationQueryKeys.reviews` and `accommodationQueryKeys.reviewsRoot` as the single review cache identity.
- [ ] Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/reviews/hooks/useReviewCreate.test.ts src/features/reservations/hooks/useReservationDetail.test.ts src/features/reservations/hooks/useReservationDetailQuery.test.ts src/features/accommodations/hooks/useAccommodationReviews.test.ts src/features/accommodations/components/AccommodationReviewsSection.test.tsx src/features/reviews/components/ReviewModal/ReviewModal.test.tsx
npm run typecheck
```

**Commit:** `refactor: align review flows with query cache`

## Task 4: Remove Presentation DTO Allowlist

**Goal:** Production UI files should not import server DTO types directly.

- [ ] Add `src/features/accommodations/lib/accommodationBookingSectionsViewModel.ts`.
- [ ] Update `AccommodationBookingCardSections.tsx` to receive view-model props instead of coupon DTO props.
- [ ] Add `src/features/reservations/lib/reservationModalViewModel.ts`.
- [ ] Update `ReservationModal.tsx` to render a view model rather than `AccommodationDetail`.
- [ ] Add `src/features/profile/lib/hostListingViewModel.ts`.
- [ ] Update `HostListingsPanel.tsx` to render host listing cards from view models.
- [ ] Update `AccommodationActionModal.tsx` to receive action modal view-model fields rather than host accommodation DTO/status imports.
- [ ] Remove the four entries from `legacyPresentationDtoImportAllowlist` in `src/api/ui-api-boundary-contracts.test.ts`.
- [ ] Keep `productionUiRoots` and `featureRouteContainerFiles` coverage intact.
- [ ] Run:

```bash
npm run test:ci:no-cache -- --runInBand src/api/ui-api-boundary-contracts.test.ts src/features/accommodations/components/AccommodationBookingCard.test.tsx src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.test.tsx src/features/reservations/components/ReservationModal/ReservationModal.test.tsx src/features/profile/HostListingsPanel.test.tsx src/features/profile/ProfileRoute.test.tsx src/features/accommodations/lib/accommodationBookingViewModel.test.ts src/features/reservations/lib/reservationDetailViewModel.test.ts
npm run typecheck
```

**Commit:** `refactor: remove frontend presentation dto exceptions`

## Task 5: Harden Pre-Design UI Semantics And Token Ownership

**Goal:** Shared UI and high-risk route CSS should be ready for Airbnb styling without hidden semantic regressions.

- [ ] Fix nested interactive markup in `src/features/accommodations/components/AccommodationHero.tsx`; the gallery overlay action must be a single button with one click handler.
- [ ] Update `AccommodationHero.test.tsx` to assert no nested gallery button interaction is required and every gallery action has a stable accessible name.
- [ ] Replace `outline: none !important` in `src/features/search/SearchRoute.module.css` with a visible focus rule based on `--focus-ring`.
- [ ] Replace raw `#ff385c` and raw icon colors in `SearchAccommodationCard.tsx` and `PaymentSuccessRoute.module.css` with token-backed CSS classes or CSS custom properties.
- [ ] Move map InfoWindow/control repeated values into named token constants in `infoWindowContent.ts` and `mapExpandControl.ts`; keep raw inline style output only where Google Maps DOM APIs require it.
- [ ] Enroll `DatePicker`, `ErrorBoundary`, payment route CSS, search map style helpers, and remaining modal CSS in `src/styles/tokens.test.ts` or `src/styles/design-system-contracts.test.ts`.
- [ ] Adopt `Button`, `IconButton`, `TextField`, `Dialog`, and `StatusBadge` in `AuthModal`, `ReservationModal`, `ReviewModal`, `WishlistModal`, `AccommodationActionModal`, `PaymentSuccessRoute`, and `PaymentFailRoute` where the markup already matches an existing primitive.
- [ ] Do not change visual layout tokens for the full Airbnb redesign in this task.
- [ ] Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/accommodations/components/AccommodationHero.test.tsx src/features/search/SearchRoute.test.tsx src/features/search/components/SearchAccommodationCard.test.tsx src/features/search/components/SearchMap/lib/infoWindowContent.test.ts src/features/search/components/SearchMap/lib/mapExpandControl.test.ts src/features/reservations/PaymentSuccessRoute.test.tsx src/features/reservations/PaymentFailRoute.test.tsx src/components/DatePicker/DatePicker.test.tsx src/components/ErrorBoundary/ErrorBoundary.test.tsx src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts src/shared/ui/shared-ui-boundary-contracts.test.ts
npm run typecheck
```

**Commit:** `refactor: harden pre-design ui contracts`

## Task 6: Make Verification Gates Actionable

**Goal:** Structure work should have green automated gates before visual redesign begins.

- [ ] Fix the 70 current lint problems instead of weakening lint rules.
- [ ] Run `npm run lint -- --format compact` after each lint batch and keep the count moving down.
- [ ] When lint reaches zero, update `package.json` so `verify:structure` runs `npm run lint:strict`.
- [ ] Add `.github/workflows/frontend.yml` with Node 20, `npm ci`, `npm run typecheck`, `npm run test:ci:no-cache -- --runInBand`, `npm run build`, and `npm run lint:strict`.
- [ ] Add a smoke preflight mode in `scripts/smoke/frontend-smoke.mjs` that validates env vars, dynamic route UIDs, browser binary path, frontend URL, and backend reachability without writing screenshots.
- [ ] Update `src/verification-gate.test.ts` to assert the preflight script behavior and the CI workflow command list.
- [ ] Update `README.md` with `verify:pre-redesign`, `verify:structure`, `verify:design-ready`, and required smoke env vars.
- [ ] Update `docs/architecture/frontend-structure-refactor.md` with the closed route-query and DTO allowlist status after Tasks 1-5 land.
- [ ] Update `docs/qa/frontend-architecture-smoke.ko.md` so stale `react-hooks/exhaustive-deps` text is removed and the current smoke prerequisites are accurate.
- [ ] Replace the two zero-byte historical plan files with a one-line historical marker that points to the maintained architecture doc.
- [ ] Run:

```bash
npm run lint:strict
npm run verify:structure
npm run verify:pre-redesign
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
npm run smoke:frontend:strict
```

The strict smoke command requires `AIRBOB_QA_EMAIL`, `AIRBOB_QA_PASSWORD`, `GSTACK_BROWSE_BIN`, `AIRBOB_SMOKE_RESERVATION_UID`, `AIRBOB_SMOKE_HOST_RESERVATION_UID`, and stable accommodation fixture env vars before it can pass.

**Commit:** `chore: tighten frontend verification gates`

## Task 7: Collapse Page Adapters After The Boundary Work

**Goal:** Remove the extra `pages/**` route adapter layer only after route query ownership, DTO boundaries, and verification gates are green.

- [ ] Update `src/routes/routeConfig.tsx` to lazy-load feature route containers directly.
- [ ] Remove page adapter tests that only prove adapter forwarding after route config points directly at features.
- [ ] Keep `src/pages/**` files only where a page has a distinct compatibility purpose.
- [ ] Update `src/routes/routeConfig.test.tsx` and `src/routes/route-boundary-contracts.test.ts` so route containers remain covered.
- [ ] Run:

```bash
npm run test:ci:no-cache -- --runInBand src/routes/routeConfig.test.tsx src/routes/route-boundary-contracts.test.ts src/App.test.tsx src/routes/RequireAuth.test.tsx src/layouts/MainLayout.test.tsx
npm run verify:pre-redesign
```

**Commit:** `refactor: load feature route containers directly`

## Execution Order

1. Task 1 closes the most explicit architecture exception: route imports from feature libs.
2. Task 2 stabilizes the highest-risk booking/payment state handoff.
3. Task 3 aligns review data with Query cache boundaries.
4. Task 4 removes DTO coupling from production UI.
5. Task 5 prepares shared UI and tokens for visual work without changing the visual language.
6. Task 6 makes verification gates reliable and documented.
7. Task 7 removes page adapter churn after the structural boundaries are already locked.

## Final Verification

Run this sequence before declaring the frontend ready for Airbnb visual redesign:

```bash
npm run typecheck
npm run lint:strict
npm run test:ci:no-cache -- --runInBand
npm run build
npm run verify:structure
npm run verify:pre-redesign
npm run smoke:frontend:strict
```

Record final evidence in:

- `docs/architecture/frontend-structure-refactor.md`
- `docs/qa/frontend-architecture-smoke.ko.md`
- `README.md`

## Design Readiness Decision

Full Airbnb-style design refactoring should wait until Tasks 1-6 are complete. A small accessibility or token hardening change can proceed before then, but broad visual styling should not start while route query allowlists, DTO allowlists, duplicated checkout state, and non-green lint remain open.
