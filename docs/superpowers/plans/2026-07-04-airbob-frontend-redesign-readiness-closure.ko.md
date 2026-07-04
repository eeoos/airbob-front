# Airbob Frontend Redesign Readiness Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 리팩터 전에 남은 프론트 구조/검증 차단점을 닫고, 디자인 변경이 기능 회귀와 섞이지 않도록 안전한 경계를 만든다.

**Architecture:** 먼저 현재 빨간 Jest contract를 녹색으로 복구하고, 사용자별 상태가 남는 상세/결제 storage 문제를 닫는다. 그 다음 URL/query ownership, route container, smoke/token gate를 확장해 page-level visual redesign이 feature workflow를 직접 건드리지 않게 만든다.

**Tech Stack:** React 19, TypeScript, React Router 7, TanStack Query 5, Axios, CRA/react-scripts, Jest, React Testing Library, CSS Modules, gstack browse.

---

## Audit Summary

- `npm run typecheck`: PASS.
- `npm run test:ci:no-cache -- --runInBand`: FAIL 1 test.
- Current failing test: `src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx` expects `EditModalShell.tsx` to import `./EditModal.module.css`, but `EditModalShell` is now a Dialog wrapper and receives modal class names from concrete modal components.
- Page/routing audit:
  - `Wishlist` and `AccommodationEdit` are thin route adapters.
  - `Search`, `AccommodationDetail`, `ReservationConfirm`, `ReservationDetail`, `ReviewCreate`, and Profile child pages still combine URL/API/workflow/layout.
  - URL state ownership is mixed: `AccommodationEdit` keeps router primitives in page, while Wishlist/SearchBar feature hooks still call React Router directly.
- State/API audit:
  - Page/shared direct API leakage is mostly controlled by boundary tests.
  - `AccommodationDetail` keeps user-scoped `is_in_wishlist` in local state outside the session cache boundary.
  - reservation checkout fallback storage contains customer identity/payment data and is not cleared by success/fail pages.
  - Profile/reservations/accommodation detail still use local server state rather than Query keys.
- Test/QA/design audit:
  - Browser smoke loads 6 routes but does not assert core interactions.
  - QA document records a prior PASS while current Jest is red.
  - Token gates cover 16 design-owned CSS files and only 3 strict newly-owned files; CSS scan found high literal risk in Reservation/Profile/Search/AccommodationEdit CSS.

## File Structure

Create:

- `src/features/accommodations/lib/accommodationDetailMembership.ts`  
  Pure helper for clearing user-scoped wishlist membership from public accommodation detail objects.

- `src/features/search/SearchRoute.tsx`  
  Feature-owned Search route container. Owns Search workflow state after page supplies router search params/callbacks.

- `src/features/accommodations/AccommodationDetailRoute.tsx`  
  Feature-owned accommodation detail route container. Owns detail/review/booking/modal orchestration after page supplies route id and navigation callbacks.

- `src/features/reservations/lib/reservationCheckoutCleanup.test.ts`  
  Focused checkout storage cleanup behavior tests if the existing checkout state test becomes too broad.

Modify:

- `src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx`
- `src/features/accommodations/hooks/useAccommodationDetail.ts`
- `src/features/accommodations/hooks/useAccommodationDetail.test.ts`
- `src/features/reservations/lib/reservationCheckoutState.ts`
- `src/features/reservations/lib/reservationCheckoutState.test.ts`
- `src/pages/Reservations/PaymentSuccess.tsx`
- `src/pages/Reservations/PaymentSuccess.test.tsx`
- `src/pages/Reservations/PaymentFail.tsx`
- `src/routes/paths.ts`
- `src/routes/paths.test.ts`
- `src/routes/route-boundary-contracts.test.ts`
- `src/pages/Search/Search.tsx`
- `src/pages/Search/Search.module.css`
- `src/pages/AccommodationDetail/AccommodationDetail.tsx`
- `src/features/search/index.ts`
- `src/features/accommodations/index.ts`
- `scripts/smoke/frontend-smoke.mjs`
- `docs/qa/frontend-architecture-smoke.ko.md`
- `src/verification-gate.test.ts`
- `src/styles/tokens.test.ts`
- selected CSS modules under `src/pages/Reservations`, `src/pages/Profile`, `src/features/accommodations/edit/components`, and `src/features/search`.

---

### Task 1: Restore Green Jest After Dialog Migration

**Files:**
- Modify: `src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx`
- Test: `src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx`

- [ ] **Step 1: Reproduce the current failing contract**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx --runInBand
```

Expected: FAIL with `Expected substring: "./EditModal.module.css"` for `EditModalShell.tsx`.

- [ ] **Step 2: Update the modal CSS ownership contract**

In `src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx`, replace the `modalFiles` assertion block with separate concrete modal and shell assertions:

```ts
const modalStyleFiles = [
  `${FEATURE_COMPONENTS_DIR}/AccommodationTypeModal.tsx`,
  `${FEATURE_COMPONENTS_DIR}/AmenityModal.tsx`,
  `${FEATURE_COMPONENTS_DIR}/DetailAddressConfirmModal.tsx`,
];

