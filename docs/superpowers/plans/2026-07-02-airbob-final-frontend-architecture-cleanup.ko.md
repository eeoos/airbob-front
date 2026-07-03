# Airbob Final Frontend Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every code-changing task. Steps use checkbox (`- [ ]`) syntax for tracking. Backend/API/DB/server code is read-only unless the user explicitly approves backend edits.

**Goal:** Airbnb `design.md` 적용 전에 Airbob 프론트엔드의 라우팅, 레이아웃, 인증, API 상태 경계, 공용 UI 기반을 전문적인 프론트 구조로 정리한다.

**Architecture:** 현재 CRA/React/TypeScript/CSS Modules 구조와 기존 URL/API 계약은 유지한다. `pages`는 라우트 화면 조립, `features/*`는 도메인 상태/API 조합, `shared/ui`는 도메인을 모르는 공용 UI, `routes`는 URL/auth/layout 정책을 담당하도록 경계를 고정한다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, CSS Modules, Jest/React Testing Library, gstack QA.

---

## 결론

바로 Airbnb 디자인 리팩토링으로 들어가지 않는다. 먼저 아래 구조 정리를 끝낸 뒤 디자인 시스템을 적용한다.

이번 계획의 완료 조건:

- 라우트별 `path`, `requiresAuth`, `layout` 정책이 한 곳에서 보인다.
- `MainLayout`은 라우터가 소유하고, 페이지가 직접 레이아웃 wrapper를 반복하지 않는다.
- 보호 페이지 내부의 중복 인증 redirect가 제거된다.
- 직접 문자열 navigation이 `routeTo`로 통일된다.
- page/component의 직접 API 호출이 주요 고위험 흐름부터 `features/*` hook/service로 이동한다.
- `shared/ui`가 Airbnb 스타일 적용을 받을 최소 primitive를 가진다.
- `verify`와 browser QA 기준이 디자인 리팩터를 막을 수 있을 정도로 현실화된다.

## 범위

포함:

- Router/Layout/Auth 구조 정리.
- route builder 적용 확대.
- 직접 API 호출 경계 정리.
- 대형 페이지 추가 분해를 위한 최소 구조 작업.
- 공용 UI primitive와 dialog/modal shell 기반 추가.
- 디자인 적용 전 검증 게이트 정리.

제외:

- Airbnb `design.md` 적용.
- UI library 도입.
- 전체 시각 디자인 변경.
- 백엔드/API/DB/server 코드 수정.
- API endpoint, request body, response shape 변경.

## 보호해야 할 기능/플로우

- Home/Header/SearchBar 검색 입력에서 `/search` query 생성.
- Search URL query, 검색 결과, 지도 bounds/list/page, wishlist heart 동기화.
- AccommodationDetail 날짜/게스트 query, 쿠폰, 예약 생성, 로그인 후 pending action.
- AccommodationEdit host 인증, 기존 숙소 로드, 이미지 업로드, 저장/게시.
- ReservationConfirm -> Toss 결제 -> PaymentSuccess confirm -> 예약 상세 이동.
- Profile guest/host tab, host listings, host reservation detail, infinite scroll.

## QA 전략

QA는 필요하다. 단, 모든 작은 리팩터마다 전체 브라우저 QA를 반복하지 않는다. 자동 테스트와 브라우저 QA를 단계별로 나눈다.

1. **매 Task 자동 검증**
   - 모든 Task 끝에서 `npm run typecheck`와 관련 Jest 테스트를 실행한다.
   - route, auth, API boundary, shared UI처럼 구조 계약이 바뀌는 Task는 해당 contract test를 먼저 실패시키고 통과시킨다.

2. **위험 Task 후 gstack browser smoke**
   - `Task N` 후: Home/Search/Detail/Profile이 layout 중복 없이 렌더링되는지 확인한다.
   - `Task O` 후: QA 계정 로그인/로그아웃 상태에서 보호 route redirect가 정상인지 확인한다.
   - `Task P` 후: Header/UserMenu/Search/Reservation navigation이 기존 URL로 이동하는지 확인한다.
   - `Task R` 후: Search wishlist, AccommodationEdit 저장/이미지, modal submit flow가 깨지지 않았는지 확인한다.

3. **전체 구조 정리 후 full smoke**
   - `Task U`에서 desktop 1280px, mobile 375px 기준 gstack QA를 실행한다.
   - 인증이 필요한 플로우는 사용자가 제공한 QA 계정을 사용한다.
   - QA 계정 비밀번호는 계획서나 repo 문서에 저장하지 않는다.

4. **최종 리뷰 후 compound 기록**
   - 모든 Task와 final review가 끝나면 `compound-engineering:ce-compound mode:headless`를 실행한다.
   - 기록 대상은 실행-검토 사이클에서 실제로 잡힌 실수, 리뷰에서 수정한 구조 문제, 다음 리팩터 때 반복하면 안 되는 예방 규칙이다.
   - compound 결과로 `docs/solutions/` 또는 `CONCEPTS.md`가 생성/수정되면 최종 작업 diff에 포함한다.
   - durable learning이 없으면 그 사실을 명시하고, 임의로 문서를 만들지 않는다.

## 파일 구조

새로 만들 파일:

