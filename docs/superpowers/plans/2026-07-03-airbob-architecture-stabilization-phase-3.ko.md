# Airbob Architecture Stabilization Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 리팩터 전에 남은 P1 프론트 플로우 결함을 줄이고, 검색/인증/예약/결제 경계를 테스트 가능한 계약으로 고정한다.

**Architecture:** 백엔드 API, DB, 서버 로직은 변경하지 않는다. `routes`는 URL 생성 계약, `features/search`는 검색 URL 직렬화, `features/accommodations`는 예약 orchestration, `contexts/AuthContext`는 서버 세션과 클라이언트 세션의 일관성을 담당하도록 최소 변경한다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, TanStack Query, CSS Modules, Jest/React Testing Library, gstack QA.

---

## File Structure

- Modify: `src/features/search/lib/searchParams.ts`
  - 검색 날짜를 UTC ISO가 아니라 로컬 calendar date로 직렬화한다.
- Modify: `src/features/search/lib/searchParams.test.ts`
  - 로컬 자정 Date가 하루 전 날짜로 밀리지 않는 계약을 추가한다.
- Modify: `src/routes/paths.ts`
  - `routeTo.accommodationDetail(id, query?)`가 검색 query를 보존할 수 있게 한다.
- Modify: `src/routes/paths.test.ts`
  - 기존 무쿼리 URL 호환과 신규 query 보존을 검증한다.
- Modify: `src/components/AccommodationCard/AccommodationCard.Search.tsx`
  - 검색 페이지에서 주입한 상세 URL을 anchor `href`로 쓸 수 있게 한다.
- Modify: `src/components/AccommodationCard/AccommodationCard.Search.test.tsx`
  - 카드 링크가 주입된 상세 URL을 유지하는지 검증한다.
- Modify: `src/features/search/components/SearchResultsList.tsx`
  - 현재 검색 query를 상세 카드 URL로 전달한다.
- Modify: `src/features/search/components/SearchResultsList.test.tsx`
  - 리스트가 상세 URL에 검색 query를 포함해 카드로 넘기는지 검증한다.
- Modify: `src/pages/Search/Search.tsx`
  - `window.open()` 상세 이동도 동일 query-preserving URL을 사용한다.
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts`
  - 예약 생성 중복 호출을 `ref`와 `isReserving` 상태로 막는다.
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`
  - 같은 렌더 사이 더블 호출이 API를 한 번만 호출하는지 검증한다.
- Modify: `src/features/accommodations/components/AccommodationBookingCard.tsx`
  - 예약 진행 중 버튼을 disabled 처리하고 라벨을 `예약 중...`으로 바꾼다.