modalStyleFiles.forEach((file) => {
  const source = readProjectFile(file);
  expect(source).toContain("./EditModal.module.css");
  expect(source).not.toContain("../AccommodationEdit.module.css");
});

const modalShellSource = readProjectFile(
  `${FEATURE_COMPONENTS_DIR}/EditModalShell.tsx`
);
expect(modalShellSource).toContain("../../../../shared/ui");
expect(modalShellSource).toContain("Dialog");
expect(modalShellSource).toContain("className={modalClassName}");
expect(modalShellSource).not.toContain("./EditModal.module.css");
expect(modalShellSource).not.toContain("../AccommodationEdit.module.css");
```

- [ ] **Step 3: Run focused test**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run full static verification**

Run:

```bash
npm run typecheck
npm run test:ci:no-cache -- --runInBand
```

Expected: typecheck PASS, Jest PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/accommodations/edit/components/AccommodationEditComponents.test.tsx
git commit -m "test: align edit modal contract with dialog shell"
```

---

### Task 2: Clear Accommodation Detail User-Scoped Wishlist State

**Files:**
- Create: `src/features/accommodations/lib/accommodationDetailMembership.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationDetail.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationDetail.test.ts`
- Test: `src/features/accommodations/hooks/useAccommodationDetail.test.ts`

- [ ] **Step 1: Add failing tests for auth transition membership state**

Append these tests to `src/features/accommodations/hooks/useAccommodationDetail.test.ts`:

```ts
it("clears user-scoped wishlist state when authentication is lost", async () => {
  jest
    .mocked(accommodationApi.getDetail)
    .mockResolvedValue(createAccommodation({ is_in_wishlist: true }));

  const { result, rerender } = renderHook(
    ({ isAuthenticated }) =>
      useAccommodationDetail({
        accommodationId: "7",
        isAuthenticated,
        handleError: mockHandleError,
        clearError: mockClearError,
      }),
    { initialProps: { isAuthenticated: true } }
  );

  await waitFor(() =>
    expect(result.current.accommodation?.is_in_wishlist).toBe(true)
  );

  rerender({ isAuthenticated: false });

  await waitFor(() =>
    expect(result.current.accommodation?.is_in_wishlist).toBe(false)
  );
});

it("reloads detail membership when authentication is gained", async () => {
  jest
    .mocked(accommodationApi.getDetail)
    .mockResolvedValueOnce(createAccommodation({ is_in_wishlist: false }))
    .mockResolvedValueOnce(createAccommodation({ is_in_wishlist: true }));

  const { result, rerender } = renderHook(
    ({ isAuthenticated }) =>
      useAccommodationDetail({
        accommodationId: "7",
        isAuthenticated,
        handleError: mockHandleError,
        clearError: mockClearError,
      }),
    { initialProps: { isAuthenticated: false } }
  );

  await waitFor(() =>
    expect(result.current.accommodation?.is_in_wishlist).toBe(false)
  );

  rerender({ isAuthenticated: true });

  await waitFor(() =>
    expect(result.current.accommodation?.is_in_wishlist).toBe(true)
  );
  expect(accommodationApi.getDetail).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationDetail.test.ts --runInBand
```

Expected: FAIL because `is_in_wishlist` remains from the previous authenticated detail response.

- [ ] **Step 3: Add pure membership helper**

Create `src/features/accommodations/lib/accommodationDetailMembership.ts`:

```ts
import { AccommodationDetail } from "../../../types/accommodation";

export const clearAccommodationWishlistMembership = (
  accommodation: AccommodationDetail | null
): AccommodationDetail | null =>
  accommodation
    ? {
        ...accommodation,
        is_in_wishlist: false,
      }
    : accommodation;
```

- [ ] **Step 4: Wire auth transition behavior in the hook**

Modify `src/features/accommodations/hooks/useAccommodationDetail.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { accommodationApi, recentlyViewedApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";
import { clearAccommodationWishlistMembership } from "../lib/accommodationDetailMembership";
```

Inside `useAccommodationDetail`, after `parsedAccommodationId`, add:

```ts
const previousAuthRef = useRef(isAuthenticated);
```

After the initial load effect, add:

```ts
useEffect(() => {
  const wasAuthenticated = previousAuthRef.current;
  previousAuthRef.current = isAuthenticated;

  if (!parsedAccommodationId) return;

  if (!isAuthenticated) {
    setAccommodation((current) =>
      clearAccommodationWishlistMembership(current)
    );
    return;
  }

  if (!wasAuthenticated) {
    void loadAccommodation(false);
  }
}, [isAuthenticated, loadAccommodation, parsedAccommodationId]);
```

- [ ] **Step 5: Run detail hook tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationDetail.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Run auth/detail regression tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/contexts/AuthContext.test.tsx src/features/accommodations/hooks/useAccommodationDetail.test.ts src/pages/AccommodationDetail/AccommodationDetail.tsx --runInBand
```

Expected: command should omit the `.tsx` page file if no page test exists. Use:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/contexts/AuthContext.test.tsx src/features/accommodations/hooks/useAccommodationDetail.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/accommodations/lib/accommodationDetailMembership.ts src/features/accommodations/hooks/useAccommodationDetail.ts src/features/accommodations/hooks/useAccommodationDetail.test.ts
git commit -m "fix: clear detail wishlist state across auth changes"
```