- `src/routes/routeConfig.tsx`: 라우트별 path/component/auth/layout metadata.
- `src/routes/routeConfig.test.tsx`: route table, auth, layout 계약 테스트.
- `src/layouts/main-layout-contracts.test.ts`: 페이지가 `MainLayout`을 직접 소유하지 않는지 검사.
- `src/features/reservations/hooks/useReservationDetail.ts`: guest 예약 상세 조회 hook.
- `src/features/reservations/hooks/useHostReservationDetail.ts`: host 예약 상세 조회 hook.
- `src/features/reservations/hooks/usePaymentConfirmation.ts`: 결제 성공 confirm hook.
- `src/features/reviews/hooks/useReviewCreate.ts`: 리뷰 작성 화면의 예약 조회/리뷰 생성 hook.
- `src/features/profile/hooks/useHostListings.ts`: host 숙소 목록 조회 hook.
- `src/shared/ui/Dialog/Dialog.tsx`: 공용 dialog/modal shell.
- `src/shared/ui/Dialog/Dialog.module.css`
- `src/shared/ui/Dialog/Dialog.test.tsx`
- `src/shared/ui/IconButton/IconButton.tsx`
- `src/shared/ui/IconButton/IconButton.module.css`
- `src/shared/ui/IconButton/IconButton.test.tsx`
- `src/shared/ui/CounterStepper/CounterStepper.tsx`
- `src/shared/ui/CounterStepper/CounterStepper.module.css`
- `src/shared/ui/CounterStepper/CounterStepper.test.tsx`
- `docs/qa/frontend-architecture-smoke.ko.md`: 디자인 전 browser QA 체크리스트.

수정할 파일:

- `src/routes/Router.tsx`
- `src/routes/navigation-contracts.test.ts`
- `src/routes/RequireAuth.tsx`
- `src/layouts/MainLayout.tsx`
- `src/layouts/MainLayout.module.css`
- `src/App.test.tsx`
- `src/pages/Home/Home.tsx`
- `src/pages/Search/Search.tsx`
- `src/pages/AccommodationDetail/AccommodationDetail.tsx`
- `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- `src/pages/Wishlist/Wishlist.tsx`
- `src/pages/Profile/Profile.tsx`
- `src/pages/Profile/HostListings/HostListings.tsx`
- `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`
- `src/pages/Reservations/ReservationConfirm.tsx`
- `src/pages/Reservations/ReservationDetail.tsx`
- `src/pages/Reservations/ReviewCreate.tsx`
- `src/pages/Reservations/PaymentSuccess.tsx`
- `src/pages/Reservations/PaymentFail.tsx`
- `src/components/Header/Header.tsx`
- `src/components/Header/UserMenu.tsx`
- `src/components/ReservationModal/ReservationModal.tsx`
- `src/components/AuthModal/AuthModal.tsx`
- `src/components/WishlistModal/WishlistModal.tsx`
- `src/components/CreateWishlistModal/CreateWishlistModal.tsx`
- `src/components/AccommodationActionModal/AccommodationActionModal.tsx`
- `src/shared/ui/index.ts`
- `src/styles/tokens.css`
- `package.json`

---

### Task M: Route Config와 Auth/Layout Metadata 중앙화

**Files:**
- Create: `src/routes/routeConfig.tsx`
- Create: `src/routes/routeConfig.test.tsx`
- Modify: `src/routes/Router.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: route config 실패 테스트 작성**

`src/routes/routeConfig.test.tsx`를 만든다.

```tsx
import { ROUTE_PATHS } from "./paths";
import { appRoutes } from "./routeConfig";

describe("app route config", () => {
  it("keeps the complete route table in one place", () => {
    expect(appRoutes.map((route) => route.path)).toEqual([
      ROUTE_PATHS.home,
      ROUTE_PATHS.search,
      ROUTE_PATHS.accommodationDetail,
      ROUTE_PATHS.accommodationConfirm,
      ROUTE_PATHS.accommodationEdit,
      ROUTE_PATHS.wishlist,
      ROUTE_PATHS.profile,
      ROUTE_PATHS.hostReservationDetail,
      ROUTE_PATHS.reservationDetail,
      ROUTE_PATHS.reviewCreate,
      ROUTE_PATHS.paymentSuccess,
      ROUTE_PATHS.paymentFail,
      ROUTE_PATHS.login,
      ROUTE_PATHS.signup,
      ROUTE_PATHS.notFound,
    ]);
  });

  it("declares protected routes explicitly", () => {
    const protectedPaths = appRoutes
      .filter((route) => route.requiresAuth)
      .map((route) => route.path);

    expect(protectedPaths).toEqual([
      ROUTE_PATHS.accommodationConfirm,
      ROUTE_PATHS.accommodationEdit,
      ROUTE_PATHS.wishlist,
      ROUTE_PATHS.profile,
      ROUTE_PATHS.hostReservationDetail,
      ROUTE_PATHS.reservationDetail,
      ROUTE_PATHS.reviewCreate,
      ROUTE_PATHS.paymentSuccess,
      ROUTE_PATHS.paymentFail,
    ]);
  });

  it("declares layout ownership explicitly", () => {
    const barePaths = appRoutes
      .filter((route) => route.layout === "bare")
      .map((route) => route.path);

    expect(barePaths).toEqual([
      ROUTE_PATHS.login,
      ROUTE_PATHS.signup,
      ROUTE_PATHS.notFound,
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/routes/routeConfig.test.tsx
```

Expected:

```text
Cannot find module './routeConfig'
```

- [ ] **Step 3: route config 추가**

`src/routes/routeConfig.tsx`를 만든다.