- Modify: `src/features/accommodations/components/AccommodationBookingCard.test.tsx`
  - 예약 진행 중 버튼이 disabled인지 검증한다.
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`
  - `booking.isReserving`을 예약 카드로 전달한다.
- Modify: `src/contexts/AuthContext.tsx`
  - 서버 로그아웃 실패 시 로컬 인증 상태를 먼저 지우지 않는다.
- Modify: `src/contexts/AuthContext.test.tsx`
  - 로그아웃 실패 시 기존 클라이언트 세션이 유지되는 계약으로 테스트를 바꾼다.
- Modify: `src/pages/Reservations/PaymentSuccess.test.tsx`
  - confirmed 결제 테스트는 유효한 amount를 쓰고, malformed amount는 failure 경로만 검증한다.

## Protected Flows

- 검색 날짜 선택 -> URL query -> 검색 결과 카드 -> 숙소 상세 -> 예약 카드 날짜/가격.
- 검색 결과 카드 클릭, 키보드 Enter, 새 탭 anchor href.
- 숙소 상세 예약 버튼 빠른 중복 클릭.
- 서버 로그아웃 실패와 성공 시 클라이언트 인증 상태.
- Toss 결제 성공 query -> 결제 confirm hook -> 예약 상세 또는 실패 페이지.

## Task 1: Search Date And Detail URL Contract

**Files:**
- Modify: `src/features/search/lib/searchParams.ts`
- Modify: `src/features/search/lib/searchParams.test.ts`
- Modify: `src/routes/paths.ts`
- Modify: `src/routes/paths.test.ts`
- Modify: `src/components/AccommodationCard/AccommodationCard.Search.tsx`
- Modify: `src/components/AccommodationCard/AccommodationCard.Search.test.tsx`
- Modify: `src/features/search/components/SearchResultsList.tsx`
- Modify: `src/features/search/components/SearchResultsList.test.tsx`
- Modify: `src/pages/Search/Search.tsx`

- [x] **Step 1: Write failing date/query tests**

Add this case to `src/features/search/lib/searchParams.test.ts`:

```ts
it("formats local calendar dates without shifting them through UTC", () => {
  const params = buildSearchNavigationParams(new URLSearchParams(), {
    destination: "Seoul",
    selectedPlace: null,
    checkIn: new Date(2026, 6, 10),
    checkOut: new Date(2026, 6, 12),
    adultOccupancy: 1,
    childOccupancy: 0,
    infantOccupancy: 0,
    petOccupancy: 0,
  });

  expect(params.get("checkIn")).toBe("2026-07-10");
  expect(params.get("checkOut")).toBe("2026-07-12");
});
```

Add this case to `src/routes/paths.test.ts`:

```ts
it("preserves raw search query params on accommodation detail routes", () => {
  expect(
    routeTo.accommodationDetail(
      12,
      "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
    )
  ).toBe(
    "/accommodations/12?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
  );
});
```

Add this case to `src/components/AccommodationCard/AccommodationCard.Search.test.tsx`:

```tsx
it("uses a query-preserving detail URL when provided", () => {
  render(
    <AccommodationCardSearch
      accommodation={accommodation}
      detailUrl="/accommodations/1?checkIn=2026-07-10&checkOut=2026-07-12"
    />
  );

  expect(
    screen.getByRole("link", { name: "숙소 상세 보기: 성수 숙소" })
  ).toHaveAttribute(
    "href",
    "/accommodations/1?checkIn=2026-07-10&checkOut=2026-07-12"
  );
});
```

Replace the `AccommodationCardSearch` mock in `src/features/search/components/SearchResultsList.test.tsx` with:

```tsx
jest.mock("../../../components/AccommodationCard", () => ({
  AccommodationCardSearch: ({
    accommodation,
    detailUrl,
    onClick,
  }: {
    accommodation: AccommodationSearchInfo;
    detailUrl?: string;
    onClick: () => void;
  }) => (
    <button type="button" data-detail-url={detailUrl} onClick={onClick}>
      {`숙소 카드 ${accommodation.id}`}
    </button>
  ),
}));
```

Add this case to `src/features/search/components/SearchResultsList.test.tsx`:

```tsx
it("passes the current search query to accommodation detail cards", () => {
  render(
    <SearchResultsList
      accommodations={[createAccommodation(7)]}
      isLoading={false}
      selectedAccommodationId={null}
      onAccommodationClick={jest.fn()}
      onWishlistToggle={jest.fn()}
      detailSearchParams={
        new URLSearchParams("checkIn=2026-07-10&checkOut=2026-07-12")
      }
    />
  );

  expect(screen.getByRole("button", { name: "숙소 카드 7" })).toHaveAttribute(
    "data-detail-url",
    "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12"
  );
});
```

- [x] **Step 2: Run focused tests and observe failures**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/lib/searchParams.test.ts src/routes/paths.test.ts src/components/AccommodationCard/AccommodationCard.Search.test.tsx src/features/search/components/SearchResultsList.test.tsx
```

Expected: FAIL until local date formatting, route query support, card `detailUrl`, and list query forwarding are implemented.

- [x] **Step 3: Implement minimal query-preserving search detail flow**

Replace `formatDateForSearchParam` in `src/features/search/lib/searchParams.ts`:

```ts
const formatDateForSearchParam = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
```

Change `routeTo.accommodationDetail` in `src/routes/paths.ts`:

```ts
accommodationDetail: (id: string | number, query?: URLSearchParams | string) =>
  withRawQuery(buildPath(ROUTE_PATHS.accommodationDetail, { id }), query),
```

Add `detailUrl?: string` to `AccommodationCardSearchProps` in `src/components/AccommodationCard/AccommodationCard.Search.tsx`, destructure it, and replace the computed URL:

```tsx
detailUrl: providedDetailUrl,
...
const detailUrl =
  providedDetailUrl ?? routeTo.accommodationDetail(accommodation.id);
```

