# Airbob Pre-Design Architecture Implementation Plan (한국어)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 `DESIGN.md`를 적용하기 전에 Airbob 프론트엔드의 테스트 기준선, 라우트/query 계약, API 응답 처리, 인증 경계, 디자인 토큰 기반을 먼저 안정화한다.

**Architecture:** 현재 CRA/React 구조와 기존 URL, 백엔드 API 계약, 사용자 플로우는 유지한다. 큰 페이지를 바로 쪼개거나 시각 디자인을 바꾸기 전에 `routes/paths`, `api/response`, 인증 가드, CSS 토큰처럼 영향 범위가 작고 검증 가능한 기반 모듈을 먼저 추가한다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, CSS Modules, Jest/React Testing Library.

---

## 현재 제약

- 백엔드, API, DB, 서버 로직은 수정하지 않는다.
- `https://getdesign.md/airbnb/design-md`의 Airbnb `DESIGN.md`는 아직 적용하지 않는다.
- 기존 URL 형태를 유지한다.
  - `/search`
  - `/accommodations/:id`
  - `/accommodations/:id/confirm`
  - `/accommodations/:id/edit?mode=create`
  - `/wishlist`
  - `/profile?mode=guest|host&tab=...`
  - `/reservations/:reservationUid`
  - `/reservations/:reservationUid/success`
  - `/reservations/:reservationUid/fail`
- 현재 페이지들이 쓰는 query key 이름은 바꾸지 않는다.
- 이 계획의 모든 작업은 기본적으로 동작 보존 리팩토링이다. 단, 이미 깨져 있는 테스트/툴링 기준선을 복구하는 작업은 예외다.

## 파일 구조

새로 만들 파일:

- `src/routes/paths.ts`: 라우트 경로 상수와 URL builder.
- `src/routes/paths.test.ts`: 라우트 builder 단위 테스트.
- `src/routes/RequireAuth.tsx`: 공통 보호 라우트 wrapper.
- `src/api/response.ts`: `ApiResponse<T>` unwrap 및 표준 API error helper.
- `src/api/response.test.ts`: API unwrap 단위 테스트.
- `src/styles/tokens.css`: 현재 반복되는 Airbnb-like 스타일 값을 CSS 변수로 이름 붙이는 토큰 파일.

수정할 파일:

- `package.json`: `typecheck`, `test:ci`, `verify` script 추가.
- `src/App.test.tsx`: CRA 기본 테스트 제거, Router smoke test로 교체.
- `src/routes/Router.tsx`: `ROUTE_PATHS`와 `RequireAuth` 사용.
- `src/index.css`: token CSS import.
- `src/contexts/AuthContext.tsx`: `client.get('/auth/me')` 직접 호출 대신 `authApi.getMe()` 사용.
- `src/api/*.ts`: `response.data.data!` 직접 접근을 `unwrapApiResponse`로 점진 교체.
- 저위험 navigation call site: 문자열 보간 대신 `routeTo` builder 사용.

이번 계획에서는 `Search`, `AccommodationDetail`, `AccommodationEdit`, `Map` 같은 큰 파일을 이동하거나 분해하지 않는다. 이 파일들은 고위험 영역이므로 기반 작업 검증 후 별도 계획에서 다룬다.

---

### Task 1: 검증 기준선 복구

**Files:**
- Modify: `package.json`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: package script 추가**

`package.json`의 `scripts` 객체를 아래 내용으로 교체한다.

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

- [ ] **Step 2: 오래된 CRA 테스트 교체**

`src/App.test.tsx`를 아래 내용으로 교체한다.

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

- [ ] **Step 3: 기준선 검증**

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

### Task 2: 라우트 경로와 URL builder 중앙화

**Files:**
- Create: `src/routes/paths.ts`
- Create: `src/routes/paths.test.ts`
- Modify: `src/routes/Router.tsx`

- [ ] **Step 1: route builder 테스트 작성**

`src/routes/paths.test.ts`를 만든다.

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

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/routes/paths.test.ts
```

Expected:

```text
Cannot find module './paths'
```

- [ ] **Step 3: route path 계약 추가**

`src/routes/paths.ts`를 만든다.

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

- [ ] **Step 4: Router가 상수를 사용하게 변경**

`src/routes/Router.tsx`를 아래 내용으로 교체한다.

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

- [ ] **Step 5: 검증**

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
git add src/routes/Router.tsx src/routes/paths.ts src/routes/paths.test.ts
git commit -m "refactor: centralize route path contracts"
```

---

### Task 3: 저위험 navigation 문자열을 route builder로 교체

**Files:**
- Modify: `src/pages/Profile/GuestTrips/GuestTrips.tsx`
- Modify: `src/pages/Profile/HostReservations/HostReservations.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentFail.tsx`

- [ ] **Step 1: GuestTrips navigation 변경**

`src/pages/Profile/GuestTrips/GuestTrips.tsx`에 import를 추가한다.

```ts
import { routeTo } from "../../../routes/paths";
```