---

### Task 3: Clear Reservation Checkout Session Storage After Payment Terminal Routes

**Files:**
- Modify: `src/features/reservations/lib/reservationCheckoutState.ts`
- Modify: `src/features/reservations/lib/reservationCheckoutState.test.ts`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.test.tsx`
- Modify: `src/pages/Reservations/PaymentFail.tsx`
- Test: `src/features/reservations/lib/reservationCheckoutState.test.ts`, `src/pages/Reservations/PaymentSuccess.test.tsx`

- [ ] **Step 1: Add failing storage cleanup tests**

Append to `src/features/reservations/lib/reservationCheckoutState.test.ts`:

```ts
import {
  clearReservationCheckoutStateByReservationUid,
  getReservationCheckoutAccommodationId,
} from "./reservationCheckoutState";
```

Add tests:

```ts
it("indexes saved checkout state by reservation uid", () => {
  saveReservationCheckoutState("7", checkoutState);

  expect(getReservationCheckoutAccommodationId("reservation-123")).toBe("7");
});

it("clears saved checkout state by reservation uid", () => {
  saveReservationCheckoutState("7", checkoutState);

  clearReservationCheckoutStateByReservationUid("reservation-123");

  expect(getReservationCheckoutAccommodationId("reservation-123")).toBeNull();
  expect(readReservationCheckoutState("7", null)).toBeNull();
});
```

Append to `src/pages/Reservations/PaymentSuccess.test.tsx`:

```ts
const mockClearCheckoutByReservationUid = jest.fn();

jest.mock("../../features/reservations/lib/reservationCheckoutState", () => ({
  clearReservationCheckoutStateByReservationUid: (reservationUid: string) =>
    mockClearCheckoutByReservationUid(reservationUid),
}));
```

Add this assertion in the confirmed, failed, malformed, and missing-query tests:

```ts
expect(mockClearCheckoutByReservationUid).toHaveBeenCalledWith(
  "reservation-123"
);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/reservationCheckoutState.test.ts src/pages/Reservations/PaymentSuccess.test.tsx --runInBand
```

Expected: FAIL because the reservation UID index and payment cleanup call do not exist.

- [ ] **Step 3: Add reservation UID index helpers**

Modify `src/features/reservations/lib/reservationCheckoutState.ts`:

```ts
const reservationIndexKey = (reservationUid: string) =>
  `airbob:reservation-checkout-index:${reservationUid}`;
```

Update `saveReservationCheckoutState`:

```ts
try {
  sessionStorage.setItem(storageKey(accommodationId), JSON.stringify(state));
  sessionStorage.setItem(
    reservationIndexKey(state.reservationUid),
    accommodationId
  );
} catch {
  // Router state remains the primary checkout handoff; storage is only a fallback.
}
```

Add exports:

```ts
export const getReservationCheckoutAccommodationId = (
  reservationUid: string
) => sessionStorage.getItem(reservationIndexKey(reservationUid));

export const clearReservationCheckoutStateByReservationUid = (
  reservationUid: string
) => {
  const accommodationId = getReservationCheckoutAccommodationId(reservationUid);

  if (accommodationId) {
    clearReservationCheckoutState(accommodationId);
  }

  sessionStorage.removeItem(reservationIndexKey(reservationUid));
};
```

Update `clearReservationCheckoutState`:

```ts
export const clearReservationCheckoutState = (accommodationId: string) => {
  const state = readReservationCheckoutState(accommodationId, null);
  sessionStorage.removeItem(storageKey(accommodationId));

  if (state?.reservationUid) {
    sessionStorage.removeItem(reservationIndexKey(state.reservationUid));
  }
};
```

- [ ] **Step 4: Clear storage in terminal payment routes**

Modify `src/pages/Reservations/PaymentSuccess.tsx`:

```ts
import { clearReservationCheckoutStateByReservationUid } from "../../features/reservations/lib/reservationCheckoutState";
```

Inside the effect, before navigating for any `reservationUid` terminal result:

```ts
if (reservationUid) {
  clearReservationCheckoutStateByReservationUid(reservationUid);
}
```

Modify `src/pages/Reservations/PaymentFail.tsx`:

```ts
import React, { useEffect } from "react";
import { clearReservationCheckoutStateByReservationUid } from "../../features/reservations/lib/reservationCheckoutState";
```

Inside the component:

```ts
useEffect(() => {
  if (reservationUid) {
    clearReservationCheckoutStateByReservationUid(reservationUid);
  }
}, [reservationUid]);
```

- [ ] **Step 5: Run checkout/payment tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/reservationCheckoutState.test.ts src/pages/Reservations/PaymentSuccess.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Run reservation focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/paymentRouteState.test.ts src/features/reservations/lib/reservationCheckoutState.test.ts src/features/accommodations/hooks/useAccommodationBooking.test.tsx src/pages/Reservations/PaymentSuccess.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/reservations/lib/reservationCheckoutState.ts src/features/reservations/lib/reservationCheckoutState.test.ts src/pages/Reservations/PaymentSuccess.tsx src/pages/Reservations/PaymentSuccess.test.tsx src/pages/Reservations/PaymentFail.tsx
git commit -m "fix: clear reservation checkout fallback after payment"
```

