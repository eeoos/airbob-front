# Airbob Architecture Stabilization Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결제/인증/예약 URL/모바일 search bottom sheet의 구조적 회귀 위험을 줄여 Airbnb 스타일 디자인 리팩터 전에 핵심 플로우 contract를 안정화한다.

**Architecture:** 이번 단계는 백엔드/API/DB를 바꾸지 않고 프론트 경계만 강화한다. `routes`는 보호 라우트 복귀 정책을 소유하고, `features/reservations/lib`는 payment route query 검증을 소유하며, `features/accommodations/hooks`는 예약 입력 검증을 소유한다. Search bottom sheet는 hook 내부에서 viewport 기반 snap position을 계산해 페이지 CSS 상태와 motion 상태가 같은 의미를 갖게 한다.

**Tech Stack:** React 19, TypeScript 4.9, React Router 7, Jest/React Testing Library, Framer Motion, CSS Modules.

---

## File Structure

- Modify: `src/routes/RequireAuth.tsx`
  - 비로그인 보호 라우트의 redirect target을 home에서 login으로 바꾸고 `state.from`을 유지한다.
- Modify: `src/routes/RequireAuth.test.tsx`
  - `/wishlist?view=recently-viewed` deep link가 `/login`으로 redirect 되는지 검증한다.
- Modify: `src/features/reservations/lib/paymentRouteState.ts`
  - Toss success query에서 amount를 숫자 문자열로 검증하고 `orderId !== reservationUid`를 invalid로 처리한다.
- Modify: `src/features/reservations/lib/paymentRouteState.test.ts`
  - amount 형식 오류와 reservation/order mismatch 테스트를 추가한다.
- Modify: `src/pages/Reservations/PaymentSuccess.test.tsx`
  - mismatch query가 confirmation hook을 disable하고 fail page로 이동하는지 검증한다.
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts`
  - URL 날짜/인원 파서를 엄격화하고 예약 직전 unavailable range와 guest count를 검증한다.
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`
  - malformed 날짜/인원 query와 unavailable date 관통 예약을 막는 테스트를 추가한다.
- Modify: `src/features/search/hooks/useSearchBottomSheet.ts`
  - mobile/tablet viewport에서 distinct snap positions를 계산한다.
- Modify: `src/features/search/hooks/useSearchBottomSheet.test.tsx`
  - snap positions가 `collapsed < half < expanded` 순서이고 resize에 반응하는지 검증한다.

---

### Task 1: Protected Route Return Path

**Files:**
- Modify: `src/routes/RequireAuth.tsx:18-31`
- Modify: `src/routes/RequireAuth.test.tsx:63-80`

- [ ] **Step 1: Write the failing test**

Change the unauthenticated test name and expected target in `src/routes/RequireAuth.test.tsx`:

```tsx
test("redirects unauthenticated users to login with a protected route return target", () => {
  renderRequireAuth({ isAuthenticated: false, isLoading: false });

  expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", routeTo.login());
  expect(screen.getByTestId("navigate")).toHaveAttribute("data-replace", "true");
  expect(screen.getByTestId("navigate")).toHaveAttribute(
    "data-state",
    JSON.stringify({
      from: {
        pathname: "/wishlist",
        search: "?view=recently-viewed",
        hash: "",
      },
    })
  );
  expect(screen.queryByText("보호된 페이지")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/RequireAuth.test.tsx --runInBand
```

Expected: FAIL because `RequireAuth` still navigates to `routeTo.home()`.

- [ ] **Step 3: Implement the redirect change**

Change `src/routes/RequireAuth.tsx`:

```tsx
if (!isAuthenticated) {
  return (
    <Navigate
      to={routeTo.login()}
      replace
      state={{
        from: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
      }}
    />
  );
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/RequireAuth.test.tsx src/pages/Auth/Login/Login.test.tsx --runInBand
```

Expected: PASS. `Login.test.tsx` already covers return path consumption.

---

### Task 2: Toss Success Route Contract

**Files:**
- Modify: `src/features/reservations/lib/paymentRouteState.ts:1-141`
- Modify: `src/features/reservations/lib/paymentRouteState.test.ts:67-110`
- Modify: `src/pages/Reservations/PaymentSuccess.test.tsx:1-140`

- [ ] **Step 1: Write failing route-state tests**

Append these tests inside `describe("toss success route state", ...)` in `src/features/reservations/lib/paymentRouteState.test.ts`:

```ts
it("marks Toss success query invalid when orderId does not match reservationUid", () => {
  const state = parseTossSuccessRouteState(
    "reservation-123",
    new URLSearchParams(
      "paymentKey=payment-key-1&orderId=reservation-456&amount=120000"
    )
  );

  expect(state).toEqual({
    status: "invalid",
    reason: "MISMATCHED_TOSS_ORDER",
  });
});

it("marks Toss success query invalid when amount is not a safe integer string", () => {
  const state = parseTossSuccessRouteState(
    "reservation-123",
    new URLSearchParams(
      "paymentKey=payment-key-1&orderId=reservation-123&amount=120000x"
    )
  );

  expect(state).toEqual({
    status: "invalid",
    reason: "INVALID_TOSS_SUCCESS_AMOUNT",
  });
});
```

Update the existing complete Toss success test to use matching ids:

```ts
const state = parseTossSuccessRouteState(
  "r-1",
  new URLSearchParams("paymentKey=payment-key-1&orderId=r-1&amount=120000")
);

expect(state).toEqual({
  status: "valid",
  reservationUid: "r-1",
  paymentKey: "payment-key-1",
  orderId: "r-1",
  amount: "120000",
});
```

- [ ] **Step 2: Write failing page test**

Add this test to `src/pages/Reservations/PaymentSuccess.test.tsx`:

```tsx
it("disables confirmation and routes to failure when Toss orderId mismatches the route reservationUid", async () => {
  mockSearchParams = new URLSearchParams({
    amount: "120000",
    orderId: "other-reservation",
    paymentKey: "payment-key-1",
  });
  mockUsePaymentConfirmation.mockReturnValue({
    result: null,
  });

  render(<PaymentSuccess />);

  expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
    amount: null,
    enabled: false,
    orderId: null,
    paymentKey: null,
  });

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith(
      "/reservations/reservation-123/fail"
    );
  });
});
```

Also change default `mockSearchParams` and the confirmed test expectation so `orderId` equals `reservation-123`.

- [ ] **Step 3: Run focused tests and verify they fail**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/paymentRouteState.test.ts src/pages/Reservations/PaymentSuccess.test.tsx --runInBand
```

Expected: FAIL because mismatch and invalid amount are not rejected yet.

- [ ] **Step 4: Implement route-state validation**

Change the invalid reason type in `src/features/reservations/lib/paymentRouteState.ts`:

```ts
export type TossSuccessRouteInvalidReason =
  | "MISSING_TOSS_SUCCESS_QUERY"
  | "INVALID_TOSS_SUCCESS_AMOUNT"
  | "MISMATCHED_TOSS_ORDER";
```

Change `parseTossSuccessRouteState`:

```ts
export const parseTossSuccessRouteState = (
  reservationUid: string | null | undefined,
  params: URLSearchParams
): TossSuccessRouteState => {
  const paymentKey = params.get("paymentKey");
  const orderId = params.get("orderId");
  const amount = params.get("amount");

  if (!reservationUid || !paymentKey || !orderId || !amount) {
    return {
      status: "invalid",
      reason: "MISSING_TOSS_SUCCESS_QUERY",
    };
  }

  if (orderId !== reservationUid) {
    return {
      status: "invalid",
      reason: "MISMATCHED_TOSS_ORDER",
    };
  }

  if (parseIntegerParam(params, "amount") === null) {
    return {
      status: "invalid",
      reason: "INVALID_TOSS_SUCCESS_AMOUNT",
    };
  }

  return {
    status: "valid",
    reservationUid,
    paymentKey,
    orderId,
    amount,
  };
};
```

- [ ] **Step 5: Run focused tests and verify they pass**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/paymentRouteState.test.ts src/pages/Reservations/PaymentSuccess.test.tsx --runInBand
```

Expected: PASS.

---

### Task 3: Booking URL Validation

**Files:**
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts:38-58`
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts:91-150`
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts:211-285`
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.test.tsx:1-320`

- [ ] **Step 1: Write failing booking tests**

Append these tests to `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`:

```tsx
it("falls back from malformed URL dates and clamps malformed occupancy params", async () => {
  const { result } = renderUseAccommodationBooking(
    new URLSearchParams(
      "checkIn=2026-02-31&checkOut=not-a-date&adultOccupancy=-5&childOccupancy=abc&infantOccupancy=3&petOccupancy=2"
    ),
    {
      accommodation: createAccommodation({
        policy: {
          max_occupancy: 4,
          infant_occupancy: 1,
          pet_occupancy: 1,
        },
      }),
    }
  );

  expect(result.current.formatDate(result.current.checkIn)).toBe("2026. 07. 10.");
  expect(result.current.formatDate(result.current.checkOut)).toBe("2026. 07. 11.");
  expect(result.current.adultCount).toBe(1);
  expect(result.current.childCount).toBe(0);
  expect(result.current.infantCount).toBe(1);
  expect(result.current.petCount).toBe(1);
});

it("blocks reservations whose selected range contains an unavailable date", async () => {
  const { result } = renderUseAccommodationBooking(
    new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-23"),
    {
      accommodation: createAccommodation({
        unavailable_dates: ["2026-07-21"],
      }),
    }
  );

  await act(async () => {
    await result.current.handleReserve();
  });

  expect(reservationApi.create).not.toHaveBeenCalled();
  expect(mockHandleError).toHaveBeenCalledWith(
    new Error("선택한 날짜에 예약할 수 없는 날짜가 포함되어 있습니다.")
  );
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationBooking.test.tsx --runInBand
```

Expected: FAIL because malformed query dates normalize and unavailable range is not checked.

- [ ] **Step 3: Implement strict parsing helpers**

Add helpers near the top of `src/features/accommodations/hooks/useAccommodationBooking.ts`:

```ts
const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const parseCountParam = (
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number
) => {
  const value = searchParams.get(key);
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return fallback;
  }

  return clampNumber(parsed, min, max);
};

const parseDateFromUrl = (dateString: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const toDateKey = (date: Date | string) => {
  const parsedDate = typeof date === "string" ? parseDateFromUrl(date) : date;
  if (!parsedDate) {
    return null;
  }

  return formatDateForUrl(parsedDate);
};

const hasUnavailableDateInRange = (
  checkIn: Date,
  checkOut: Date,
  unavailableDates: Array<string | Date>
) => {
  const unavailableDateKeys = new Set(
    unavailableDates
      .map(toDateKey)
      .filter((dateKey): dateKey is string => dateKey !== null)
  );
  const cursor = new Date(checkIn);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    if (unavailableDateKeys.has(formatDateForUrl(cursor))) {
      return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return false;
};
```

- [ ] **Step 4: Use strict parsers in state initialization and effects**

Use policy max values when parsing counts:

```ts
const maxOccupancy = accommodation?.policy.max_occupancy ?? Number.MAX_SAFE_INTEGER;
const maxInfants = accommodation?.policy.infant_occupancy ?? Number.MAX_SAFE_INTEGER;
const maxPets = accommodation?.policy.pet_occupancy ?? Number.MAX_SAFE_INTEGER;

const [adultCount, setAdultCount] = useState(() =>
  parseCountParam(searchParams, "adultOccupancy", 1, 1, maxOccupancy)
);
const [childCount, setChildCount] = useState(() =>
  parseCountParam(searchParams, "childOccupancy", 0, 0, maxOccupancy)
);
const [infantCount, setInfantCount] = useState(() =>
  parseCountParam(searchParams, "infantOccupancy", 0, 0, maxInfants)
);
const [petCount, setPetCount] = useState(() =>
  parseCountParam(searchParams, "petOccupancy", 0, 0, maxPets)
);
```

In the URL date memo, only accept dates when both parse and `checkOutDate > checkInDate`:

```ts
if (urlCheckIn && urlCheckOut && accommodation) {
  const checkInDate = parseDateFromUrl(urlCheckIn);
  const checkOutDate = parseDateFromUrl(urlCheckOut);

  if (checkInDate && checkOutDate && checkOutDate > checkInDate) {
    const nightsCount = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      nights: nightsCount,
      totalPrice: accommodation.base_price * nightsCount,
    };
  }
}
```

In the occupancy sync effect:

```ts
setAdultCount(parseCountParam(searchParams, "adultOccupancy", 1, 1, maxOccupancy));
setChildCount(parseCountParam(searchParams, "childOccupancy", 0, 0, maxOccupancy));
setInfantCount(parseCountParam(searchParams, "infantOccupancy", 0, 0, maxInfants));
setPetCount(parseCountParam(searchParams, "petOccupancy", 0, 0, maxPets));
```

- [ ] **Step 5: Add reservation-time range and guest validation**