아래 코드를:

```tsx
onClick={() => navigate(`/reservations/${reservation.reservation_uid}`)}
```

아래처럼 바꾼다.

```tsx
onClick={() => navigate(routeTo.reservationDetail(reservation.reservation_uid))}
```

- [ ] **Step 2: HostReservations navigation 변경**

`src/pages/Profile/HostReservations/HostReservations.tsx`에 import를 추가한다.

```ts
import { routeTo } from "../../../routes/paths";
```

아래 형태의 직접 문자열 navigation을:

```tsx
navigate(`/profile/host/reservations/${reservation.reservation_uid}`)
```

아래처럼 바꾼다.

```tsx
navigate(routeTo.hostReservationDetail(reservation.reservation_uid))
```

- [ ] **Step 3: PaymentFail render 중 navigate 제거**

`src/pages/Reservations/PaymentFail.tsx`의 React import를 바꾼다.

```tsx
import React, { useEffect } from "react";
```

route builder import를 추가한다.

```ts
import { routeTo } from "../../routes/paths";
```

아래 코드를:

```tsx
if (!isAuthenticated) {
  navigate("/");
  return null;
}
```

아래처럼 바꾼다.

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

버튼 navigation도 바꾼다.

```tsx
onClick={() => navigate(routeTo.profile())}
```

```tsx
onClick={() => navigate(routeTo.reservationDetail(reservationUid))}
```

- [ ] **Step 4: PaymentSuccess navigation 변경**

`src/pages/Reservations/PaymentSuccess.tsx`에 import를 추가한다.

```ts
import { routeTo } from "../../routes/paths";
```

`navigate("/")`는 아래로 바꾼다.

```tsx
navigate(routeTo.home(), { replace: true });
```

`navigate("/profile")`는 아래로 바꾼다.

```tsx
navigate(routeTo.profile(), { replace: true });
```

`navigate(`/reservations/${reservationUid}`)`는 모두 아래로 바꾼다.

```tsx
navigate(routeTo.reservationDetail(reservationUid), { replace: true });
```

- [ ] **Step 5: 검증**

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
git add src/pages/Profile/GuestTrips/GuestTrips.tsx src/pages/Profile/HostReservations/HostReservations.tsx src/pages/Reservations/PaymentFail.tsx src/pages/Reservations/PaymentSuccess.tsx
git commit -m "refactor: use route builders in low-risk navigation"
```

---

### Task 4: API 응답 unwrap 계약 추가

**Files:**
- Create: `src/api/response.ts`
- Create: `src/api/response.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/api/response.test.ts`를 만든다.

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

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/api/response.test.ts
```

Expected:

```text
Cannot find module './response'
```

- [ ] **Step 3: unwrap helper 구현**

`src/api/response.ts`를 만든다.

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

- [ ] **Step 4: 검증**

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
git add src/api/response.ts src/api/response.test.ts
git commit -m "feat: add typed API response unwrap helper"
```

---

### Task 5: 주요 API 모듈을 `unwrapApiResponse`로 전환

**Files:**
- Modify: `src/api/accommodations.ts`
- Modify: `src/api/reservations.ts`
- Modify: `src/api/payments.ts`
- Modify: `src/api/reviews.ts`
- Modify: `src/api/wishlist.ts`
- Modify: `src/api/recentlyViewed.ts`
- Modify: `src/api/coupons.ts`
- Modify: `src/api/commonCodes.ts`

- [ ] **Step 1: import 추가**

위 파일들에 아래 import를 추가한다.

```ts
import { unwrapApiResponse } from "./response";
```

일반적인 import 순서는 아래처럼 둔다.

```ts
import { client } from "./client";
import { unwrapApiResponse } from "./response";
```

- [ ] **Step 2: 데이터 반환 패턴 교체**

아래 코드를:

```ts
return response.data.data!;
```

아래처럼 바꾼다.

```ts
return unwrapApiResponse(response.data);
```

- [ ] **Step 3: mutation endpoint null 처리**

`Promise<void>`를 반환하고 `ApiResponse<null>`을 받는 endpoint는 아래 패턴을 사용한다.

```ts
const response = await client.patch<ApiResponse<null>>(url, data);
unwrapApiResponse(response.data, { allowNull: true });
```

`post`, `patch`, `delete` 모두 같은 방식으로 적용한다.

- [ ] **Step 4: 강제 unwrap 잔여 확인**

Run:

```bash
rg -n "response\\.data\\.data!" src/api
```

Expected:

```text
No matches in migrated files
```

`src/api/auth.ts`의 login/signup custom handling은 Task 6에서 따로 다룬다.

- [ ] **Step 5: 검증**

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

### Task 6: AuthContext를 API 경계에 맞추기

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/api/auth.ts`

- [ ] **Step 1: `authApi.getMe`에 unwrap 적용**

`src/api/auth.ts`에 import를 추가한다.

```ts
import { unwrapApiResponse } from "./response";
```

`getMe`를 아래처럼 교체한다.

