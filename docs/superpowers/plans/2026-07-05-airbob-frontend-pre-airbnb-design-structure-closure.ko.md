# Airbob Frontend Pre-Airbnb Design Structure Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 시스템을 입히기 전에 남은 프론트 구조 리스크를 닫고, 이후 디자인 diff가 레이아웃/스타일 변경에 집중되도록 만든다.

**Architecture:** 현재의 route table, thin page adapter, feature route container, shared UI primitive, API unwrap, query cache boundary는 유지한다. 남은 작업은 큰 feature surface를 더 작은 route/query/view-model/UI adapter로 쪼개고, 수동 fetch와 route-local styling debt를 contract test로 막는 구조 정리다. 백엔드, API shape, DB, 서버 로직은 수정하지 않는다.

**Tech Stack:** React 19, TypeScript 4.9, React Router 7, TanStack Query 5, Axios, CRA/react-scripts, Jest, React Testing Library, CSS Modules, gstack browse/QA.

---

## Audit Inputs

- `superpowers:dispatching-parallel-agents` 방식으로 4개 read-only subagent 감사를 수행했다.
- Routing/page audit: `src/routes`, `src/pages`, `src/layouts`, route state, auth guard.
- Component/UI audit: `src/shared/ui`, `src/components`, feature components, accessibility, modal/card/control ownership.
- State/API audit: `src/api`, `src/query`, `src/contexts`, feature hooks/libs, DTO/view-model boundary.
- Styling/design audit: `src/styles`, CSS Modules, token gates, z-index/overlay/layout readiness.
- Local scan: largest TS/TSX files, largest CSS files, raw DOM/global usage, smoke/verification scripts.
- All subagents were read-only. No production code was edited during this audit.

## Current Frontend Structure Summary

- `src/App.tsx` is thin and renders `Router` only.
- `src/routes/routeConfig.tsx` owns lazy route registration with `path`, `requiresAuth`, and `layout`.
- `src/routes/Router.tsx` maps app routes into `MainLayout` and bare routes, wrapping protected routes with `RequireAuth`.
- `src/routes/paths.ts` centralizes `ROUTE_PATHS`, typed query contracts, and `routeTo` builders.
- `src/pages/*` mostly acts as thin route adapters into feature route containers.
- `src/features/*` owns domain route containers, components, hooks, and pure `lib` helpers.
- `src/api/*` wraps backend calls through `requestApi` and `unwrapApiResponse`.
- `src/query/sessionCacheBoundary.ts` centralizes session-scoped cache cleanup.
- `src/shared/ui/*` provides primitive UI such as `Button`, `Dialog`, `TextField`, `Card`, `IconButton`, `CounterStepper`, and state views.
- `src/styles/tokens.css` is the global design token entrypoint; route/feature CSS remains distributed through CSS Modules.
- Browser smoke is centralized in `scripts/smoke/frontend-smoke.mjs`; design readiness is guarded by `npm run verify:design-ready`.

## Stabilized Strengths To Preserve

- Route config and route URL builders are centralized and tested.
- Page-to-feature imports are guarded by contract tests.
- Shared UI is domain-independent and protected from feature/page imports.
- Dialog accessibility baseline is solid: focus trap, Escape close, focus restore, body scroll lock.
- API response envelope access is guarded by tests.
- Auth session cache cleanup exists and protects user-scoped query roots.
- Search URL parsing, wishlist cache sync, reservation checkout state, and payment dedupe have pure helpers and tests.
- Design token tests already cover z-index scale, overlay tokens, selected layout tokens, and several design-sensitive CSS files.
- Strict smoke mode exists and records skipped dynamic route coverage.

## Major Problems

- `src/routes/paths.ts` combines route path registry, query types, query serialization, and route builders. Airbnb-style search filters will make this file too dense.
- Route metadata only supports `layout` and `requiresAuth`. Redesign will need route id, header mode, full-bleed search shell, modal/sheet policy, and title ownership.
- URL parsing ownership is inconsistent. `Search` and `Profile` receive router search params from pages, while Wishlist still reads router state inside a feature hook.
- Server state is split between TanStack Query and manual `useEffect`/local state fetches. Accommodation detail, reviews, coupons, reservation list, and reservation confirm still carry stale/race risk.
- DTOs still reach presentation surfaces in accommodation detail, reservation modal, and review surfaces.
- Payment entry has two frontend paths: booking-confirm-success flow and legacy direct Toss flow.
- `SearchBar.tsx` is 638 lines and owns destination autocomplete, dates, guests, popovers, URL state, and responsive shell in one component.
- `useMapSelectionInfoWindow.ts` is 459 lines and mixes Google Maps event wiring, HTML string generation, marker selection, wishlist state, and navigation.
- `AccommodationBookingCardSections.tsx` and `useAccommodationBooking.ts` combine auth handoff, coupon state, date validation, guest counting, checkout state, and route navigation.
- `src/components` and `src/shared/ui` ownership is unclear for `DatePicker`, `ErrorToast`, and `ListContainer`.
- Shared primitives exist, but feature CSS still reimplements buttons, inputs, counters, cards, badges, toast hosts, and modal footers.
- CSS token migration is incomplete. High-risk route CSS still includes raw colors, raw viewport math, `!important`, `transition: all`, and repeated toast containers.
- Raw browser/global usage remains scattered: `console.*`, `window.open`, DOM click-outside listeners, inline `style`, and `sessionStorage` wrappers.
- Search smoke currently depends on ES data availability. User will seed ES index, but the frontend gate must make missing search fixture data explicit.

## Refactoring Risk Zones

