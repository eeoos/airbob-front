# Airbob Pre-Design Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the Airbob frontend for an Airbnb-inspired `DESIGN.md` pass by first stabilizing tests, route/query contracts, API response handling, auth boundaries, and design-token scaffolding.

**Architecture:** Keep the current CRA/React app and preserve all existing URLs, backend contracts, and user flows. Introduce small foundation modules (`routes/paths`, `api/response`, auth route guard, token CSS) before splitting large pages or applying visual redesign.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, CSS Modules, Jest/React Testing Library.

---

## Current Constraints

- Do not modify backend/API/DB/server behavior.
- Do not apply `https://getdesign.md/airbnb/design-md` yet. This plan creates the foundation needed before that visual pass.
- Preserve route shapes:
  - `/search`
  - `/accommodations/:id`
  - `/accommodations/:id/confirm`
  - `/accommodations/:id/edit?mode=create`
  - `/wishlist`
  - `/profile?mode=guest|host&tab=...`
  - `/reservations/:reservationUid`
  - `/reservations/:reservationUid/success`
  - `/reservations/:reservationUid/fail`
- Preserve query key names currently used by pages. The first refactor may centralize parsing, but must not rename keys.
- Keep every task behavior-preserving unless the task explicitly fixes a broken test/tooling baseline.

## File Structure

Create these files:

- `src/routes/paths.ts`: canonical route path constants and URL builders.
- `src/routes/paths.test.ts`: unit tests for route builders.
- `src/routes/RequireAuth.tsx`: shared protected route wrapper using existing auth state.
- `src/api/response.ts`: `ApiResponse<T>` unwrap and normalized API error helpers.
- `src/api/response.test.ts`: unit tests for API response unwrap behavior.
- `src/styles/tokens.css`: current Airbob/Airbnb-like repeated values expressed as CSS variables.

Modify these files:

- `package.json`: add `typecheck`, `test:ci`, and `verify` scripts.
- `src/App.test.tsx`: replace stale CRA default test with router smoke test.
- `src/routes/Router.tsx`: use `ROUTE_PATHS` and `RequireAuth`.
- `src/index.css`: import tokens before global base styles.
- `src/contexts/AuthContext.tsx`: use `authApi.getMe()` instead of bypassing the API layer.
- `src/api/*.ts`: incrementally replace direct `response.data.data!` access with `unwrapApiResponse`.
- Low-risk navigation call sites: replace direct string interpolation with `routeTo` builders.

Do not move large pages (`Search`, `AccommodationDetail`, `AccommodationEdit`, `Map`) in this plan. They are high-risk and should be split only after this foundation passes verification.

---

### Task 1: Restore Verification Baseline

**Files:**
- Modify: `package.json`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update package scripts**

In `package.json`, replace the existing `scripts` object with:

```json
"scripts": {
  "start": "react-scripts start",
  "build": "react-scripts build",
  "test": "react-scripts test",
  "test:ci": "react-scripts test --watchAll=false",
  "typecheck": "tsc --noEmit",
  "verify": "npm run typecheck && npm run test:ci",
  "eject": "react-scripts eject"
}
```

- [ ] **Step 2: Replace the stale CRA test**

Replace `src/App.test.tsx` with:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock(
  "react-router-dom",
  () => ({
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="browser-router">{children}</div>
    ),
    Routes: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="routes">{children}</div>
    ),
    Route: ({ path }: { path: string; element: React.ReactNode }) => (
      <div data-testid={`route-${path}`}>{path}</div>
    ),
    useNavigate: () => jest.fn(),
    useLocation: () => ({
      pathname: "/",
      search: "",
      hash: "",
      state: null,
      key: "test",
    }),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useParams: () => ({}),
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  }),
  { virtual: true }
);