```ts
  // 내 정보 조회
  getMe: async (): Promise<MeInfo> => {
    const response = await client.get<ApiResponse<MeInfo>>("/auth/me");
    return unwrapApiResponse(response.data);
  },
```

- [ ] **Step 2: AuthContext에서 client 직접 호출 제거**

`src/contexts/AuthContext.tsx`에서 아래 import를 제거한다.

```ts
import { client } from "../api/client";
```

`checkAuth` 본문을 아래처럼 바꾼다.

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

- [ ] **Step 3: 검증**

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

### Task 7: 공통 보호 라우트 wrapper 추가

**Files:**
- Create: `src/routes/RequireAuth.tsx`
- Modify: `src/routes/Router.tsx`

- [ ] **Step 1: route guard 컴포넌트 추가**

`src/routes/RequireAuth.tsx`를 만든다.

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

- [ ] **Step 2: 보호 route 감싸기**

`src/routes/Router.tsx`에 import를 추가한다.

```ts
import { RequireAuth } from "./RequireAuth";
```

아래 route들은 `RequireAuth`로 감싼다.

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

아래 public route들은 감싸지 않는다.

```text
Home
Search
AccommodationDetail
ReservationConfirm
Login
Signup
NotFound
```

- [ ] **Step 3: 중복 인증 체크 제거는 다음 단계로 미루기**

`Profile`, `AccommodationEdit`, `ReservationDetail`, payment pages 내부의 기존 인증 체크는 이 commit에서 제거하지 않는다. 먼저 route guard가 기존 동작을 보존하는지 확인한다.

- [ ] **Step 4: 검증**

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

### Task 8: 디자인 적용 전 token scaffold 추가

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/index.css`

- [ ] **Step 1: 현재 값 기반 token 추가**

`src/styles/tokens.css`를 만든다.

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

- [ ] **Step 2: 전역 CSS에서 token import**

`src/index.css` 맨 위에 추가한다.

```css
@import "./styles/tokens.css";
```

`body`의 `font-family`를 아래처럼 바꾼다.

```css
  font-family: var(--font-family-base);
```

`src/index.css` 상단은 아래 형태가 된다.

```css
@import "./styles/tokens.css";

body {
  margin: 0;
  font-family: var(--font-family-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 3: CSS 전체 치환은 하지 않기**

이 task에서는 `#222222`, `#717171`, `#ff385c` 등을 전체 치환하지 않는다. 이번 단계는 나중의 디자인 시스템 적용을 위한 안정적인 토큰 목표를 만드는 것이다.

- [ ] **Step 4: 검증**

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

### Task 9: 디자인 리팩토링 전 브라우저 smoke QA

**Files:**
- 회귀가 발견되지 않으면 source file 변경 없음.

- [ ] **Step 1: 앱 실행**

Run:

```bash
npm start
```

Expected:

```text
Local: http://localhost:3000
```

- [ ] **Step 2: public flow 확인**

브라우저에서 연다.

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

- [ ] **Step 3: protected flow redirect 확인**

로그아웃 상태에서 연다.

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

- [ ] **Step 4: URL 계약 확인**

아래 URL을 직접 열어본다.

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

- [ ] **Step 5: dev server 종료**

`npm start`가 실행 중인 터미널에서 `Ctrl+C`.

- [ ] **Step 6: QA 수정이 있었을 때만 commit**

브라우저 smoke 중 회귀를 발견해 수정했다면:

```bash
git add <changed-files>
git commit -m "fix: preserve route behavior after architecture foundation"
```

수정이 없었다면:

```bash
git status --short
```

Expected:

```text
No output
```

---

## 이 계획 이후

이 계획이 완료되고 검증된 뒤에만 Airbnb `DESIGN.md`를 설치하고 적용한다.

```bash
npx getdesign@latest add airbnb
```

그 다음 별도의 디자인 시스템 계획을 만든다. 다음 계획의 첫 작업 순서는 아래가 적절하다.

1. 생성된 `DESIGN.md` 읽기.
2. `DESIGN.md`의 token을 `src/styles/tokens.css`에 매핑.
3. primitive UI component 생성 또는 보강.
4. 저위험 화면부터 적용: auth pages, 단순 modal, card.
5. 고위험 화면은 마지막에 적용: search/map, accommodation detail booking panel, reservation/payment, accommodation edit.

## Self-Review

- 요구사항 커버리지: 테스트, 라우팅, query-safe route builder, API 응답 경계, 인증 가드, 디자인 토큰 scaffold를 다룬다.
- Placeholder scan: 미완성 placeholder 표현이나 불명확한 테스트 지시는 없다.
- 타입 일관성: `ROUTE_PATHS`, `routeTo`, `unwrapApiResponse`, `ApiClientError`, `RequireAuth`는 뒤 task에서 참조되기 전에 먼저 정의된다.
- 범위 통제: 큰 페이지 분해와 Airbnb 시각 스타일 적용은 이후 계획으로 명확히 미룬다.