- Search route: `SearchRoute.tsx`, `SearchRoute.module.css`, `SearchBar`, `useSearchResults`, map hooks, wishlist modal, pagination, and URL query semantics.
- Google Maps integration: API key loading, Places autocomplete, map instance lifecycle, info window HTML, marker events, mobile/desktop map layout.
- Reservation and payment: checkout state fallback, payment success/fail callback parsing, payment dedupe, guest/host reservation UIDs, direct Toss legacy hook.
- Auth/session boundary: `auth/me`, logout/global auth error, user-scoped search/wishlist/profile/reservation caches.
- Accommodation detail/booking: wishlist membership, recently viewed, coupons, booking auth modal, date/guest validation, checkout navigation.
- Accommodation edit wizard: large screen component, icon registry, mapper, image upload state, dirty diff, publish/update ordering.
- Design-sensitive CSS: Search, Wishlist, Reservation Detail, Host Reservation Detail, DatePicker, Booking Card, Accommodation Hero, Review Create, Edit Form.
- Browser smoke/QA: dynamic route UIDs, ES index dependency, Google Maps key, redacted credential handling, console/network failure guards.

## Flows That Must Keep Working

- Home `/` search entry into `/search`.
- Search URL query contract for destination, dates, adult/child/infant/pet occupancy, page, and map bounds.
- Search list card and map marker detail navigation into `/accommodations/:id`.
- Wishlist add/remove from search, accommodation detail, and wishlist pages, including modal close reconciliation.
- `/wishlist?id=:id` detail view and `/wishlist?view=recently-viewed`.
- Accommodation detail: unauthenticated wishlist false, authenticated re-fetch, recently viewed only for authenticated users.
- Booking: detail booking card -> reservation confirm -> checkout state -> Toss success callback -> payment confirm dedupe -> checkout cleanup.
- Payment failure: `/reservations/:reservationUid/fail?reason=confirm-failed|invalid-callback`.
- Guest reservations, host reservations, host reservation detail, and review create routes.
- Profile mode/tab query contract.
- Protected route redirect to `/login` and post-login return to original `pathname/search/hash`.
- Host accommodation edit/create: host DTO -> edit form mapper -> dirty diff -> update/uploadImages/publish.
- Smoke route coverage with stable dynamic IDs and no credential leakage in reports.

## Recommended Architecture Direction

- Keep the existing feature-first layout. Do not rewrite the app into a new framework or new global state layer.
- Keep pages thin. Pages may read router params/search params and pass stable values/callbacks into feature route containers.
- Move all URL/query parsing into route/domain `lib` files and keep `src/routes/paths.ts` as a public facade.
- Move all server state reads to TanStack Query unless the state is intentionally client-only.
- Keep DTOs in `src/types` and API/lib boundaries. UI components should consume view models or explicit presentation props.
- Keep `shared/ui` domain-independent. Put accommodation-specific reusable cards under `src/features/accommodations` and expose them through a feature public boundary only when needed.
- Create shared interaction primitives for outside click, popover/dropdown shell, tab/segmented control, pagination, toast host, status badge, and dialog actions.
- Treat Google Maps as a vendor adapter boundary. CSS overrides, marker icon model, info window HTML, and event wiring should be isolated from search route layout.
- Treat CSS Modules as the styling implementation, but require design-sensitive modules to use tokens for colors, radius, shadow, z-index, viewport offsets, and interaction transitions.
- Add contract tests before broad visual changes so Airbnb tokens/components cannot reintroduce route coupling or raw design literals.

## First Work Order

1. Tighten verification and smoke fixture gates, including ES search data readiness and Google Maps env detection.
2. Normalize route/query ownership and route metadata before redesign-specific shell variants appear.
3. Move remaining manual server-state hooks to TanStack Query and expand DTO/view-model boundaries.
4. Decompose SearchBar and search map vendor adapter before touching visual design.
5. Standardize shared UI interactions and accessibility primitives.
6. Split booking/payment and edit wizard high-risk components.
7. Expand token/style contract tests to cover high-risk CSS and remove raw design literals.
8. Run full static, smoke, and browser QA with seeded ES data.
9. Only then start Airbnb visual redesign.

## Airbnb Design System Preparation Gate

Airbnb-style design work must not start until these checks are true:

- `npm run verify:pre-redesign` passes.
- `npm run smoke:frontend:strict` passes with real dynamic route IDs and seeded ES search data.
- `/search` renders at least one result card and a map without `Google Maps API 키가 설정되지 않았습니다.`.
- The QA report records no unhandled console error/warning except the React DevTools development hint.
- Design-sensitive CSS files use tokens for colors, radius, shadows, z-index, viewport offsets, and transitions.
- SearchBar, SearchMap, booking card, reservation detail, and edit wizard are small enough that visual changes do not rewrite behavior.
- No frontend plan, QA report, or smoke output records QA password or API key values.

## File Structure

Create:

- `src/routes/routeShell.ts`
- `src/routes/routeQuery.ts`
- `src/features/search/lib/searchRouteQuery.ts`
- `src/features/wishlist/lib/wishlistRouteQuery.ts`
- `src/features/profile/lib/profileRouteQuery.ts`
- `src/features/reservations/lib/paymentRouteState.test.ts`
- `src/features/accommodations/lib/accommodationDetailViewModel.ts`
- `src/features/reviews/lib/reviewViewModel.ts`
- `src/shared/ui/useOutsideClick.ts`
- `src/shared/ui/Tabs/Tabs.tsx`
- `src/shared/ui/Tabs/Tabs.module.css`
- `src/shared/ui/Tabs/Tabs.test.tsx`
- `src/shared/ui/StatusBadge/StatusBadge.tsx`
- `src/shared/ui/StatusBadge/StatusBadge.module.css`
- `src/shared/ui/StatusBadge/StatusBadge.test.tsx`
- `src/shared/ui/ToastHost/ToastHost.tsx`
- `src/shared/ui/ToastHost/ToastHost.module.css`
- `src/shared/ui/ToastHost/ToastHost.test.tsx`
- `src/features/search/components/SearchBar/SearchDestinationField.tsx`
- `src/features/search/components/SearchBar/SearchDateFields.tsx`
- `src/features/search/components/SearchBar/SearchGuestSelector.tsx`
- `src/features/search/components/SearchBar/SearchBarPopover.tsx`
- `src/features/search/components/SearchMap/lib/infoWindowContent.ts`
- `src/features/search/components/SearchMap/lib/markerIcon.ts`
- `src/features/search/components/SearchMap/hooks/useMapInfoWindowEvents.ts`
- `src/utils/clientLogger.ts`

