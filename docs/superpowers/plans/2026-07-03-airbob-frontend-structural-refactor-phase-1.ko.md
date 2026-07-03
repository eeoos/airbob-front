# Airbob Frontend Structural Refactor Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인을 적용하기 전에 프론트엔드의 결제 SDK, 라우팅/Auth, 빌드 경고, 구조 경계 테스트를 먼저 안정화한다.

**Architecture:** 1차 구조 정리는 동작 변경을 최소화하면서 페이지가 직접 소유하던 외부 SDK/라우팅/전역 부작용을 feature/lib 또는 route boundary로 이동한다. 큰 페이지 분해와 디자인 시스템 적용은 이 계획 이후에 진행하고, 이 계획은 후속 분해가 가능한 안전한 기반을 만든다.

**Tech Stack:** React 18, TypeScript, React Router, TanStack Query, Axios, Jest/Testing Library, CRA build.

---

## File Structure

- Create: `src/features/reservations/lib/tossPayments.ts`
  - Toss Payments SDK script loading, client key lookup, global type, payment error normalization을 한 곳에서 소유한다.
- Create: `src/features/reservations/lib/tossPayments.test.ts`
  - 중복 script 삽입 방지, client key 검증, silent reset error 판별, auth error 변환을 검증한다.
- Modify: `src/features/reservations/hooks/useReservationPayment.ts`
  - `window.TossPayments`, `process.env.REACT_APP_TOSS_CLIENT_KEY`, Toss error parsing을 새 adapter로 위임한다.
- Modify: `src/features/reservations/hooks/useReservationPayment.test.ts`
  - hook이 adapter를 호출하는지 검증하고 `window.TossPayments` 직접 세팅 의존을 줄인다.
- Modify: `src/pages/Reservations/ReservationConfirm.tsx`
  - 페이지 내부 Toss script injection과 global type 선언을 제거하고 adapter를 사용한다.
- Modify: `src/features/reservations/components/ReservationModal/ReservationModal.tsx`
  - 모달 내부 Toss script injection을 제거하고 결제 hook에 SDK 준비 책임을 위임한다.
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
  - build warning을 없애기 위해 render 중 생성되는 `result` 객체를 effect 내부로 이동한다.
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`
  - 사용하지 않는 `reviewObserverTarget` destructuring 제거 및 effect deps 정리.
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
  - `setOpenTimePicker` effect dependency 추가.
- Modify: `src/pages/Profile/HostListings/HostListings.tsx`
  - 사용하지 않는 `useCallback` import 제거.
- Modify: `src/api/client.ts`
  - import 시점 production/debug log 제거.
- Create: `src/api/client-contracts.test.ts`
  - API client가 source-level `console.log`를 갖지 않도록 구조 계약을 둔다.
- Modify: `src/routes/RequireAuth.tsx`
  - 보호 라우트 실패 시 현재 location을 `state.from`으로 보존한다.
- Modify: `src/routes/RequireAuth.test.tsx`
  - redirect state 보존을 테스트한다.
- Modify: `src/routes/routeConfig.tsx`
  - route-level lazy loading을 적용한다.
- Modify: `src/routes/Router.tsx`
  - Suspense fallback을 route element boundary에 추가한다.
- Modify: `src/routes/routeConfig.test.tsx`, `src/App.test.tsx`
  - lazy route config에 맞게 테스트를 조정한다.

---

### Task 1: Create Toss Payments Adapter

**Files:**
- Create: `src/features/reservations/lib/tossPayments.ts`
- Create: `src/features/reservations/lib/tossPayments.test.ts`

- [ ] **Step 1: Write the failing adapter test**

Create `src/features/reservations/lib/tossPayments.test.ts`:

```ts
import {
  ensureTossPaymentsScript,
  getTossClientKey,
  shouldSilentlyResetPayment,
  toReservationPaymentError,
} from "./tossPayments";