---

### Task 4: Type Route Query Builders Before Moving More Pages

**Files:**
- Modify: `src/routes/paths.ts`
- Modify: `src/routes/paths.test.ts`
- Modify: `src/features/search/lib/accommodationDetailParams.ts`
- Modify: `src/features/search/lib/searchParams.ts`
- Test: `src/routes/paths.test.ts`, `src/features/search/lib/searchParams.test.ts`

- [ ] **Step 1: Add route builder tests that reject raw query pollution**

Add to `src/routes/paths.test.ts`:

```ts
it("builds typed search and accommodation booking queries", () => {
  expect(
    routeTo.search({
      destination: "Seoul",
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultOccupancy: 2,
    })
  ).toBe(
    "/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
  );

  expect(
    routeTo.accommodationDetail(12, {
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultOccupancy: 2,
    })
  ).toBe(
    "/accommodations/12?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
  );
});

it("rejects unsupported raw query objects at compile time", () => {
  // @ts-expect-error search route must use the typed query object
  routeTo.search("destination=Seoul&memberId=999999");
  // @ts-expect-error detail route must use the typed booking query object
  routeTo.accommodationDetail(12, "memberId=999999");
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/paths.test.ts --runInBand
```

Expected: FAIL at compile-time test because `routeTo.search` and `routeTo.accommodationDetail` still accept raw strings.

- [ ] **Step 3: Add typed route query types**

Modify `src/routes/paths.ts`:

```ts
type OccupancyRouteQuery = {
  adultOccupancy?: RouteParamValue;
  childOccupancy?: RouteParamValue;
  infantOccupancy?: RouteParamValue;
  petOccupancy?: RouteParamValue;
};

export type AccommodationBookingRouteQuery = OccupancyRouteQuery & {
  checkIn?: string;
  checkOut?: string;
};

export type SearchRouteQuery = AccommodationBookingRouteQuery & {
  destination?: string;
  page?: RouteParamValue;
  neLat?: RouteParamValue;
  neLng?: RouteParamValue;
  swLat?: RouteParamValue;
  swLng?: RouteParamValue;
};
```

Replace the raw builders:

```ts
search: (query?: SearchRouteQuery) =>
  withQuery(ROUTE_PATHS.search, {
    destination: query?.destination,
    checkIn: query?.checkIn,
    checkOut: query?.checkOut,
    adultOccupancy: query?.adultOccupancy,
    childOccupancy: query?.childOccupancy,
    infantOccupancy: query?.infantOccupancy,
    petOccupancy: query?.petOccupancy,
    page: query?.page,
    neLat: query?.neLat,
    neLng: query?.neLng,
    swLat: query?.swLat,
    swLng: query?.swLng,
  }),
accommodationDetail: (id: string | number, query?: AccommodationBookingRouteQuery) =>
  withQuery(buildPath(ROUTE_PATHS.accommodationDetail, { id }), {
    checkIn: query?.checkIn,
    checkOut: query?.checkOut,
    adultOccupancy: query?.adultOccupancy,
    childOccupancy: query?.childOccupancy,
    infantOccupancy: query?.infantOccupancy,
    petOccupancy: query?.petOccupancy,
  }),
accommodationConfirm: (id: string | number, query?: AccommodationBookingRouteQuery) =>
  withQuery(buildPath(ROUTE_PATHS.accommodationConfirm, { id }), {
    checkIn: query?.checkIn,
    checkOut: query?.checkOut,
    adultOccupancy: query?.adultOccupancy,
    childOccupancy: query?.childOccupancy,
    infantOccupancy: query?.infantOccupancy,
    petOccupancy: query?.petOccupancy,
  }),
```

- [ ] **Step 4: Update feature call sites to pass typed query objects**

Replace call sites that currently pass `URLSearchParams` or raw strings:

```ts
routeTo.search(buildSearchRouteQuery(searchParams))
routeTo.accommodationDetail(id, buildAccommodationBookingRouteQuery(params))
routeTo.accommodationConfirm(id, buildAccommodationBookingRouteQuery(params))
```

Define the converter functions in `src/features/search/lib/searchParams.ts`:

```ts
import type {
  AccommodationBookingRouteQuery,
  SearchRouteQuery,
} from "../../../routes/paths";

export const toSearchRouteQuery = (
  params: URLSearchParams
): SearchRouteQuery => ({
  destination: params.get("destination") ?? undefined,
  checkIn: params.get("checkIn") ?? undefined,
  checkOut: params.get("checkOut") ?? undefined,
  adultOccupancy: params.get("adultOccupancy") ?? undefined,
  childOccupancy: params.get("childOccupancy") ?? undefined,
  infantOccupancy: params.get("infantOccupancy") ?? undefined,
  petOccupancy: params.get("petOccupancy") ?? undefined,
  page: params.get("page") ?? undefined,
  neLat: params.get("neLat") ?? undefined,
  neLng: params.get("neLng") ?? undefined,
  swLat: params.get("swLat") ?? undefined,
  swLng: params.get("swLng") ?? undefined,
});

export const toAccommodationBookingRouteQuery = (
  params: URLSearchParams
): AccommodationBookingRouteQuery => ({
  checkIn: params.get("checkIn") ?? undefined,
  checkOut: params.get("checkOut") ?? undefined,
  adultOccupancy: params.get("adultOccupancy") ?? undefined,
  childOccupancy: params.get("childOccupancy") ?? undefined,
  infantOccupancy: params.get("infantOccupancy") ?? undefined,
  petOccupancy: params.get("petOccupancy") ?? undefined,
});
```