Modify:

- `src/routes/paths.ts`
- `src/routes/routeConfig.tsx`
- `src/routes/routeConfig.test.tsx`
- `src/routes/route-boundary-contracts.test.ts`
- `src/routes/navigation-contracts.test.ts`
- `src/pages/Wishlist/Wishlist.tsx`
- `src/features/wishlist/WishlistRoute.tsx`
- `src/features/wishlist/hooks/useWishlistRouteViewState.ts`
- `src/features/wishlist/hooks/useWishlistData.ts`
- `src/features/wishlist/lib/wishlistCacheSync.ts`
- `src/features/search/queryKeys.ts`
- `src/features/search/lib/searchParams.ts`
- `src/features/search/hooks/useSearchResults.ts`
- `src/features/search/hooks/useSearchBarState.ts`
- `src/features/search/hooks/useSearchWishlistModal.ts`
- `src/features/search/SearchRoute.tsx`
- `src/features/search/SearchRoute.module.css`
- `src/features/search/components/SearchBar/SearchBar.tsx`
- `src/features/search/components/SearchBar/SearchBar.module.css`
- `src/features/search/components/SearchMap/Map.module.css`
- `src/features/search/components/SearchMap/hooks/useMapSelectionInfoWindow.ts`
- `src/features/search/components/SearchAccommodationCard.tsx`
- `src/features/search/components/SearchPagination.tsx`
- `src/features/accommodations/hooks/useAccommodationDetail.ts`
- `src/features/accommodations/hooks/useAccommodationReviews.ts`
- `src/features/accommodations/hooks/useAccommodationCoupons.ts`
- `src/features/accommodations/hooks/useAccommodationBooking.ts`
- `src/features/accommodations/components/AccommodationBookingCardSections.tsx`
- `src/features/accommodations/components/AccommodationBookingCard.module.css`
- `src/features/accommodations/components/AccommodationOverview.module.css`
- `src/features/accommodations/components/AccommodationLocationSection.tsx`
- `src/features/accommodations/components/AccommodationLocationSection.module.css`
- `src/features/accommodations/components/AccommodationHero.tsx`
- `src/features/accommodations/components/AccommodationHero.module.css`
- `src/features/accommodations/edit/components/AccommodationEditScreen.tsx`
- `src/features/accommodations/edit/components/accommodationEditIcons.tsx`
- `src/features/accommodations/edit/components/TimeStep.module.css`
- `src/features/accommodations/edit/components/PhotosStep.module.css`
- `src/features/accommodations/edit/components/EditWizardLayout.module.css`
- `src/features/accommodations/edit/components/EditForm.module.css`
- `src/features/accommodations/edit/components/EditModal.module.css`
- `src/features/reservations/hooks/useReservationList.ts`
- `src/features/reservations/hooks/useReservationConfirmAccommodation.ts`
- `src/features/reservations/hooks/useReservationPayment.ts`
- `src/features/reservations/ReservationConfirmRoute.tsx`
- `src/features/reservations/ReservationDetailRoute.module.css`
- `src/features/reservations/HostReservationsPanel.tsx`
- `src/features/reservations/HostReservationsPanel.module.css`
- `src/features/reservations/HostReservationDetailRoute.module.css`
- `src/features/reservations/PaymentSuccessRoute.module.css`
- `src/features/reservations/PaymentFailRoute.module.css`
- `src/features/reservations/components/ReservationModal/ReservationModal.tsx`
- `src/features/profile/components/ProfileShell.tsx`
- `src/features/profile/HostListingsPanel.tsx`
- `src/components/DatePicker/DatePicker.tsx`
- `src/components/DatePicker/DatePicker.module.css`
- `src/components/ErrorToast/ErrorToast.tsx`
- `src/components/ErrorToast/ErrorToast.module.css`
- `src/components/ListContainer/ListContainer.tsx`
- `src/styles/tokens.css`
- `src/styles/tokens.test.ts`
- `src/styles/design-system-contracts.test.ts`
- `src/api/ui-api-boundary-contracts.test.ts`
- `src/shared/ui/shared-ui-boundary-contracts.test.ts`
- `src/verification-gate.test.ts`
- `scripts/smoke/frontend-smoke.mjs`
- `docs/qa/frontend-architecture-smoke.ko.md`

---

### Task 1: Close Verification And Smoke Fixture Gaps