```tsx
import React from "react";
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

export type AppRouteLayout = "main" | "bare";

export interface AppRouteConfig {
  path: string;
  component: React.ComponentType;
  requiresAuth: boolean;
  layout: AppRouteLayout;
}

export const appRoutes: AppRouteConfig[] = [
  { path: ROUTE_PATHS.home, component: Home, requiresAuth: false, layout: "main" },
  { path: ROUTE_PATHS.search, component: Search, requiresAuth: false, layout: "main" },
  {
    path: ROUTE_PATHS.accommodationDetail,
    component: AccommodationDetail,
    requiresAuth: false,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.accommodationConfirm,
    component: ReservationConfirm,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.accommodationEdit,
    component: AccommodationEdit,
    requiresAuth: true,
    layout: "main",
  },
  { path: ROUTE_PATHS.wishlist, component: Wishlist, requiresAuth: true, layout: "main" },
  { path: ROUTE_PATHS.profile, component: Profile, requiresAuth: true, layout: "main" },
  {
    path: ROUTE_PATHS.hostReservationDetail,
    component: HostReservationDetail,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.reservationDetail,
    component: ReservationDetail,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.reviewCreate,
    component: ReviewCreate,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.paymentSuccess,
    component: PaymentSuccess,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.paymentFail,
    component: PaymentFail,
    requiresAuth: true,
    layout: "main",
  },
  { path: ROUTE_PATHS.login, component: Login, requiresAuth: false, layout: "bare" },
  { path: ROUTE_PATHS.signup, component: Signup, requiresAuth: false, layout: "bare" },
  { path: ROUTE_PATHS.notFound, component: NotFound, requiresAuth: false, layout: "bare" },
];
```

- [ ] **Step 4: Router가 config를 map하도록 변경**

`src/routes/Router.tsx`를 아래 구조로 바꾼다. 이 단계에서는 아직 nested layout을 적용하지 않는다.

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth";
import { AppRouteConfig, appRoutes } from "./routeConfig";

const renderRouteElement = ({ component: Page, requiresAuth }: AppRouteConfig) => {
  const pageElement = <Page />;

  if (!requiresAuth) {
    return pageElement;
  }

  return <RequireAuth>{pageElement}</RequireAuth>;
};

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        {appRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={renderRouteElement(route)}
          />
        ))}
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
```

- [ ] **Step 5: App route table 테스트 업데이트**

`src/App.test.tsx`의 `routeMappings`에서 `/accommodations/:id/confirm`의 `requiresAuth`를 `true`로 바꾼다. 이 route는 기존에도 page 내부에서 인증 redirect를 수행했으므로 route metadata로 올리는 것이 맞다.

- [ ] **Step 6: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/routes/routeConfig.test.tsx src/App.test.tsx
npm run typecheck
```

Expected:

```text
PASS src/routes/routeConfig.test.tsx
PASS src/App.test.tsx
npm run typecheck exits 0
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/routeConfig.tsx src/routes/routeConfig.test.tsx src/routes/Router.tsx src/App.test.tsx
git commit -m "refactor: centralize frontend route metadata"
```

---

### Task N: MainLayout을 Router 소유로 이동

**Files:**
- Create: `src/layouts/main-layout-contracts.test.ts`
- Modify: `src/layouts/MainLayout.tsx`
- Modify: `src/routes/Router.tsx`
- Modify: `src/pages/Home/Home.tsx`
- Modify: `src/pages/Search/Search.tsx`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- Modify: `src/pages/Wishlist/Wishlist.tsx`
- Modify: `src/pages/Profile/Profile.tsx`
- Modify: `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`
- Modify: `src/pages/Reservations/ReservationConfirm.tsx`
- Modify: `src/pages/Reservations/ReservationDetail.tsx`
- Modify: `src/pages/Reservations/ReviewCreate.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentFail.tsx`

- [ ] **Step 1: page-local MainLayout 금지 테스트 작성**

`src/layouts/main-layout-contracts.test.ts`를 만든다.

```ts
import { readFileSync } from "fs";
import { join } from "path";

const mainLayoutRoutePages = [
  "src/pages/Home/Home.tsx",
  "src/pages/Search/Search.tsx",
  "src/pages/AccommodationDetail/AccommodationDetail.tsx",
  "src/pages/AccommodationEdit/AccommodationEdit.tsx",
  "src/pages/Wishlist/Wishlist.tsx",
  "src/pages/Profile/Profile.tsx",
  "src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx",
  "src/pages/Reservations/ReservationConfirm.tsx",
  "src/pages/Reservations/ReservationDetail.tsx",
  "src/pages/Reservations/ReviewCreate.tsx",
  "src/pages/Reservations/PaymentSuccess.tsx",
  "src/pages/Reservations/PaymentFail.tsx",
];

const sourceText = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("MainLayout ownership", () => {
  it("keeps MainLayout owned by the router instead of individual pages", () => {
    const violations = mainLayoutRoutePages.flatMap((relativePath) => {
      const source = sourceText(relativePath);
      const importsMainLayout =
        source.includes("from \"../../layouts\"") ||
        source.includes("from \"../../../layouts\"") ||
        source.includes("from '../../layouts'") ||
        source.includes("from '../../../layouts'");
      const rendersMainLayout = source.includes("<MainLayout");

      return importsMainLayout || rendersMainLayout ? [relativePath] : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps Search from nesting a main element inside MainLayout", () => {
    const source = sourceText("src/pages/Search/Search.tsx");

    expect(source).not.toContain("<main");
    expect(source).not.toContain("</main>");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/layouts/main-layout-contracts.test.ts
```

Expected:

```text
FAIL with page paths that still import or render MainLayout
```

- [ ] **Step 3: MainLayout이 Outlet을 렌더링하도록 변경**

`src/layouts/MainLayout.tsx`를 아래 구조로 바꾼다.

```tsx
import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import styles from "./MainLayout.module.css";

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>{children ?? <Outlet />}</main>
    </div>
  );
};
```

- [ ] **Step 4: Router에 nested layout 적용**

`src/routes/Router.tsx`를 아래 구조로 바꾼다.

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts";
import RequireAuth from "./RequireAuth";
import { AppRouteConfig, appRoutes } from "./routeConfig";

const renderRouteElement = ({ component: Page, requiresAuth }: AppRouteConfig) => {
  const pageElement = <Page />;

  if (!requiresAuth) {
    return pageElement;
  }

  return <RequireAuth>{pageElement}</RequireAuth>;
};

const Router = () => {
  const mainRoutes = appRoutes.filter((route) => route.layout === "main");
  const bareRoutes = appRoutes.filter((route) => route.layout === "bare");

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {mainRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={renderRouteElement(route)}
            />
          ))}
        </Route>
        {bareRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={renderRouteElement(route)}
          />
        ))}
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
```

- [ ] **Step 5: 페이지에서 MainLayout wrapper 제거**

아래 파일에서 `MainLayout` import를 제거하고, 최상위 `<MainLayout>...</MainLayout>`을 fragment 또는 기존 content wrapper로 바꾼다.

```text
src/pages/Home/Home.tsx
src/pages/Search/Search.tsx
src/pages/AccommodationDetail/AccommodationDetail.tsx
src/pages/AccommodationEdit/AccommodationEdit.tsx
src/pages/Wishlist/Wishlist.tsx
src/pages/Profile/Profile.tsx
src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx
src/pages/Reservations/ReservationConfirm.tsx
src/pages/Reservations/ReservationDetail.tsx
src/pages/Reservations/ReviewCreate.tsx
src/pages/Reservations/PaymentSuccess.tsx
src/pages/Reservations/PaymentFail.tsx
```

Search는 nested `<main>`을 만들지 않도록 기존 `<main className={styles.searchPage}>`를 `<div className={styles.searchPage}>`로 바꾼다.

- [ ] **Step 6: 페이지 테스트 mock 정리**

`AccommodationEdit.test.tsx`처럼 `MainLayout`을 mock하던 테스트가 있으면 mock을 제거하거나, router-level layout 없이 page만 렌더링하도록 기대값을 바꾼다.

- [ ] **Step 7: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/layouts/main-layout-contracts.test.ts src/App.test.tsx
npm run typecheck
```

Expected:

```text
PASS src/layouts/main-layout-contracts.test.ts
PASS src/App.test.tsx
npm run typecheck exits 0
```

- [ ] **Step 8: Commit**

```bash
git add src/layouts src/routes src/pages src/App.test.tsx
git commit -m "refactor: move main layout ownership to router"
```

---

### Task O: 보호 페이지의 중복 Auth Redirect 제거

**Files:**
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- Modify: `src/pages/Wishlist/Wishlist.tsx`
- Modify: `src/pages/Profile/Profile.tsx`
- Modify: `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`
- Modify: `src/pages/Reservations/ReservationConfirm.tsx`
- Modify: `src/pages/Reservations/ReservationDetail.tsx`
- Modify: `src/pages/Reservations/ReviewCreate.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentFail.tsx`
- Modify: affected page tests

- [ ] **Step 1: 중복 guard 제거 범위 확인**

Run:

```bash
rg "isAuthenticated|isAuthLoading|navigate\\(\"/\"\\)|navigate\\('/'\\)" src/pages -n
```

Expected: 보호 route page에서 page-level redirect 후보가 나온다.

- [ ] **Step 2: 보호 route page 내부 redirect 제거**

아래 원칙으로 수정한다.

```text
Route 접근 권한: RequireAuth가 담당한다.
Page 데이터 로딩: 해당 page 또는 feature hook이 담당한다.
Page 내부에서 navigate("/")로 인증 실패를 처리하지 않는다.
```

각 파일에서 제거한다.

```text
useAuth import 중 redirect에만 쓰는 부분
isAuthLoading 기반 "로딩 중..." return
!isAuthenticated -> navigate("/") effect
```

단, `AccommodationDetail`처럼 public page에서 로그인 여부로 wishlist/booking modal 분기하는 로직은 제거하지 않는다. 이 파일은 route guard 대상이 아니다.

- [ ] **Step 3: 보호 page 테스트 업데이트**

page 테스트가 unauthenticated redirect를 직접 기대한다면 삭제한다. 인증 redirect는 `src/routes/RequireAuth.test.tsx`와 `src/App.test.tsx`에서만 검증한다.

- [ ] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/routes/RequireAuth.test.tsx src/App.test.tsx
npm run test:ci -- --no-cache
npm run typecheck
```

Expected:

```text
PASS src/routes/RequireAuth.test.tsx
PASS src/App.test.tsx
all test suites pass
npm run typecheck exits 0
```

- [ ] **Step 5: Commit**

```bash
git add src/pages src/routes src/App.test.tsx
git commit -m "refactor: rely on route guard for protected pages"
```

---

### Task P: routeTo 적용 확대와 Navigation Contract 강화

**Files:**
- Modify: `src/routes/navigation-contracts.test.ts`
- Modify: `src/components/Header/Header.tsx`
- Modify: `src/components/Header/UserMenu.tsx`
- Modify: `src/components/AccommodationCard/BaseAccommodationCard.tsx`
- Modify: `src/components/AccommodationActionModal/AccommodationActionModal.tsx`
- Modify: `src/components/ReservationModal/ReservationModal.tsx`
- Modify: `src/components/Map/Map.tsx`
- Modify: `src/pages/Auth/Login/Login.tsx`
- Modify: `src/pages/Auth/Signup/Signup.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- Modify: `src/pages/Reservations/ReservationConfirm.tsx`
- Modify: `src/pages/Reservations/ReservationDetail.tsx`
- Modify: `src/pages/Reservations/ReviewCreate.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentFail.tsx`