- [ ] **Step 5: Run route/search tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/paths.test.ts src/features/search/lib/searchParams.test.ts src/features/search/components/SearchResultsList.test.tsx src/features/search/components/SearchMap/SearchMapStructure.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/paths.ts src/routes/paths.test.ts src/features/search/lib/searchParams.ts src/features/search/lib/searchParams.test.ts src/features/search/lib/accommodationDetailParams.ts src/features/search/components/SearchResultsList.tsx src/features/search/components/SearchMap/hooks/useMapSelectionInfoWindow.ts
git commit -m "refactor: type route query builders"
```

---

### Task 5: Move Search Page Workflow Into A Feature Route Container

**Files:**
- Create: `src/features/search/SearchRoute.tsx`
- Modify: `src/features/search/index.ts`
- Modify: `src/pages/Search/Search.tsx`
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Test: `src/features/search/hooks/useSearchResults.test.tsx`, `src/features/search/components/SearchResultsList.test.tsx`, `src/routes/route-boundary-contracts.test.ts`

- [ ] **Step 1: Add boundary test for Search page adapter**

Modify `src/routes/route-boundary-contracts.test.ts` and add Search to `featureRouteAdapters`:

```ts
{
  page: "src/pages/Search/Search.tsx",
  publicImport: "../../features/search",
  routeContainer: "SearchRoute",
  forbiddenDeepImportPattern: /features\/search\/(?:components|hooks|lib)\//,
}
```

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts --runInBand
```

Expected: FAIL because `Search.tsx` imports feature hooks/components directly.

- [ ] **Step 2: Create SearchRoute public container**

Create `src/features/search/SearchRoute.tsx` with this interface:

```tsx
import React from "react";
import { URLSearchParamsInit } from "react-router-dom";

export interface SearchRouteProps {
  searchParams: URLSearchParams;
  setSearchParams: (nextInit: URLSearchParamsInit, options?: { replace?: boolean }) => void;
}

export const SearchRoute: React.FC<SearchRouteProps> = ({
  searchParams,
  setSearchParams,
}) => {
  return null;
};
```

- [ ] **Step 3: Move Search page body into SearchRoute**

Move the current body of `src/pages/Search/Search.tsx` into `SearchRoute`. Keep the current CSS import pointing at `../../pages/Search/Search.module.css` for this task so behavior and layout do not change while ownership changes.

The page becomes:

```tsx
import React from "react";
import { useSearchParams } from "react-router-dom";
import { SearchRoute } from "../../features/search";

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <SearchRoute
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
};

export default Search;
```

Export from `src/features/search/index.ts`:

```ts
export { SearchRoute } from "./SearchRoute";
export type { SearchRouteProps } from "./SearchRoute";
```

- [ ] **Step 4: Preserve behavior tests**

Move or update tests that render Search route behavior so they import `SearchRoute` for workflow coverage and keep a page adapter test for router plumbing.

Page adapter test shape:

```tsx
jest.mock("../../features/search", () => ({
  SearchRoute: ({ searchParams }: { searchParams: URLSearchParams }) => (
    <div data-testid="search-route">{searchParams.toString()}</div>
  ),
}));

it("passes router search params into SearchRoute", () => {
  render(<Search />);
  expect(screen.getByTestId("search-route")).toBeInTheDocument();
});
```

- [ ] **Step 5: Run focused Search tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts src/features/search/hooks/useSearchResults.test.tsx src/features/search/hooks/useSearchBarState.test.tsx src/features/search/components/SearchResultsList.test.tsx src/features/search/components/SearchMap/SearchMapStructure.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/search/SearchRoute.tsx src/features/search/index.ts src/pages/Search/Search.tsx src/routes/route-boundary-contracts.test.ts
git commit -m "refactor: move search workflow into feature route"
```

---

### Task 6: Move Accommodation Detail Workflow Into A Feature Route Container

**Files:**
- Create: `src/features/accommodations/AccommodationDetailRoute.tsx`
- Create or modify: `src/features/accommodations/index.ts`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Test: `src/features/accommodations/hooks/useAccommodationDetail.test.ts`, accommodation component tests, route boundary tests

- [ ] **Step 1: Add boundary test for AccommodationDetail page adapter**

Modify `src/routes/route-boundary-contracts.test.ts`:

```ts
{
  page: "src/pages/AccommodationDetail/AccommodationDetail.tsx",
  publicImport: "../../features/accommodations",
  routeContainer: "AccommodationDetailRoute",
  forbiddenDeepImportPattern: /features\/accommodations\/(?:components|hooks|lib)\//,
}
```

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts --runInBand
```