**Files:**
- Modify: `scripts/smoke/frontend-smoke.mjs`
- Modify: `src/verification-gate.test.ts`
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`

- [ ] **Step 1: Add explicit map key readiness without logging secrets**

Update `scripts/smoke/frontend-smoke.mjs` so the report records boolean readiness only:

```js
const googleMapsApiKeyReady = Boolean(process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
```

The report must include `Google Maps API key: present` or `Google Maps API key: missing`, never the key value.

- [ ] **Step 2: Make ES-backed search result coverage explicit**

Add a route assertion mode that fails strict smoke when the search route has zero result cards after ES is seeded:

```js
const strictSearchResults =
  process.env.AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS === "true";
```

When `strictSearchResults` is true, `/search` must assert that one of these is visible:

```js
[
  "[data-testid='search-result-card']",
  "[data-testid='accommodation-card']",
  "article[aria-label*='숙소']",
]
```

If no selector matches, the smoke report must fail with `Search result fixture was required but no result card was visible`.

- [ ] **Step 3: Update verification contract**

Extend `src/verification-gate.test.ts` to require these exact smoke script terms:

```ts
[
  "googleMapsApiKeyReady",
  "Google Maps API key:",
  "AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS",
  "Search result fixture was required but no result card was visible",
].forEach((term) => {
  expect(smokeScript).toContain(term);
});
```

- [ ] **Step 4: Update QA doc**

In `docs/qa/frontend-architecture-smoke.ko.md`, add a section named `ES Search Fixture Gate` with these facts:

- strict design smoke can run before ES data, but search card visual QA is incomplete
- after ES index is seeded, run with `AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS=true`
- reports must record Google Maps key readiness without recording the key value

- [ ] **Step 5: Run focused checks**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/verification-gate.test.ts --runInBand
```

Expected: PASS.

```bash
npm run smoke:frontend:strict
```

Expected before ES seed: PASS when `AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS` is unset. Report records search empty state or visible card state.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke/frontend-smoke.mjs src/verification-gate.test.ts docs/qa/frontend-architecture-smoke.ko.md
git commit -m "test: make frontend smoke fixture readiness explicit"
```

---

### Task 2: Normalize Route Metadata And Query Ownership

**Files:**
- Create: `src/routes/routeShell.ts`
- Create: `src/routes/routeQuery.ts`
- Create: `src/features/search/lib/searchRouteQuery.ts`
- Create: `src/features/wishlist/lib/wishlistRouteQuery.ts`
- Create: `src/features/profile/lib/profileRouteQuery.ts`
- Modify: `src/routes/paths.ts`
- Modify: `src/routes/routeConfig.tsx`
- Modify: `src/routes/routeConfig.test.tsx`
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Modify: `src/pages/Wishlist/Wishlist.tsx`
- Modify: `src/features/wishlist/WishlistRoute.tsx`
- Modify: `src/features/wishlist/hooks/useWishlistRouteViewState.ts`

- [ ] **Step 1: Add route shell metadata type**

Create `src/routes/routeShell.ts`:

```ts
export type RouteId =
  | "home"
  | "search"
  | "login"
  | "signup"
  | "wishlist"
  | "profile"
  | "accommodation-detail"
  | "accommodation-confirm"
  | "accommodation-edit"
  | "reservation-detail"
  | "reservation-review"
  | "payment-success"
  | "payment-fail"
  | "host-reservation-detail";

export type RouteShell = "main" | "bare";

export type HeaderMode = "default" | "search" | "hidden";

export interface RouteShellMeta {
  id: RouteId;
  layout: RouteShell;
  headerMode: HeaderMode;
  requiresAuth?: boolean;
}
```

- [ ] **Step 2: Extend route config without changing paths**

In `src/routes/routeConfig.tsx`, add `id` and `headerMode` to every route. Existing `layout` and `requiresAuth` values must not change.

- [ ] **Step 3: Split route query helpers by domain**

Move search-specific query shape and serialization from `src/routes/paths.ts` into `src/features/search/lib/searchRouteQuery.ts`. Keep public exports from `src/routes/paths.ts` stable by re-exporting the domain helpers.

Create `src/routes/routeQuery.ts` for shared helpers:

```ts
export const appendDefinedSearchParam = (
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) => {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
};

export const toCanonicalSearchString = (params: URLSearchParams) =>
  Array.from(params.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .reduce((nextParams, [key, value]) => {
      nextParams.append(key, value);
      return nextParams;
    }, new URLSearchParams())
    .toString();
```

- [ ] **Step 4: Move Wishlist URL ownership to page adapter**

Update `src/pages/Wishlist/Wishlist.tsx` so it reads `searchParams` and `setSearchParams`, then passes both into `WishlistRoute`.

Update `src/features/wishlist/WishlistRoute.tsx` props:

```ts
interface WishlistRouteProps {
  searchParams: URLSearchParams;
  setSearchParams: (nextParams: URLSearchParams, options?: { replace?: boolean }) => void;
}
```

Update `src/features/wishlist/hooks/useWishlistRouteViewState.ts` so it no longer imports from `react-router-dom`.

- [ ] **Step 5: Centralize payment fail reason parsing**

Move `PaymentFail` query parsing into `src/features/reservations/lib/paymentRouteState.ts` and add tests to `src/features/reservations/lib/paymentRouteState.test.ts`.

- [ ] **Step 6: Run route tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/routeConfig.test.tsx src/routes/paths.test.ts src/routes/route-boundary-contracts.test.ts src/routes/navigation-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes src/pages/Wishlist src/features/wishlist src/features/search/lib src/features/profile/lib src/features/reservations/lib
git commit -m "refactor: clarify route metadata and query ownership"
```

---

### Task 3: Unify Server State And DTO Boundaries

**Files:**
- Create: `src/features/accommodations/lib/accommodationDetailViewModel.ts`
- Create: `src/features/reviews/lib/reviewViewModel.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationDetail.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationReviews.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationCoupons.ts`
- Modify: `src/features/reservations/hooks/useReservationList.ts`
- Modify: `src/features/reservations/hooks/useReservationConfirmAccommodation.ts`
- Modify: `src/features/search/queryKeys.ts`
- Modify: `src/features/search/lib/searchParams.ts`
- Modify: `src/features/search/hooks/useSearchResults.ts`
- Modify: `src/features/wishlist/lib/wishlistCacheSync.ts`
- Modify: `src/api/ui-api-boundary-contracts.test.ts`

- [ ] **Step 1: Add canonical query key signatures**

Use `toCanonicalSearchString` from `src/routes/routeQuery.ts` inside search and wishlist query key builders. Equal query values must produce equal query keys independent of insertion order.

- [ ] **Step 2: Convert manual fetch hooks to TanStack Query**

Convert these hooks to `useQuery` with explicit query keys and `enabled` gates:

- `useAccommodationDetail`
- `useAccommodationReviews`
- `useAccommodationCoupons`
- `useReservationList`
- `useReservationConfirmAccommodation`

Each converted hook must preserve its current public return shape.

- [ ] **Step 3: Keep auth/session behavior unchanged**

Accommodation detail must still do this:

- logged-out detail state exposes `is_in_wishlist=false`
- login transition re-fetches detail
- logout transition clears user-scoped wishlist state
- authenticated user can add recently viewed item

- [ ] **Step 4: Add view model boundaries**

Create `src/features/accommodations/lib/accommodationDetailViewModel.ts` so route/component files consume presentation fields instead of raw server DTOs.

The mapper must expose stable names for:

- title
- location label
- hero image URLs
- host summary
- guest/bedroom/bed/bath counts
- rating/review count
- amenities
- cancellation/check-in/check-out labels
- wishlist membership

Create `src/features/reviews/lib/reviewViewModel.ts` for rating, author, date, content, and image presentation fields.

- [ ] **Step 5: Expand UI/API boundary contracts**

Update `src/api/ui-api-boundary-contracts.test.ts` so presentation files cannot import server DTO types directly except approved mapper files.

- [ ] **Step 6: Run focused state/API tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationDetail.test.ts src/features/accommodations/hooks/useAccommodationReviews.test.ts src/features/reservations/hooks/useReservationList.test.ts src/features/search/hooks/useSearchResults.test.ts src/api/ui-api-boundary-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/accommodations src/features/reviews src/features/reservations src/features/search src/features/wishlist src/api/ui-api-boundary-contracts.test.ts
git commit -m "refactor: align server state and dto boundaries"
```

---

### Task 4: Decompose SearchBar Before Visual Redesign

**Files:**
- Create: `src/features/search/components/SearchBar/SearchDestinationField.tsx`
- Create: `src/features/search/components/SearchBar/SearchDateFields.tsx`
- Create: `src/features/search/components/SearchBar/SearchGuestSelector.tsx`
- Create: `src/features/search/components/SearchBar/SearchBarPopover.tsx`
- Modify: `src/features/search/components/SearchBar/SearchBar.tsx`
- Modify: `src/features/search/components/SearchBar/SearchBar.module.css`
- Modify: `src/features/search/hooks/useSearchBarState.ts`
- Modify: `src/features/search/hooks/useSearchBarState.test.tsx`

- [ ] **Step 1: Preserve public SearchBar contract**

Do not change existing imports of `SearchBar`. Its exported component name, route header usage, and search submit behavior must remain stable.

- [ ] **Step 2: Extract destination field**

Move destination input, Google Places suggestion list, selection handling, and clear behavior into `SearchDestinationField.tsx`.

Required props:

```ts
interface SearchDestinationFieldProps {
  value: string;
  suggestions: string[];
  isLoading: boolean;
  isActive: boolean;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
}
```

- [ ] **Step 3: Extract date fields**

Move check-in/check-out labels and date popover trigger handling into `SearchDateFields.tsx`. The DatePicker component must remain outside `shared/ui` until Task 6 decides ownership.

- [ ] **Step 4: Extract guest selector**

Move adult/child/infant/pet counters into `SearchGuestSelector.tsx` and use `CounterStepper` where the interaction model matches existing behavior.

- [ ] **Step 5: Extract popover shell**

Create `SearchBarPopover.tsx` for desktop popover and mobile sheet shell. It must use existing z-index/layout tokens and keep keyboard close behavior.

- [ ] **Step 6: Add decomposition contract**

Add a focused test to `src/features/search/components/SearchBar/SearchBar.test.tsx` or an existing search bar test that asserts:

- destination typing updates route-ready state
- date selection keeps check-in/check-out order
- guest counters clamp values
- submit calls current route builder
- Escape closes active popover

- [ ] **Step 7: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/components/SearchBar/SearchBar.test.tsx src/features/search/hooks/useSearchBarState.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/search/components/SearchBar src/features/search/hooks/useSearchBarState.ts src/features/search/hooks/useSearchBarState.test.tsx
git commit -m "refactor: split search bar interaction surfaces"
```

---

### Task 5: Isolate Search Map Vendor Boundary

**Files:**
- Create: `src/features/search/components/SearchMap/lib/infoWindowContent.ts`
- Create: `src/features/search/components/SearchMap/lib/markerIcon.ts`
- Create: `src/features/search/components/SearchMap/hooks/useMapInfoWindowEvents.ts`
- Modify: `src/features/search/components/SearchMap/hooks/useMapSelectionInfoWindow.ts`
- Modify: `src/features/search/components/SearchMap/Map.module.css`
- Modify: `src/features/search/SearchRoute.tsx`
- Modify: `src/features/search/SearchRoute.module.css`

- [ ] **Step 1: Extract info window content builder**

Move HTML string generation out of `useMapSelectionInfoWindow.ts` into `infoWindowContent.ts`.

The function signature must be:

```ts
export interface SearchMapInfoWindowContent {
  accommodationId: string;
  title: string;
  priceLabel: string;
  imageUrl?: string;
  ratingLabel?: string;
  isWishlisted: boolean;
}

export const buildSearchMapInfoWindowContent = (
  content: SearchMapInfoWindowContent,
) => string;
```

- [ ] **Step 2: Extract marker icon model**

Move marker icon SVG/path/color decisions into `markerIcon.ts`. Raw color literals must be named constants in that file and covered by a unit test.

- [ ] **Step 3: Extract event binding**

Create `useMapInfoWindowEvents.ts` for click handlers that bridge info window buttons to React callbacks. `useMapSelectionInfoWindow.ts` should coordinate data and lifecycle only.

- [ ] **Step 4: Fence Google Maps CSS overrides**

Move Google Maps global override selectors in `Map.module.css` under a documented vendor boundary block. Keep `!important` only for Google-owned inline styles that cannot be overridden through tokens.

- [ ] **Step 5: Replace search route inline style**

Remove the inline `style` usage in `src/features/search/SearchRoute.tsx` and replace it with a CSS class or CSS variable written through a typed style helper.

- [ ] **Step 6: Run focused map/search tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/components/SearchMap src/features/search/SearchRoute.test.tsx --runInBand
```

Expected: PASS. If `SearchRoute.test.tsx` does not exist, run all search tests:

```bash
npm run test:ci:no-cache -- --runTestsByPath $(find src/features/search -name "*.test.ts" -o -name "*.test.tsx" | tr "\n" " ") --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/search/components/SearchMap src/features/search/SearchRoute.tsx src/features/search/SearchRoute.module.css
git commit -m "refactor: isolate search map vendor boundary"
```

---

### Task 6: Standardize Shared UI Interactions And Accessibility

**Files:**
- Create: `src/shared/ui/useOutsideClick.ts`
- Create: `src/shared/ui/Tabs/Tabs.tsx`
- Create: `src/shared/ui/Tabs/Tabs.module.css`
- Create: `src/shared/ui/Tabs/Tabs.test.tsx`
- Create: `src/shared/ui/StatusBadge/StatusBadge.tsx`
- Create: `src/shared/ui/StatusBadge/StatusBadge.module.css`
- Create: `src/shared/ui/StatusBadge/StatusBadge.test.tsx`
- Create: `src/shared/ui/ToastHost/ToastHost.tsx`
- Create: `src/shared/ui/ToastHost/ToastHost.module.css`
- Create: `src/shared/ui/ToastHost/ToastHost.test.tsx`
- Modify: `src/shared/ui/shared-ui-boundary-contracts.test.ts`
- Modify: `src/layouts/AppHeader/UserMenu.tsx`
- Modify: `src/features/reviews/components/ReviewModal/ReviewModal.tsx`
- Modify: `src/features/accommodations/AccommodationDetailRoute.tsx`
- Modify: `src/features/accommodations/edit/components/AccommodationEditScreen.tsx`
- Modify: `src/features/profile/components/ProfileShell.tsx`
- Modify: `src/features/profile/HostListingsPanel.tsx`
- Modify: `src/features/reservations/HostReservationsPanel.tsx`
- Modify: `src/features/search/components/SearchPagination.tsx`
- Modify: `src/components/ErrorToast/ErrorToast.tsx`

- [ ] **Step 1: Add shared outside-click hook**

Create `src/shared/ui/useOutsideClick.ts`:

```ts
import { RefObject, useEffect } from "react";

export const useOutsideClick = <T extends HTMLElement>(
  ref: RefObject<T>,
  onOutsideClick: () => void,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const node = ref.current;

      if (!node || node.contains(event.target as Node)) {
        return;
      }

      onOutsideClick();
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [enabled, onOutsideClick, ref]);
};
```

- [ ] **Step 2: Replace local click-outside logic**

Use `useOutsideClick` in:

- `UserMenu`
- `ReviewModal`
- `AccommodationDetailRoute`
- `SearchBar` if still needed after Task 4
- `AccommodationEditScreen`

- [ ] **Step 3: Add Tabs primitive**

Create a domain-independent tabs primitive with `role="tablist"`, `role="tab"`, `aria-selected`, keyboard ArrowLeft/ArrowRight/Home/End behavior, and token-backed styling.

- [ ] **Step 4: Apply tabs/accessibility fixes**

Use the tabs primitive or add equivalent semantics in:

- `ProfileShell`
- `HostListingsPanel`
- `HostReservationsPanel`
- search filter/pagination surfaces

Sortable table headers must expose `aria-sort`.

- [ ] **Step 5: Add StatusBadge and ToastHost**

Move repeated status badge and toast host CSS into shared primitives. Route CSS should no longer duplicate `.toastContainer`.

- [ ] **Step 6: Reclassify `src/components`**

Move ownership decisions into code comments and boundary tests:

- `DatePicker` remains `src/components` until it has full date-grid semantics.
- `ErrorToast` becomes a thin wrapper around `ToastHost`.
- `ListContainer` either becomes shared layout utility or is replaced by CSS classes in callers.

- [ ] **Step 7: Run shared UI and accessibility tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/shared/ui/shared-ui-boundary-contracts.test.ts src/shared/ui/Tabs/Tabs.test.tsx src/shared/ui/StatusBadge/StatusBadge.test.tsx src/shared/ui/ToastHost/ToastHost.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/ui src/layouts/AppHeader src/features/profile src/features/reservations src/features/reviews src/features/accommodations src/features/search src/components/ErrorToast src/components/ListContainer
git commit -m "refactor: standardize shared ui interactions"
```

---

### Task 7: Split Booking, Payment, And Reservation Surfaces

**Files:**
- Modify: `src/features/accommodations/components/AccommodationBookingCardSections.tsx`
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts`
- Modify: `src/features/reservations/ReservationConfirmRoute.tsx`
- Modify: `src/features/reservations/hooks/useReservationPayment.ts`
- Modify: `src/features/reservations/components/ReservationModal/ReservationModal.tsx`
- Modify: `src/features/reservations/hooks/useReservationList.ts`
- Modify: `src/features/reservations/ReservationDetailRoute.module.css`
- Modify: `src/features/reservations/HostReservationsPanel.tsx`
- Modify: `src/features/reservations/HostReservationDetailRoute.module.css`

- [ ] **Step 1: Pick one canonical payment entry**

Keep this canonical path:

```txt
useAccommodationBooking -> ReservationConfirmRoute -> PaymentSuccessRoute -> payment confirm dedupe -> checkout cleanup
```

`ReservationModal` must call the same route-based flow or be isolated behind a clearly named legacy helper.

- [ ] **Step 2: Split booking hook responsibilities**

Split `useAccommodationBooking.ts` into internal helpers for:

- date range validation
- guest count validation
- coupon selection
- auth modal handoff
- checkout state creation
- reservation confirm navigation

The public hook return shape must stay stable for `AccommodationBookingCardSections`.

- [ ] **Step 3: Split booking card sections**

Break `AccommodationBookingCardSections.tsx` into:

- date controls
- guest controls
- coupon controls
- price summary
- submit/auth modal section

Use `CounterStepper` for guest controls when the current behavior matches.

- [ ] **Step 4: Tokenize reservation status styles**

Move reservation status colors and repeated button/card styles into `StatusBadge`, shared `Button`, or tokens. Remove raw status colors from reservation CSS.

- [ ] **Step 5: Run reservation and accommodation booking tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationBooking.test.ts src/features/reservations/lib/paymentRouteState.test.ts src/features/reservations/lib/reservationCheckoutState.test.ts src/features/reservations/hooks/useReservationList.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/accommodations/components src/features/accommodations/hooks src/features/reservations
git commit -m "refactor: clarify booking and reservation flow surfaces"
```

---

### Task 8: Split Edit Wizard And Remove Design Literals From High-Risk CSS

**Files:**
- Modify: `src/features/accommodations/edit/components/AccommodationEditScreen.tsx`
- Modify: `src/features/accommodations/edit/components/accommodationEditIcons.tsx`
- Modify: `src/features/accommodations/edit/lib/accommodationEditMapper.ts`
- Modify: `src/features/accommodations/edit/components/TimeStep.module.css`
- Modify: `src/features/accommodations/edit/components/PhotosStep.module.css`
- Modify: `src/features/accommodations/edit/components/EditWizardLayout.module.css`
- Modify: `src/features/accommodations/edit/components/EditForm.module.css`
- Modify: `src/features/accommodations/edit/components/EditModal.module.css`
- Modify: `src/features/accommodations/components/AccommodationOverview.module.css`
- Modify: `src/features/accommodations/components/AccommodationLocationSection.module.css`
- Modify: `src/features/accommodations/components/AccommodationHero.tsx`
- Modify: `src/features/accommodations/components/AccommodationHero.module.css`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/tokens.test.ts`
- Modify: `src/styles/design-system-contracts.test.ts`

- [ ] **Step 1: Split edit wizard screen**

Extract from `AccommodationEditScreen.tsx`:

- wizard progress header
- step navigation footer
- save/publish action bar
- dirty state warning modal adapter

No extracted component may import API files directly.

- [ ] **Step 2: Split icon registry**

Break `accommodationEditIcons.tsx` into smaller files by domain:

- `editStepIcons.tsx`
- `amenityIcons.tsx`
- `accommodationTypeIcons.tsx`

Keep the existing icon visuals until the visual redesign phase.

- [ ] **Step 3: Tokenize edit wizard CSS**

Replace raw colors, shadows, radius values, `transition: all`, and viewport height literals in edit wizard modules with tokens from `src/styles/tokens.css`.

- [ ] **Step 4: Tokenize accommodation detail core CSS**

Clean raw design literals in:

- `AccommodationOverview.module.css`
- `AccommodationLocationSection.module.css`
- `AccommodationHero.module.css`
- `AccommodationBookingCard.module.css`

Inline transform for the hero carousel may remain only if it is dynamic behavior. Static inline styles must move to CSS Modules.

- [ ] **Step 5: Expand token contract**

Update `src/styles/tokens.test.ts` so high-risk CSS files from this task are included in the token-owned CSS list.

- [ ] **Step 6: Run style and edit tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/accommodations/edit src/features/accommodations/components src/styles
git commit -m "refactor: prepare edit and detail styles for redesign"
```

---

### Task 9: Add Console, Inline Style, And Design Literal Guardrails

**Files:**
- Create: `src/utils/clientLogger.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/components/ErrorBoundary/ErrorBoundary.tsx`
- Modify: `src/hooks/usePlacesAutocomplete.ts`
- Modify: `src/layouts/AppHeader/UserMenu.tsx`
- Modify: `src/features/search/hooks/useSearchWishlistModal.ts`
- Modify: `src/features/wishlist/WishlistRoute.tsx`
- Modify: `src/features/accommodations/hooks/useAccommodationDetail.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationCoupons.ts`
- Modify: `src/features/search/components/SearchAccommodationCard.tsx`
- Modify: `src/features/wishlist/components/WishlistDetailView.tsx`
- Modify: `src/features/wishlist/components/WishlistModal/WishlistModal.tsx`
- Modify: `src/features/accommodations/edit/components/PhotosStep.tsx`
- Modify: `src/verification-gate.test.ts`

- [ ] **Step 1: Add client logger wrapper**

Create `src/utils/clientLogger.ts`:

```ts
type LogLevel = "warn" | "error";

interface ClientLogPayload {
  message: string;
  error?: unknown;
}

const emitLog = (level: LogLevel, payload: ClientLogPayload) => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const logger = level === "warn" ? console.warn : console.error;
  logger(payload.message, payload.error);
};

export const clientLogger = {
  warn: (payload: ClientLogPayload) => emitLog("warn", payload),
  error: (payload: ClientLogPayload) => emitLog("error", payload),
};
```

- [ ] **Step 2: Replace raw production console calls**

Replace raw `console.warn` and `console.error` in production code with `clientLogger`. Keep `reportWebVitals(console.log)` as a comment-only example in `src/index.tsx`.

- [ ] **Step 3: Remove static inline styles**

Move static `style={{ display: "none" }}`, static border style, and static button style objects into CSS Modules. Keep runtime-progress width and carousel transform inline only when values depend on live state.

- [ ] **Step 4: Add guard tests**

Extend `src/verification-gate.test.ts` to scan production `src` files and fail on raw `console.warn`, raw `console.error`, and static inline style patterns outside an allowlist.

- [ ] **Step 5: Run verification gate**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/verification-gate.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils src/contexts src/components src/hooks src/layouts src/features src/verification-gate.test.ts
git commit -m "test: guard frontend logging and inline style drift"
```

---

### Task 10: Run Final Structure Gate And Browser QA

**Files:**
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`

- [ ] **Step 1: Confirm worktree state**

```bash
git status --short
```

Expected: clean before starting final verification, or only intended QA doc edits after browser QA.

- [ ] **Step 2: Run static redesign gate**

```bash
npm run verify:pre-redesign
```

Expected:

- TypeScript PASS
- Jest PASS
- production build prints `Compiled successfully`

- [ ] **Step 3: Run strict browser smoke without leaking secrets**

Use shell variables for credentials and dynamic route IDs. Do not write credential values into repo files.

```bash
: "${AIRBOB_QA_EMAIL:?set AIRBOB_QA_EMAIL in the shell}"
: "${AIRBOB_QA_PASSWORD:?set AIRBOB_QA_PASSWORD in the shell}"
: "${AIRBOB_SMOKE_ACCOMMODATION_ID:?set AIRBOB_SMOKE_ACCOMMODATION_ID in the shell}"
: "${AIRBOB_SMOKE_RESERVATION_UID:?set AIRBOB_SMOKE_RESERVATION_UID in the shell}"
: "${AIRBOB_SMOKE_HOST_RESERVATION_UID:?set AIRBOB_SMOKE_HOST_RESERVATION_UID in the shell}"
AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS=true npm run smoke:frontend:strict
```

Expected:

- smoke report status PASS
- no skipped dynamic routes
- search result card visible
- map rendered
- Google Maps API key readiness recorded as present
- credentials and API key values absent from output and report

- [ ] **Step 4: Run gstack QA when visual flows are available**

Use gstack QA against `http://localhost:3000` after frontend and backend are running and ES index is seeded.

Required manual checkpoints:

- Home search opens search results.
- Search card click opens accommodation detail.
- Map marker/info window opens detail.
- Wishlist modal opens and closes without stale membership state.
- Login flow works with the QA account through env-provided credentials.
- Profile guest/host tabs expose selected state.
- Reservation detail and host reservation detail render with stable dynamic route IDs.
- Mobile search bottom sheet and map/list toggle do not overlap header or toast layers.

- [ ] **Step 5: Update QA report**

Append a dated section to `docs/qa/frontend-architecture-smoke.ko.md` with:

- static gate result
- strict smoke report path
- whether ES search result fixture was present
- whether Google Maps key readiness was present
- dynamic route coverage
- browser QA result
- remaining risk if a backend fixture is unavailable

- [ ] **Step 6: Final full verification**

```bash
npm run verify:design-ready
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/qa/frontend-architecture-smoke.ko.md
git commit -m "docs: record frontend design readiness qa"
```

---

## Self-Review Checklist

- [ ] No backend, API contract, DB, or server code changed.
- [ ] Pages remain thin route adapters.
- [ ] Feature route containers do not import page files.
- [ ] `shared/ui` does not import feature/page/API/type DTO files.
- [ ] Route builders still preserve all existing public URLs.
- [ ] Search query keys are canonical and order-independent.
- [ ] User-scoped cache is cleared on logout/global auth error.
- [ ] DTO imports in presentation files are blocked by contract tests.
- [ ] SearchBar behavior is preserved after decomposition.
- [ ] Google Maps vendor CSS and info window HTML are isolated.
- [ ] Dialog, tabs, status badges, toast hosts, and counters use shared primitives where domain-independent.
- [ ] High-risk CSS files use tokens for colors, radius, shadows, z-index, viewport offsets, and transitions.
- [ ] No QA password, API key, or dynamic production identifier is committed.
- [ ] `npm run verify:pre-redesign` passes.
- [ ] `npm run smoke:frontend:strict` passes with seeded ES data.
- [ ] `npm run verify:design-ready` passes.

## Final Decision

Do not go straight into Airbnb visual redesign yet. The current architecture is much better than the starting point, but it is still not safe enough for a large design pass because SearchBar, SearchMap, booking/payment, edit wizard, and high-risk CSS are still behavior-heavy and style-heavy at the same time.

The correct next step is a short structure-closure pass using this plan. After Tasks 1-10 pass, Airbnb design system work can proceed with a much lower chance of breaking search, map, wishlist, booking, payment, and host flows.