- [ ] **Step 1: navigation contract 범위 확대**

`src/routes/navigation-contracts.test.ts`의 검사 파일 목록을 아래처럼 확장한다.

```ts
const scopedNavigationFiles = [
  "src/components/Header/Header.tsx",
  "src/components/Header/UserMenu.tsx",
  "src/components/AccommodationCard/BaseAccommodationCard.tsx",
  "src/components/AccommodationActionModal/AccommodationActionModal.tsx",
  "src/components/ReservationModal/ReservationModal.tsx",
  "src/components/Map/Map.tsx",
  "src/pages/Auth/Login/Login.tsx",
  "src/pages/Auth/Signup/Signup.tsx",
  "src/pages/AccommodationEdit/AccommodationEdit.tsx",
  "src/pages/Profile/GuestTrips/GuestTrips.tsx",
  "src/pages/Profile/HostReservations/HostReservations.tsx",
  "src/pages/Reservations/ReservationConfirm.tsx",
  "src/pages/Reservations/ReservationDetail.tsx",
  "src/pages/Reservations/ReviewCreate.tsx",
  "src/pages/Reservations/PaymentFail.tsx",
  "src/pages/Reservations/PaymentSuccess.tsx",
];
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/routes/navigation-contracts.test.ts
```

Expected:

```text
FAIL with direct navigate string call locations
```

- [ ] **Step 3: 직접 문자열 navigation을 routeTo로 교체**

교체 기준:

```tsx
navigate(routeTo.home());
navigate(routeTo.wishlist());
navigate(routeTo.profile());
navigate(routeTo.profile({ mode: "host" }));
navigate(routeTo.login());
navigate(routeTo.signup());
navigate(routeTo.reservationDetail(reservationUid));
navigate(routeTo.reviewCreate(reservationUid));
navigate(routeTo.accommodationDetail(accommodationId));
navigate(routeTo.accommodationConfirm(accommodationId, searchParams));
```

`window.open("/accommodations/...")` 형태도 아래처럼 바꾼다.

```tsx
window.open(routeTo.accommodationDetail(accommodationId), "_blank");
```

- [ ] **Step 4: 테스트 기대값 업데이트**

Auth/Login/Signup 테스트에서 `navigate("/")`, `navigate("/login")`, `navigate("/signup")`를 기대하는 경우 결과 문자열은 동일하게 유지된다. import 변경으로 mock이 깨지는 경우 `routeTo`는 실제 구현을 사용한다.

- [ ] **Step 5: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/routes/navigation-contracts.test.ts
npm run test:ci -- --no-cache
npm run typecheck
```

Expected:

```text
PASS src/routes/navigation-contracts.test.ts
all test suites pass
npm run typecheck exits 0
```

- [ ] **Step 6: Commit**

```bash
git add src/routes src/components src/pages
git commit -m "refactor: enforce route builder navigation"
```

---

### Task Q: Reservations/Profile API 호출을 Feature Hook으로 이동

**Files:**
- Create: `src/features/reservations/hooks/useReservationDetail.ts`
- Create: `src/features/reservations/hooks/useHostReservationDetail.ts`
- Create: `src/features/reservations/hooks/usePaymentConfirmation.ts`
- Create: `src/features/reviews/hooks/useReviewCreate.ts`
- Create: `src/features/profile/hooks/useHostListings.ts`
- Modify: `src/pages/Reservations/ReservationDetail.tsx`
- Modify: `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/ReviewCreate.tsx`
- Modify: `src/pages/Profile/HostListings/HostListings.tsx`
- Modify: affected tests

- [ ] **Step 1: ReservationDetail hook 테스트 작성**

`src/features/reservations/hooks/useReservationDetail.test.tsx`를 만든다.

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { reservationApi } from "../../../api";
import { useReservationDetail } from "./useReservationDetail";

jest.mock("../../../api", () => ({
  reservationApi: {
    getDetail: jest.fn(),
  },
}));

const mockedReservationApi = jest.mocked(reservationApi);

describe("useReservationDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads reservation detail by uid", async () => {
    mockedReservationApi.getDetail.mockResolvedValueOnce({
      reservationUid: "rsv_1",
      accommodationName: "Airbob Stay",
    } as never);

    const { result } = renderHook(() => useReservationDetail("rsv_1"));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedReservationApi.getDetail).toHaveBeenCalledWith("rsv_1");
    expect(result.current.reservation?.reservationUid).toBe("rsv_1");
    expect(result.current.error).toBeNull();
  });

  it("does not call the API without a uid", () => {
    renderHook(() => useReservationDetail(undefined));

    expect(mockedReservationApi.getDetail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/reservations/hooks/useReservationDetail.test.tsx
```

Expected:

```text
Cannot find module './useReservationDetail'
```

- [ ] **Step 3: ReservationDetail hook 구현**