Expected: FAIL because the page imports accommodation hooks/components directly.

- [ ] **Step 2: Create route container contract**

Create `src/features/accommodations/AccommodationDetailRoute.tsx`:

```tsx
import React from "react";
import { URLSearchParamsInit } from "react-router-dom";

export interface AccommodationDetailRouteProps {
  accommodationId?: string;
  bookingSearchParams: URLSearchParams;
  setBookingSearchParams: (
    nextInit: URLSearchParamsInit,
    options?: { replace?: boolean }
  ) => void;
  onNavigateToProfile: () => void;
  onNavigateToReservationConfirm: (
    accommodationId: number,
    query: URLSearchParams
  ) => void;
}

export const AccommodationDetailRoute: React.FC<AccommodationDetailRouteProps> = () => {
  return null;
};
```

- [ ] **Step 3: Move current page workflow into the route container**

Move the existing `AccommodationDetail.tsx` feature hook/component orchestration into `AccommodationDetailRoute`. Keep `pages/AccommodationDetail/AccommodationDetail.module.css` imported from the route container during this task.

The page becomes:

```tsx
import React, { useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AccommodationDetailRoute } from "../../features/accommodations";
import { routeTo } from "../../routes/paths";

const AccommodationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const navigateToProfile = useCallback(() => {
    navigate(routeTo.profile());
  }, [navigate]);

  const navigateToReservationConfirm = useCallback(
    (accommodationId: number, query: URLSearchParams) => {
      navigate(routeTo.accommodationConfirm(accommodationId, query));
    },
    [navigate]
  );

  return (
    <AccommodationDetailRoute
      accommodationId={id}
      bookingSearchParams={searchParams}
      setBookingSearchParams={setSearchParams}
      onNavigateToProfile={navigateToProfile}
      onNavigateToReservationConfirm={navigateToReservationConfirm}
    />
  );
};

export default AccommodationDetail;
```

- [ ] **Step 4: Export public route container**

Create or update `src/features/accommodations/index.ts`:

```ts
export { AccommodationDetailRoute } from "./AccommodationDetailRoute";
export type { AccommodationDetailRouteProps } from "./AccommodationDetailRoute";
```

- [ ] **Step 5: Run detail focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts src/features/accommodations/hooks/useAccommodationDetail.test.ts src/features/accommodations/components/AccommodationBookingCard.test.tsx src/features/accommodations/components/AccommodationHero.test.tsx src/features/accommodations/components/AccommodationImageGalleryModal.test.tsx src/features/accommodations/components/AccommodationDescriptionModal.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/accommodations/AccommodationDetailRoute.tsx src/features/accommodations/index.ts src/pages/AccommodationDetail/AccommodationDetail.tsx src/routes/route-boundary-contracts.test.ts
git commit -m "refactor: move accommodation detail workflow into feature route"
```

---

### Task 7: Upgrade Smoke From Route Load To Flow Assertions

**Files:**
- Modify: `scripts/smoke/frontend-smoke.mjs`
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`
- Modify: `src/verification-gate.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add pre-redesign verify script**

Modify `package.json`:

```json
{
  "scripts": {
    "verify:pre-redesign": "npm run typecheck && npm run test:ci:no-cache -- --runInBand && npm run build"
  }
}
```

- [ ] **Step 2: Add route-specific smoke assertions**

In `scripts/smoke/frontend-smoke.mjs`, extend each route entry:

```js
const ROUTES = [
  {
    name: "home",
    path: "/",
    selector: "header",
    expectedText: "Airbob",
  },
  {
    name: "search-seoul",
    path: "/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1",
    selector: "main",
    expectedText: "Seoul",
  },
  {
    name: "wishlist",
    path: "/wishlist",
    selector: "main",
    expectedText: "위시리스트",
  },
  {
    name: "wishlist-recently-viewed",
    path: "/wishlist?view=recently-viewed",
    selector: "main",
    expectedText: "최근 조회",
  },
  {
    name: "profile-host-listings",
    path: "/profile?mode=host&tab=listings",
    selector: "main",
    expectedText: "호스트",
  },
  {
    name: "accommodation-edit",
    path: `/accommodations/${encodeURIComponent(editAccommodationId)}/edit`,
    selector: "main",
    expectedText: "숙소",
  },
];
```

Add assertion command after route load:

```js
const routeTextAssertion = (route) => `(() => {
  const element = document.querySelector(${JSON.stringify(route.selector)});
  if (!element) {
    throw new Error("Missing selector ${route.selector}");
  }
  const text = element.textContent || "";
  if (!text.includes(${JSON.stringify(route.expectedText)})) {
    throw new Error("Expected ${route.expectedText} in ${route.selector}");
  }
  return "matched ${route.expectedText}";
})()`.replace(/\s+/g, " ");
```

Push:

```js
["js", routeTextAssertion(route)]
```

- [ ] **Step 3: Fail on API 4xx/5xx network responses**

After each `["network"]` result, parse stdout JSON if gstack browse exposes structured output. If not, add a post-run text scan:

```js
const failingNetworkPattern = /(?:GET|POST|PATCH|DELETE)\s+http:\/\/localhost:3000\/api\/[^\n]+→\s+(?:4\d\d|5\d\d)/;
const hasFailingNetwork = failingNetworkPattern.test(redactedStdout);
```

Set failed:

```js
const failed =
  Boolean(result.error) ||
  status !== 0 ||
  hasFailingNetwork ||
  hasConsoleErrors;
