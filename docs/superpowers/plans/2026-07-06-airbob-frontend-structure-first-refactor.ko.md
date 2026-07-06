# Airbob Frontend Structure-First Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 시스템을 적용하기 전에 프론트엔드의 라우팅, 상태/API, 기능 경계, 스타일 primitive, 검증 게이트를 안정화한다.

**Architecture:** 현재의 feature-first 구조, thin page adapter, route config, TanStack Query, API envelope wrapper, CSS Modules, design token 기반은 유지한다. 리팩토링은 backend/API/DB/server 로직을 변경하지 않고, 프론트 내부 경계와 테스트 게이트만 정리한다. 디자인 변경은 이 계획이 끝난 뒤 별도 단계로 진행한다.

**Tech Stack:** React 19, TypeScript 4.9, React Router 7, TanStack Query 5, Axios, CRA/react-scripts, Jest, React Testing Library, CSS Modules, gstack smoke/browser QA.

---

## Starting State

- Base branch: `main`
- Verified source: `origin/main` fetched before audit
- Current verified commit during audit: `e5491a5`
- Static check observed during audit: `npm run typecheck` passed
- Scope constraint: do not modify backend/API/DB/server code
- Execution rule: one task per commit, with tests run before each commit

## Files And Ownership

Create:

- `src/routes/routeDefinitions.ts` - component-free route metadata source of truth.
- `src/routes/routeMatching.ts` - route metadata lookup by pathname.
- `src/routes/routeMatching.test.ts` - tests for route shell lookup, dynamic paths, and not-found fallback.
- `src/features/wishlist/publicCache.ts` - public wishlist cache invalidation/membership helpers for other features.
- `src/features/search/publicCache.ts` - public search cache invalidation helpers for wishlist mutations.
- `src/shared/ui/PageShell/PageShell.tsx` - route/page spacing shell primitive.
- `src/shared/ui/PageShell/PageShell.module.css` - tokenized page shell layout.
- `src/shared/ui/PageShell/PageShell.test.tsx` - layout primitive contract.
- `src/shared/ui/ListingCard/ListingCard.tsx` - product-level listing card primitive.
- `src/shared/ui/ListingCard/ListingCard.module.css` - tokenized listing card styles.
- `src/shared/ui/ListingCard/ListingCard.test.tsx` - listing card accessibility and rendering contract.
- `src/shared/ui/OverlaySurface/OverlaySurface.tsx` - shared popover/bottom-sheet/dialog surface primitive.
- `src/shared/ui/OverlaySurface/OverlaySurface.module.css` - z-index, shadow, and responsive overlay tokens.
- `src/shared/ui/OverlaySurface/OverlaySurface.test.tsx` - overlay role and class contract.
- `docs/architecture/frontend-structure-refactor.md` - short architecture decision record after implementation.

Modify:

- `src/routes/routeConfig.tsx` - build lazy route config from component-free definitions.
- `src/routes/Router.tsx` - render routes from the unified config without duplicating shell metadata.
- `src/routes/routeShell.ts` - keep only `RouteId`, `RouteShell`, `HeaderMode`, and `RouteShellMeta` type declarations.
- `src/routes/routeConfig.test.tsx` - assert route definitions and lazy route config stay in sync.
- `src/routes/route-boundary-contracts.test.ts` - protect the new route definition boundary.
- `src/layouts/MainLayout.tsx` - resolve active route shell and pass header mode.
- `src/layouts/AppHeader/Header.tsx` - accept `headerMode` and render one responsive search shell path.
- `src/layouts/AppHeader/Header.module.css` - remove hidden duplicate searchbar dependency after `Header.tsx` renders one logical search bar.
- `scripts/smoke/frontend-smoke.mjs` - align smoke route coverage with route definitions and explicit dynamic fixtures.
- `src/features/reservations/hooks/useReservationList.ts` - move cursor pagination fully to Query state.
- `src/features/reservations/hooks/useReservationList.test.ts` - preserve pagination and race behavior.
- `src/features/profile/hooks/useHostListings.ts` - move manual fetch to Query state.
- `src/features/profile/hooks/useHostListings.test.ts` - preserve reload, filter reset, and pagination.
- `src/features/wishlist/lib/wishlistCacheSync.ts` - remove direct private search query key ownership.
- `src/features/search/hooks/useSearchWishlistModal.ts` - depend on public wishlist boundary only.
- `src/features/search/SearchRoute.tsx` - reduce route orchestration surface.
- `src/features/search/SearchRoute.module.css` - remove missing or implicit selected styling and use tokens.
- `src/features/search/components/SearchBar/SearchBar.tsx` - split shell/controller details without behavior changes.
- `src/features/search/hooks/useSearchBarState.ts` - narrow hook return surface.
- `src/features/accommodations/AccommodationDetailRoute.tsx` - group booking/coupon/review/view state props.
- `src/features/accommodations/components/AccommodationBookingCard.tsx` - receive grouped state/action props.
- `src/features/accommodations/hooks/useAccommodationBooking.ts` - keep checkout state and date validation in one hook boundary.
- `src/features/reservations/hooks/useReservationPayment.ts` - share checkout/payment helpers with confirm route.
- `src/features/reservations/ReservationConfirmRoute.tsx` - use shared checkout/payment helper.
- `src/contexts/AuthContext.tsx` - make frontend logout cache clearing local-first and server logout best-effort.
- `src/shared/ui/index.ts` - export new UI primitives.
- `src/styles/tokens.css` - add only missing semantic tokens needed by new primitives.
- `src/styles/tokens.test.ts` - guard new primitive and high-risk route CSS token usage.
- `package.json` - add lint/static verification scripts after existing lint failures are handled.