Before setting `isReservingRef.current = true` in `handleReserve`, add:

```ts
if (checkOut <= checkIn) {
  handleError(new Error("체크아웃 날짜는 체크인 날짜 이후여야 합니다."));
  return;
}

if (hasUnavailableDateInRange(checkIn, checkOut, accommodation.unavailable_dates)) {
  handleError(new Error("선택한 날짜에 예약할 수 없는 날짜가 포함되어 있습니다."));
  return;
}

const guestCount = adultCount + childCount;
if (guestCount < 1 || guestCount > accommodation.policy.max_occupancy) {
  handleError(new Error("예약 가능한 인원 수를 확인해주세요."));
  return;
}
```

Then remove the later duplicate `const guestCount = adultCount + childCount;` inside the `try` block.

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/hooks/useAccommodationBooking.test.tsx --runInBand
```

Expected: PASS.

---

### Task 4: Search Bottom Sheet Snap Positions

**Files:**
- Modify: `src/features/search/hooks/useSearchBottomSheet.ts:17-27`
- Modify: `src/features/search/hooks/useSearchBottomSheet.test.tsx:1-80`

- [ ] **Step 1: Write failing snap-position test**

Add this test to `src/features/search/hooks/useSearchBottomSheet.test.tsx`:

```tsx
it("computes distinct mobile snap positions from the viewport", () => {
  resizeWindow(390);
  const { result } = renderHook(() => useSearchBottomSheet());

  expect(result.current.snapPositions.collapsed).toBe(0);
  expect(result.current.snapPositions.half).toBeGreaterThan(
    result.current.snapPositions.collapsed
  );
  expect(result.current.snapPositions.expanded).toBeGreaterThan(
    result.current.snapPositions.half
  );
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/hooks/useSearchBottomSheet.test.tsx --runInBand
```

Expected: FAIL because all snap positions are currently `0`.

- [ ] **Step 3: Implement viewport-based snap positions**

Change `useSearchBottomSheet.ts`:

```ts
const getViewportHeight = () =>
  typeof window === "undefined" ? 0 : window.innerHeight;

const snapPositions = useMemo(() => {
  if (!isMobileOrTablet) {
    return { collapsed: 0, half: 0, expanded: 0 };
  }

  const viewportHeight = getViewportHeight();
  const collapsed = 0;
  const half = Math.round(viewportHeight * 0.32);
  const expanded = Math.round(viewportHeight * 0.68);

  return {
    collapsed,
    half,
    expanded,
  };
}, [isMobileOrTablet]);
```

If tests need deterministic height, set `window.innerHeight` in `resizeWindow`:

```ts
Object.defineProperty(window, "innerHeight", {
  writable: true,
  configurable: true,
  value: 844,
});
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/hooks/useSearchBottomSheet.test.tsx --runInBand
```

Expected: PASS.

---

### Task 5: Verification

**Files:**
- No code file ownership; this task verifies all changes.

- [ ] **Step 1: Run targeted tests for changed areas**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/RequireAuth.test.tsx src/pages/Auth/Login/Login.test.tsx src/features/reservations/lib/paymentRouteState.test.ts src/pages/Reservations/PaymentSuccess.test.tsx src/features/accommodations/hooks/useAccommodationBooking.test.tsx src/features/search/hooks/useSearchBottomSheet.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full Jest suite**

Run:

```bash
CI=true npm run test:ci:no-cache -- --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run dependency audit as non-blocking evidence**

Run:

```bash
npm audit --omit=dev
```

Expected: FAIL is acceptable for this phase only if it matches the known baseline around `axios`, `react-router-dom`, and `react-scripts`. Do not fix dependencies in this phase.

---

## Self-Review

- Spec coverage: This plan addresses the latest audit's highest-risk frontend-owned correctness issues before design work: protected-route return path, Toss success mismatch, malformed booking URL state, unavailable date range, and bottom-sheet snap behavior. Map decomposition, modal primitive migration, dependency upgrades, and broad token cleanup are deliberately left for later phases because they are independent subsystems and should each get their own plan.
- Placeholder scan: No `TBD`, `TODO`, or undefined broad instructions remain. Each code-changing step includes concrete snippets and focused test commands.
- Type consistency: `TossSuccessRouteInvalidReason`, `parseTossSuccessRouteState`, `parseCountParam`, `parseDateFromUrl`, and `hasUnavailableDateInRange` names match all references in this plan.