Add `detailSearchParams?: URLSearchParams` to `SearchResultsListProps` in `src/features/search/components/SearchResultsList.tsx`, import `routeTo`, destructure the prop, and pass the URL:

```tsx
detailUrl={routeTo.accommodationDetail(
  accommodation.id,
  detailSearchParams
)}
```

Update both `SearchResultsList` usages in `src/pages/Search/Search.tsx`:

```tsx
detailSearchParams={searchParams}
```

Update `handleAccommodationCardClick` in `src/pages/Search/Search.tsx`:

```tsx
window.open(
  routeTo.accommodationDetail(accommodationId, searchParams),
  "_blank"
);
```

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/lib/searchParams.test.ts src/routes/paths.test.ts src/components/AccommodationCard/AccommodationCard.Search.test.tsx src/features/search/components/SearchResultsList.test.tsx
```

Expected: PASS.

## Task 2: Reservation Duplicate Submit Guard

**Files:**
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`
- Modify: `src/features/accommodations/components/AccommodationBookingCard.tsx`
- Modify: `src/features/accommodations/components/AccommodationBookingCard.test.tsx`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`

- [x] **Step 1: Write failing duplicate-submit and disabled-button tests**

Add this case to `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`:

```tsx
it("ignores duplicate reserve calls while reservation creation is in flight", async () => {
  let resolveReservation!: (value: Awaited<ReturnType<typeof reservationApi.create>>) => void;
  jest.mocked(reservationApi.create).mockReturnValue(
    new Promise((resolve) => {
      resolveReservation = resolve;
    })
  );

  const { result } = renderUseAccommodationBooking(
    new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-22")
  );

  await act(async () => {
    void result.current.handleReserve();
    void result.current.handleReserve();
  });

  expect(reservationApi.create).toHaveBeenCalledTimes(1);
  expect(result.current.isReserving).toBe(true);

  await act(async () => {
    resolveReservation({
      reservation_uid: "res-1",
      order_name: "주문명",
      amount: 200000,
      customer_email: "guest@example.com",
      customer_name: "게스트",
    });
  });

  expect(result.current.isReserving).toBe(false);
});
```

Add `isReserving: false` to the default props in `renderBookingCard`, then add this case to `src/features/accommodations/components/AccommodationBookingCard.test.tsx`:

```tsx
it("disables the reserve button while a reservation is being created", () => {
  const props = renderBookingCard({ isReserving: true });

  const reserveButton = screen.getByRole("button", { name: "예약 중..." });

  expect(reserveButton).toBeDisabled();

  fireEvent.click(reserveButton);

  expect(props.onReserve).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run focused tests and observe failures**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/accommodations/hooks/useAccommodationBooking.test.tsx src/features/accommodations/components/AccommodationBookingCard.test.tsx
```

Expected: FAIL until `isReserving` exists and the hook guards duplicate calls.

- [x] **Step 3: Implement duplicate-submit guard**

Update imports in `src/features/accommodations/hooks/useAccommodationBooking.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

Inside the hook, add:

```ts
const [isReserving, setIsReserving] = useState(false);
const isReservingRef = useRef(false);
```

Inside `handleReserve`, after auth/accommodation/date validation and before `clearError()`:

```ts
if (isReservingRef.current) {
  return;
}

isReservingRef.current = true;
setIsReserving(true);
```

In the `try/catch`, add a `finally`:

```ts
} finally {
  isReservingRef.current = false;
  setIsReserving(false);
}
```

Return `isReserving` from the hook.

Add `isReserving: boolean` to `AccommodationBookingCardProps`, destructure it, and update the reserve button:

```tsx
<button
  type="button"
  className={styles.reserveButton}
  onClick={onReserve}
  disabled={isReserving}
>
  {isReserving ? "예약 중..." : "예약하기"}
</button>
```

Pass `isReserving={booking.isReserving}` from `src/pages/AccommodationDetail/AccommodationDetail.tsx`.

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/accommodations/hooks/useAccommodationBooking.test.tsx src/features/accommodations/components/AccommodationBookingCard.test.tsx
```

Expected: PASS.

## Task 3: Auth Logout Consistency

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/contexts/AuthContext.test.tsx`

- [x] **Step 1: Write failing logout consistency test**

Rename the existing logout rejection test to:

```tsx
it("keeps authenticated state when server logout rejects", async () => {
```

Replace its final assertions with:

```tsx
await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
expect(thrownError).toBe(logoutError);
expect(document.cookie).toContain("SESSION_ID=test-session");
```

Add this success case below it:

```tsx
it("clears authenticated state and the session cookie when logout succeeds", async () => {
  jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
  jest.mocked(authApi.logout).mockResolvedValueOnce(undefined);
  document.cookie = "SESSION_ID=test-session; path=/;";

  const { result } = renderUseAuth();
  await waitForSessionSettled(result);
  expect(result.current.isAuthenticated).toBe(true);

  await act(async () => {
    await result.current.logout();
  });

  await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
  expect(document.cookie).not.toContain("SESSION_ID=");
});
```

- [x] **Step 2: Run focused AuthContext test and observe failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/contexts/AuthContext.test.tsx
```

Expected: FAIL because `logout()` clears the local session in `finally`.

- [x] **Step 3: Implement logout consistency**

Replace `logout` in `src/contexts/AuthContext.tsx`:

```ts
const logout = async () => {
  await authApi.logout();
  document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  await clearSession();
};
```

- [x] **Step 4: Run focused AuthContext test**

Run:

```bash
npm run test:ci -- --runTestsByPath src/contexts/AuthContext.test.tsx
```

Expected: PASS.

## Task 4: Payment Success Test Contract

**Files:**
- Modify: `src/pages/Reservations/PaymentSuccess.test.tsx`

- [x] **Step 1: Fix confirmed payment setup**

Change the default `mockSearchParams` value at the top of `src/pages/Reservations/PaymentSuccess.test.tsx` and in `beforeEach`:

```ts
let mockSearchParams = new URLSearchParams({
  amount: "120000",
  orderId: "order-1",
  paymentKey: "payment-key-1",
});
```

Add this assertion inside `"routes confirmed payment confirmation to the reservation detail page"`:

```ts
expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
  amount: "120000",
  enabled: true,
  orderId: "order-1",
  paymentKey: "payment-key-1",
});
```

Set malformed amount explicitly at the start of `"routes malformed payment confirmation results to the failure page"`:

```ts
mockSearchParams = new URLSearchParams({
  amount: "120000x",
  orderId: "order-1",
  paymentKey: "payment-key-1",
});
```

- [x] **Step 2: Run focused payment tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/pages/Reservations/PaymentSuccess.test.tsx src/features/reservations/hooks/usePaymentConfirmation.test.ts src/features/reservations/lib/paymentRouteState.test.ts
```

