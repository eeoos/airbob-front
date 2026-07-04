# Airbob Frontend Post-Audit Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 리팩터 전에 사용자 세션, URL 상태, 컴포넌트 소유권, 디자인 시스템 계약, 브라우저 QA 안전망을 닫는다.

**Architecture:** 먼저 인증 경계와 URL privacy처럼 사용자 데이터가 섞일 수 있는 문제를 닫고, 그 다음 route/query 소유권과 feature container 경계를 정리한다. 디자인 작업은 token contract, Dialog/sheet contract, smoke QA가 전수 적용된 뒤에 시작한다.

**Tech Stack:** React 19, TypeScript, React Router 7, TanStack Query 5, CRA/react-scripts, Jest, Testing Library, CSS Modules, gstack browse/QA.

---

## Audit Summary

Subagent 감사와 로컬 검증 결과를 통합했다.

- 정적 검증: `npm run typecheck && npm run test:ci:no-cache -- --runInBand && npm run build` 통과.
- Jest 결과: 124 suites, 501 tests passed.
- Build 경고: `baseline-browser-mapping`, `caniuse-lite` freshness only.
- P1 기능/보안 리스크:
  - 인증 전환 후 user-scoped React Query cache가 남는다.
  - 예약 확인/결제 callback 정보가 URL query에 과도하게 노출된다.
  - Header search state가 URL back/forward 변경을 따라가지 않는다.
  - 디자인 token contract가 실제 이동된 CSS surface를 놓친다.
  - 자동화된 browser smoke가 없어 디자인 리팩터 회귀를 잡기 어렵다.
- P1/P2 구조 리스크:
  - Wishlist route shell과 `useWishlistData`가 여전히 넓다.
  - AccommodationEdit route shell이 feature workflow internals를 소유한다.
  - AppHeader가 search/auth/accommodation feature internals에 직접 결합돼 있다.
  - Search detail links와 map-bounds mutation이 raw query를 전파할 수 있다.

## File Structure

Create:

- `src/query/sessionCacheBoundary.ts`  
  인증 전환 시 지워야 하는 user-scoped query families를 한 곳에서 관리한다.

- `src/features/reservations/lib/reservationCheckoutState.ts`  
  예약 확인 화면에 필요한 checkout state를 URL query 대신 `location.state` + `sessionStorage` fallback으로 넘긴다.

- `src/features/search/lib/accommodationDetailParams.ts`  
  Search에서 Accommodation Detail로 넘길 query allowlist를 소유한다.

- `src/features/wishlist/lib/wishlistMembership.ts`  
  accommodation이 어떤 wishlist에도 포함됐는지 cursor pagination으로 확인하는 helper다.

- `src/layouts/AppHeader/UserMenu.test.tsx`  
  Header test에서 mock 처리된 UserMenu의 auth/menu/hosting 동작을 직접 검증한다.

- `src/features/wishlist/components/WishlistViews.test.tsx`  
  추출된 Wishlist view components의 loading/empty/click propagation/edit-mode/fallback render branch를 검증한다.

- `scripts/smoke/frontend-smoke.mjs`  
  디자인 리팩터 전에 반복 실행할 최소 브라우저 smoke script. Playwright를 채택하지 않을 경우 gstack browse 명령 wrapper로 시작한다.

Modify:

- `src/contexts/AuthContext.tsx`
- `src/contexts/AuthContext.test.tsx`
- `src/query/queryClient.ts`
- `src/features/search/queryKeys.ts`
- `src/features/wishlist/queryKeys.ts`
- `src/features/profile/queryKeys.ts`
- `src/features/reservations/queryKeys.ts`
- `src/features/accommodations/hooks/useAccommodationBooking.ts`
- `src/pages/Reservations/ReservationConfirm.tsx`
- `src/pages/Reservations/PaymentSuccess.tsx`
- `src/features/reservations/lib/paymentRouteState.ts`
- `src/features/reservations/lib/paymentRouteState.test.ts`
- `src/features/search/hooks/useSearchBarState.ts`
- `src/features/search/hooks/useSearchBarState.test.tsx`
- `src/features/search/hooks/useSearchWishlistModal.ts`
- `src/features/search/hooks/useSearchWishlistModal.test.ts`
- `src/features/search/lib/searchParams.ts`
- `src/features/search/lib/searchParams.test.ts`
- `src/features/search/components/SearchResultsList.tsx`
- `src/features/search/components/SearchResultsList.test.tsx`
- `src/pages/Search/Search.tsx`
- `src/routes/paths.ts`
- `src/routes/paths.test.ts`
- `src/features/wishlist/hooks/useWishlistRouteViewState.ts`
- `src/features/wishlist/lib/wishlistRouteState.ts`
- `src/features/wishlist/lib/wishlistRouteState.test.ts`
- `src/pages/Wishlist/Wishlist.tsx`
- `src/features/wishlist/hooks/useWishlistData.ts`
- `src/features/wishlist/hooks/useWishlistData.test.ts`
- `src/styles/tokens.css`
- `src/styles/tokens.test.ts`
- `src/styles/design-system-contracts.test.ts`
- `src/shared/ui/Dialog/Dialog.tsx`
- `src/shared/ui/Dialog/Dialog.test.tsx`
- `src/features/accommodations/components/AccommodationDescriptionModal.tsx`
- `src/features/accommodations/edit/components/EditModalShell.tsx`
- `src/features/accommodations/edit/components/AccommodationEditScreen.tsx`
- `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- `package.json`
- `docs/qa/frontend-architecture-smoke.ko.md`

---

### Task 1: Auth Session Cache Boundary

**Files:**
- Create: `src/query/sessionCacheBoundary.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/contexts/AuthContext.test.tsx`
- Test: `src/contexts/AuthContext.test.tsx`

- [ ] **Step 1: Write failing cache-boundary tests**

Append tests that seed personalized caches and assert logout/auth error clears them.

```tsx
import { searchQueryKeys } from "../features/search/queryKeys";
import { wishlistQueryKeys } from "../features/wishlist/queryKeys";
import { profileQueryKeys } from "../features/profile/queryKeys";
import { reservationQueryKeys } from "../features/reservations/queryKeys";