describe("tossPayments adapter", () => {
  const originalClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;

  afterEach(() => {
    process.env.REACT_APP_TOSS_CLIENT_KEY = originalClientKey;
    document
      .querySelectorAll('script[src="https://js.tosspayments.com/v1"]')
      .forEach((script) => script.remove());
  });

  it("inserts the Toss SDK script only once", () => {
    ensureTossPaymentsScript();
    ensureTossPaymentsScript();

    expect(
      document.querySelectorAll('script[src="https://js.tosspayments.com/v1"]')
    ).toHaveLength(1);
  });

  it("returns the configured client key", () => {
    process.env.REACT_APP_TOSS_CLIENT_KEY = "test_ck_123";

    expect(getTossClientKey()).toBe("test_ck_123");
  });

  it("throws a user-facing setup error when the client key is missing", () => {
    delete process.env.REACT_APP_TOSS_CLIENT_KEY;

    expect(() => getTossClientKey()).toThrow("결제 설정이 올바르지 않습니다.");
  });

  it("recognizes user-cancel and Toss sandbox selection failures as silent resets", () => {
    expect(
      shouldSilentlyResetPayment({
        code: "USER_CANCEL",
        message: "사용자가 결제를 취소했습니다.",
      })
    ).toBe(true);
    expect(
      shouldSilentlyResetPayment({
        code: "BAD_REQUEST",
        message: "계약 후 테스트 가능합니다.",
      })
    ).toBe(true);
  });

  it("normalizes Toss auth failures", () => {
    expect(
      toReservationPaymentError(new Error("Unauthorized"))
    ).toEqual(
      new Error(
        "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
          "클라이언트 키가 올바른지 확인해주세요. " +
          "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다."
      )
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --watchAll=false src/features/reservations/lib/tossPayments.test.ts
```

Expected: FAIL because `./tossPayments` does not exist.

- [ ] **Step 3: Implement the adapter**

Create `src/features/reservations/lib/tossPayments.ts`:

```ts
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsClient;
  }
}

export interface TossPaymentsClient {
  widgets: (options: { customerKey: string }) => {
    renderPaymentMethods: (
      selector: string,
      amount: { value: number },
      options: { variantKey: string }
    ) => Promise<void>;
  };
  requestPayment: (options: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail: string;
    customerName: string;
    amount: number;
  }) => Promise<void>;
}

const TOSS_PAYMENTS_SCRIPT_SRC = "https://js.tosspayments.com/v1";

export const ensureTossPaymentsScript = () => {
  if (document.querySelector(`script[src="${TOSS_PAYMENTS_SCRIPT_SRC}"]`)) {
    return;
  }

  const script = document.createElement("script");
  script.src = TOSS_PAYMENTS_SCRIPT_SRC;
  script.async = true;
  document.body.appendChild(script);
};

export const getTossClientKey = () => {
  const tossClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;

  if (!tossClientKey) {
    throw new Error("결제 설정이 올바르지 않습니다.");
  }

  return tossClientKey;
};

export const getTossPaymentsClient = (clientKey = getTossClientKey()) => {
  if (!window.TossPayments) {
    throw new Error("결제 시스템을 불러올 수 없습니다.");
  }

  return window.TossPayments(clientKey);
};

const getTossErrorCode = (error: unknown): string => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "";
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
};

const getTossErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "";
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
};

export const shouldSilentlyResetPayment = (error: unknown): boolean => {
  const errorCode = getTossErrorCode(error);
  const errorMessage = getTossErrorMessage(error);

  return (
    errorCode === "USER_CANCEL" ||
    errorMessage.includes("취소") ||
    errorMessage.includes("USER_CANCEL") ||
    errorCode === "BAD_REQUEST" ||
    errorMessage.includes("계약 후 테스트")
  );
};