Expected: PASS.

## Task 5: Verification And gstack QA

**Files:**
- No source changes unless QA reveals a blocking regression in files modified by this plan.

- [x] **Step 1: Run architecture-focused gates**

Run:

```bash
npm run test:ci -- --runTestsByPath src/api/ui-api-boundary-contracts.test.ts src/components/components-boundary-contracts.test.ts src/shared/ui/shared-ui-boundary-contracts.test.ts src/routes/navigation-contracts.test.ts src/styles/design-system-contracts.test.ts
```

Expected: PASS.

- [x] **Step 2: Run full verification**

Run:

```bash
npm run verify
```

Expected: PASS.

- [x] **Step 3: Run gstack QA smoke against the affected frontend flows**

Start the app if no dev server is already available:

```bash
npm start
```

Use gstack QA/browser checks for:

```text
1. Search page with checkIn/checkOut query keeps those params when opening a result detail.
2. Accommodation detail reserve button cannot trigger duplicate reservation creation.
3. Login/logout visible state remains coherent after auth actions.
4. Payment success route with invalid amount reaches the failure route.
```

Expected: no P1/P2 regressions in affected flows. If backend auth/payment endpoints are unavailable locally, record that limitation and keep the automated Jest/build verification as the hard gate for this phase.

## Self-Review

- Spec coverage: Covers the remaining high-risk frontend-only audit findings that can be fixed without backend/API/DB/server changes.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps are present.
- Type consistency: `detailSearchParams`, `detailUrl`, `isReserving`, and `routeTo.accommodationDetail(id, query?)` are used consistently across tasks.