Do not modify:

- Backend repository files.
- API response contracts.
- Database or server logic.
- Environment secret values.
- Generated smoke screenshots/reports unless a smoke run intentionally creates them.

## Task 1: Route Shell Source Of Truth

**Files:**

- Create: `src/routes/routeDefinitions.ts`
- Create: `src/routes/routeMatching.ts`
- Create: `src/routes/routeMatching.test.ts`
- Modify: `src/routes/routeShell.ts`
- Modify: `src/routes/routeConfig.tsx`
- Modify: `src/routes/routeConfig.test.tsx`
- Modify: `src/routes/Router.tsx`
- Modify: `src/layouts/MainLayout.tsx`
- Modify: `src/layouts/AppHeader/Header.tsx`
- Modify: `src/layouts/AppHeader/Header.module.css`
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Modify: `scripts/smoke/frontend-smoke.mjs`
- Delete after reference check: `src/pages/Reservations/Reservations.tsx`, only when `rg` proves it has no imports or route registration.

- [ ] **Step 1: Write route definition tests**

Add `src/routes/routeMatching.test.ts` with these cases:

```ts
import { ROUTE_PATHS } from "./paths";
import { getRouteShellForPathname } from "./routeMatching";

describe("route shell matching", () => {
  it("returns search header metadata for the search route", () => {
    expect(getRouteShellForPathname(ROUTE_PATHS.search)).toMatchObject({
      id: "search",
      layout: "main",
      headerMode: "search",
      requiresAuth: false,
    });
  });

  it("matches dynamic accommodation detail paths", () => {
    expect(getRouteShellForPathname("/accommodations/42")).toMatchObject({
      id: "accommodation-detail",
      layout: "main",
      headerMode: "default",
      requiresAuth: false,
    });
  });

  it("falls back to not-found shell metadata for unknown paths", () => {
    expect(getRouteShellForPathname("/missing-route")).toMatchObject({
      id: "not-found",
      layout: "bare",
      headerMode: "hidden",
      requiresAuth: false,
    });
  });
});
```

- [ ] **Step 2: Run the failing route test**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/routes/routeMatching.test.ts
```

Expected: FAIL because `routeMatching.ts` does not exist yet.

- [ ] **Step 3: Create component-free route definitions**

Create `src/routes/routeDefinitions.ts`:

```ts
import { ROUTE_PATHS } from "./paths";
import type { HeaderMode, RouteId, RouteShell } from "./routeShell";

export type AppRouteId = RouteId | "not-found";

export interface AppRouteDefinition {
  id: AppRouteId;
  path: string;
  requiresAuth: boolean;
  layout: RouteShell;
  headerMode: HeaderMode;
}