`src/features/reservations/hooks/useReservationDetail.ts`를 만든다.

```ts
import { useEffect, useState } from "react";
import { reservationApi } from "../../../api";

export function useReservationDetail<TReservation = unknown>(
  reservationUid: string | undefined
) {
  const [reservation, setReservation] = useState<TReservation | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(reservationUid));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!reservationUid) {
      setReservation(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setError(null);

    reservationApi
      .getDetail(reservationUid)
      .then((data) => {
        if (isMounted) {
          setReservation(data as TReservation);
        }
      })
      .catch((caughtError) => {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError : new Error("예약 정보를 불러오지 못했습니다."));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [reservationUid]);

  return { reservation, isLoading, error };
}
```

- [ ] **Step 4: 같은 패턴으로 host/payment/review/profile hook 작성**

각 hook은 page에서 직접 호출하던 API만 옮긴다. URL 이동, 버튼 클릭 UI, route param 읽기는 page에 둔다.

```text
useHostReservationDetail.ts -> reservationApi.getHostReservationDetail
usePaymentConfirmation.ts -> paymentApi.confirm
useReviewCreate.ts -> reservationApi.getDetail + reviewApi.create
useHostListings.ts -> accommodationApi.getHostAccommodations 또는 현재 HostListings가 쓰는 동일 API
```

- [ ] **Step 5: pages가 hook을 사용하도록 변경**

아래 page에서 `reservationApi`, `paymentApi`, `reviewApi`, `accommodationApi` 직접 import를 제거한다.

```text
src/pages/Reservations/ReservationDetail.tsx
src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx
src/pages/Reservations/PaymentSuccess.tsx
src/pages/Reservations/ReviewCreate.tsx
src/pages/Profile/HostListings/HostListings.tsx
```

- [ ] **Step 6: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/reservations/hooks/useReservationDetail.test.tsx
npm run test:ci -- --no-cache
npm run typecheck
```

Expected:

```text
new hook tests pass
all existing tests pass
npm run typecheck exits 0
```

- [ ] **Step 7: Commit**

```bash
git add src/features src/pages
git commit -m "refactor: move reservation profile data loading to feature hooks"
```

---

### Task R: Search/AccommodationEdit/Modal API 경계 정리

**Files:**
- Modify: `src/pages/Search/Search.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- Modify: `src/components/AuthModal/AuthModal.tsx`
- Modify: `src/components/WishlistModal/WishlistModal.tsx`
- Modify: `src/components/CreateWishlistModal/CreateWishlistModal.tsx`
- Modify: `src/components/AccommodationActionModal/AccommodationActionModal.tsx`
- Modify: `src/components/ReservationModal/ReservationModal.tsx`
- Create or Modify: feature hooks under `src/features/search`, `src/features/accommodations`, `src/features/wishlist`, `src/features/auth`, `src/features/reservations`

- [ ] **Step 1: 직접 API import 기준선 확인**

Run:

```bash
rg "from \\\".*api|from '.*api" src/pages src/components -n
```

Expected: 남은 직접 API import 목록이 나온다.

- [ ] **Step 2: Search wishlist 동기화 hook으로 이동**

`Search.tsx`의 `wishlistApi` 직접 호출은 `src/features/search/hooks/useSearchWishlistModal.ts` 또는 `src/features/wishlist/hooks/useWishlistMembership.ts`로 이동한다.

hook의 public API는 아래 형태를 유지한다.

```ts
interface SearchWishlistModalState {
  selectedAccommodationId: number | null;
  isWishlistModalOpen: boolean;
  isAuthModalOpen: boolean;
  openWishlist: (accommodationId: number) => void;
  closeWishlist: () => void;
  closeAuth: () => void;
  reconcileWishlistState: () => Promise<void>;
}
```

- [ ] **Step 3: AccommodationEdit API 호출 경계 이동**

`AccommodationEdit.tsx`에 남은 `accommodationApi` 직접 호출 중 host detail fetch, image upload, save/publish 호출을 `src/features/accommodations/edit/hooks` 또는 `src/features/accommodations/edit/services`로 이동한다.

page에는 아래 책임만 남긴다.

```text
route param 읽기
mode query 읽기
step component 조립
hook 반환값을 props로 전달
저장/게시 버튼 이벤트 연결
```

- [ ] **Step 4: modal API 호출을 submit hook으로 이동**

아래 컴포넌트는 visual shell과 form event만 맡도록 줄인다.

```text
AuthModal -> useAuthModalLogin
WishlistModal -> useWishlistSelection
CreateWishlistModal -> useCreateWishlist
AccommodationActionModal -> useAccommodationActions
ReservationModal -> useReservationPayment
```

각 hook은 `isSubmitting`, `error`, `submit`을 반환한다.

```ts
interface MutationHookResult<TInput> {
  isSubmitting: boolean;
  error: string | null;
  submit: (input: TInput) => Promise<void>;
}
```

- [ ] **Step 5: 직접 API import 감소 검증**

Run:

```bash
rg "from \\\".*api|from '.*api" src/pages src/components -n
```

Expected: direct API imports are limited to page tests, feature hooks, and allowed auth boundary files. `src/pages`와 `src/components` production files에는 새 직접 import를 추가하지 않는다.

- [ ] **Step 6: 테스트**

Run:

```bash
npm run test:ci -- --no-cache
npm run typecheck
```

Expected:

```text
all test suites pass
npm run typecheck exits 0
```

- [ ] **Step 7: Commit**