```

Use:

```js
const hasConsoleErrors = /\[console\][\s\S]*?(error|warning)/i.test(
  redactedStdout.replace(/Console buffer cleared\./g, "")
);
```

- [ ] **Step 4: Run smoke wrapper validation without credentials**

Run:

```bash
env -u AIRBOB_QA_EMAIL -u AIRBOB_QA_PASSWORD -u GSTACK_BROWSE_BIN node scripts/smoke/frontend-smoke.mjs
```

Expected: exit 1, missing env names only, no credential values.

- [ ] **Step 5: Run full smoke with QA env**

Run:

```bash
AIRBOB_FRONTEND_URL=http://localhost:3000 \
GSTACK_BROWSE_BIN=/Users/jaehoonchoi/gstack/.agents/skills/gstack/browse/dist/browse \
AIRBOB_QA_EMAIL='[provided out-of-band]' \
AIRBOB_QA_PASSWORD='[provided out-of-band]' \
AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID=3 \
npm run smoke:frontend
```

Expected: PASS and writes report under `.gstack/qa-reports/`.

- [ ] **Step 6: Update QA doc with latest dated result**

In `docs/qa/frontend-architecture-smoke.ko.md`, add a new dated section with:

```md
## 2026-07-04 KST Redesign Readiness Smoke

- `npm run verify:pre-redesign`: PASS
- `npm run smoke:frontend`: PASS
- Report: `.gstack/qa-reports/<actual-report-name>.md`
- Credentials: supplied via environment variables only; no account values recorded.
```

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/smoke/frontend-smoke.mjs docs/qa/frontend-architecture-smoke.ko.md src/verification-gate.test.ts
git commit -m "test: strengthen pre-redesign smoke gate"
```

---

### Task 8: Expand Design Token Ownership In High-Risk CSS Bands

**Files:**
- Modify: `src/styles/tokens.test.ts`
- Modify: selected CSS modules:
  - `src/pages/Reservations/ReservationDetail.module.css`
  - `src/pages/Reservations/ReservationConfirm.module.css`
  - `src/pages/Reservations/ReviewCreate.module.css`
  - `src/pages/Profile/Profile.module.css`
  - `src/pages/Profile/HostListings/HostListings.module.css`
  - `src/pages/Profile/HostReservations/HostReservations.module.css`
  - `src/pages/Profile/GuestTrips/GuestTrips.module.css`
  - `src/features/accommodations/edit/components/EditForm.module.css`
  - `src/features/accommodations/edit/components/EditModal.module.css`
  - `src/features/accommodations/edit/components/EditWizardLayout.module.css`
  - `src/features/accommodations/edit/components/PhotosStep.module.css`

- [ ] **Step 1: Add high-risk token ownership list**

Modify `src/styles/tokens.test.ts`:

```ts
const highRiskPreRedesignCssFiles = [
  "pages/Reservations/ReservationDetail.module.css",
  "pages/Reservations/ReservationConfirm.module.css",
  "pages/Reservations/ReviewCreate.module.css",
  "pages/Profile/Profile.module.css",
  "pages/Profile/HostListings/HostListings.module.css",
  "pages/Profile/HostReservations/HostReservations.module.css",
  "pages/Profile/GuestTrips/GuestTrips.module.css",
  "features/accommodations/edit/components/EditForm.module.css",
  "features/accommodations/edit/components/EditModal.module.css",
  "features/accommodations/edit/components/EditWizardLayout.module.css",
  "features/accommodations/edit/components/PhotosStep.module.css",
];
```

Add:

```ts
const preRedesignTokenOwnedCssFiles = [
  ...designTokenOwnedCssFiles,
  ...highRiskPreRedesignCssFiles,
];
```

- [ ] **Step 2: Add failing literal contract for high-risk files**

Add test:

```ts
it("keeps high-risk pre-redesign CSS on color, radius, shadow, and z-index tokens", () => {
  const offenders = highRiskPreRedesignCssFiles.flatMap((relativePath) => {
    const source = readCss(relativePath);

    return source.split(/\r?\n/).flatMap((line, index) => {
      const literal = findForbiddenDesignLiteral(line);
      const rawZIndex = findRawZIndexDeclaration(line);

      return [
        literal ? `${relativePath}:${index + 1}: [${literal}] ${line.trim()}` : null,
        rawZIndex ? `${relativePath}:${index + 1}: [raw-z-index] ${line.trim()}` : null,
      ].filter(Boolean);
    });
  });

  expect(offenders).toEqual([]);
});
```

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/styles/tokens.test.ts --runInBand
```

Expected: FAIL listing the exact CSS lines to tokenize.

- [ ] **Step 3: Tokenize high-risk CSS in small groups**

Replace recurring literals with existing tokens:

```css
#222222 -> var(--color-text-primary)
#717171 -> var(--color-text-secondary)
#f7f7f7 -> var(--color-background-muted)
#dddddd -> var(--color-border-default)
#ebebeb -> var(--color-border-subtle)
#ff385c -> var(--color-brand-coral)
#e61e4d -> var(--color-brand-coral-dark)
#000000 -> var(--color-text-primary)
border-radius: 8px -> border-radius: var(--radius-md)
border-radius: 12px -> border-radius: var(--radius-lg)
box-shadow: 0 2px 16px rgba(0, 0, 0, 0.12) -> box-shadow: var(--shadow-lg)
z-index: 1 -> z-index: var(--z-base)
z-index: 10 -> z-index: var(--z-sticky)
```

For `transition: all`, replace with explicit properties:

```css
transition:
  background-color var(--motion-duration-base) var(--motion-ease-standard),
  border-color var(--motion-duration-base) var(--motion-ease-standard),
  color var(--motion-duration-base) var(--motion-ease-standard),
  transform var(--motion-duration-base) var(--motion-ease-standard);