export const toReservationPaymentError = (error: unknown): Error => {
  const errorMessage = getTossErrorMessage(error);

  if (errorMessage.includes("인증") || errorMessage.includes("Unauthorized")) {
    return new Error(
      "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
        "클라이언트 키가 올바른지 확인해주세요. " +
        "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다."
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(errorMessage || "결제 진행 중 오류가 발생했습니다.");
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --watchAll=false src/features/reservations/lib/tossPayments.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/reservations/lib/tossPayments.ts src/features/reservations/lib/tossPayments.test.ts
git commit -m "refactor: centralize Toss Payments adapter"
```

---

### Task 2: Route Reservation Payment Through the Adapter

**Files:**
- Modify: `src/features/reservations/hooks/useReservationPayment.ts`
- Modify: `src/features/reservations/hooks/useReservationPayment.test.ts`
- Modify: `src/pages/Reservations/ReservationConfirm.tsx`
- Modify: `src/features/reservations/components/ReservationModal/ReservationModal.tsx`

- [ ] **Step 1: Write failing source-boundary assertions in payment tests**

Add this test to `src/features/reservations/hooks/useReservationPayment.test.ts`:

```ts
it("loads the Toss SDK through the shared adapter", async () => {
  const handleError = jest.fn();
  const clearError = jest.fn();
  const renderPaymentMethods = jest.fn().mockResolvedValue(undefined);
  const requestPayment = jest.fn();
  const widgets = jest.fn(() => ({ renderPaymentMethods }));
  (window as any).TossPayments = jest.fn(() => ({
    widgets,
    requestPayment,
  }));
  jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

  const { result } = renderHook(() =>
    useReservationPayment({
      clearError,
      handleError,
    })
  );

  expect(
    document.querySelectorAll('script[src="https://js.tosspayments.com/v1"]')
  ).toHaveLength(1);

  await act(async () => {
    await result.current.startReservationPayment(paymentOptions);
  });

  await waitFor(() => expect(requestPayment).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run focused tests to verify failure or current direct ownership**

Run:

```bash
npm test -- --watchAll=false src/features/reservations/hooks/useReservationPayment.test.ts src/features/reservations/components/ReservationModal/ReservationModal.test.tsx
```

Expected before implementation: the new script assertion fails if the adapter is not called from the hook.

- [ ] **Step 3: Update `useReservationPayment`**

Replace the global declaration and Toss helper functions in `src/features/reservations/hooks/useReservationPayment.ts` with adapter imports:

```ts
import {
  ensureTossPaymentsScript,
  getTossClientKey,
  getTossPaymentsClient,
  shouldSilentlyResetPayment,
  toReservationPaymentError,
} from "../lib/tossPayments";
```

Add SDK setup inside `useReservationPayment`:

```ts
useEffect(() => {
  ensureTossPaymentsScript();
}, []);
```

In `startReservationPayment`, replace direct `window.TossPayments` and env lookup with:

```ts
const tossClientKey = getTossClientKey();
```

In `requestTossPayment`, replace:

```ts
const paymentWidget = window.TossPayments(pendingPayment.tossClientKey);
```

with:

```ts
const paymentWidget = getTossPaymentsClient(pendingPayment.tossClientKey);
```

- [ ] **Step 4: Remove direct script ownership from modal and page**

In `src/features/reservations/components/ReservationModal/ReservationModal.tsx`, remove `useEffect` from the import and delete the script-injection effect:

```ts
import React from "react";
```

In `src/pages/Reservations/ReservationConfirm.tsx`, remove the `declare global` block and the `useEffect` script-injection block. Add:

```ts
import {
  ensureTossPaymentsScript,
  getTossClientKey,
  getTossPaymentsClient,
  shouldSilentlyResetPayment,
  toReservationPaymentError,
} from "../../features/reservations/lib/tossPayments";
```

Add setup:

```ts
useEffect(() => {
  ensureTossPaymentsScript();
}, []);
```

Replace direct client creation in `handleReserve`:

```ts
const paymentWidget = getTossPaymentsClient(getTossClientKey());
```

Replace local Toss error branches with:

```ts
if (shouldSilentlyResetPayment(paymentError)) {
  setIsProcessingPayment(false);
  return;
}

throw toReservationPaymentError(paymentError);
```

- [ ] **Step 5: Run focused reservation payment tests**

Run:

```bash
npm test -- --watchAll=false src/features/reservations/hooks/useReservationPayment.test.ts src/features/reservations/components/ReservationModal/ReservationModal.test.tsx src/pages/Reservations/ReservationConfirm.test.tsx
```

Expected: PASS. If `src/pages/Reservations/ReservationConfirm.test.tsx` does not exist, run the two existing payment-focused tests and full verify in Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/features/reservations/hooks/useReservationPayment.ts src/features/reservations/hooks/useReservationPayment.test.ts src/pages/Reservations/ReservationConfirm.tsx src/features/reservations/components/ReservationModal/ReservationModal.tsx
git commit -m "refactor: route reservation payments through Toss adapter"
```

---

### Task 3: Remove Build Warnings and API Debug Logging

**Files:**
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- Modify: `src/pages/Profile/HostListings/HostListings.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/api/client.ts`
- Create: `src/api/client-contracts.test.ts`

- [ ] **Step 1: Write source contract for API client logging**

Create `src/api/client-contracts.test.ts`:

```ts
import { readFileSync } from "fs";
import { join } from "path";

describe("api client source contracts", () => {
  it("does not log client configuration during module import", () => {
    const source = readFileSync(join(process.cwd(), "src/api/client.ts"), "utf8");

    expect(source).not.toContain("console.log");
    expect(source).not.toContain("[axios client]");
  });
});
```

- [ ] **Step 2: Run contract test to verify it fails**

Run:

```bash
npm test -- --watchAll=false src/api/client-contracts.test.ts
```

Expected: FAIL because `src/api/client.ts` still contains import-time logging.

- [ ] **Step 3: Remove import-time logging**

Delete this block from `src/api/client.ts`:

```ts
console.log("[axios client]", {
  nodeEnv: process.env.NODE_ENV,
  apiDomain: API_DOMAIN,
  baseURL: instance.defaults.baseURL,
  version,
});
```

- [ ] **Step 4: Clean build warnings**

In `src/pages/AccommodationDetail/AccommodationDetail.tsx`, remove `reviewObserverTarget` from the destructured review hook result and update the dropdown effect dependency list:

```ts
}, [isGuestPickerOpen, isDatePickerOpen, setIsGuestPickerOpen, setIsDatePickerOpen]);
```

In `src/pages/AccommodationEdit/AccommodationEdit.tsx`, update the time picker effect dependency list:

```ts
}, [openTimePicker, setOpenTimePicker]);
```

In `src/pages/Profile/HostListings/HostListings.tsx`, change the import to:

```ts
import React, { useState, useEffect, useRef } from "react";
```

In `src/pages/Reservations/PaymentSuccess.tsx`, remove the render-level `result` constant and move it inside the effect:

```ts
useEffect(() => {
  if (!reservationUid) {
    navigate(routeTo.profile());
    return;
  }

  const result = isPaymentQueryIncomplete
    ? ({ error: null, status: "skipped" } as const)
    : confirmationResult;

  if (!result) return;

  if (result.status === "confirmed") {
    navigate(routeTo.reservationDetail(reservationUid));
    return;
  }

  navigate(routeTo.paymentFail(reservationUid));
}, [confirmationResult, isPaymentQueryIncomplete, reservationUid, navigate]);
```

- [ ] **Step 5: Run focused tests and build**

Run:

```bash
npm test -- --watchAll=false src/api/client-contracts.test.ts src/pages/Reservations/PaymentSuccess.test.tsx
npm run build
```

Expected: tests PASS and build completes without ESLint warnings from the five files listed above.

- [ ] **Step 6: Commit**

```bash
git add src/api/client.ts src/api/client-contracts.test.ts src/pages/AccommodationDetail/AccommodationDetail.tsx src/pages/AccommodationEdit/AccommodationEdit.tsx src/pages/Profile/HostListings/HostListings.tsx src/pages/Reservations/PaymentSuccess.tsx
git commit -m "chore: clear frontend build warnings"
```

---

### Task 4: Preserve Protected Route Return Location

**Files:**
- Modify: `src/routes/RequireAuth.tsx`
- Modify: `src/routes/RequireAuth.test.tsx`

- [ ] **Step 1: Write failing redirect-state test**

Update the `react-router-dom` mock in `src/routes/RequireAuth.test.tsx`:

```ts
Navigate: ({
  to,
  replace,
  state,
}: {
  to: string;
  replace?: boolean;
  state?: unknown;
}) => (
  <div
    data-testid="navigate"
    data-replace={String(replace)}
    data-state={JSON.stringify(state)}
    data-to={to}
  />
),
useLocation: () => ({
  pathname: "/wishlist",
  search: "?view=recently-viewed",
  hash: "",
  state: null,
  key: "test-location",
}),
```

Replace the unauthenticated test assertion with:

```ts
expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", routeTo.home());
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --watchAll=false src/routes/RequireAuth.test.tsx
```

Expected: FAIL because `RequireAuth` does not pass `state`.

- [ ] **Step 3: Implement redirect state preservation**

Update `src/routes/RequireAuth.tsx`:

```tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { routeTo } from "./paths";

interface RequireAuthProps {
  children: React.ReactElement;
}

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={routeTo.home()}
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

  return children;
};

export default RequireAuth;
```

- [ ] **Step 4: Run route auth tests**

Run:

```bash
npm test -- --watchAll=false src/routes/RequireAuth.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/RequireAuth.tsx src/routes/RequireAuth.test.tsx
git commit -m "fix: preserve protected route return location"
```

---

### Task 5: Add Route-Level Lazy Loading

**Files:**
- Modify: `src/routes/routeConfig.tsx`
- Modify: `src/routes/Router.tsx`
- Modify: `src/routes/routeConfig.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write route lazy contract**

Add this assertion to `src/routes/routeConfig.test.tsx`:

```ts
import { readFileSync } from "fs";
import { join } from "path";

it("uses lazy route components so pages can split by route", () => {
  const source = readFileSync(join(process.cwd(), "src/routes/routeConfig.tsx"), "utf8");

  expect(source).toContain("React.lazy");
  expect(source).not.toMatch(/import\s+\w+\s+from\s+["']\.\.\/pages\//);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --watchAll=false src/routes/routeConfig.test.tsx
```

Expected: FAIL because route components are currently eager imports.

- [ ] **Step 3: Convert route config to lazy imports**

Replace eager page imports in `src/routes/routeConfig.tsx` with:

```tsx
import React from "react";
import { ROUTE_PATHS } from "./paths";

const Home = React.lazy(() => import("../pages/Home/Home"));
const Search = React.lazy(() => import("../pages/Search/Search"));
const AccommodationDetail = React.lazy(
  () => import("../pages/AccommodationDetail/AccommodationDetail")
);
const AccommodationEdit = React.lazy(
  () => import("../pages/AccommodationEdit/AccommodationEdit")
);
const Wishlist = React.lazy(() => import("../pages/Wishlist/Wishlist"));
const Profile = React.lazy(() => import("../pages/Profile/Profile"));
const ReservationDetail = React.lazy(
  () => import("../pages/Reservations/ReservationDetail")
);
const HostReservationDetail = React.lazy(
  () => import("../pages/Profile/HostReservationDetail/HostReservationDetail")
);
const ReservationConfirm = React.lazy(
  () => import("../pages/Reservations/ReservationConfirm")
);
const ReviewCreate = React.lazy(
  () => import("../pages/Reservations/ReviewCreate")
);
const PaymentSuccess = React.lazy(
  () => import("../pages/Reservations/PaymentSuccess")
);
const PaymentFail = React.lazy(() => import("../pages/Reservations/PaymentFail"));
const Login = React.lazy(() => import("../pages/Auth/Login/Login"));
const Signup = React.lazy(() => import("../pages/Auth/Signup/Signup"));
const NotFound = React.lazy(() => import("../pages/NotFound/NotFound"));

export type AppRouteLayout = "main" | "bare";

export interface AppRouteConfig {
  path: string;
  component: React.LazyExoticComponent<React.ComponentType>;
  requiresAuth: boolean;
  layout: AppRouteLayout;
}
```

Keep the existing `appRoutes` array.

- [ ] **Step 4: Add Suspense boundary in Router**

Update `src/routes/Router.tsx`:

```tsx
import { Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts";
import { LoadingState } from "../shared/ui";
import RequireAuth from "./RequireAuth";
import { AppRouteConfig, appRoutes } from "./routeConfig";

const routeFallback = <LoadingState title="페이지를 불러오는 중..." />;

const renderRouteElement = ({ component: Page, requiresAuth }: AppRouteConfig) => {
  const pageElement = (
    <Suspense fallback={routeFallback}>
      <Page />
    </Suspense>
  );

  if (!requiresAuth) {
    return pageElement;
  }

  return <RequireAuth>{pageElement}</RequireAuth>;
};
```

- [ ] **Step 5: Adjust tests for Suspense/lazy**

In `src/App.test.tsx`, mock `LoadingState` and assert route elements render fallback instead of immediately resolving page components:

```ts
jest.mock("./shared/ui", () => ({
  LoadingState: ({ title }: { title: string }) => (
    <div data-testid="route-loading">{title}</div>
  ),
}));
```

Replace per-page assertions with:

```ts
routeMappings.forEach(({ path }) => {
  const route = screen.getByTestId(`route-${path}`);

  expect(route).toHaveTextContent(path);
  expect(within(route).getByTestId("route-loading")).toHaveTextContent(
    "페이지를 불러오는 중..."
  );
});
```

- [ ] **Step 6: Run routing tests**

Run:

```bash
npm test -- --watchAll=false src/routes/routeConfig.test.tsx src/App.test.tsx src/routes/RequireAuth.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/routeConfig.tsx src/routes/Router.tsx src/routes/routeConfig.test.tsx src/App.test.tsx
git commit -m "refactor: lazy load route pages"
```

---

### Task 6: Full Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run verify
```

Expected:
- `tsc --noEmit`: PASS
- `react-scripts test --watchAll=false --no-cache`: PASS
- `react-scripts build`: PASS
- No ESLint warnings from the files cleaned in Task 3.

- [ ] **Step 2: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended committed changes or plan files remain.

- [ ] **Step 3: Summarize follow-up architecture work**

Report:
- Payment SDK ownership now lives under `features/reservations/lib`.
- Protected route return location is preserved.
- Route pages are lazy loaded.
- Build warnings/debug client log are removed.
- Remaining structural follow-ups: page/widget decomposition for `AccommodationDetail`, `Wishlist`, and imperative `Map` bridge isolation.

---

## Self-Review

**Spec coverage:** This plan addresses the audit blockers that should happen before design: SDK ownership, route/auth boundary, build warnings, API debug logging, and route-level bundle splitting. It intentionally does not start Airbnb visual redesign.

**Placeholder scan:** The plan has no TBD/TODO placeholders and every code-changing step includes exact target files and concrete code snippets.

**Type consistency:** `TossPaymentsClient`, `getTossPaymentsClient`, `ensureTossPaymentsScript`, `shouldSilentlyResetPayment`, and `toReservationPaymentError` are defined before use and referenced consistently in later tasks.