it("clears user-scoped query data on logout", async () => {
  jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
  jest.mocked(authApi.logout).mockResolvedValueOnce(undefined);

  const { result, queryClient } = renderUseAuth();
  await waitForSessionSettled(result);

  queryClient.setQueryData(searchQueryKeys.results("destination=Seoul"), {
    page_info: { current_page: 0, total_pages: 1, total_elements: 1 },
    stay_search_result_listing: [{ id: 1, is_in_wishlist: true }],
  });
  queryClient.setQueryData(wishlistQueryKeys.recentlyViewed(), {
    accommodations: [{ accommodation_id: 1, is_in_wishlist: true }],
    total_count: 1,
  });
  queryClient.setQueryData(profileQueryKeys.hostListings("status=PUBLISHED"), {
    pages: [],
    pageParams: [],
  });
  queryClient.setQueryData(reservationQueryKeys.guestReservations("tab=upcoming"), {
    pages: [],
    pageParams: [],
  });

  await act(async () => {
    await result.current.logout();
  });

  expect(queryClient.getQueryData(searchQueryKeys.results("destination=Seoul"))).toBeUndefined();
  expect(queryClient.getQueryData(wishlistQueryKeys.recentlyViewed())).toBeUndefined();
  expect(queryClient.getQueryData(profileQueryKeys.hostListings("status=PUBLISHED"))).toBeUndefined();
  expect(queryClient.getQueryData(reservationQueryKeys.guestReservations("tab=upcoming"))).toBeUndefined();
  expect(queryClient.getQueryData(authQueryKeys.me())).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/contexts/AuthContext.test.tsx --runInBand
```

Expected: FAIL because current `clearSession` only clears `authQueryKeys.me()`.

- [ ] **Step 3: Add session cache boundary helper**

Implement `src/query/sessionCacheBoundary.ts`.

```ts
import { QueryClient } from "@tanstack/react-query";
import { authQueryKeys } from "../features/auth/queryKeys";
import { profileQueryKeys } from "../features/profile/queryKeys";
import { reservationQueryKeys } from "../features/reservations/queryKeys";
import { searchQueryKeys } from "../features/search/queryKeys";
import { wishlistQueryKeys } from "../features/wishlist/queryKeys";
import { MeInfo } from "../types/auth";

const userScopedQueryRoots = [
  wishlistQueryKeys.all,
  profileQueryKeys.all,
  reservationQueryKeys.all,
  searchQueryKeys.all,
] as const;

export const clearSessionQueryData = async (queryClient: QueryClient) => {
  await Promise.all(
    userScopedQueryRoots.map((queryKey) =>
      queryClient.cancelQueries({ queryKey })
    )
  );

  userScopedQueryRoots.forEach((queryKey) => {
    queryClient.removeQueries({ queryKey });
  });

  await queryClient.cancelQueries({ queryKey: authQueryKeys.me() });
  queryClient.setQueryData<MeInfo | null>(authQueryKeys.me(), null);
  queryClient.removeQueries({
    queryKey: authQueryKeys.me(),
    type: "inactive",
  });
};

export const refreshSessionQueryData = async (
  queryClient: QueryClient,
  meInfo: MeInfo
) => {
  userScopedQueryRoots.forEach((queryKey) => {
    queryClient.removeQueries({ queryKey });
  });
  queryClient.setQueryData<MeInfo | null>(authQueryKeys.me(), meInfo);
};
```

- [ ] **Step 4: Wire AuthContext through the helper**

Replace local cache manipulation in `src/contexts/AuthContext.tsx`.

```tsx
import {
  clearSessionQueryData,
  refreshSessionQueryData,
} from "../query/sessionCacheBoundary";

const clearSession = useCallback(async () => {
  await clearSessionQueryData(queryClient);
}, [queryClient]);

const refreshSession = useCallback(async () => {
  try {
    const meInfo = await authApi.getMe();
    await refreshSessionQueryData(queryClient, meInfo);
  } catch (error) {
    await clearSession();
    throw error;
  }
}, [clearSession, queryClient]);
```

- [ ] **Step 5: Run auth tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/contexts/AuthContext.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/query/sessionCacheBoundary.ts src/contexts/AuthContext.tsx src/contexts/AuthContext.test.tsx
git commit -m "fix: clear user-scoped query caches on auth transitions"
```

---

### Task 2: Reservation And Payment URL Privacy

**Files:**
- Create: `src/features/reservations/lib/reservationCheckoutState.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts`
- Modify: `src/pages/Reservations/ReservationConfirm.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/features/reservations/lib/paymentRouteState.ts`
- Test: `src/features/reservations/lib/paymentRouteState.test.ts`
- Test: `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`
- Test: `src/pages/Reservations/PaymentSuccess.test.tsx`

- [ ] **Step 1: Write failing URL privacy tests**

In `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`, assert reservation navigation does not include customer/order/coupon query keys.

```tsx
expect(mockNavigate).toHaveBeenCalledWith("/accommodations/1/confirm", {
  state: expect.objectContaining({
    reservationUid: "reservation-1",
    orderName: "Airbob stay",
    amount: 10000,
    customerEmail: "guest@example.com",
    customerName: "Guest",
  }),
});
expect(mockNavigate.mock.calls[0][0]).not.toContain("customerEmail");
expect(mockNavigate.mock.calls[0][0]).not.toContain("orderName");
expect(mockNavigate.mock.calls[0][0]).not.toContain("couponName");
```

In `src/pages/Reservations/PaymentSuccess.test.tsx`, assert redirects use `replace: true`.

```tsx
await waitFor(() =>
  expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-1", {
    replace: true,
  })
);
```

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationBooking.test.tsx src/pages/Reservations/PaymentSuccess.test.tsx --runInBand
```

Expected: FAIL because navigation currently serializes reservation/customer state into query params and success redirects do not use `replace`.

- [ ] **Step 3: Add checkout state helper**

Implement `src/features/reservations/lib/reservationCheckoutState.ts`.

```ts
export interface ReservationCheckoutState {
  reservationUid: string;
  orderName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  checkIn: string;
  checkOut: string;
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
  couponName: string | null;
  couponDiscount: number | null;
}

const storageKey = (accommodationId: string) =>
  `airbob:reservation-checkout:${accommodationId}`;

export const saveReservationCheckoutState = (
  accommodationId: string,
  state: ReservationCheckoutState
) => {
  sessionStorage.setItem(storageKey(accommodationId), JSON.stringify(state));
};

export const readReservationCheckoutState = (
  accommodationId: string,
  locationState: unknown
): ReservationCheckoutState | null => {
  if (
    locationState &&
    typeof locationState === "object" &&
    "reservationUid" in locationState
  ) {
    return locationState as ReservationCheckoutState;
  }

  const raw = sessionStorage.getItem(storageKey(accommodationId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ReservationCheckoutState;
    return typeof parsed.reservationUid === "string" ? parsed : null;
  } catch {
    return null;
  }
};

export const clearReservationCheckoutState = (accommodationId: string) => {
  sessionStorage.removeItem(storageKey(accommodationId));
};
```

- [ ] **Step 4: Navigate to confirmation without query payload**

In `useAccommodationBooking.ts`, replace `URLSearchParams` construction with state.

```ts
const checkoutState: ReservationCheckoutState = {
  reservationUid: reservation_uid,
  orderName: order_name,
  amount,
  customerEmail: customer_email,
  customerName: customer_name,
  checkIn: checkInStr,
  checkOut: checkOutStr,
  adultOccupancy: adultCount,
  childOccupancy: childCount,
  infantOccupancy: infantCount,
  petOccupancy: petCount,
  couponName:
    reserveCouponDiscount > 0 && reserveSelectedCoupon
      ? reserveSelectedCoupon.name
      : null,
  couponDiscount: reserveCouponDiscount > 0 ? reserveCouponDiscount : null,
};

saveReservationCheckoutState(accommodationId, checkoutState);
navigate(routeTo.accommodationConfirm(accommodationId), { state: checkoutState });
```

- [ ] **Step 5: Read confirmation state from location state/sessionStorage**

In `ReservationConfirm.tsx`, read `useLocation().state`, then use `readReservationCheckoutState(id, location.state)`.

```tsx
const location = useLocation();
const checkoutState = id
  ? readReservationCheckoutState(id, location.state)
  : null;

if (!checkoutState) {
  return <div className={styles.error}>예약 정보가 없습니다.</div>;
}

const {
  reservationUid,
  orderName,
  amount,
  customerEmail,
  customerName,
  couponName,
  couponDiscount,
} = checkoutState;
```

- [ ] **Step 6: Replace payment callback history entries**

In `PaymentSuccess.tsx`, replace both navigations.

```tsx
navigate(routeTo.reservationDetail(reservationUid), { replace: true });
navigate(routeTo.paymentFail(reservationUid), { replace: true });
```

- [ ] **Step 7: Keep parse tests focused on Toss callback only**

Update `paymentRouteState.ts` so `parsePaymentRouteState` no longer requires customer/order query state for confirmation. Keep `parseTossSuccessRouteState` for Toss callback validation.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationBooking.test.tsx src/pages/Reservations/PaymentSuccess.test.tsx src/features/reservations/lib/paymentRouteState.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/reservations/lib/reservationCheckoutState.ts src/features/accommodations/hooks/useAccommodationBooking.ts src/pages/Reservations/ReservationConfirm.tsx src/pages/Reservations/PaymentSuccess.tsx src/features/reservations/lib/paymentRouteState.ts src/features/reservations/lib/paymentRouteState.test.ts src/features/accommodations/hooks/useAccommodationBooking.test.tsx src/pages/Reservations/PaymentSuccess.test.tsx
git commit -m "fix: keep reservation checkout details out of URLs"
```

---

### Task 3: Search URL Allowlist And Detail Link Hygiene

**Files:**
- Create: `src/features/search/lib/accommodationDetailParams.ts`
- Modify: `src/features/search/lib/searchParams.ts`
- Modify: `src/features/search/lib/searchParams.test.ts`
- Modify: `src/pages/Search/Search.tsx`
- Modify: `src/features/search/components/SearchResultsList.tsx`
- Modify: `src/features/search/components/SearchResultsList.test.tsx`
- Modify: `src/routes/paths.ts`
- Test: `src/features/search/lib/searchParams.test.ts`
- Test: `src/features/search/components/SearchResultsList.test.tsx`

- [ ] **Step 1: Write failing allowlist tests**

In `searchParams.test.ts`, add coverage for map bounds and detail params.

```ts
it("drops non-search route state when building map-bounds params", () => {
  const current = new URLSearchParams(
    "destination=Seoul&id=1001&view=recently-viewed&mode=host&tab=listings&page=2"
  );

  const next = buildMapBoundsSearchParams(current, {
    north: 37.6,
    south: 37.5,
    east: 127.1,
    west: 127.0,
  });

  expect(next.get("id")).toBeNull();
  expect(next.get("view")).toBeNull();
  expect(next.get("mode")).toBeNull();
  expect(next.get("tab")).toBeNull();
  expect(next.get("page")).toBeNull();
  expect(next.get("topLeftLat")).toBe("37.6");
});

it("keeps only booking-safe query state for accommodation detail links", () => {
  const current = new URLSearchParams(
    "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&token=secret&email=a@example.com"
  );

  const next = buildAccommodationDetailSearchParams(current);

  expect(next.toString()).toBe(
    "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/lib/searchParams.test.ts --runInBand
```

Expected: FAIL because detail allowlist does not exist and map bounds currently clones unrelated keys.

- [ ] **Step 3: Export an allowlist picker and detail params builder**

In `searchParams.ts`, export `pickSearchParams` and use it inside map bounds.

```ts
export const pickSearchParams = (params: URLSearchParams) => {
  const nextParams = new URLSearchParams();
  SEARCH_QUERY_KEYS_TO_PRESERVE.forEach((key) => {
    const value = params.get(key);
    if (value !== null && value !== "") {
      nextParams.set(key, value);
    }
  });
  return nextParams;
};

export const buildMapBoundsSearchParams = (
  currentParams: URLSearchParams,
  bounds: SearchViewport
): URLSearchParams => {
  const params = removeViewportAndLocationParams(pickSearchParams(currentParams));
  setViewportParams(params, bounds);
  params.delete("destination");
  params.delete("page");
  return params;
};
```

Create `accommodationDetailParams.ts`.

```ts
const DETAIL_QUERY_KEYS_TO_PRESERVE = [
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
] as const;

export const buildAccommodationDetailSearchParams = (
  params: URLSearchParams
) => {
  const nextParams = new URLSearchParams();
  DETAIL_QUERY_KEYS_TO_PRESERVE.forEach((key) => {
    const value = params.get(key);
    if (value !== null && value !== "") {
      nextParams.set(key, value);
    }
  });
  return nextParams;
};
```

- [ ] **Step 4: Use detail allowlist before routeTo.accommodationDetail**

In `Search.tsx`:

```tsx
const detailParams = buildAccommodationDetailSearchParams(searchParams);
window.open(routeTo.accommodationDetail(accommodationId, detailParams), "_blank");
```

In `SearchResultsList.tsx`:

```tsx
const detailUrl = routeTo.accommodationDetail(
  accommodation.id,
  buildAccommodationDetailSearchParams(detailSearchParams)
);
```

- [ ] **Step 5: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/lib/searchParams.test.ts src/features/search/components/SearchResultsList.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/search/lib/searchParams.ts src/features/search/lib/searchParams.test.ts src/features/search/lib/accommodationDetailParams.ts src/pages/Search/Search.tsx src/features/search/components/SearchResultsList.tsx src/features/search/components/SearchResultsList.test.tsx
git commit -m "fix: allowlist search and detail query state"
```

---

### Task 4: Header Search URL Synchronization

**Files:**
- Modify: `src/features/search/hooks/useSearchBarState.ts`
- Modify: `src/features/search/hooks/useSearchBarState.test.tsx`
- Modify: `src/layouts/AppHeader/Header.test.tsx`

- [ ] **Step 1: Write failing back/forward sync test**

In `useSearchBarState.test.tsx`, render with a router and update `initialEntries` or navigate between URLs. Assert hook state follows `location.search`.

```tsx
it("syncs search bar state when URL search params change after mount", async () => {
  const { result, router } = renderUseSearchBarState({
    initialEntries: ["/search?destination=Seoul&adultOccupancy=2"],
  });

  expect(result.current.inputText).toBe("Seoul");
  expect(result.current.adultOccupancy).toBe(2);

  await act(async () => {
    await router.navigate("/search?destination=Busan&adultOccupancy=4&childOccupancy=1");
  });

  expect(result.current.inputText).toBe("Busan");
  expect(result.current.adultOccupancy).toBe(4);
  expect(result.current.childOccupancy).toBe(1);
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/hooks/useSearchBarState.test.tsx --runInBand
```

Expected: FAIL because the URL hydration effect runs only once.

- [ ] **Step 3: Extract URL parsing into a stable helper**

Inside `useSearchBarState.ts`, add a parser that returns defaults when params are absent.

```ts
const parseSearchBarUrlState = (params: URLSearchParams) => ({
  destination: params.get("destination") ?? "",
  checkIn: parseDateParam(params.get("checkIn")),
  checkOut: parseDateParam(params.get("checkOut")),
  adultOccupancy: parsePositiveInt(params.get("adultOccupancy"), 1),
  childOccupancy: parseNonNegativeInt(params.get("childOccupancy"), 0),
  infantOccupancy: parseNonNegativeInt(params.get("infantOccupancy"), 0),
  petOccupancy: parseNonNegativeInt(params.get("petOccupancy"), 0),
});
```

- [ ] **Step 4: Replace mount-only effect with URL signature effect**

Use `urlSearchParams.toString()` as the dependency, and reset local values for missing params.

```tsx
const urlSearchParamsString = urlSearchParams.toString();

useEffect(() => {
  const nextState = parseSearchBarUrlState(new URLSearchParams(urlSearchParamsString));

  handleInputChange(nextState.destination);
  setCheckIn(nextState.checkIn);
  setCheckOut(nextState.checkOut);
  setAdultOccupancy(nextState.adultOccupancy);
  setChildOccupancy(nextState.childOccupancy);
  setInfantOccupancy(nextState.infantOccupancy);
  setPetOccupancy(nextState.petOccupancy);
}, [handleInputChange, urlSearchParamsString]);
```

- [ ] **Step 5: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/hooks/useSearchBarState.test.tsx src/layouts/AppHeader/Header.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/search/hooks/useSearchBarState.ts src/features/search/hooks/useSearchBarState.test.tsx src/layouts/AppHeader/Header.test.tsx
git commit -m "fix: sync header search state with URL changes"
```

---

### Task 5: Wishlist Route Canonicalization And Mutation Cache Consistency

**Files:**
- Create: `src/features/wishlist/lib/wishlistMembership.ts`
- Modify: `src/routes/paths.ts`
- Modify: `src/routes/paths.test.ts`
- Modify: `src/features/wishlist/lib/wishlistRouteState.ts`
- Modify: `src/features/wishlist/lib/wishlistRouteState.test.ts`
- Modify: `src/features/wishlist/hooks/useWishlistRouteViewState.ts`
- Modify: `src/pages/Wishlist/Wishlist.tsx`
- Modify: `src/features/wishlist/hooks/useWishlistData.ts`
- Modify: `src/features/wishlist/hooks/useWishlistData.test.ts`
- Modify: `src/features/wishlist/hooks/useWishlistSelection.ts`
- Modify: `src/features/wishlist/hooks/useWishlistSelection.test.ts`
- Modify: `src/features/search/hooks/useSearchWishlistModal.ts`
- Modify: `src/features/search/hooks/useSearchWishlistModal.test.ts`

- [ ] **Step 1: Write failing route canonicalization tests**

In `paths.test.ts`:

```ts
expect(routeTo.wishlist({ view: "recently-viewed" })).toBe(
  "/wishlist?view=recently-viewed"
);
expect(routeTo.wishlist({ id: 1001 })).toBe("/wishlist?id=1001");
```

Add a TypeScript-only negative case using `// @ts-expect-error`:

```ts
// @ts-expect-error wishlist routes cannot include id and recently-viewed together
routeTo.wishlist({ id: 1001, view: "recently-viewed" });
```

- [ ] **Step 2: Write failing deletion URL test**

In `Wishlist.memoModal.test.tsx` or `Wishlist.routeState.test.tsx`, seed `/wishlist?id=1001`, delete wishlist `1001`, and assert the URL becomes `/wishlist`.

- [ ] **Step 3: Run focused tests to verify failure**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/paths.test.ts src/pages/Wishlist/Wishlist.routeState.test.tsx --runInBand
```

Expected: FAIL because route types allow contradictory params and `clearSelectedWishlist` does not update URL.

- [ ] **Step 4: Convert wishlist route query type to a discriminated union**

In `routes/paths.ts`:

```ts
type WishlistRouteQuery =
  | { id: RouteParamValue; view?: never }
  | { view: Extract<WishlistRouteView, "recently-viewed">; id?: never }
  | undefined;
```

- [ ] **Step 5: Make clearSelectedWishlist canonicalize the URL**

In `useWishlistRouteViewState.ts`:

```ts
const clearSelectedWishlist = useCallback(() => {
  setSelectedWishlist(null);
  setShowRecentlyViewed(false);
  setIsEditMode(false);
  setSearchParams(
    buildWishlistRouteSearchParams({
      view: "index",
      wishlistId: null,
    }),
    { replace: true }
  );
}, [setSearchParams]);
```

- [ ] **Step 6: Extract paginated membership helper**

Create `wishlistMembership.ts`.

```ts
import { wishlistApi } from "../../../api";
import { WishlistInfos } from "../../../types/wishlist";
import { WISHLIST_PAGE_SIZE } from "../hooks/useWishlistListsQuery";

export interface WishlistMembershipResult {
  isInAnyWishlist: boolean;
  pages: WishlistInfos[];
  pageParams: Array<string | null>;
}

export const fetchAccommodationWishlistMembership = async (
  accommodationId: number
): Promise<WishlistMembershipResult> => {
  let cursor: string | null = null;
  const pages: WishlistInfos[] = [];
  const pageParams: Array<string | null> = [];

  while (true) {
    pageParams.push(cursor);
    const response = await wishlistApi.getWishlists({
      accommodationId,
      ...(cursor ? { cursor } : {}),
      size: WISHLIST_PAGE_SIZE,
    });
    pages.push(response);

    if (response.wishlists.some((wishlist) => wishlist.is_contained)) {
      return { isInAnyWishlist: true, pages, pageParams };
    }

    cursor = response.page_info.next_cursor ?? null;
    if (!response.page_info.has_next || cursor === null) {
      return { isInAnyWishlist: false, pages, pageParams };
    }
  }
};
```

- [ ] **Step 7: Use helper in search, wishlist, and modal selection hooks**

Replace the single-page check in `useSearchWishlistModal.ts` and the local loop in `useWishlistData.ts` with `fetchAccommodationWishlistMembership`.

In `useWishlistSelection.ts`, keep the modal toggle flow on the same membership/cache path. The modal must not keep its own one-page wishlist membership assumption after this task.

- [ ] **Step 8: Invalidate aggregate wishlist caches after membership mutations**

In `useWishlistData.ts`, after `removeFromWishlistMutation` success:

```ts
queryClient.invalidateQueries({ queryKey: wishlistQueryKeys.lists("") });
queryClient.invalidateQueries({ queryKey: wishlistQueryKeys.recentlyViewed() });
queryClient.invalidateQueries({ queryKey: ["search"] });
```

For `WishlistModal` add/remove flows in `useWishlistSelection.ts`, route mutation effects through a shared helper or invalidate `wishlistQueryKeys.all`, `wishlistQueryKeys.recentlyViewed()`, and search result queries after successful add/remove. The post-mutation cache behavior must be covered in `useWishlistSelection.test.ts`.

- [ ] **Step 9: Add rejection tests for mutation catch paths**

In `useWishlistData.test.ts`, add cases for `removeRecentlyViewed`, `deleteWishlist`, `removeFromWishlist`, `saveWishlistAccommodationMemo`, and `refreshRecentlyViewedWishlistState` rejection. Assert `handleError` output is visible or returned `false` when applicable.

- [ ] **Step 10: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/paths.test.ts src/features/wishlist/lib/wishlistRouteState.test.ts src/pages/Wishlist/Wishlist.routeState.test.tsx src/features/wishlist/hooks/useWishlistData.test.ts src/features/wishlist/hooks/useWishlistSelection.test.ts src/features/search/hooks/useSearchWishlistModal.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/features/wishlist/lib/wishlistMembership.ts src/routes/paths.ts src/routes/paths.test.ts src/features/wishlist/lib/wishlistRouteState.ts src/features/wishlist/lib/wishlistRouteState.test.ts src/features/wishlist/hooks/useWishlistRouteViewState.ts src/pages/Wishlist/Wishlist.tsx src/features/wishlist/hooks/useWishlistData.ts src/features/wishlist/hooks/useWishlistData.test.ts src/features/wishlist/hooks/useWishlistSelection.ts src/features/wishlist/hooks/useWishlistSelection.test.ts src/features/search/hooks/useSearchWishlistModal.ts src/features/search/hooks/useSearchWishlistModal.test.ts
git commit -m "fix: canonicalize wishlist routes and membership caches"
```

---

### Task 6: Design-System Contract Coverage

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/tokens.test.ts`
- Modify: `src/styles/design-system-contracts.test.ts`
- Modify: `src/layouts/AppHeader/Header.module.css`
- Modify: `src/layouts/AppHeader/UserMenu.module.css`
- Modify: `src/features/wishlist/components/WishlistViews.module.css`

- [ ] **Step 1: Write failing scoped ownership test**

In `tokens.test.ts`, keep the current `designTokenOwnedCssFiles` ownership model and add the CSS modules that were moved or split during the architecture refactor.

```ts
const newlyTokenOwnedCssFiles = [
  "layouts/AppHeader/Header.module.css",
  "layouts/AppHeader/UserMenu.module.css",
  "features/wishlist/components/WishlistViews.module.css",
];

const designTokenOwnedCssFiles = [
  // existing entries...
  ...newlyTokenOwnedCssFiles,
];
```

Add an assertion that `newlyTokenOwnedCssFiles` are present in `designTokenOwnedCssFiles`. Do not introduce a recursive all-`.module.css` failure gate in this task. The repository still has legacy CSS modules outside the refactored surfaces, and forcing all of them through this task would turn a stabilization pass into a broad visual migration.

- [ ] **Step 2: Run token tests to verify failure**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts --runInBand
```

Expected: FAIL because the newly owned AppHeader and Wishlist view files still contain literal design values.

- [ ] **Step 3: Expand tokens**

Add these tokens to `tokens.css`.

```css
--space-7: 28px;
--space-12: 48px;
--space-16: 64px;
--control-touch-target: 44px;
--focus-ring: 0 0 0 2px rgba(34, 34, 34, 0.24);
--color-status-warning-bg: #fff3cd;
--color-status-warning-text: #856404;
--motion-duration-slow: 300ms;
--layout-mobile-safe-bottom: env(safe-area-inset-bottom, 0px);
```

- [ ] **Step 4: Tokenize AppHeader and WishlistViews**

Replace literal colors, radii, shadows, transition durations, and fixed 32px interactive controls in:

- `src/layouts/AppHeader/Header.module.css`
- `src/layouts/AppHeader/UserMenu.module.css`
- `src/features/wishlist/components/WishlistViews.module.css`

Use `var(--control-touch-target)` for touchable icon buttons where the control is visible on mobile.

- [ ] **Step 5: Add scoped contract coverage for forbidden patterns**

In `tokens.test.ts`, scan `newlyTokenOwnedCssFiles` for:

- `transition: all`
- raw local `z-index` values outside tokens
- `outline: none` without a nearby `:focus-visible`
- `!important`
- hardcoded core color/radius/shadow literals

Keep existing production-wide gates only for the contracts that already pass today, such as app overlay z-index and media breakpoint scale. Keep the existing color/radius/shadow literal scan on `designTokenOwnedCssFiles`, but apply the newly introduced `transition: all`, local z-index, `outline: none`, and `!important` gates only to `newlyTokenOwnedCssFiles`. If a full CSS migration inventory is needed, record it as follow-up documentation, not as a failing test in this task.

- [ ] **Step 6: Run token/design tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/styles/tokens.css src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts src/layouts/AppHeader/Header.module.css src/layouts/AppHeader/UserMenu.module.css src/features/wishlist/components/WishlistViews.module.css
git commit -m "test: expand design-system CSS contracts"
```

---

### Task 7: Dialog, Sheet, Touch, And Keyboard Readiness

**Files:**
- Modify: `src/shared/ui/Dialog/Dialog.tsx`
- Modify: `src/shared/ui/Dialog/Dialog.test.tsx`
- Modify: `src/features/accommodations/components/AccommodationDescriptionModal.tsx`
- Modify: `src/features/accommodations/edit/components/EditModalShell.tsx`
- Modify: `src/components/DatePicker/DatePicker.tsx`
- Modify: `src/components/DatePicker/DatePicker.module.css`
- Modify: `src/features/wishlist/components/WishlistIndexView.tsx`
- Modify: `src/features/wishlist/components/WishlistDetailView.tsx`
- Modify: `src/features/wishlist/components/RecentlyViewedView.tsx`
- Test: related component tests

- [ ] **Step 1: Write failing modal accessibility tests**

Add tests for `AccommodationDescriptionModal` and edit modals asserting:

```tsx
expect(screen.getByRole("dialog")).toBeInTheDocument();
await user.keyboard("{Escape}");
expect(onClose).toHaveBeenCalled();
```

- [ ] **Step 2: Migrate raw modal shells to shared Dialog**

Use `Dialog` in `AccommodationDescriptionModal.tsx` and replace `EditModalShell` internals with `Dialog`.

```tsx
<Dialog isOpen={true} onClose={onClose} title="숙소 설명">
  <div className={styles.descriptionContent}>{description}</div>
</Dialog>
```

- [ ] **Step 3: Convert clickable div date cells to buttons**

In `DatePicker.tsx`, render selectable dates as buttons.

```tsx
<button
  type="button"
  className={dayClasses}
  disabled={isPastDate(date)}
  onClick={() => handleDateClick(date)}
>
  {date.getDate()}
</button>
```

- [ ] **Step 4: Convert clickable cards to semantic buttons or links**

For Wishlist views, use `button type="button"` when the whole card performs an in-app action, or `<a>`/router link when it navigates.

- [ ] **Step 5: Add focus-visible and touch target tests**

Add contract tests to ensure interactive controls expose `:focus-visible` styles and at least `var(--control-touch-target)` for mobile controls.

- [ ] **Step 6: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/shared/ui/Dialog/Dialog.test.tsx src/components/DatePicker/DatePicker.test.tsx src/pages/Wishlist/Wishlist.memoModal.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/Dialog/Dialog.tsx src/shared/ui/Dialog/Dialog.test.tsx src/features/accommodations/components/AccommodationDescriptionModal.tsx src/features/accommodations/edit/components/EditModalShell.tsx src/components/DatePicker/DatePicker.tsx src/components/DatePicker/DatePicker.module.css src/features/wishlist/components/WishlistIndexView.tsx src/features/wishlist/components/WishlistDetailView.tsx src/features/wishlist/components/RecentlyViewedView.tsx
git commit -m "fix: standardize dialogs and semantic interactions"
```

---

### Task 8: Wishlist And Header Test Coverage

**Files:**
- Create: `src/layouts/AppHeader/UserMenu.test.tsx`
- Create: `src/features/wishlist/components/WishlistViews.test.tsx`
- Modify: `src/layouts/AppHeader/Header.test.tsx`
- Modify: `src/pages/Wishlist/Wishlist.routeState.test.tsx`

- [ ] **Step 1: Add UserMenu tests**

Cover unauthenticated menu, authenticated menu, outside click, logout, and hosting draft creation.

```tsx
it("opens login and signup auth modal modes from the unauthenticated menu", async () => {
  renderUserMenu({ isAuthenticated: false });
  await user.click(screen.getByRole("button", { name: /메뉴/i }));
  await user.click(screen.getByRole("button", { name: "로그인" }));
  expect(screen.getByRole("dialog", { name: "로그인" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Add Wishlist view component tests**

Cover empty/loading states, click propagation, image fallback, edit mode delete, wishlist toggle, and memo button.

```tsx
it("does not open accommodation detail when deleting a wishlist card", async () => {
  const onOpenWishlist = jest.fn();
  const onDeleteWishlist = jest.fn();
  render(<WishlistIndexView {...props} onOpenWishlist={onOpenWishlist} onDeleteWishlist={onDeleteWishlist} />);

  await user.click(screen.getByRole("button", { name: "위시리스트 삭제" }));

  expect(onDeleteWishlist).toHaveBeenCalled();
  expect(onOpenWishlist).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Keep page tests integration-only**

Remove assertions from page tests that duplicate view rendering details. Page tests should prove URL state chooses the right feature view and modals wire correctly.

- [ ] **Step 4: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/layouts/AppHeader/UserMenu.test.tsx src/layouts/AppHeader/Header.test.tsx src/features/wishlist/components/WishlistViews.test.tsx src/pages/Wishlist/Wishlist.routeState.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/AppHeader/UserMenu.test.tsx src/layouts/AppHeader/Header.test.tsx src/features/wishlist/components/WishlistViews.test.tsx src/pages/Wishlist/Wishlist.routeState.test.tsx
git commit -m "test: cover header menu and wishlist feature views"
```

---

### Task 9: Feature Ownership Containers

**Files:**
- Create: `src/features/wishlist/WishlistRoute.tsx`
- Create: `src/features/accommodations/edit/AccommodationEditRoute.tsx`
- Create: `src/features/accommodations/edit/hooks/useAccommodationEditController.ts`
- Modify: `src/pages/Wishlist/Wishlist.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- Modify: `src/features/wishlist/index.ts`
- Modify: `src/features/accommodations/edit/index.ts`
- Modify: boundary tests

- [ ] **Step 1: Add boundary tests for page import policy**

Pages should import feature public route containers, not deep hooks/components/libs.

```ts
expect(pageSource).not.toMatch(/features\/wishlist\/hooks/);
expect(pageSource).not.toMatch(/features\/wishlist\/components/);
expect(pageSource).toMatch(/features\/wishlist/);
```

- [ ] **Step 2: Move Wishlist route orchestration into feature**

Create `WishlistRoute.tsx` by moving current `Wishlist.tsx` orchestration into `src/features/wishlist`. Keep `src/pages/Wishlist/Wishlist.tsx` as:

```tsx
import { WishlistRoute } from "../../features/wishlist";

export default function Wishlist() {
  return <WishlistRoute />;
}
```

- [ ] **Step 3: Extract AccommodationEdit controller**

Move route-independent orchestration from `AccommodationEdit.tsx` into `useAccommodationEditController`.

```ts
export function useAccommodationEditController({
  accommodationId,
  isNewDraft,
  navigateToHostProfile,
}: {
  accommodationId?: string;
  isNewDraft: boolean;
  navigateToHostProfile: () => void;
}) {
  return {
    state,
    actions,
  };
}
```

Then keep page as route adapter:

```tsx
export default function AccommodationEdit() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  return (
    <AccommodationEditRoute
      accommodationId={id}
      isNewDraft={searchParams.get("mode") === "create"}
      onNavigateToHostProfile={() => navigate(routeTo.profile({ mode: "host" }))}
    />
  );
}
```

- [ ] **Step 4: Reduce screen prop surface**

Replace the 60-plus flat props in `AccommodationEditScreenProps` with grouped props:

```ts
interface AccommodationEditScreenProps {
  state: AccommodationEditScreenState;
  actions: AccommodationEditScreenActions;
}
```

- [ ] **Step 5: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/pages/Wishlist/Wishlist.routeState.test.tsx src/pages/Wishlist/Wishlist.memoModal.test.tsx src/pages/AccommodationEdit/AccommodationEdit.test.tsx src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx src/components/components-boundary-contracts.test.ts src/routes/route-boundary-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/wishlist/WishlistRoute.tsx src/pages/Wishlist/Wishlist.tsx src/features/wishlist/index.ts src/features/accommodations/edit/AccommodationEditRoute.tsx src/features/accommodations/edit/hooks/useAccommodationEditController.ts src/features/accommodations/edit/index.ts src/pages/AccommodationEdit/AccommodationEdit.tsx src/features/accommodations/edit/components/AccommodationEditScreen.tsx src/components/components-boundary-contracts.test.ts src/routes/route-boundary-contracts.test.ts
git commit -m "refactor: move route orchestration into feature containers"
```

---

### Task 10: Browser Smoke Automation

**Files:**
- Create: `scripts/smoke/frontend-smoke.mjs`
- Modify: `package.json`
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`

- [ ] **Step 1: Add smoke command**

Add script:

```json
{
  "scripts": {
    "smoke:frontend": "node scripts/smoke/frontend-smoke.mjs"
  }
}
```

- [ ] **Step 2: Implement smoke wrapper without committed credentials**

The script should read credentials from environment variables and refuse to print them.

```js
const requiredEnv = ["AIRBOB_QA_EMAIL", "AIRBOB_QA_PASSWORD"];
for (const name of requiredEnv) {
  if (!process.env[name]) {
    console.error(`${name} is required`);
    process.exit(1);
  }
}

const baseUrl = process.env.AIRBOB_FRONTEND_URL ?? "http://localhost:3000";
```

Use gstack browse if available:

```js
const browse = process.env.GSTACK_BROWSE_BIN;
if (!browse) {
  console.error("GSTACK_BROWSE_BIN is required for smoke:frontend");
  process.exit(1);
}
```

Smoke these routes at desktop `1280x720` and mobile `375x812`:

- `/`
- `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`
- `/wishlist`
- `/wishlist?view=recently-viewed`
- `/profile?mode=host&tab=listings`
- first available `/accommodations/:id/edit` from host listings

For each route, run:

- navigate
- snapshot/screenshot
- console errors
- fail on new console error except the known pre-login `/auth/me` 401 before login

- [ ] **Step 3: Update QA doc**

Document:

```bash
AIRBOB_FRONTEND_URL=http://localhost:3000 \
GSTACK_BROWSE_BIN=/absolute/path/to/browse \
AIRBOB_QA_EMAIL='[provided out-of-band]' \
AIRBOB_QA_PASSWORD='[provided out-of-band]' \
npm run smoke:frontend
```

Do not write real account values.

- [ ] **Step 4: Run smoke manually**

Start frontend and backend, then run:

```bash
npm run smoke:frontend
```

Expected: script exits `0`, screenshots written under `.gstack/qa-reports/screenshots/`, no committed credentials.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke/frontend-smoke.mjs package.json docs/qa/frontend-architecture-smoke.ko.md
git commit -m "test: add frontend smoke QA command"
```

---

### Task 11: Dead Shared Components And CSS Selector Cleanup

**Files:**
- Modify or delete: `src/components/AccommodationCard/*`
- Modify: `src/components/components-boundary-contracts.test.ts`
- Modify: `src/styles/tokens.test.ts`
- Modify: stale CSS modules reported by selector usage checks

- [ ] **Step 1: Confirm production usage**

Run:

```bash
rg -n "AccommodationCard|BaseAccommodationCard|AccommodationMeta" src --glob '!*.test.*'
```

Expected: only `src/components/AccommodationCard/index.ts` or no production usage. If production usage exists, stop and convert only route-free pieces into `src/shared/ui`.

- [ ] **Step 2: Delete dead shared AccommodationCard**

Delete:

- `src/components/AccommodationCard/BaseAccommodationCard.tsx`
- `src/components/AccommodationCard/BaseAccommodationCard.module.css`
- `src/components/AccommodationCard/AccommodationMeta.tsx`
- `src/components/AccommodationCard/AccommodationMeta.module.css`
- `src/components/AccommodationCard/BaseAccommodationCard.test.tsx`
- `src/components/AccommodationCard/index.ts`

- [ ] **Step 3: Update token and boundary tests**

Remove `components/AccommodationCard/BaseAccommodationCard.module.css` from token ownership checks. Add a rule that `src/components` may not import from `src/routes` or domain `src/types` unless explicitly allowlisted.

- [ ] **Step 4: Remove confirmed-unused selectors**

For each CSS module selector reported by `rg` and selector usage check, delete only selectors with no TS/TSX usage and no dynamic `styles[key]` path.

- [ ] **Step 5: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/components/components-boundary-contracts.test.ts src/styles/tokens.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components src/styles/tokens.test.ts src/components/components-boundary-contracts.test.ts
git commit -m "refactor: remove dead shared accommodation card"
```

---

### Task 12: Final Verification Gate

**Files:**
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`

- [ ] **Step 1: Run full static verification**

```bash
git diff --check
npm run typecheck
npm run test:ci:no-cache -- --runInBand
npm run build
```

Expected:

- `git diff --check`: no output, exit 0.
- `typecheck`: exit 0.
- Jest: all suites pass.
- Build: `Compiled successfully.` Freshness warnings are acceptable only if no compile/lint/test failure appears.

- [ ] **Step 2: Run focused high-risk tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath src/contexts/AuthContext.test.tsx src/features/reservations/lib/paymentRouteState.test.ts src/features/search/hooks/useSearchBarState.test.tsx src/features/search/lib/searchParams.test.ts src/features/wishlist/hooks/useWishlistData.test.ts src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run frontend smoke**

```bash
AIRBOB_FRONTEND_URL=http://localhost:3000 \
GSTACK_BROWSE_BIN=/absolute/path/to/browse \
AIRBOB_QA_EMAIL='[provided out-of-band]' \
AIRBOB_QA_PASSWORD='[provided out-of-band]' \
npm run smoke:frontend
```

Expected: PASS. Screenshots and report paths are recorded without account values.

- [ ] **Step 4: Update QA doc**

Append date, commands, pass/fail status, browser viewport coverage, and screenshot paths to `docs/qa/frontend-architecture-smoke.ko.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/qa/frontend-architecture-smoke.ko.md
git commit -m "docs: record frontend stabilization QA evidence"
```

---

## Execution Order

1. Task 1: Auth Session Cache Boundary
2. Task 2: Reservation And Payment URL Privacy
3. Task 3: Search URL Allowlist And Detail Link Hygiene
4. Task 4: Header Search URL Synchronization
5. Task 5: Wishlist Route Canonicalization And Mutation Cache Consistency
6. Task 6: Design-System Contract Coverage
7. Task 7: Dialog, Sheet, Touch, And Keyboard Readiness
8. Task 8: Wishlist And Header Test Coverage
9. Task 9: Feature Ownership Containers
10. Task 10: Browser Smoke Automation
11. Task 11: Dead Shared Components And CSS Selector Cleanup
12. Task 12: Final Verification Gate

## Airbnb Design Readiness Decision

Do not start broad Airbnb-style visual redesign until Tasks 1-7 and Task 10 pass. Isolated token expansion or primitive cleanup can happen earlier, but page-level visual redesign should wait until auth cache, URL privacy, Header URL sync, query allowlists, token contracts, Dialog consistency, and browser smoke are in place.

## Self-Review Notes

- Spec coverage: covers routing/page structure, component ownership, state/API boundaries, styling/design system, test/QA structure, and security/privacy findings from all subagents.
- Placeholder scan: no task relies on unresolved placeholders or unspecified "add tests"; each task names files, test cases, commands, and expected results.
- Type consistency: new helpers use existing query key names: `authQueryKeys`, `searchQueryKeys`, `wishlistQueryKeys`, `profileQueryKeys`, and `reservationQueryKeys`.