```

- [ ] **Step 4: Run CSS contract tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run visual smoke after tokenization**

Run:

```bash
npm run build
```

Expected: `Compiled successfully.` Existing freshness warnings may remain.

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.test.ts src/pages/Reservations src/pages/Profile src/features/accommodations/edit/components
git commit -m "refactor: enroll high-risk CSS in token contracts"
```

---

### Task 9: Final Redesign Readiness Verification

**Files:**
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`

- [ ] **Step 1: Run full static gate**

Run:

```bash
git diff --check
npm run typecheck
npm run test:ci:no-cache -- --runInBand
npm run build
```

Expected:

- `git diff --check`: exit 0.
- `typecheck`: PASS.
- Jest: PASS.
- Build: `Compiled successfully.`

- [ ] **Step 2: Run high-risk focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationDetail.test.ts src/features/reservations/lib/reservationCheckoutState.test.ts src/pages/Reservations/PaymentSuccess.test.tsx src/routes/paths.test.ts src/routes/route-boundary-contracts.test.ts src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run browser smoke**

Start backend and frontend, then run:

```bash
AIRBOB_FRONTEND_URL=http://localhost:3000 \
GSTACK_BROWSE_BIN=/Users/jaehoonchoi/gstack/.agents/skills/gstack/browse/dist/browse \
AIRBOB_QA_EMAIL='[provided out-of-band]' \
AIRBOB_QA_PASSWORD='[provided out-of-band]' \
AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID=3 \
npm run smoke:frontend
```

Expected: PASS. No credential values appear in docs, scripts, source, or smoke report.

- [ ] **Step 4: Scan for committed credentials**

Run:

```bash
rg -n "<thread-provided-qa-email-pattern>|<thread-provided-qa-password-pattern>" docs scripts src .gstack/qa-reports
```

Expected: no matches after replacing the placeholders with escaped patterns for the QA credentials provided out of band.

- [ ] **Step 5: Update QA evidence**

Append:

```md
## 2026-07-04 KST Redesign Readiness Final

- `git diff --check`: PASS
- `npm run typecheck`: PASS
- `npm run test:ci:no-cache -- --runInBand`: PASS
- `npm run build`: PASS
- `npm run smoke:frontend`: PASS
- Smoke report: `.gstack/qa-reports/<actual-report-name>.md`
- Credential scan: PASS, no QA account values found in committed paths.
```

- [ ] **Step 6: Commit**

```bash
git add docs/qa/frontend-architecture-smoke.ko.md
git commit -m "docs: record redesign readiness verification"
```

---

## Execution Order

1. Task 1: Restore Green Jest After Dialog Migration
2. Task 2: Clear Accommodation Detail User-Scoped Wishlist State
3. Task 3: Clear Reservation Checkout Session Storage After Payment Terminal Routes
4. Task 4: Type Route Query Builders Before Moving More Pages
5. Task 5: Move Search Page Workflow Into A Feature Route Container
6. Task 6: Move Accommodation Detail Workflow Into A Feature Route Container
7. Task 7: Upgrade Smoke From Route Load To Flow Assertions
8. Task 8: Expand Design Token Ownership In High-Risk CSS Bands
9. Task 9: Final Redesign Readiness Verification

## Design Refactor Readiness Decision

Do not start broad Airbnb-style page redesign while Task 1 is failing. After Tasks 1-3 pass, user-data and payment privacy risks are closed enough for low-risk token/component work. Broad page-level visual redesign should wait until Tasks 4-9 are complete, because Search and AccommodationDetail still own workflow-heavy page code and current smoke/token gates are too shallow for design churn.

## Self-Review

- Spec coverage: The plan covers the latest audit findings: red Jest, user-scoped detail state, reservation checkout cleanup, URL query typing, Search/AccommodationDetail page ownership, smoke depth, token ownership, and final QA evidence.
- Placeholder scan: No `TBD`, `TODO`, or unstated implementation slots are present.
- Type consistency: Route query types are introduced in `routes/paths.ts` before feature call sites consume them. `AccommodationDetailRouteProps` and `SearchRouteProps` keep router primitives at the page boundary and typed callbacks at feature boundaries.