test("renders the configured application routes", () => {
  render(<App />);

  expect(screen.getByTestId("browser-router")).toBeInTheDocument();
  expect(screen.getByTestId("route-/")).toHaveTextContent("/");
  expect(screen.getByTestId("route-/search")).toHaveTextContent("/search");
  expect(screen.getByTestId("route-/accommodations/:id")).toHaveTextContent(
    "/accommodations/:id"
  );
  expect(screen.getByTestId("route-*")).toHaveTextContent("*");
});
```

- [ ] **Step 3: Verify the baseline**

Run:

```bash
npm run typecheck
npm run test:ci -- --no-cache
```

Expected:

```text
npm run typecheck exits 0
npm run test:ci exits 0
```

- [ ] **Step 4: Commit**

```bash
git add package.json src/App.test.tsx
git commit -m "test: restore frontend verification baseline"
```

---

### Task 2: Centralize Route Paths and URL Builders

**Files:**
- Create: `src/routes/paths.ts`
- Create: `src/routes/paths.test.ts`
- Modify: `src/routes/Router.tsx`

- [ ] **Step 1: Write route builder tests**

Create `src/routes/paths.test.ts`:

```ts
import { ROUTE_PATHS, routeTo } from "./paths";

describe("route path contracts", () => {
  it("keeps existing router path shapes", () => {
    expect(ROUTE_PATHS.home).toBe("/");
    expect(ROUTE_PATHS.search).toBe("/search");
    expect(ROUTE_PATHS.accommodationDetail).toBe("/accommodations/:id");
    expect(ROUTE_PATHS.accommodationConfirm).toBe("/accommodations/:id/confirm");
    expect(ROUTE_PATHS.accommodationEdit).toBe("/accommodations/:id/edit");
    expect(ROUTE_PATHS.profile).toBe("/profile");
    expect(ROUTE_PATHS.reservationDetail).toBe("/reservations/:reservationUid");
    expect(ROUTE_PATHS.paymentSuccess).toBe("/reservations/:reservationUid/success");
    expect(ROUTE_PATHS.paymentFail).toBe("/reservations/:reservationUid/fail");
  });

  it("builds dynamic routes without changing URL contracts", () => {
    expect(routeTo.accommodationDetail(12)).toBe("/accommodations/12");
    expect(routeTo.accommodationEdit(12, { mode: "create" })).toBe(
      "/accommodations/12/edit?mode=create"
    );
    expect(routeTo.reservationDetail("rsv_123")).toBe("/reservations/rsv_123");
    expect(routeTo.profile({ mode: "host", tab: "listings-published" })).toBe(
      "/profile?mode=host&tab=listings-published"
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm run test:ci -- --runTestsByPath src/routes/paths.test.ts
```

Expected:

```text
Cannot find module './paths'
```

- [ ] **Step 3: Add route path contracts**

Create `src/routes/paths.ts`:

```ts
export const ROUTE_PATHS = {
  home: "/",
  search: "/search",
  accommodationDetail: "/accommodations/:id",
  accommodationConfirm: "/accommodations/:id/confirm",
  accommodationEdit: "/accommodations/:id/edit",
  wishlist: "/wishlist",
  profile: "/profile",
  hostReservationDetail: "/profile/host/reservations/:reservationUid",
  reservationDetail: "/reservations/:reservationUid",
  reviewCreate: "/reservations/:reservationUid/review",
  paymentSuccess: "/reservations/:reservationUid/success",
  paymentFail: "/reservations/:reservationUid/fail",
  login: "/login",
  signup: "/signup",
  notFound: "*",
} as const;

type ProfileMode = "guest" | "host";

const withQuery = (path: string, entries: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();

  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

export const routeTo = {
  home: () => ROUTE_PATHS.home,
  search: (query?: URLSearchParams | string) => {
    if (!query) return ROUTE_PATHS.search;
    const queryString = typeof query === "string" ? query : query.toString();
    return queryString ? `${ROUTE_PATHS.search}?${queryString}` : ROUTE_PATHS.search;
  },
  accommodationDetail: (id: string | number) => `/accommodations/${id}`,
  accommodationConfirm: (id: string | number, query?: URLSearchParams | string) => {
    const queryString = query ? (typeof query === "string" ? query : query.toString()) : "";
    return queryString
      ? `/accommodations/${id}/confirm?${queryString}`
      : `/accommodations/${id}/confirm`;
  },
  accommodationEdit: (id: string | number, query?: { mode?: "create" }) =>
    withQuery(`/accommodations/${id}/edit`, { mode: query?.mode }),
  wishlist: (query?: { id?: string | number; view?: string }) =>
    withQuery(ROUTE_PATHS.wishlist, {
      id: query?.id,
      view: query?.view,
    }),
  profile: (query?: { mode?: ProfileMode; tab?: string }) =>
    withQuery(ROUTE_PATHS.profile, {
      mode: query?.mode,
      tab: query?.tab,
    }),
  hostReservationDetail: (reservationUid: string) =>
    `/profile/host/reservations/${reservationUid}`,
  reservationDetail: (reservationUid: string) => `/reservations/${reservationUid}`,
  reviewCreate: (reservationUid: string) => `/reservations/${reservationUid}/review`,
  paymentSuccess: (reservationUid: string) => `/reservations/${reservationUid}/success`,
  paymentFail: (reservationUid: string) => `/reservations/${reservationUid}/fail`,
  login: () => ROUTE_PATHS.login,
  signup: () => ROUTE_PATHS.signup,
};
```

- [ ] **Step 4: Update the router to use constants**

Replace `src/routes/Router.tsx` with:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home/Home";
import Search from "../pages/Search/Search";
import AccommodationDetail from "../pages/AccommodationDetail/AccommodationDetail";
import AccommodationEdit from "../pages/AccommodationEdit/AccommodationEdit";
import Wishlist from "../pages/Wishlist/Wishlist";
import Profile from "../pages/Profile/Profile";
import ReservationDetail from "../pages/Reservations/ReservationDetail";
import HostReservationDetail from "../pages/Profile/HostReservationDetail/HostReservationDetail";
import ReservationConfirm from "../pages/Reservations/ReservationConfirm";
import ReviewCreate from "../pages/Reservations/ReviewCreate";
import PaymentSuccess from "../pages/Reservations/PaymentSuccess";
import PaymentFail from "../pages/Reservations/PaymentFail";
import Login from "../pages/Auth/Login/Login";
import Signup from "../pages/Auth/Signup/Signup";
import NotFound from "../pages/NotFound/NotFound";
import { ROUTE_PATHS } from "./paths";

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTE_PATHS.home} element={<Home />} />
        <Route path={ROUTE_PATHS.search} element={<Search />} />
        <Route path={ROUTE_PATHS.accommodationDetail} element={<AccommodationDetail />} />
        <Route path={ROUTE_PATHS.accommodationConfirm} element={<ReservationConfirm />} />
        <Route path={ROUTE_PATHS.accommodationEdit} element={<AccommodationEdit />} />
        <Route path={ROUTE_PATHS.wishlist} element={<Wishlist />} />
        <Route path={ROUTE_PATHS.profile} element={<Profile />} />
        <Route path={ROUTE_PATHS.hostReservationDetail} element={<HostReservationDetail />} />
        <Route path={ROUTE_PATHS.reservationDetail} element={<ReservationDetail />} />
        <Route path={ROUTE_PATHS.reviewCreate} element={<ReviewCreate />} />
        <Route path={ROUTE_PATHS.paymentSuccess} element={<PaymentSuccess />} />
        <Route path={ROUTE_PATHS.paymentFail} element={<PaymentFail />} />
        <Route path={ROUTE_PATHS.login} element={<Login />} />
        <Route path={ROUTE_PATHS.signup} element={<Signup />} />
        <Route path={ROUTE_PATHS.notFound} element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
```

- [ ] **Step 5: Verify**

Run:

```bash
npm run verify -- --no-cache
```

Expected:

```text
typecheck passes
App.test.tsx passes
paths.test.ts passes
codes.test.ts passes
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/Router.tsx src/routes/paths.ts src/routes/paths.test.ts
git commit -m "refactor: centralize route path contracts"
```

---

### Task 3: Replace Low-Risk Navigation Strings With Route Builders

**Files:**
- Modify: `src/pages/Profile/GuestTrips/GuestTrips.tsx`
- Modify: `src/pages/Profile/HostReservations/HostReservations.tsx`
- Modify: `src/pages/Profile/Profile.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentFail.tsx`

- [ ] **Step 1: Update guest trip navigation**

In `src/pages/Profile/GuestTrips/GuestTrips.tsx`, add this import:

```ts
import { routeTo } from "../../../routes/paths";
```

Replace:

```tsx
onClick={() => navigate(`/reservations/${reservation.reservation_uid}`)}
```

with:

```tsx
onClick={() => navigate(routeTo.reservationDetail(reservation.reservation_uid))}
```

- [ ] **Step 2: Update host reservation navigation**

In `src/pages/Profile/HostReservations/HostReservations.tsx`, add this import:

```ts
import { routeTo } from "../../../routes/paths";
```

Replace direct navigation to host reservation detail:

```tsx
navigate(`/profile/host/reservations/${reservation.reservation_uid}`)
```

with:

```tsx
navigate(routeTo.hostReservationDetail(reservation.reservation_uid))
```

- [ ] **Step 3: Update profile tab URL writes**

In `src/pages/Profile/Profile.tsx`, add this import:

```ts
import { routeTo } from "../../routes/paths";
```

For button handlers that currently call:

```tsx
setSearchParams({ mode: "guest", tab: "upcoming" }, { replace: true });
```

keep the existing `setSearchParams` call for now. Do not replace it with `navigate(routeTo.profile(...))` in this task, because `setSearchParams` preserves the current component state path. Use `routeTo.profile` only for future cross-page navigation.

- [ ] **Step 4: Fix render-time navigation in PaymentFail**

In `src/pages/Reservations/PaymentFail.tsx`, change the import:

```tsx
import React from "react";
```

to:

```tsx
import React, { useEffect } from "react";
```

Add:

```ts
import { routeTo } from "../../routes/paths";
```

Replace the unauthenticated branch:

```tsx
if (!isAuthenticated) {
  navigate("/");
  return null;
}
```

with:

```tsx
useEffect(() => {
  if (!isAuthLoading && !isAuthenticated) {
    navigate(routeTo.home(), { replace: true });
  }
}, [isAuthLoading, isAuthenticated, navigate]);

if (!isAuthenticated) {
  return null;
}
```

Replace:

```tsx
onClick={() => navigate("/profile")}
```

with:

```tsx
onClick={() => navigate(routeTo.profile())}
```

Replace:

```tsx
onClick={() => navigate(`/reservations/${reservationUid}`)}
```

with:

```tsx
onClick={() => navigate(routeTo.reservationDetail(reservationUid))}
```

- [ ] **Step 5: Update PaymentSuccess navigation**

In `src/pages/Reservations/PaymentSuccess.tsx`, add:

```ts
import { routeTo } from "../../routes/paths";
```

Replace:

```tsx
navigate("/");
```

with:

```tsx
navigate(routeTo.home(), { replace: true });
```

Replace:

```tsx
navigate("/profile");
```

with:

```tsx
navigate(routeTo.profile(), { replace: true });
```

Replace each:

```tsx
navigate(`/reservations/${reservationUid}`);
```

with:

```tsx
navigate(routeTo.reservationDetail(reservationUid), { replace: true });
```

- [ ] **Step 6: Verify**

Run:

```bash
npm run verify -- --no-cache
```

Expected:

```text
typecheck passes
all tests pass
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/Profile/GuestTrips/GuestTrips.tsx src/pages/Profile/HostReservations/HostReservations.tsx src/pages/Profile/Profile.tsx src/pages/Reservations/PaymentFail.tsx src/pages/Reservations/PaymentSuccess.tsx
git commit -m "refactor: use route builders in low-risk navigation"
```

---

### Task 4: Add API Response Unwrap Contract

**Files:**
- Create: `src/api/response.ts`
- Create: `src/api/response.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/api/response.test.ts`:

```ts
import { ApiResponse } from "../types/api";
import { ApiClientError, unwrapApiResponse } from "./response";

describe("unwrapApiResponse", () => {
  it("returns data for successful responses", () => {
    const response: ApiResponse<{ id: number }> = {
      success: true,
      data: { id: 1 },
      error: null,
    };

    expect(unwrapApiResponse(response)).toEqual({ id: 1 });
  });

  it("throws ApiClientError for backend error responses", () => {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: {
        message: "로그인이 필요합니다.",
        status: 401,
        code: "M004",
      },
    };

    expect(() => unwrapApiResponse(response)).toThrow(ApiClientError);
    expect(() => unwrapApiResponse(response)).toThrow("로그인이 필요합니다.");
  });

  it("throws a typed error when required data is null", () => {
    const response: ApiResponse<{ id: number }> = {
      success: true,
      data: null,
      error: null,
    };

    expect(() => unwrapApiResponse(response)).toThrow("응답 데이터가 비어 있습니다.");
  });

  it("allows null data for mutation endpoints when configured", () => {
    const response: ApiResponse<null> = {
      success: true,
      data: null,
      error: null,
    };

    expect(unwrapApiResponse(response, { allowNull: true })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm run test:ci -- --runTestsByPath src/api/response.test.ts
```

Expected:

```text
Cannot find module './response'
```

- [ ] **Step 3: Implement API unwrap helper**

Create `src/api/response.ts`:

```ts
import { ApiResponse, ErrorResponse } from "../types/api";

interface UnwrapOptions {
  allowNull?: boolean;
}

const fallbackError: ErrorResponse = {
  message: "요청 처리 중 오류가 발생했습니다.",
  status: 500,
  code: "UNKNOWN_API_ERROR",
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ErrorResponse["errors"];

  constructor(error: ErrorResponse) {
    super(error.message);
    this.name = "ApiClientError";
    this.status = error.status;
    this.code = error.code;
    this.errors = error.errors;
  }
}

export const unwrapApiResponse = <T>(
  response: ApiResponse<T>,
  options: UnwrapOptions = {}
): T => {
  if (!response.success) {
    throw new ApiClientError(response.error || fallbackError);
  }

  if (response.data === null && !options.allowNull) {
    throw new ApiClientError({
      message: "응답 데이터가 비어 있습니다.",
      status: 500,
      code: "EMPTY_API_DATA",
    });
  }

  return response.data as T;
};
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run verify -- --no-cache
```

Expected:

```text
typecheck passes
response.test.ts passes
existing tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/api/response.ts src/api/response.test.ts
git commit -m "feat: add typed API response unwrap helper"
```

---

### Task 5: Migrate High-Traffic API Modules to `unwrapApiResponse`

**Files:**
- Modify: `src/api/accommodations.ts`
- Modify: `src/api/reservations.ts`
- Modify: `src/api/payments.ts`
- Modify: `src/api/reviews.ts`
- Modify: `src/api/wishlist.ts`
- Modify: `src/api/recentlyViewed.ts`
- Modify: `src/api/coupons.ts`
- Modify: `src/api/commonCodes.ts`

- [ ] **Step 1: Add imports**

Add this import to each file listed above:

```ts
import { unwrapApiResponse } from "./response";
```

For files that already import only from sibling modules, keep import ordering as:

```ts
import { client } from "./client";
import { unwrapApiResponse } from "./response";
```

- [ ] **Step 2: Replace successful data returns**

In each file, replace:

```ts
return response.data.data!;
```

with:

```ts
return unwrapApiResponse(response.data);
```

- [ ] **Step 3: Replace mutation endpoint null handling**

For mutation endpoints typed as `ApiResponse<null>` and returning `Promise<void>`, replace:

```ts
await client.patch<ApiResponse<null>>(url, data);
```

or:

```ts
await client.delete<ApiResponse<null>>(url);
```

with this pattern:

```ts
const response = await client.patch<ApiResponse<null>>(url, data);
unwrapApiResponse(response.data, { allowNull: true });
```

Use the same pattern for `post`, `patch`, and `delete` mutation endpoints.

- [ ] **Step 4: Verify no forced data unwrap remains in migrated files**

Run:

```bash
rg -n "response\\.data\\.data!" src/api
```

Expected after this task:

```text
No matches in accommodations.ts, reservations.ts, payments.ts, reviews.ts, wishlist.ts, recentlyViewed.ts, coupons.ts, commonCodes.ts
```

If `src/api/auth.ts` still has custom login/signup handling, leave it for Task 6.

- [ ] **Step 5: Verify**

Run:

```bash
npm run verify -- --no-cache
```

Expected:

```text
typecheck passes
all tests pass
```

- [ ] **Step 6: Commit**

```bash
git add src/api/accommodations.ts src/api/reservations.ts src/api/payments.ts src/api/reviews.ts src/api/wishlist.ts src/api/recentlyViewed.ts src/api/coupons.ts src/api/commonCodes.ts
git commit -m "refactor: unwrap API responses consistently"
```

---

### Task 6: Align AuthContext With the API Boundary

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/api/auth.ts`

- [ ] **Step 1: Update auth API `getMe`**

In `src/api/auth.ts`, add:

```ts
import { unwrapApiResponse } from "./response";
```

Replace `getMe` with:

```ts
  // 내 정보 조회
  getMe: async (): Promise<MeInfo> => {
    const response = await client.get<ApiResponse<MeInfo>>("/auth/me");
    return unwrapApiResponse(response.data);
  },
```

- [ ] **Step 2: Stop AuthContext from bypassing authApi**

In `src/contexts/AuthContext.tsx`, remove:

```ts
import { client } from "../api/client";
```

Replace the body of `checkAuth` with:

```ts
  const checkAuth = useCallback(async () => {
    try {
      await authApi.getMe();
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run verify -- --no-cache
```

Expected:

```text
typecheck passes
all tests pass
```

- [ ] **Step 4: Commit**

```bash
git add src/api/auth.ts src/contexts/AuthContext.tsx
git commit -m "refactor: align auth checks with API boundary"
```

---

### Task 7: Introduce Shared Protected Route Wrapper

**Files:**
- Create: `src/routes/RequireAuth.tsx`
- Modify: `src/routes/Router.tsx`

- [ ] **Step 1: Add route guard component**

Create `src/routes/RequireAuth.tsx`:

```tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { routeTo } from "./paths";

interface RequireAuthProps {
  children: React.ReactElement;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={routeTo.home()} replace />;
  }

  return children;
};
```

- [ ] **Step 2: Wrap protected routes**

In `src/routes/Router.tsx`, add:

```ts
import { RequireAuth } from "./RequireAuth";
```

Wrap these route elements:

```tsx
<Route
  path={ROUTE_PATHS.wishlist}
  element={
    <RequireAuth>
      <Wishlist />
    </RequireAuth>
  }
/>
<Route
  path={ROUTE_PATHS.profile}
  element={
    <RequireAuth>
      <Profile />
    </RequireAuth>
  }
/>
<Route
  path={ROUTE_PATHS.hostReservationDetail}
  element={
    <RequireAuth>
      <HostReservationDetail />
    </RequireAuth>
  }
/>
<Route
  path={ROUTE_PATHS.reservationDetail}
  element={
    <RequireAuth>
      <ReservationDetail />
    </RequireAuth>
  }
/>
<Route
  path={ROUTE_PATHS.reviewCreate}
  element={
    <RequireAuth>
      <ReviewCreate />
    </RequireAuth>
  }
/>
<Route
  path={ROUTE_PATHS.paymentSuccess}
  element={
    <RequireAuth>
      <PaymentSuccess />
    </RequireAuth>
  }
/>
<Route
  path={ROUTE_PATHS.paymentFail}
  element={
    <RequireAuth>
      <PaymentFail />
    </RequireAuth>
  }
/>
<Route
  path={ROUTE_PATHS.accommodationEdit}
  element={
    <RequireAuth>
      <AccommodationEdit />
    </RequireAuth>
  }
/>
```

Leave public routes unwrapped:

```tsx
Home
Search
AccommodationDetail
ReservationConfirm
Login
Signup
NotFound
```

- [ ] **Step 3: Remove duplicate page-level redirects only after route guard works**

Do not remove duplicate auth checks in `Profile`, `AccommodationEdit`, `ReservationDetail`, or payment pages in the same commit. First verify route guard behavior. Remove page-level duplication in a later task after browser QA.

- [ ] **Step 4: Verify**

Run:

```bash
npm run verify -- --no-cache
```

Expected:

```text
typecheck passes
all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/RequireAuth.tsx src/routes/Router.tsx
git commit -m "refactor: add shared protected route wrapper"
```

---

### Task 8: Add Pre-Design Token Scaffold

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/index.css`

- [ ] **Step 1: Add current-value design tokens**

Create `src/styles/tokens.css`:

```css
:root {
  --color-text-primary: #222222;
  --color-text-secondary: #717171;
  --color-text-inverse: #ffffff;
  --color-background-page: #ffffff;
  --color-background-muted: #f7f7f7;
  --color-border-default: #dddddd;
  --color-border-subtle: #ebebeb;
  --color-border-strong: #b0b0b0;
  --color-brand-coral: #ff385c;
  --color-brand-coral-hover: #e61e4d;
  --color-success: #00a699;
  --color-danger: #c13515;

  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
    "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
    "Helvetica Neue", sans-serif;

  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 22px;
  --font-size-2xl: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 999px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 2px 16px rgba(0, 0, 0, 0.18);
  --shadow-lg: 0 4px 24px rgba(0, 0, 0, 0.15);

  --z-header: 1000;
  --z-dropdown: 10000;
  --z-modal: 99999;
  --z-toast: 100000;

  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
  --breakpoint-wide: 1400px;
}
```

- [ ] **Step 2: Import tokens globally**

At the top of `src/index.css`, add:

```css
@import "./styles/tokens.css";
```

Then replace the body font-family with:

```css
  font-family: var(--font-family-base);
```

The complete top of `src/index.css` should be:

```css
@import "./styles/tokens.css";

body {
  margin: 0;
  font-family: var(--font-family-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 3: Do not mass-replace CSS yet**

Do not replace all `#222222`, `#717171`, or `#ff385c` occurrences in this task. This scaffold is only to create a stable target for the later design-system pass.

- [ ] **Step 4: Verify**

Run:

```bash
npm run typecheck
npm run test:ci -- --no-cache
```

Expected:

```text
typecheck passes
all tests pass
```

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/index.css
git commit -m "style: add pre-design token scaffold"
```

---

### Task 9: Browser Smoke QA Before Design Refactor

**Files:**
- No source files unless a regression is found.

- [ ] **Step 1: Start the app**

Run:

```bash
npm start
```

Expected:

```text
Local: http://localhost:3000
```

- [ ] **Step 2: Smoke test public flows**

Open:

```text
http://localhost:3000/
http://localhost:3000/search
http://localhost:3000/accommodations/1
```

Expected:

```text
Home renders.
Search page renders without React crash.
Accommodation detail either renders data or a controlled API error/loading state.
```

- [ ] **Step 3: Smoke test protected flow redirects**

Open while logged out:

```text
http://localhost:3000/profile
http://localhost:3000/wishlist
http://localhost:3000/reservations/test-reservation
```

Expected:

```text
Each protected route redirects to / or renders null during redirect.
No "Cannot update a component while rendering a different component" warning appears.
```

- [ ] **Step 4: Smoke test route builder URLs**

From any page, navigate manually to:

```text
http://localhost:3000/profile?mode=host&tab=listings-published
http://localhost:3000/accommodations/1/edit?mode=create
http://localhost:3000/reservations/test-reservation/fail
```

Expected:

```text
Existing URL shapes still match Router paths.
Protected pages redirect when logged out.
No blank white screen.
```

- [ ] **Step 5: Stop the dev server**

Use `Ctrl+C` in the terminal running `npm start`.

- [ ] **Step 6: Commit only if QA fixes were needed**

If browser smoke revealed and fixed a regression:

```bash
git add <changed-files>
git commit -m "fix: preserve route behavior after architecture foundation"
```

If no files changed:

```bash
git status --short
```

Expected:

```text
No output
```

---

## After This Plan

Only after this plan is complete and verified should the Airbnb `DESIGN.md` be installed and applied:

```bash
npx getdesign@latest add airbnb
```

The next plan should be a separate design-system plan. Its first tasks should be:

1. Read the generated `DESIGN.md`.
2. Map `DESIGN.md` tokens to `src/styles/tokens.css`.
3. Create or update primitive UI components.
4. Apply primitives to low-risk screens first: auth pages, simple modals, cards.
5. Apply visual changes to high-risk screens last: search/map, accommodation detail booking panel, reservation/payment, accommodation edit.

## Self-Review

- Spec coverage: This plan covers the requested pre-design architecture foundation: tests, routing, query-safe route builders, API response boundary, auth guard, and token scaffold.
- Placeholder scan: No task uses unfinished placeholder language or unspecified test instructions.
- Type consistency: `ROUTE_PATHS`, `routeTo`, `unwrapApiResponse`, `ApiClientError`, and `RequireAuth` are defined before later tasks reference them.
- Scope control: Large page decomposition and Airbnb visual styling are explicitly deferred to later plans.