```bash
git add src/features src/pages src/components
git commit -m "refactor: move remaining ui api calls behind feature hooks"
```

---

### Task S: Shared UI Primitive 확장

**Files:**
- Create: `src/shared/ui/Dialog/Dialog.tsx`
- Create: `src/shared/ui/Dialog/Dialog.module.css`
- Create: `src/shared/ui/Dialog/Dialog.test.tsx`
- Create: `src/shared/ui/Dialog/index.ts`
- Create: `src/shared/ui/IconButton/IconButton.tsx`
- Create: `src/shared/ui/IconButton/IconButton.module.css`
- Create: `src/shared/ui/IconButton/IconButton.test.tsx`
- Create: `src/shared/ui/IconButton/index.ts`
- Create: `src/shared/ui/CounterStepper/CounterStepper.tsx`
- Create: `src/shared/ui/CounterStepper/CounterStepper.module.css`
- Create: `src/shared/ui/CounterStepper/CounterStepper.test.tsx`
- Create: `src/shared/ui/CounterStepper/index.ts`
- Modify: `src/shared/ui/index.ts`

- [ ] **Step 1: Dialog 테스트 작성**

`src/shared/ui/Dialog/Dialog.test.tsx`를 만든다.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("does not render content when closed", () => {
    render(
      <Dialog isOpen={false} title="위시리스트" onClose={jest.fn()}>
        content
      </Dialog>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an accessible modal dialog when open", () => {
    render(
      <Dialog isOpen title="위시리스트" onClose={jest.fn()}>
        content
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: "위시리스트" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = jest.fn();
    render(
      <Dialog isOpen title="위시리스트" onClose={onClose}>
        content
      </Dialog>
    );

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Dialog 구현**

`src/shared/ui/Dialog/Dialog.tsx`를 만든다.

```tsx
import React from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function Dialog({ children, isOpen, onClose, title }: DialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        aria-label={title}
        className={styles.dialog}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} type="button" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Dialog CSS 구현**

`src/shared/ui/Dialog/Dialog.module.css`를 만든다.

```css
.overlay {
  align-items: center;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: var(--z-modal);
}

.dialog {
  background: var(--color-background-page);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-height: min(720px, calc(100vh - 48px));
  max-width: min(560px, calc(100vw - 48px));
  overflow: hidden;
  width: 100%;
}

.header {
  align-items: center;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: space-between;
  min-height: 56px;
  padding: 0 20px;
}

.title {
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin: 0;
}

.closeButton {
  background: transparent;
  border: 0;
  color: var(--color-text-primary);
  cursor: pointer;
  font: inherit;
  padding: 8px;
}

.body {
  overflow: auto;
  padding: 20px;
}
```

- [ ] **Step 4: IconButton과 CounterStepper 추가**

`IconButton`은 icon-only 버튼의 접근성 이름을 강제한다.

```tsx
export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
}
```

`CounterStepper`는 guest/coupon/count UI에 재사용할 수 있게 만든다.

```tsx
export interface CounterStepperProps {
  decrementLabel: string;
  incrementLabel: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
}
```

- [ ] **Step 5: shared export 추가**

`src/shared/ui/index.ts`에 추가한다.

```ts
export { Dialog } from "./Dialog";
export type { DialogProps } from "./Dialog";
export { IconButton } from "./IconButton";
export type { IconButtonProps } from "./IconButton";
export { CounterStepper } from "./CounterStepper";
export type { CounterStepperProps } from "./CounterStepper";
```

- [ ] **Step 6: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/shared/ui/Dialog/Dialog.test.tsx src/shared/ui/IconButton/IconButton.test.tsx src/shared/ui/CounterStepper/CounterStepper.test.tsx
npm run typecheck
```

Expected:

```text
PASS shared ui tests
npm run typecheck exits 0
```

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui
git commit -m "feat: add shared dialog and control primitives"
```

---

### Task T: Token/Z-Index/Overlay 기준 정리

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: modal/dialog-related CSS modules
- Modify: `src/components/Header/Header.module.css`
- Modify: `src/components/SearchBar/SearchBar.module.css`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.module.css`
- Modify: `src/pages/Wishlist/Wishlist.module.css`

- [ ] **Step 1: overlay token 확장**

`src/styles/tokens.css`에 overlay 계층을 명확히 추가한다.

```css
:root {
  --z-header: 1000;
  --z-sticky: 1100;
  --z-dropdown: 2000;
  --z-popover: 3000;
  --z-bottom-sheet: 4000;
  --z-modal: 5000;
  --z-toast: 6000;
  --overlay-backdrop: rgba(0, 0, 0, 0.45);
}
```

- [ ] **Step 2: 산재한 z-index 교체**

아래 값을 직접 쓰는 CSS를 token으로 바꾼다.

```text
100000 -> var(--z-toast)
99999 -> var(--z-modal)
10001 -> var(--z-popover) 또는 var(--z-modal)
10000 -> var(--z-dropdown)
1000 -> var(--z-header)
```

교체 전후 확인:

```bash
rg "z-index:\\s*(100000|99999|10001|10000|1000)" src -n
```

Expected after migration:

```text
No production CSS z-index hard-code matches except tokens.css.
```

- [ ] **Step 3: overlay background 교체**

모달/overlay CSS에서 `rgba(0, 0, 0, 0.4)`, `rgba(0, 0, 0, 0.45)`, `rgba(0, 0, 0, 0.5)`를 `var(--overlay-backdrop)`로 통일한다.

- [ ] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --no-cache
npm run typecheck
```

Expected:

```text
all test suites pass
npm run typecheck exits 0
```

- [ ] **Step 5: Commit**

```bash
git add src/styles src/components src/pages
git commit -m "refactor: standardize overlay tokens"
```

---

### Task U: Verify/Build/Browser QA Gate 현실화

**Files:**
- Modify: `package.json`
- Create: `docs/qa/frontend-architecture-smoke.ko.md`
- Modify: `README.md` if it already documents frontend verification

- [ ] **Step 1: verify script에 build 포함**

`package.json` scripts를 아래 기준으로 바꾼다.

```json
"scripts": {
  "start": "react-scripts start",
  "build": "react-scripts build",
  "test": "react-scripts test",
  "test:ci": "react-scripts test --watchAll=false",
  "test:ci:no-cache": "react-scripts test --watchAll=false --no-cache",
  "typecheck": "tsc --noEmit",
  "verify": "npm run typecheck && npm run test:ci:no-cache && npm run build",
  "eject": "react-scripts eject"
}
```

- [ ] **Step 2: 검증**

Run:

```bash
npm run verify
```

Expected:

```text
typecheck passes
test suites pass without npm no-cache warning
production build succeeds
```

- [ ] **Step 3: browser QA 문서 작성**

`docs/qa/frontend-architecture-smoke.ko.md`를 만든다. 계정 비밀번호는 문서에 저장하지 않는다. 실행자는 사용자에게 받은 QA 계정으로 로그인한다.

```md
# Frontend Architecture Smoke QA

## 목적

Airbnb 디자인 리팩터 전에 구조 변경이 핵심 사용자 플로우를 깨지 않았는지 확인한다.

## 환경

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- QA account: use the QA account provided by the user in the thread. Do not commit credentials.

## Desktop 1280px

- [ ] Home에서 목적지 검색 후 `/search` 이동.
- [ ] Search list가 렌더링되고 page 변경 시 URL query가 유지된다.
- [ ] Search 지도 marker 또는 bounds 변경 후 결과가 갱신된다.
- [ ] 숙소 상세로 이동해 날짜/게스트 선택, 쿠폰 영역, 예약 버튼을 확인한다.
- [ ] 예약 확인 페이지가 로그인 상태에서 열린다.
- [ ] Wishlist 페이지에서 목록/상세 전환과 modal open/close를 확인한다.
- [ ] Profile guest tab과 host tab이 열린다.
- [ ] Host listing infinite scroll 또는 empty state가 깨지지 않는다.

## Mobile 375px

- [ ] Home 검색 UI가 화면 밖으로 넘치지 않는다.
- [ ] Search mobile bottom sheet가 `closed | half | full` 상태로 동작한다.
- [ ] Detail booking panel과 modal이 viewport에 맞게 열린다.
- [ ] Wishlist modal과 auth modal이 닫기 버튼/overlay click으로 닫힌다.

## 기록

- 실패한 단계
- console error
- network 실패 요청
- screenshot path
```

- [ ] **Step 4: gstack QA 실행**

Frontend/backend를 켠 뒤 gstack QA를 실행한다. 계정은 사용자 제공 QA 계정을 사용한다.

```bash
npm start
```

Expected:

```text
Frontend dev server runs at http://localhost:3000
```

Browser QA expected:

```text
Desktop and mobile smoke paths complete without blocking regression.
Any discovered bug is either fixed in the same task or recorded with exact reproduction steps.
```

- [ ] **Step 5: Commit**

```bash
git add package.json docs/qa README.md
git commit -m "chore: add frontend architecture verification gate"
```

---

## 실행 순서

권장 순서:

1. Task M: Route Config와 Auth/Layout Metadata 중앙화.
2. Task N: MainLayout을 Router 소유로 이동.
3. Task O: 보호 페이지의 중복 Auth Redirect 제거.
4. Task P: routeTo 적용 확대와 Navigation Contract 강화.
5. Task Q: Reservations/Profile API 호출을 Feature Hook으로 이동.
6. Task R: Search/AccommodationEdit/Modal API 경계 정리.
7. Task S: Shared UI Primitive 확장.
8. Task T: Token/Z-Index/Overlay 기준 정리.
9. Task U: Verify/Build/Browser QA Gate 현실화.
10. Final Review: 전체 diff에 대한 spec compliance review와 code quality review를 수행한다.
11. Compound Capture: `compound-engineering:ce-compound mode:headless final review and execution-review loop lessons`로 반복 방지 지식을 기록한다.

각 Task는 독립 commit으로 끝낸다. Subagent-driven 방식으로 실행할 때는 한 task당 fresh subagent를 띄우고, 메인 agent가 결과 diff/test를 리뷰한 뒤 다음 task로 넘어간다.

## Airbnb design.md 적용 전 최종 판정 기준

아래 조건을 모두 만족하면 디자인 리팩토링으로 넘어간다.

- `npm run verify`가 통과한다.
- gstack browser QA smoke가 desktop/mobile에서 통과한다.
- `rg "from \".*api|from '.*api" src/pages src/components -n` 결과가 허용된 예외만 남는다.
- route metadata에서 protected/main/bare route가 한눈에 보인다.
- 주요 page가 `MainLayout`을 직접 import하지 않는다.
- shared UI에 dialog, icon button, counter stepper, state view, button, text field, card가 있다.
- 디자인 적용 첫 vertical slice를 `Search card + AccommodationDetail booking panel`로 잡을 수 있을 만큼 구조가 분리되어 있다.