export const routeDefinitions: AppRouteDefinition[] = [
  {
    id: "home",
    path: ROUTE_PATHS.home,
    requiresAuth: false,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "search",
    path: ROUTE_PATHS.search,
    requiresAuth: false,
    layout: "main",
    headerMode: "search",
  },
  {
    id: "accommodation-detail",
    path: ROUTE_PATHS.accommodationDetail,
    requiresAuth: false,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "accommodation-confirm",
    path: ROUTE_PATHS.accommodationConfirm,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "accommodation-edit",
    path: ROUTE_PATHS.accommodationEdit,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "wishlist",
    path: ROUTE_PATHS.wishlist,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "profile",
    path: ROUTE_PATHS.profile,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "host-reservation-detail",
    path: ROUTE_PATHS.hostReservationDetail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "reservation-detail",
    path: ROUTE_PATHS.reservationDetail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "reservation-review",
    path: ROUTE_PATHS.reviewCreate,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "payment-success",
    path: ROUTE_PATHS.paymentSuccess,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "payment-fail",
    path: ROUTE_PATHS.paymentFail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "login",
    path: ROUTE_PATHS.login,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
  {
    id: "signup",
    path: ROUTE_PATHS.signup,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
  {
    id: "not-found",
    path: ROUTE_PATHS.notFound,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
];
```

- [ ] **Step 4: Create route shell matcher**

Create `src/routes/routeMatching.ts`:

```ts
import { matchPath } from "react-router-dom";
import { routeDefinitions } from "./routeDefinitions";

const notFoundRoute = routeDefinitions.find((route) => route.id === "not-found");

if (!notFoundRoute) {
  throw new Error("routeDefinitions must include not-found route metadata");
}

export const getRouteShellForPathname = (pathname: string) => {
  return (
    routeDefinitions.find((route) =>
      matchPath({ path: route.path, end: true }, pathname),
    ) ?? notFoundRoute
  );
};
```

- [ ] **Step 5: Rebuild route config from definitions**

Modify `src/routes/routeConfig.tsx` so lazy components are mapped by route id and merged with `routeDefinitions`.

Use this shape:

```ts
import React from "react";
import { routeDefinitions, type AppRouteDefinition } from "./routeDefinitions";

const Home = React.lazy(() => import("../pages/Home/Home"));
const Search = React.lazy(() => import("../pages/Search/Search"));
const AccommodationDetail = React.lazy(
  () => import("../pages/AccommodationDetail/AccommodationDetail"),
);
const AccommodationEdit = React.lazy(
  () => import("../pages/AccommodationEdit/AccommodationEdit"),
);
const Wishlist = React.lazy(() => import("../pages/Wishlist/Wishlist"));
const Profile = React.lazy(() => import("../pages/Profile/Profile"));
const ReservationDetail = React.lazy(
  () => import("../pages/Reservations/ReservationDetail"),
);
const HostReservationDetail = React.lazy(
  () => import("../pages/Profile/HostReservationDetail/HostReservationDetail"),
);
const ReservationConfirm = React.lazy(
  () => import("../pages/Reservations/ReservationConfirm"),
);
const ReviewCreate = React.lazy(
  () => import("../pages/Reservations/ReviewCreate"),
);
const PaymentSuccess = React.lazy(
  () => import("../pages/Reservations/PaymentSuccess"),
);
const PaymentFail = React.lazy(() => import("../pages/Reservations/PaymentFail"));
const Login = React.lazy(() => import("../pages/Auth/Login/Login"));
const Signup = React.lazy(() => import("../pages/Auth/Signup/Signup"));
const NotFound = React.lazy(() => import("../pages/NotFound/NotFound"));

const routeComponents = {
  home: Home,
  search: Search,
  "accommodation-detail": AccommodationDetail,
  "accommodation-confirm": ReservationConfirm,
  "accommodation-edit": AccommodationEdit,
  wishlist: Wishlist,
  profile: Profile,
  "host-reservation-detail": HostReservationDetail,
  "reservation-detail": ReservationDetail,
  "reservation-review": ReviewCreate,
  "payment-success": PaymentSuccess,
  "payment-fail": PaymentFail,
  login: Login,
  signup: Signup,
  "not-found": NotFound,
} satisfies Record<
  AppRouteDefinition["id"],
  React.LazyExoticComponent<React.ComponentType>
>;

export interface AppRouteConfig extends AppRouteDefinition {
  component: React.LazyExoticComponent<React.ComponentType>;
}

export const appRoutes: AppRouteConfig[] = routeDefinitions.map((route) => ({
  ...route,
  component: routeComponents[route.id],
}));
```

- [ ] **Step 6: Make `headerMode` real**

Modify `src/layouts/MainLayout.tsx` so it resolves the active shell and passes `headerMode` into `Header`.

Use this component shape:

```tsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./AppHeader";
import { getRouteShellForPathname } from "../routes/routeMatching";
import styles from "./MainLayout.module.css";

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const routeShell = getRouteShellForPathname(location.pathname);

  return (
    <div className={styles.container}>
      <Header headerMode={routeShell.headerMode} />
      <main className={styles.main}>{children ?? <Outlet />}</main>
    </div>
  );
};
```

Modify `src/layouts/AppHeader/Header.tsx` to accept the prop:

```tsx
import type { HeaderMode } from "../../routes/routeShell";

interface HeaderProps {
  headerMode?: HeaderMode;
}

export const Header: React.FC<HeaderProps> = ({ headerMode = "default" }) => {
  const shouldRenderSearch = headerMode === "default" || headerMode === "search";
  const isSearchRouteHeader = headerMode === "search";
```

Then render `HeaderSearchBar` only behind `shouldRenderSearch`. Keep current visual behavior on default routes until Task 4 removes the duplicate responsive mount.

- [ ] **Step 7: Update route tests to compare definitions**

In `src/routes/routeConfig.test.tsx`, replace the duplicated route metadata array with assertions against `routeDefinitions`.

Add:

```ts
import { routeDefinitions } from "./routeDefinitions";

it("builds lazy app routes from component-free route definitions", () => {
  expect(
    appRoutes.map(({ component, ...route }) => route),
  ).toEqual(routeDefinitions);
});
```

- [ ] **Step 8: Update boundary tests**

In `src/routes/route-boundary-contracts.test.ts`, allow `routeDefinitions.ts` and `routeMatching.ts` to import only `./paths`, `./routeShell`, and `react-router-dom`. Keep feature imports forbidden.

Add this assertion:

```ts
it("keeps route shell definitions component-free", () => {
  const definitionSource = readFileSync(
    join(process.cwd(), "src/routes/routeDefinitions.ts"),
    "utf8",
  );

  expect(definitionSource).not.toContain("React.lazy");
  expect(definitionSource).not.toMatch(/pages\//);
  expect(definitionSource).not.toMatch(/features\//);
});
```

- [ ] **Step 9: Align smoke route source**

Modify `scripts/smoke/frontend-smoke.mjs` so route templates are documented from the frontend route list. Because this script runs in Node outside TypeScript, keep the static `ROUTES` array for execution but add a `KNOWN_ROUTE_NAMES` array that mirrors route ids and fails when required smoke route names are missing.

Add near route definitions:

```js
const KNOWN_ROUTE_NAMES = [
  "home",
  "search",
  "wishlist",
  "wishlist-recently-viewed",
  "profile-host-listings",
  "accommodation-detail",
  "accommodation-edit",
  "reservation-detail",
  "host-reservation-detail",
];

const routeNames = ROUTES.map((route) => route.name);
const missingKnownRoutes = KNOWN_ROUTE_NAMES.filter(
  (name) => !routeNames.includes(name),
);

if (missingKnownRoutes.length > 0) {
  console.error(
    `Smoke route registry is missing required routes: ${missingKnownRoutes.join(", ")}`,
  );
  process.exit(1);
}
```

- [ ] **Step 10: Remove or justify stale reservations page**

Run:

```bash
rg "pages/Reservations/Reservations|Reservations/Reservations|<Reservations" src
```

Expected if stale: no references except the file itself. If no references exist, delete `src/pages/Reservations/Reservations.tsx`. If a reference exists, wire it through `routeDefinitions.ts` and `routeConfig.tsx` instead of leaving it unreachable.

- [ ] **Step 11: Run route verification**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/routes/routeMatching.test.ts src/routes/routeConfig.test.tsx src/routes/route-boundary-contracts.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/routes src/layouts scripts/smoke/frontend-smoke.mjs src/pages/Reservations/Reservations.tsx
git commit -m "refactor: centralize frontend route shell metadata"
```

## Task 2: Server State And API Boundary Cleanup

**Files:**

- Modify: `src/features/reservations/hooks/useReservationList.ts`
- Modify: `src/features/reservations/hooks/useReservationList.test.ts`
- Modify: `src/features/profile/hooks/useHostListings.ts`
- Modify: `src/features/profile/hooks/useHostListings.test.ts`
- Modify: `src/features/accommodations/edit/hooks/useAccommodationEditSave.ts`
- Modify: `src/features/reviews/hooks/useReviewCreate.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/query/sessionCacheBoundary.ts`

- [ ] **Step 1: Add Query-centric pagination expectations**

In `src/features/reservations/hooks/useReservationList.test.ts`, add an expectation to the existing load-more test that the hook does not expose stale first-page data while a filter change is resolving.

Add:

```ts
expect(result.current.isLoadingMore).toBe(false);
expect(result.current.reservations.map((item) => item.reservation_uid)).toEqual([
  "reservation-1",
  "reservation-2",
]);
```

In `src/features/profile/hooks/useHostListings.test.ts`, wrap the hook with a `QueryClientProvider` the same way `useReservationList.test.ts` does before implementation.

- [ ] **Step 2: Run state tests before implementation**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/reservations/hooks/useReservationList.test.ts src/features/profile/hooks/useHostListings.test.ts
```

Expected: existing reservation tests pass; host listings tests fail after adding the Query provider expectation if the hook has not moved to Query yet.

- [ ] **Step 3: Convert reservation pagination to `useInfiniteQuery`**

Replace local `reservations`, `cursor`, `hasNext`, `isLoadingMore`, `requestGenerationRef`, and `loadingMoreRef` ownership in `useReservationList.ts` with `useInfiniteQuery`.

Use this return shape:

```ts
return {
  clearError,
  error,
  hasNext: Boolean(reservationPagesQuery.hasNextPage),
  isLoading: reservationPagesQuery.isLoading,
  isLoadingMore: reservationPagesQuery.isFetchingNextPage,
  loadMore,
  reservations,
};
```

Compute `reservations` from pages:

```ts
const reservations = useMemo(
  () =>
    reservationPagesQuery.data?.pages.flatMap(
      (page) => page.reservations,
    ) ?? [],
  [reservationPagesQuery.data],
);
```

Keep `retry: false` and `throwOnError: false`. Preserve custom scopes so anonymous fetchers do not share cache unexpectedly.

- [ ] **Step 4: Convert host listings to Query**

In `src/features/profile/hooks/useHostListings.ts`, replace manual `useEffect` fetches with `useInfiniteQuery`.

Return the same public hook API:

```ts
return {
  accommodations,
  clearError,
  error,
  hasNext: Boolean(hostListingsQuery.hasNextPage),
  isLoading: hostListingsQuery.isLoading,
  isLoadingMore: hostListingsQuery.isFetchingNextPage,
  loadMore,
  reload,
};
```

Use a stable query key:

```ts
const queryKey = ["profile", "host-listings", statusType] as const;
```

The `reload` implementation should call:

```ts
await queryClient.invalidateQueries({ queryKey });
```

- [ ] **Step 5: Make mutation invalidation explicit**

In `src/features/accommodations/edit/hooks/useAccommodationEditSave.ts`, invalidate accommodation detail and host listings after update/publish succeeds.

Use existing query key modules if present. If no host listing key exists, create a local helper in `src/features/profile/queryKeys.ts` before using it from edit code.

In `src/features/reviews/hooks/useReviewCreate.ts`, invalidate review/reservation detail queries after create succeeds. Keep navigation behavior unchanged.

- [ ] **Step 6: Make logout local-first**

Modify `src/contexts/AuthContext.tsx` so frontend auth state and user-scoped query caches clear even when server logout fails.

Use this behavior:

```ts
const logout = useCallback(async () => {
  clearSession();

  try {
    await authApi.logout();
  } catch (error) {
    console.error("Logout request failed after local session clear", error);
  }
}, [clearSession]);
```

Keep the existing global auth error listener behavior.

- [ ] **Step 7: Run focused state/API tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/reservations/hooks/useReservationList.test.ts src/features/profile/hooks/useHostListings.test.ts src/contexts/AuthContext.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/reservations src/features/profile src/features/accommodations/edit src/features/reviews src/contexts src/query
git commit -m "refactor: standardize frontend server state boundaries"
```

## Task 3: Search And Wishlist Public Boundary

**Files:**

- Create: `src/features/search/publicCache.ts`
- Create: `src/features/wishlist/publicCache.ts`
- Modify: `src/features/wishlist/lib/wishlistCacheSync.ts`
- Modify: `src/features/search/hooks/useSearchWishlistModal.ts`
- Modify: `src/features/search/queryKeys.ts`
- Modify: `src/features/wishlist/queryKeys.ts`
- Modify: `src/api/ui-api-boundary-contracts.test.ts`
- Modify: `src/routes/route-boundary-contracts.test.ts`

- [ ] **Step 1: Write boundary tests**

Add a test to `src/routes/route-boundary-contracts.test.ts`:

```ts
it("keeps search and wishlist cross-feature cache access on public boundaries", () => {
  const wishlistCacheSync = readFileSync(
    join(process.cwd(), "src/features/wishlist/lib/wishlistCacheSync.ts"),
    "utf8",
  );
  const searchWishlistModal = readFileSync(
    join(process.cwd(), "src/features/search/hooks/useSearchWishlistModal.ts"),
    "utf8",
  );

  expect(wishlistCacheSync).not.toContain("../../search/queryKeys");
  expect(searchWishlistModal).not.toContain("../../wishlist/lib/");
});
```

- [ ] **Step 2: Run failing boundary test**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/routes/route-boundary-contracts.test.ts
```

Expected: FAIL because current code imports private cross-feature internals.

- [ ] **Step 3: Add public cache modules**

Create `src/features/search/publicCache.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { searchQueryKeys } from "./queryKeys";

export const invalidateSearchResultCaches = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
};
```

Create `src/features/wishlist/publicCache.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { wishlistQueryKeys } from "./queryKeys";

export const invalidateWishlistCaches = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wishlistQueryKeys.all });
  queryClient.invalidateQueries({
    queryKey: wishlistQueryKeys.recentlyViewed(),
  });
};
```

- [ ] **Step 4: Move invalidation ownership**

In `src/features/wishlist/lib/wishlistCacheSync.ts`, replace direct search query key imports with:

```ts
import { invalidateSearchResultCaches } from "../../search/publicCache";
```

Then call:

```ts
invalidateSearchResultCaches(queryClient);
```

where the file currently invalidates `searchQueryKeys.all`.

- [ ] **Step 5: Move modal membership access to public wishlist API**

If `useSearchWishlistModal.ts` imports wishlist internals, expose the minimal public function from the wishlist feature index or `publicCache.ts`. The search hook should import from:

```ts
import { invalidateWishlistCaches } from "../../wishlist/publicCache";
```

Do not import from `../../wishlist/lib/*` inside search.

- [ ] **Step 6: Run feature and boundary tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/routes/route-boundary-contracts.test.ts src/features/search/SearchRoute.test.tsx src/features/wishlist/WishlistRoute.routeState.test.tsx src/features/wishlist/WishlistRoute.memoModal.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/search src/features/wishlist src/routes src/api
git commit -m "refactor: isolate search and wishlist cache boundaries"
```

## Task 4: Search Shell And Header Stabilization

**Files:**

- Modify: `src/layouts/AppHeader/Header.tsx`
- Modify: `src/layouts/AppHeader/Header.module.css`
- Modify: `src/features/search/SearchRoute.tsx`
- Modify: `src/features/search/SearchRoute.module.css`
- Modify: `src/features/search/components/SearchBar/SearchBar.tsx`
- Modify: `src/features/search/components/SearchBar/SearchBar.module.css`
- Modify: `src/features/search/hooks/useSearchBarState.ts`
- Modify: `src/features/search/hooks/useSearchBarState.test.tsx`
- Modify: `src/features/search/components/SearchResultsList.tsx`
- Modify: `src/features/search/SearchRoute.test.tsx`

- [ ] **Step 1: Add tests for one logical header search shell**

In the existing header or route tests, assert that the header does not mount two independent `HeaderSearchBar` instances. If there is no header test file, create `src/layouts/AppHeader/Header.test.tsx`.

Test shape:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header";

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

jest.mock("../../features/search/appShell", () => ({
  HeaderSearchBar: () => <div data-testid="header-search-bar" />,
  getViewportFromSearchParams: () => null,
}));

describe("Header", () => {
  it("renders one logical search bar for searchable header modes", () => {
    render(
      <MemoryRouter initialEntries={["/search"]}>
        <Header headerMode="search" />
      </MemoryRouter>,
    );

    expect(screen.getAllByTestId("header-search-bar")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run failing header test**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/layouts/AppHeader/Header.test.tsx
```

Expected: FAIL because current header renders desktop and mobile search bar instances.

- [ ] **Step 3: Collapse duplicate search bar mount**

Modify `Header.tsx` to render one `HeaderSearchBar` inside one wrapper. Use CSS media queries to reposition the same instance.

Keep these behaviors:

- logo links to home
- `UserMenu` remains visible
- map-drag mode detection remains based on `/search` and viewport params
- `headerMode="hidden"` renders no search bar

- [ ] **Step 4: Narrow `SearchBar` state surface**

In `useSearchBarState.ts`, group the return value into stable objects:

```ts
return {
  destination,
  dates,
  guests,
  popover,
  actions,
  status,
};
```

Update `SearchBar.tsx` so it destructures grouped values instead of a wide flat hook return.

- [ ] **Step 5: Fix selected result styling contract**

In `src/features/search/SearchRoute.module.css`, add a tokenized selected result class if `SearchRoute.tsx` still passes `styles.selected` into `SearchResultsList`.

Use:

```css
.selected {
  outline: 2px solid var(--color-brand-coral);
  outline-offset: 2px;
  box-shadow: var(--focus-ring);
}
```

The selected class must use existing tokens: `--color-brand-coral` and `--focus-ring`.

- [ ] **Step 6: Run search tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/layouts/AppHeader/Header.test.tsx src/features/search/components/SearchBar/SearchBar.test.tsx src/features/search/hooks/useSearchBarState.test.tsx src/features/search/SearchRoute.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/AppHeader src/features/search src/styles
git commit -m "refactor: stabilize search shell before redesign"
```

## Task 5: Booking, Payment, And Detail Route Boundaries

**Files:**

- Modify: `src/features/accommodations/AccommodationDetailRoute.tsx`
- Modify: `src/features/accommodations/AccommodationDetailRoute.test.tsx`
- Modify: `src/features/accommodations/components/AccommodationBookingCard.tsx`
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts`
- Modify: `src/features/reservations/hooks/useReservationPayment.ts`
- Modify: `src/features/reservations/ReservationConfirmRoute.tsx`
- Modify: `src/features/reservations/lib/paymentRouteState.ts`
- Modify: `src/features/reservations/lib/paymentRouteState.test.ts`

- [ ] **Step 1: Add booking prop boundary test**

In `AccommodationDetailRoute.test.tsx`, mock `AccommodationBookingCard` and assert it receives grouped props:

```tsx
expect(mockBookingCardProps).toMatchObject({
  bookingState: expect.any(Object),
  bookingActions: expect.any(Object),
  couponState: expect.any(Object),
  couponActions: expect.any(Object),
});
```

Also assert legacy flat props are absent:

```tsx
expect(mockBookingCardProps.selectedCouponId).toBeUndefined();
expect(mockBookingCardProps.onCouponChange).toBeUndefined();
```

- [ ] **Step 2: Run failing detail test**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/accommodations/AccommodationDetailRoute.test.tsx
```

Expected: FAIL until the booking card prop boundary is grouped.

- [ ] **Step 3: Group booking props**

Define these local types near `AccommodationBookingCardProps`:

```ts
export interface AccommodationBookingState {
  checkInDate: string;
  checkOutDate: string;
  adultCount: number;
  childCount: number;
  infantCount: number;
  petCount: number;
  totalPrice: number;
  validationMessage: string | null;
}

export interface AccommodationBookingActions {
  onDateChange: (checkInDate: string, checkOutDate: string) => void;
  onGuestChange: (guestType: string, nextValue: number) => void;
  onSubmit: () => void;
}

export interface AccommodationCouponState {
  selectedCouponId: number | null;
  availableCouponCount: number;
  discountAmount: number;
}

export interface AccommodationCouponActions {
  onCouponChange: (couponId: number | null) => void;
}
```

Use narrower union types instead of `string` for `guestType` if an existing guest type already exists in the feature.

- [ ] **Step 4: Centralize checkout/payment route state**

Move duplicated payment route state parsing into `src/features/reservations/lib/paymentRouteState.ts`. Keep existing exported functions and add tests for:

- missing checkout state
- invalid callback query
- confirm-failed redirect reason
- successful callback parsing

- [ ] **Step 5: Run booking/payment tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/accommodations/AccommodationDetailRoute.test.tsx src/features/reservations/lib/paymentRouteState.test.ts src/features/reservations
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/accommodations src/features/reservations
git commit -m "refactor: group booking and payment route boundaries"
```

## Task 6: Product UI Primitives Before Airbnb Styling

**Files:**

- Create: `src/shared/ui/PageShell/PageShell.tsx`
- Create: `src/shared/ui/PageShell/PageShell.module.css`
- Create: `src/shared/ui/PageShell/PageShell.test.tsx`
- Create: `src/shared/ui/ListingCard/ListingCard.tsx`
- Create: `src/shared/ui/ListingCard/ListingCard.module.css`
- Create: `src/shared/ui/ListingCard/ListingCard.test.tsx`
- Create: `src/shared/ui/OverlaySurface/OverlaySurface.tsx`
- Create: `src/shared/ui/OverlaySurface/OverlaySurface.module.css`
- Create: `src/shared/ui/OverlaySurface/OverlaySurface.test.tsx`
- Modify: `src/shared/ui/index.ts`
- Modify: `src/shared/ui/shared-ui-boundary-contracts.test.ts`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/tokens.test.ts`

- [ ] **Step 1: Write primitive tests**

For `PageShell`, assert semantic structure:

```tsx
import { render, screen } from "@testing-library/react";
import { PageShell } from "./PageShell";

describe("PageShell", () => {
  it("renders a labelled page region", () => {
    render(
      <PageShell title="검색 결과">
        <p>content</p>
      </PageShell>,
    );

    expect(screen.getByRole("main", { name: "검색 결과" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
```

For `ListingCard`, assert image alt, title, and selected state:

```tsx
import { render, screen } from "@testing-library/react";
import { ListingCard } from "./ListingCard";

describe("ListingCard", () => {
  it("renders listing content with selected state", () => {
    render(
      <ListingCard
        title="서울 한옥"
        subtitle="Mapo, Seoul"
        imageUrl="https://example.com/room.jpg"
        imageAlt="서울 한옥 숙소 사진"
        selected
      />,
    );

    expect(screen.getByRole("img", { name: "서울 한옥 숙소 사진" })).toBeInTheDocument();
    expect(screen.getByText("서울 한옥")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveAttribute("aria-selected", "true");
  });
});
```

- [ ] **Step 2: Run failing primitive tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/shared/ui/PageShell/PageShell.test.tsx src/shared/ui/ListingCard/ListingCard.test.tsx src/shared/ui/OverlaySurface/OverlaySurface.test.tsx
```

Expected: FAIL because primitives do not exist yet.

- [ ] **Step 3: Implement primitives with token-only CSS**

Implement `PageShell` with `role="main"` and `aria-label={title}`.

Implement `ListingCard` with `article`, optional image, title, subtitle, action slot, and `aria-selected`.

Implement `OverlaySurface` with a `variant` prop:

```ts
type OverlaySurfaceVariant = "popover" | "bottom-sheet" | "dialog";
```

Use CSS variables from `tokens.css` for color, radius, shadow, z-index, spacing, and transitions.

- [ ] **Step 4: Export primitives**

Update `src/shared/ui/index.ts`:

```ts
export { PageShell } from "./PageShell/PageShell";
export { ListingCard } from "./ListingCard/ListingCard";
export { OverlaySurface } from "./OverlaySurface/OverlaySurface";
```

- [ ] **Step 5: Protect primitive ownership**

Update `src/shared/ui/shared-ui-boundary-contracts.test.ts` so shared UI still has no `features/`, `pages/`, or API imports.

Add new primitive files to any owned-file allowlist if the test has one.

- [ ] **Step 6: Run UI/style tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/shared/ui src/styles/tokens.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui src/styles
git commit -m "feat: add pre-redesign product UI primitives"
```

## Task 7: Verification Gate And Tooling Cleanup

**Files:**

- Modify: `package.json`
- Create: `.env.example`
- Create: `docs/architecture/frontend-structure-refactor.md`
- Modify: `src/verification-gate.test.ts`

- [ ] **Step 1: Add lint visibility without blocking unrelated cleanup**

Add scripts:

```json
"lint": "eslint src --ext .ts,.tsx",
"lint:strict": "eslint src --ext .ts,.tsx --max-warnings=0",
"verify:structure": "npm run typecheck && npm run test:ci:no-cache -- --runInBand && npm run lint"
```

Do not replace `verify` until `npm run lint:strict` is passing.

- [ ] **Step 2: Run lint and capture exact failures**

Run:

```bash
npm run lint
```

Expected now: may fail on existing lint debt. Fix only lint failures in files touched by Tasks 1-6. Leave unrelated lint debt listed in `docs/architecture/frontend-structure-refactor.md`.

- [ ] **Step 3: Add environment example**

Create `.env.example` with non-secret placeholders:

```dotenv
REACT_APP_API_URL=http://localhost:8080
REACT_APP_GOOGLE_MAPS_API_KEY=replace-with-local-dev-key
AIRBOB_FRONTEND_URL=http://localhost:3000
AIRBOB_QA_EMAIL=qa@example.com
AIRBOB_QA_PASSWORD=replace-with-local-qa-password
AIRBOB_SMOKE_ACCOMMODATION_ID=3
AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID=3
AIRBOB_SMOKE_RESERVATION_UID=replace-with-stable-reservation-uid
AIRBOB_SMOKE_HOST_RESERVATION_UID=replace-with-stable-host-reservation-uid
AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS=true
GSTACK_BROWSE_BIN=replace-with-gstack-browse-path
```

- [ ] **Step 4: Add architecture note**

Create `docs/architecture/frontend-structure-refactor.md` with:

```md
# Frontend Structure Refactor

## Decisions

- Keep feature-first structure and thin page adapters.
- Keep CSS Modules and tokenized styling before Airbnb visual redesign.
- Keep TanStack Query as the server-state layer.
- Keep backend/API/DB/server contracts unchanged.
- Defer CRA-to-Vite migration until structure and smoke gates are stable.

## Remaining Follow-Ups

- Run `npm audit` and prioritize direct dependency upgrades.
- Plan CRA-to-Vite/Vitest migration as a separate branch.
- Promote `lint:strict` into `verify` after existing lint debt is closed.
```

- [ ] **Step 5: Run tooling verification**

Run:

```bash
npm run typecheck
npm run test:ci:no-cache -- --runInBand
npm run build
npm run lint
```

Expected: typecheck, tests, and build pass. Lint either passes or fails only with documented pre-existing debt not introduced by this plan.

- [ ] **Step 6: Commit**

```bash
git add package.json .env.example docs/architecture src/verification-gate.test.ts
git commit -m "chore: document frontend structure verification gate"
```

## Task 8: Pre-Design Acceptance Gate

**Files:**

- Modify only files needed to fix regressions discovered by this task.
- No broad visual redesign in this task.

- [ ] **Step 1: Run full static gate**

Run:

```bash
npm run verify:pre-redesign
```

Expected: PASS.

- [ ] **Step 2: Run strict smoke when environment is available**

Run:

```bash
npm run smoke:frontend:strict
```

Expected: PASS with stable dynamic route IDs and seeded search data. If env is missing, do not fake success; record the missing variables in the final handoff.

- [ ] **Step 3: Check git diff scope**

Run:

```bash
git diff --stat
git diff --name-only
```

Expected: only frontend source, frontend tests, frontend docs, and frontend config files changed.

- [ ] **Step 4: Confirm no backend/API contract drift**

Run:

```bash
rg "localhost:8080|/api/|axios\\.|requestApi|unwrapApiResponse" src api docs package.json
```

Expected: no new backend endpoints or response shape assumptions outside existing frontend API client/wrapper patterns.

- [ ] **Step 5: Final commit if fixes were needed**

If Step 1 or Step 2 required fixes:

```bash
git add src docs package.json .env.example
git commit -m "fix: close frontend pre-design verification gaps"
```

If no fixes were needed, do not create an empty commit.

## Airbnb Design System Entry Criteria

Start Airbnb visual redesign only when all are true:

- `npm run verify:pre-redesign` passes.
- `npm run typecheck` passes after every structural task.
- Route shell metadata is single-source and `headerMode` is consumed by layout/header.
- Search and wishlist no longer import each other's private cache/query internals.
- Reservation and host listing pagination are Query-owned.
- Booking/payment route state has focused tests.
- Header mounts one logical search bar instance.
- `PageShell`, `ListingCard`, and `OverlaySurface` exist and are tokenized.
- High-risk CSS changes are protected by `src/styles/tokens.test.ts`.
- Strict smoke either passes or has explicit missing environment variables recorded.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-06-airbob-frontend-structure-first-refactor.ko.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, and keep commits small.
2. **Inline Execution** - execute tasks in this session using `superpowers:executing-plans`, with checkpoints after each task.

Recommended choice for this codebase: **Subagent-Driven**, because routing, state/API, search/wishlist, booking/payment, and UI primitives can be reviewed independently.
