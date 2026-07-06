# Airbob Frontend Architecture Freeze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 디자인 리팩토링 전에 프론트 구조 점검 루프를 끝낼 수 있도록 기능 경계, Query 에러 처리, 검색 route orchestration, Auth/session 책임, 검증 문서를 freeze 기준으로 고정한다.

**Architecture:** 현재 구조는 feature-first, direct route container lazy loading, route-owned query contract, TanStack Query cache, CSS Modules/token 기반으로 유지한다. 새 리팩토링은 UI 시각 변경 없이 cross-feature private import를 닫고, 반복 Query 에러 처리와 큰 route orchestration만 얇게 정리한다. 구조 종료 기준은 테스트와 문서에 명시해 새 감사에서 같은 이슈가 반복되지 않게 한다.

**Tech Stack:** React 19, TypeScript 4.9, React Router 7, TanStack Query 5, Axios, CRA/react-scripts, Jest, React Testing Library, CSS Modules.

---

## Audit Baseline

- 기준 브랜치: `codex/frontend-post-merge-audit-plan-20260706`
- 기준 커밋: `b3bd8e4 fix: preserve route-level lazy chunks`
- `npm run typecheck`: PASS
- `npm run lint:strict`: PASS
- `npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts src/routes/route-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts src/styles/design-system-contracts.test.ts`: PASS, 4 suites, 33 tests
- 남은 구조 리스크:
  - feature 간 private import가 일부 남아 있다.
  - Query 에러 처리 패턴이 여러 hook에 반복된다.
  - `SearchRoute.tsx`가 검색, 지도, bottom sheet, wishlist modal, 새 탭 이동 orchestration을 한 곳에서 조립한다.
  - `AuthContext.tsx`가 auth API, session query refresh, user-scoped cache clear, reservation checkout storage clear까지 맡는다.
  - 디자인 token은 존재하지만 feature CSS 하드코딩은 아직 많다. 이 계획에서는 시각 디자인 변경을 하지 않는다.

## Freeze Definition

구조 freeze는 아래 기준을 모두 만족할 때 완료로 본다.

- Production feature 파일은 다른 feature의 `components`, `hooks`, `lib`, `queryKeys`를 직접 import하지 않는다.
- Cross-feature 사용은 `appShell.ts`, `publicCache.ts`, route container lazy import, 같은 feature 내부 import만 허용한다.
- Reservation checkout과 review display처럼 여러 기능이 공유하는 표면은 owning feature의 public surface에서만 가져온다.
- Query 에러 toast 처리에 `handledErrorUpdatedAtRef`를 feature hook마다 복붙하지 않는다.
- `SearchRoute.tsx`는 화면 렌더링을 담당하고, 검색 route orchestration은 hook으로 분리한다.
- `AuthContext.tsx`는 provider 역할을 유지하되 session lifecycle 세부 작업은 auth lib로 분리한다.
- `verify:structure`와 핵심 boundary tests가 구조 freeze gate로 통과한다.

## Non-Goals

- Airbnb 스타일 시각 디자인 적용은 하지 않는다.
- API path, API response shape, 백엔드, DB, 서버 로직은 수정하지 않는다.
- CRA-to-Vite 또는 Jest-to-Vitest migration은 하지 않는다.
- 공개 route path 문자열은 바꾸지 않는다.
- 검색/예약/리뷰 기능 동작을 새로 설계하지 않는다.

## Files And Ownership

Create:

- `src/query/useHandledQueryError.ts` - TanStack Query error toast 중복 방지 hook.
- `src/query/useHandledQueryError.test.tsx` - `errorUpdatedAt` 기준 중복 처리 방지 테스트.
- `src/features/accommodations/publicCache.ts` - accommodation review cache invalidation public API.
- `src/features/search/hooks/useSearchRouteController.ts` - `SearchRoute` orchestration owner.
- `src/features/search/hooks/useSearchRouteController.test.tsx` - detail navigation and controller wiring tests.
- `src/features/auth/lib/sessionLifecycle.ts` - login/logout/session refresh side effects owner.
- `src/features/auth/lib/sessionLifecycle.test.ts` - session lifecycle cache/storage behavior tests.
- `docs/architecture/frontend-architecture-freeze.ko.md` - 구조 freeze 기준과 남은 의도적 리스크 문서.

Modify:

- `src/routes/route-boundary-contracts.test.ts`
- `src/features/reservations/appShell.ts`
- `src/features/reviews/appShell.ts`
- `src/features/accommodations/appShell.ts`
- `src/features/accommodations/components/AccommodationReviewsSection.tsx`
- `src/features/accommodations/hooks/useAccommodationBooking.ts`
- `src/features/reviews/hooks/useReviewCreate.ts`
- `src/features/reservations/hooks/useReservationDetail.ts`
- `src/features/reservations/hooks/useReservationConfirmAccommodation.ts`
- `src/features/reservations/hooks/useReservationList.ts`
- `src/features/reservations/hooks/useHostReservationDetail.ts`
- `src/features/accommodations/hooks/useAccommodationDetail.ts`
- `src/features/accommodations/hooks/useAccommodationReviews.ts`
- `src/features/profile/hooks/useHostListings.ts`
- `src/features/wishlist/hooks/useWishlistData.ts`
- `src/features/search/hooks/useSearchResults.ts`
- `src/features/search/SearchRoute.tsx`
- `src/contexts/AuthContext.tsx`
- `src/query/sessionCacheBoundary.ts`
- `src/verification-gate.test.ts`
- `docs/architecture/frontend-structure-refactor.md`
- `README.md`

Do not modify:

- `src/api/client.ts` base URL/proxy behavior.
- `src/routes/paths.ts` public route paths.
- Toss callback parameter names.
- Backend/API/DB/server code.
- Visual CSS beyond source-boundary test text if a task does not explicitly call for it.

---

### Task 1: Generalize Cross-Feature Boundary Contract

**Files:**
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Test: `src/routes/route-boundary-contracts.test.ts`

- [ ] **Step 1: Write the failing all-feature private import contract**

In `src/routes/route-boundary-contracts.test.ts`, replace the `importsPrivateFeatureSurface` function and `collectPrivateCrossFeatureImports` helper with this all-feature version:

```ts
const publicFeatureSurfaceFiles = new Set(["appShell", "publicCache"]);
const privateFeatureSegments = new Set(["components", "hooks", "lib"]);

const getFeatureName = (sourceRootRelativePath: string) =>
  sourceRootRelativePath.match(/^src\/features\/([^/]+)/)?.[1] ?? null;

const getImportedFeatureSurface = (importTarget: string) => {
  const match = importTarget.match(/^src\/features\/([^/]+)(?:\/(.+))?$/);

  if (!match) {
    return null;
  }

  const [, featureName, rest = ""] = match;
  const [firstSegment = "index"] = rest.split("/");
  const basename = firstSegment.replace(/\.[tj]sx?$/, "");

  return {
    featureName,
    firstSegment,
    basename,
  };
};

const importsPrivateCrossFeatureSurface = (
  importerPath: string,
  importTarget: string,
) => {
  const importerFeature = getFeatureName(importerPath);
  const imported = getImportedFeatureSurface(importTarget);

  if (!importerFeature || !imported || importerFeature === imported.featureName) {
    return false;
  }

  if (publicFeatureSurfaceFiles.has(imported.basename)) {
    return false;
  }

  if (privateFeatureSegments.has(imported.firstSegment)) {
    return true;
  }

  return imported.firstSegment === "queryKeys";
};

const collectPrivateCrossFeatureImports = () =>
  collectSourceFiles(featuresRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    const importerPath = relative(projectRoot, filePath).replace(/\\/g, "/");

    return Array.from(source.matchAll(importDeclarationPattern))
      .map((match) => match[1])
      .filter((importSource): importSource is string => Boolean(importSource))
      .map((importSource) => ({
        importSource,
        importTarget: toProjectRelativeImportTarget(filePath, importSource),
      }))
      .filter(
        ({ importTarget }) =>
          importTarget !== null &&
          importsPrivateCrossFeatureSurface(importerPath, importTarget),
      )
      .map(
        ({ importSource, importTarget }) =>
          `${importerPath} imports ${importSource} (${importTarget})`,
      );
  });
```

Then replace the current search/wishlist-only test with:

```ts
it("keeps feature-to-feature imports on public feature surfaces", () => {
  expect(collectPrivateCrossFeatureImports()).toEqual([]);
});
```

Keep the existing route lazy import and public barrel tests unchanged.

- [ ] **Step 2: Run the boundary test and confirm the current violations**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/routes/route-boundary-contracts.test.ts
```

Expected: FAIL. The failure list must include these production imports:

```text
src/features/accommodations/hooks/useAccommodationBooking.ts imports ../../reservations/lib/paymentRouteState
src/features/accommodations/hooks/useAccommodationBooking.ts imports ../../reservations/lib/reservationCheckoutHandoff
src/features/accommodations/components/AccommodationReviewsSection.tsx imports ../../reviews/lib/reviewViewModel
src/features/reviews/hooks/useReviewCreate.ts imports ../../reservations/hooks/useReservationDetailQuery
src/features/reviews/hooks/useReviewCreate.ts imports ../../reservations/queryKeys
src/features/reviews/hooks/useReviewCreate.ts imports ../../accommodations/queryKeys
```

- [ ] **Step 3: Commit the failing contract**

```bash
git add src/routes/route-boundary-contracts.test.ts
git commit -m "test: define frontend feature boundary freeze"
```

### Task 2: Move Cross-Feature Workflow Access To Public Surfaces

**Files:**
- Create: `src/features/accommodations/publicCache.ts`
- Modify: `src/features/reservations/appShell.ts`
- Modify: `src/features/reservations/publicCache.ts`
- Modify: `src/features/reviews/appShell.ts`
- Modify: `src/features/accommodations/appShell.ts`
- Modify: `src/features/accommodations/components/AccommodationReviewsSection.tsx`
- Modify: `src/features/accommodations/hooks/useAccommodationBooking.ts`
- Modify: `src/features/reviews/hooks/useReviewCreate.ts`
- Test: `src/routes/route-boundary-contracts.test.ts`
- Test: `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`
- Test: `src/features/reviews/hooks/useReviewCreate.test.ts`
- Test: `src/features/accommodations/components/AccommodationReviewsSection.test.tsx`

- [ ] **Step 1: Add accommodation cache public API**

Create `src/features/accommodations/publicCache.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { accommodationQueryKeys } from "./queryKeys";

export const invalidateAccommodationReviewCaches = (
  queryClient: QueryClient,
  accommodationId: number | string,
) =>
  queryClient.invalidateQueries({
    queryKey: accommodationQueryKeys.reviewsRoot(String(accommodationId)),
  });
```

- [ ] **Step 2: Export reservation public workflow APIs**

Update `src/features/reservations/appShell.ts` to:

```ts
export { GuestTripsPanel } from "./GuestTripsPanel";
export { HostReservationsPanel } from "./HostReservationsPanel";
export { useReservationDetailQuery } from "./hooks/useReservationDetailQuery";
export { formatCheckoutDateParam } from "./lib/paymentRouteState";
export {
  startReservationCheckoutHandoff,
  type AppliedReservationCheckoutCoupon,
  type ReservationCheckoutHandoffNavigate,
  type ReservationCheckoutHandoffResult,
  type StartReservationCheckoutHandoffOptions,
} from "./lib/reservationCheckoutHandoff";
```

- [ ] **Step 3: Add reservation cache public API**

Update `src/features/reservations/publicCache.ts` to:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { reservationQueryKeys } from "./queryKeys";

export const invalidateGuestReservationCaches = async (
  queryClient: QueryClient,
  reservationUid: string,
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: reservationQueryKeys.guestReservationDetail(reservationUid),
    }),
    queryClient.invalidateQueries({
      queryKey: reservationQueryKeys.guestReservationsRoot,
    }),
  ]);
};

export const invalidateReservationPaymentCaches =
  invalidateGuestReservationCaches;
```

- [ ] **Step 4: Export review presentation public API**

Keep `src/features/reviews/appShell.ts` as the public review display surface:

```ts
export { ReviewModal } from "./components/ReviewModal/ReviewModal";
export {
  toReviewViewModel,
  toReviewViewModels,
} from "./lib/reviewViewModel";
export type { ReviewViewModel } from "./lib/reviewViewModel";
```

This file already has the correct shape. Do not export review mutation hooks from it.

- [ ] **Step 5: Keep accommodation appShell UI-only**

Update `src/features/accommodations/appShell.ts` to:

```ts
export { AccommodationActionModal } from "./components/AccommodationActionModal";
export { useCreateAccommodationDraft } from "./hooks/useCreateAccommodationDraft";
```

Do not export `publicCache` from `appShell`; cross-feature cache callers should import `../accommodations/publicCache` explicitly.

- [ ] **Step 6: Update accommodation booking to use reservation appShell**

In `src/features/accommodations/hooks/useAccommodationBooking.ts`, replace:

```ts
import { formatCheckoutDateParam } from "../../reservations/lib/paymentRouteState";
import { startReservationCheckoutHandoff } from "../../reservations/lib/reservationCheckoutHandoff";
```

with:

```ts
import {
  formatCheckoutDateParam,
  startReservationCheckoutHandoff,
} from "../../reservations/appShell";
```

- [ ] **Step 7: Update accommodation review section to use review appShell**

In `src/features/accommodations/components/AccommodationReviewsSection.tsx`, replace:

```ts
import type { ReviewViewModel } from "../../reviews/lib/reviewViewModel";
```

with:

```ts
import type { ReviewViewModel } from "../../reviews/appShell";
```

- [ ] **Step 8: Update review creation cache access**

In `src/features/reviews/hooks/useReviewCreate.ts`, replace:

```ts
import { accommodationQueryKeys } from "../../accommodations/queryKeys";
import { useReservationDetailQuery } from "../../reservations/hooks/useReservationDetailQuery";
import { reservationQueryKeys } from "../../reservations/queryKeys";
```

with:

```ts
import { invalidateAccommodationReviewCaches } from "../../accommodations/publicCache";
import { useReservationDetailQuery } from "../../reservations/appShell";
import { invalidateGuestReservationCaches } from "../../reservations/publicCache";
```

Then replace `invalidateReviewCreateCaches` with:

```ts
const invalidateReviewCreateCaches = useCallback(
  async (reviewedReservation: ReservationDetailInfo) => {
    await Promise.all([
      invalidateGuestReservationCaches(
        queryClient,
        reviewedReservation.reservation_uid,
      ),
      invalidateAccommodationReviewCaches(
        queryClient,
        reviewedReservation.accommodation.id,
      ),
    ]);
  },
  [queryClient],
);
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand \
  src/routes/route-boundary-contracts.test.ts \
  src/features/accommodations/hooks/useAccommodationBooking.test.tsx \
  src/features/reviews/hooks/useReviewCreate.test.ts \
  src/features/accommodations/components/AccommodationReviewsSection.test.tsx
```

Expected: PASS. The route boundary test must report zero cross-feature private imports.

- [ ] **Step 10: Commit**

```bash
git add \
  src/features/accommodations/publicCache.ts \
  src/features/reservations/appShell.ts \
  src/features/reservations/publicCache.ts \
  src/features/reviews/appShell.ts \
  src/features/accommodations/appShell.ts \
  src/features/accommodations/components/AccommodationReviewsSection.tsx \
  src/features/accommodations/hooks/useAccommodationBooking.ts \
  src/features/reviews/hooks/useReviewCreate.ts \
  src/routes/route-boundary-contracts.test.ts
git commit -m "refactor: freeze feature public boundaries"
```

### Task 3: Centralize Query Error Toast Handling

**Files:**
- Create: `src/query/useHandledQueryError.ts`
- Create: `src/query/useHandledQueryError.test.tsx`
- Modify: `src/features/reservations/hooks/useReservationDetail.ts`
- Modify: `src/features/reservations/hooks/useReservationConfirmAccommodation.ts`
- Modify: `src/features/reservations/hooks/useReservationList.ts`
- Modify: `src/features/reservations/hooks/useHostReservationDetail.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationDetail.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationReviews.ts`
- Modify: `src/features/profile/hooks/useHostListings.ts`
- Modify: `src/features/wishlist/hooks/useWishlistData.ts`
- Modify: `src/features/search/hooks/useSearchResults.ts`
- Modify: `src/features/reviews/hooks/useReviewCreate.ts`

- [ ] **Step 1: Add the shared hook test**

Create `src/query/useHandledQueryError.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { useHandledQueryError } from "./useHandledQueryError";

describe("useHandledQueryError", () => {
  it("handles a query error once per errorUpdatedAt value", () => {
    const onError = jest.fn();
    const error = new Error("first failure");

    const { rerender } = renderHook(
      ({ errorUpdatedAt }) =>
        useHandledQueryError({
          error,
          errorUpdatedAt,
          isError: true,
          onError,
        }),
      {
        initialProps: { errorUpdatedAt: 10 },
      },
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);

    rerender({ errorUpdatedAt: 10 });
    expect(onError).toHaveBeenCalledTimes(1);

    rerender({ errorUpdatedAt: 11 });
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("does not handle null or inactive error state", () => {
    const onError = jest.fn();

    renderHook(() =>
      useHandledQueryError({
        error: null,
        errorUpdatedAt: 1,
        isError: false,
        onError,
      }),
    );

    expect(onError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the shared hook test and confirm it fails**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/query/useHandledQueryError.test.tsx
```

Expected: FAIL with module not found for `./useHandledQueryError`.

- [ ] **Step 3: Implement the shared hook**

Create `src/query/useHandledQueryError.ts`:

```ts
import { useEffect, useRef } from "react";

interface UseHandledQueryErrorOptions {
  error: unknown;
  errorUpdatedAt: number;
  isError: boolean;
  onError: (error: unknown) => unknown;
}

export const useHandledQueryError = ({
  error,
  errorUpdatedAt,
  isError,
  onError,
}: UseHandledQueryErrorOptions) => {
  const handledErrorUpdatedAtRef = useRef(0);

  useEffect(() => {
    if (
      !isError ||
      !error ||
      handledErrorUpdatedAtRef.current === errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = errorUpdatedAt;
    onError(error);
  }, [error, errorUpdatedAt, isError, onError]);
};
```

- [ ] **Step 4: Replace duplicate error refs in feature hooks**

For each target hook, remove local `handledErrorUpdatedAtRef` and replace its effect with `useHandledQueryError`.

Example for `src/features/reservations/hooks/useReservationDetail.ts`:

```ts
import { useCallback } from "react";
import { useApiError } from "../../../hooks/useApiError";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
import { useReservationDetailQuery } from "./useReservationDetailQuery";

export function useReservationDetail(reservationUid?: string) {
  const { error, handleError, clearError } = useApiError();
  const detailQuery = useReservationDetailQuery(reservationUid);
  const { refetch } = detailQuery;

  useHandledQueryError({
    error: detailQuery.error,
    errorUpdatedAt: detailQuery.errorUpdatedAt,
    isError: detailQuery.isError,
    onError: handleError,
  });

  const reload = useCallback(async () => {
    if (!reservationUid) return;

    clearError();
    await refetch();
  }, [clearError, refetch, reservationUid]);

  return {
    clearError,
    error,
    isError: detailQuery.isError,
    isLoading: detailQuery.isLoading,
    reload,
    reservation: detailQuery.isError ? null : detailQuery.data ?? null,
  };
}
```

For every file listed under this task, delete the local `handledErrorUpdatedAtRef` declaration and delete the `useEffect` block that compares `errorUpdatedAt`. Insert one `useHandledQueryError` call next to the query declaration. In `useWishlistData.ts`, insert these three calls:

```ts
useHandledQueryError({
  error: recentlyViewedQuery.error,
  errorUpdatedAt: recentlyViewedQuery.errorUpdatedAt,
  isError: recentlyViewedQuery.isError,
  onError: handleError,
});

useHandledQueryError({
  error: wishlistsQuery.error,
  errorUpdatedAt: wishlistsQuery.errorUpdatedAt,
  isError: wishlistsQuery.isError,
  onError: handleError,
});

useHandledQueryError({
  error: wishlistDetailQuery.error,
  errorUpdatedAt: wishlistDetailQuery.errorUpdatedAt,
  isError: wishlistDetailQuery.isError,
  onError: handleError,
});
```

- [ ] **Step 5: Add a source guard against repeated local refs**

In `src/verification-gate.test.ts`, add this test inside `describe("frontend verification gate", () => { ... })`:

```ts
test("query error toast handling uses the shared query hook", () => {
  const productionFiles = getProductionSourceFiles()
    .map(toProjectPath)
    .filter((relativePath) => relativePath.startsWith("src/features/"));

  const violations = productionFiles.filter((relativePath) => {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
    return /handledErrorUpdatedAtRef/.test(source);
  });

  expect(violations).toEqual([]);
});
```

- [ ] **Step 6: Run focused query tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand \
  src/query/useHandledQueryError.test.tsx \
  src/features/reservations/hooks/useReservationDetail.test.ts \
  src/features/reservations/hooks/useReservationList.test.ts \
  src/features/accommodations/hooks/useAccommodationDetail.test.ts \
  src/features/accommodations/hooks/useAccommodationReviews.test.ts \
  src/features/profile/hooks/useHostListings.test.ts \
  src/features/wishlist/hooks/useWishlistData.test.ts \
  src/features/search/hooks/useSearchResults.test.tsx \
  src/features/reviews/hooks/useReviewCreate.test.ts \
  src/verification-gate.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add \
  src/query/useHandledQueryError.ts \
  src/query/useHandledQueryError.test.tsx \
  src/features/reservations/hooks/useReservationDetail.ts \
  src/features/reservations/hooks/useReservationConfirmAccommodation.ts \
  src/features/reservations/hooks/useReservationList.ts \
  src/features/reservations/hooks/useHostReservationDetail.ts \
  src/features/accommodations/hooks/useAccommodationDetail.ts \
  src/features/accommodations/hooks/useAccommodationReviews.ts \
  src/features/profile/hooks/useHostListings.ts \
  src/features/wishlist/hooks/useWishlistData.ts \
  src/features/search/hooks/useSearchResults.ts \
  src/features/reviews/hooks/useReviewCreate.ts \
  src/verification-gate.test.ts
git commit -m "refactor: centralize query error handling"
```

### Task 4: Move Search Route Orchestration Into A Controller Hook

**Files:**
- Create: `src/features/search/hooks/useSearchRouteController.ts`
- Create: `src/features/search/hooks/useSearchRouteController.test.tsx`
- Modify: `src/features/search/SearchRoute.tsx`
- Test: `src/features/search/SearchRoute.test.tsx`
- Test: `src/features/search/hooks/useSearchRouteController.test.tsx`

- [ ] **Step 1: Add route controller source contract**

In `src/features/search/SearchRoute.test.tsx`, add:

```tsx
import fs from "fs";
import path from "path";

describe("SearchRoute structure", () => {
  it("keeps route orchestration in useSearchRouteController", () => {
    const routeSource = fs.readFileSync(
      path.join(process.cwd(), "src/features/search/SearchRoute.tsx"),
      "utf8",
    );

    expect(routeSource).toContain("useSearchRouteController");
    expect(routeSource).not.toContain("window.open(");
    expect(routeSource).not.toContain("routeTo.accommodationDetail");
    expect(routeSource).not.toContain("useSearchResults({");
    expect(routeSource).not.toContain("useSearchWishlistModal({");
  });
});
```

- [ ] **Step 2: Run the route test and confirm it fails**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/search/SearchRoute.test.tsx
```

Expected: FAIL because `SearchRoute.tsx` still contains route orchestration and direct `window.open`.

- [ ] **Step 3: Create the controller hook**

Create `src/features/search/hooks/useSearchRouteController.ts`:

```ts
import { useCallback } from "react";
import { useApiError } from "../../../hooks/useApiError";
import { useAuth } from "../../../hooks/useAuth";
import { routeTo } from "../../../routes/paths";
import { useSearchBottomSheet } from "./useSearchBottomSheet";
import { useSearchMapState } from "./useSearchMapState";
import { useSearchResults } from "./useSearchResults";
import { useSearchWishlistModal } from "./useSearchWishlistModal";
import { toAccommodationBookingRouteQuery } from "../lib/accommodationDetailParams";

type SetSearchParams = (
  nextParams: URLSearchParams,
  options?: { replace?: boolean },
) => void;

interface UseSearchRouteControllerOptions {
  openWindow?: (url: string, target: string) => Window | null;
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParams;
}

export const useSearchRouteController = ({
  openWindow = window.open,
  searchParams,
  setSearchParams,
}: UseSearchRouteControllerOptions) => {
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const mapState = useSearchMapState();
  const searchResults = useSearchResults({
    searchParams,
    setSearchParams,
    handleError,
    clearError,
    setIsMapDragMode: mapState.setIsMapDragMode,
    requestMapBoundsUpdate: mapState.requestMapBoundsUpdate,
  });
  const bottomSheet = useSearchBottomSheet();
  const wishlist = useSearchWishlistModal({
    isAuthenticated,
    onWishlistStatusChange: searchResults.updateAccommodationWishlistStatus,
  });

  const openAccommodationDetail = useCallback(
    (accommodationId: number) => {
      const detailParams = toAccommodationBookingRouteQuery(searchParams);

      openWindow(
        routeTo.accommodationDetail(accommodationId, detailParams),
        "_blank",
      );
      mapState.selectAccommodationId(accommodationId);
    },
    [mapState, openWindow, searchParams],
  );

  return {
    bottomSheet,
    checkIn: searchParams.get("checkIn"),
    checkOut: searchParams.get("checkOut"),
    clearError,
    error,
    hasResults: searchResults.accommodationCards.length > 0,
    mapState,
    openAccommodationDetail,
    searchResults,
    wishlist,
  };
};
```

- [ ] **Step 4: Add controller behavior test**

Create `src/features/search/hooks/useSearchRouteController.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { useSearchRouteController } from "./useSearchRouteController";

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    clearError: jest.fn(),
    error: null,
    handleError: jest.fn(),
  }),
}));

jest.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

const selectAccommodationId = jest.fn();
const setIsMapDragMode = jest.fn();
const requestMapBoundsUpdate = jest.fn();

jest.mock("./useSearchMapState", () => ({
  useSearchMapState: () => ({
    hoveredAccommodationId: null,
    isMapDragMode: false,
    isMapExpanded: false,
    onMapBoundsUpdated: jest.fn(),
    requestMapBoundsUpdate,
    selectAccommodationId,
    selectedAccommodationId: null,
    setHoveredAccommodationId: jest.fn(),
    setIsMapDragMode,
    shouldUpdateMapBounds: false,
    toggleMapExpanded: jest.fn(),
    handleAccommodationSelect: jest.fn(),
  }),
}));

jest.mock("./useSearchResults", () => ({
  useSearchResults: () => ({
    accommodationCards: [],
    accommodationMapItems: [],
    currentPage: 0,
    handleMapBoundsChange: jest.fn(),
    handlePageChange: jest.fn(),
    isLoading: false,
    totalElements: 0,
    totalPages: 0,
    updateAccommodationWishlistStatus: jest.fn(),
  }),
}));

jest.mock("./useSearchBottomSheet", () => ({
  useSearchBottomSheet: () => ({
    bottomSheetRef: { current: null },
    bottomSheetState: "collapsed",
    handleBottomSheetScroll: jest.fn(),
    handleDrag: jest.fn(),
    handleDragEnd: jest.fn(),
    handleDragStart: jest.fn(),
    handleMapInteraction: jest.fn(),
    isMobileOrTablet: false,
    snapPositions: { collapsed: 0, expanded: 0 },
    translateY: 0,
  }),
}));

jest.mock("./useSearchWishlistModal", () => ({
  useSearchWishlistModal: () => ({
    authModalOpen: false,
    closeAuthModal: jest.fn(),
    closeWishlistModal: jest.fn(),
    handleAuthSuccess: jest.fn(),
    openWishlistModal: jest.fn(),
    selectedAccommodationForWishlist: null,
    wishlistModalOpen: false,
  }),
}));

describe("useSearchRouteController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens accommodation detail with booking query params and records selection", () => {
    const openWindow = jest.fn();
    const { result } = renderHook(() =>
      useSearchRouteController({
        openWindow,
        searchParams: new URLSearchParams(
          "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
        ),
        setSearchParams: jest.fn(),
      }),
    );

    result.current.openAccommodationDetail(42);

    expect(openWindow).toHaveBeenCalledWith(
      "/accommodations/42?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
      "_blank",
    );
    expect(selectAccommodationId).toHaveBeenCalledWith(42);
  });
});
```

- [ ] **Step 5: Update SearchRoute to consume the controller**

In `src/features/search/SearchRoute.tsx`:

- Remove imports for `useApiError`, `useAuth`, `routeTo`, `useSearchBottomSheet`, `useSearchMapState`, `useSearchResults`, `useSearchWishlistModal`, and `toAccommodationBookingRouteQuery`.
- Add:

```ts
import { useSearchRouteController } from "./hooks/useSearchRouteController";
```

Inside `SearchRouteContent`, replace the current hook orchestration block with:

```ts
const {
  bottomSheet,
  checkIn,
  checkOut,
  clearError,
  error,
  hasResults,
  mapState,
  openAccommodationDetail,
  searchResults,
  wishlist,
} = useSearchRouteController({ searchParams, setSearchParams });
```

Then update JSX references:

```ts
mapState.selectedAccommodationId
mapState.hoveredAccommodationId
mapState.isMapExpanded
mapState.isMapDragMode
mapState.shouldUpdateMapBounds
mapState.setHoveredAccommodationId
mapState.handleAccommodationSelect
mapState.toggleMapExpanded
mapState.onMapBoundsUpdated
searchResults.accommodationCards
searchResults.accommodationMapItems
searchResults.isLoading
searchResults.currentPage
searchResults.totalPages
searchResults.totalElements
searchResults.handleMapBoundsChange
searchResults.handlePageChange
bottomSheet.bottomSheetState
bottomSheet.isMobileOrTablet
bottomSheet.bottomSheetRef
bottomSheet.snapPositions
bottomSheet.translateY
bottomSheet.handleDragStart
bottomSheet.handleDrag
bottomSheet.handleDragEnd
bottomSheet.handleMapInteraction
bottomSheet.handleBottomSheetScroll
wishlist.authModalOpen
wishlist.closeAuthModal
wishlist.closeWishlistModal
wishlist.handleAuthSuccess
wishlist.openWishlistModal
wishlist.selectedAccommodationForWishlist
wishlist.wishlistModalOpen
openAccommodationDetail
```

- [ ] **Step 6: Run focused search tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand \
  src/features/search/hooks/useSearchRouteController.test.tsx \
  src/features/search/SearchRoute.test.tsx \
  src/features/search/hooks/useSearchResults.test.tsx \
  src/features/search/hooks/useSearchWishlistModal.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add \
  src/features/search/hooks/useSearchRouteController.ts \
  src/features/search/hooks/useSearchRouteController.test.tsx \
  src/features/search/SearchRoute.tsx \
  src/features/search/SearchRoute.test.tsx
git commit -m "refactor: isolate search route orchestration"
```

### Task 5: Split Auth Session Lifecycle From AuthProvider

**Files:**
- Create: `src/features/auth/lib/sessionLifecycle.ts`
- Create: `src/features/auth/lib/sessionLifecycle.test.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Test: `src/contexts/AuthContext.test.tsx`

- [ ] **Step 1: Add lifecycle tests**

Create `src/features/auth/lib/sessionLifecycle.test.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";
import { authApi } from "../../../api";
import { clearAllReservationCheckoutState } from "../../reservations/lib/reservationCheckoutState";
import {
  clearAuthenticatedSession,
  refreshAuthenticatedSession,
} from "./sessionLifecycle";

jest.mock("../../../api", () => ({
  authApi: {
    getMe: jest.fn(),
  },
}));

jest.mock("../../reservations/lib/reservationCheckoutState", () => ({
  clearAllReservationCheckoutState: jest.fn(),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe("sessionLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears reservation checkout state when clearing authenticated session", async () => {
    const queryClient = createQueryClient();

    await clearAuthenticatedSession(queryClient);

    expect(clearAllReservationCheckoutState).toHaveBeenCalledTimes(1);
  });

  it("refreshes session data from authApi.getMe", async () => {
    const queryClient = createQueryClient();
    const meInfo = {
      id: 1,
      email: "qa@example.com",
      nickname: "QA",
      profile_image_url: null,
    };
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);

    await refreshAuthenticatedSession(queryClient);

    expect(authApi.getMe).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run lifecycle tests and confirm they fail**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/auth/lib/sessionLifecycle.test.ts
```

Expected: FAIL with module not found for `./sessionLifecycle`.

- [ ] **Step 3: Implement session lifecycle lib**

Create `src/features/auth/lib/sessionLifecycle.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { authApi } from "../../../api";
import {
  clearSessionQueryData,
  refreshSessionQueryData,
} from "../../../query/sessionCacheBoundary";
import { MeInfo } from "../../../types/auth";
import { clearAllReservationCheckoutState } from "../../reservations/lib/reservationCheckoutState";

export const clearAuthenticatedSession = async (queryClient: QueryClient) => {
  clearAllReservationCheckoutState();
  await clearSessionQueryData(queryClient);
};

export const refreshAuthenticatedSession = async (
  queryClient: QueryClient,
): Promise<MeInfo> => {
  try {
    const meInfo = await authApi.getMe();
    await refreshSessionQueryData(queryClient, meInfo);
    return meInfo;
  } catch (error) {
    await clearAuthenticatedSession(queryClient);
    throw error;
  }
};
```

- [ ] **Step 4: Simplify AuthContext imports and callbacks**

In `src/contexts/AuthContext.tsx`, remove imports:

```ts
import { authApi } from "../api";
import {
  clearSessionQueryData,
  refreshSessionQueryData,
} from "../query/sessionCacheBoundary";
import { clearAllReservationCheckoutState } from "../features/reservations/lib/reservationCheckoutState";
```

Add:

```ts
import { authApi } from "../api";
import {
  clearAuthenticatedSession,
  refreshAuthenticatedSession,
} from "../features/auth/lib/sessionLifecycle";
```

Then replace `clearSession` and `refreshSession` implementations with:

```ts
const clearSession = useCallback(async () => {
  await clearAuthenticatedSession(queryClient);
}, [queryClient]);

const refreshSession = useCallback(async () => {
  await refreshAuthenticatedSession(queryClient);
}, [queryClient]);
```

Keep `login` and `logout` in `AuthContext.tsx`; they remain user actions exposed by the provider.

- [ ] **Step 5: Run auth tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand \
  src/features/auth/lib/sessionLifecycle.test.ts \
  src/contexts/AuthContext.test.tsx \
  src/routes/RequireAuth.test.tsx \
  src/layouts/AppHeader/UserMenu.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  src/features/auth/lib/sessionLifecycle.ts \
  src/features/auth/lib/sessionLifecycle.test.ts \
  src/contexts/AuthContext.tsx
git commit -m "refactor: isolate auth session lifecycle"
```

### Task 6: Document Freeze Criteria And Promote Verification

**Files:**
- Create: `docs/architecture/frontend-architecture-freeze.ko.md`
- Modify: `docs/architecture/frontend-structure-refactor.md`
- Modify: `src/verification-gate.test.ts`
- Modify: `README.md`
- Test: `src/verification-gate.test.ts`

- [ ] **Step 1: Add verification test for freeze documentation**

In `src/verification-gate.test.ts`, add constants near the existing architecture doc path:

```ts
const architectureFreezeDocPath = path.join(
  projectRoot,
  "docs/architecture/frontend-architecture-freeze.ko.md",
);
```

Then add this test:

```ts
test("frontend architecture freeze criteria are documented", () => {
  expect(fs.existsSync(architectureFreezeDocPath)).toBe(true);

  const freezeDoc = fs.readFileSync(architectureFreezeDocPath, "utf8");

  [
    "구조 freeze 기준",
    "Production feature 파일은 다른 feature의 private surface를 직접 import하지 않는다.",
    "Cross-feature 사용은 appShell.ts 또는 publicCache.ts를 통한다.",
    "SearchRoute는 화면 렌더링을 담당하고 useSearchRouteController가 route orchestration을 소유한다.",
    "Query 에러 toast 중복 방지는 useHandledQueryError가 소유한다.",
    "AuthProvider는 provider 역할을 맡고 sessionLifecycle이 세션 side effect를 소유한다.",
    "Airbnb 스타일 시각 리팩토링은 이 문서의 freeze gate 통과 뒤 화면 단위로 진행한다.",
  ].forEach((term) => {
    expect(freezeDoc).toContain(term);
  });
});
```

- [ ] **Step 2: Run verification test and confirm it fails**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
```

Expected: FAIL because `docs/architecture/frontend-architecture-freeze.ko.md` does not exist.

- [ ] **Step 3: Create freeze documentation**

Create `docs/architecture/frontend-architecture-freeze.ko.md`:

````md
# Airbob Frontend Architecture Freeze

## 구조 freeze 기준

- Production feature 파일은 다른 feature의 private surface를 직접 import하지 않는다.
- Cross-feature 사용은 appShell.ts 또는 publicCache.ts를 통한다.
- Route path와 route query contract는 src/routes가 소유한다.
- Feature public index.ts는 route container export만 허용한다.
- SearchRoute는 화면 렌더링을 담당하고 useSearchRouteController가 route orchestration을 소유한다.
- Query 에러 toast 중복 방지는 useHandledQueryError가 소유한다.
- AuthProvider는 provider 역할을 맡고 sessionLifecycle이 세션 side effect를 소유한다.
- API response shape와 backend contract는 프론트 구조 정리에서 변경하지 않는다.
- Airbnb 스타일 시각 리팩토링은 이 문서의 freeze gate 통과 뒤 화면 단위로 진행한다.

## 의도적으로 남기는 리스크

- Search, accommodation detail, reservation/payment, wishlist는 여전히 큰 화면이다.
- CSS Modules에는 feature-local hard-coded value가 남아 있다.
- Strict browser smoke는 QA 계정, stable reservation UID, frontend server, backend server, GSTACK_BROWSE_BIN이 있어야 실행된다.
- CRA-to-Vite migration은 구조 freeze 이후 별도 브랜치에서만 진행한다.

## Freeze Gate

```bash
npm run verify:structure
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
```

브라우저 플로우까지 닫을 때는 아래 명령을 별도로 실행한다.

```bash
npm run verify:design-ready
```
````

- [ ] **Step 4: Update existing architecture doc**

Append to `docs/architecture/frontend-structure-refactor.md`:

```md

## Architecture Freeze

- Freeze criteria now live in `docs/architecture/frontend-architecture-freeze.ko.md`.
- Future frontend structure audits should start from the freeze criteria instead of restarting a full-app audit.
- Design work should proceed screen-by-screen after `npm run verify:structure` passes.
```

- [ ] **Step 5: Update README verification section**

In `README.md`, add this command note near the existing verification commands:

````md
### Frontend Architecture Freeze

구조 리팩토링 종료 기준은 `docs/architecture/frontend-architecture-freeze.ko.md`에 기록되어 있습니다.

```bash
npm run verify:structure
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
```

브라우저 기반 smoke까지 확인하려면 QA 계정, 안정적인 reservation UID, 프론트/백엔드 서버, `GSTACK_BROWSE_BIN`을 준비한 뒤 실행합니다.

```bash
npm run verify:design-ready
```
````

- [ ] **Step 6: Run documentation verification**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add \
  docs/architecture/frontend-architecture-freeze.ko.md \
  docs/architecture/frontend-structure-refactor.md \
  src/verification-gate.test.ts \
  README.md
git commit -m "docs: record frontend architecture freeze criteria"
```

### Task 7: Final Freeze Verification

**Files:**
- No code files expected beyond Tasks 1-6.

- [ ] **Step 1: Run full structure gate**

Run:

```bash
npm run verify:structure
```

Expected: PASS for `typecheck`, full no-cache Jest in band, and `lint:strict`.

- [ ] **Step 2: Run pre-redesign static gate**

Run:

```bash
npm run verify:pre-redesign
```

Expected: PASS for `typecheck`, full no-cache Jest in band, and production build. Existing `baseline-browser-mapping` or `caniuse-lite` freshness warnings are acceptable only if the command exits 0.

- [ ] **Step 3: Run strict smoke preflight when local env is available**

Run:

```bash
npm run smoke:frontend:preflight
```

Expected when env is missing: FAIL listing missing `AIRBOB_QA_EMAIL`, `AIRBOB_QA_PASSWORD`, or `GSTACK_BROWSE_BIN`.

Expected when env and servers are ready: PASS with frontend and backend reachability messages and no leaked credentials.

- [ ] **Step 4: Confirm no uncommitted changes**

Run:

```bash
git status --short --branch
```

Expected:

```text
## codex/frontend-post-merge-audit-plan-20260706
```

- [ ] **Step 5: Create final verification commit only if documentation changed during verification**

If Task 7 required documentation edits, run:

```bash
git add docs README.md
git commit -m "docs: finalize frontend architecture freeze verification"
```

If no files changed, do not create an empty commit.

## Execution Order

1. Task 1: write the failing all-feature boundary contract.
2. Task 2: close current cross-feature private imports through public surfaces.
3. Task 3: centralize Query error handling.
4. Task 4: isolate Search route orchestration.
5. Task 5: isolate Auth session lifecycle.
6. Task 6: document freeze criteria and gate.
7. Task 7: run final verification.

## Risk Notes

- Task 2 can expose more private imports than the current manual scan. Treat every reported production import as a real boundary violation unless it is same-feature or goes through `appShell.ts`/`publicCache.ts`.
- Task 4 is the most behavior-sensitive because Search combines map, mobile bottom sheet, wishlist modal, and URL state. Keep the controller as a wiring hook and avoid changing search result or map behavior.
- Task 5 must preserve logout order: local session/cache clearing remains best-effort before server logout completion, and cookie clearing remains in the final logout cleanup.
- Browser smoke remains external-env dependent and is not a blocker for static architecture freeze.

## Self-Review

- Spec coverage: This plan addresses the repeated audit concern by creating a freeze gate, closing cross-feature private imports, reducing repeated Query error handling, isolating Search orchestration, isolating Auth session side effects, and documenting the new audit starting point.
- Placeholder scan: No task contains open-ended implementation placeholders. Each code-changing task includes concrete file paths, code blocks, commands, expected outcomes, and commit messages.
- Type consistency: Public surface names are stable across tasks: `useHandledQueryError`, `useSearchRouteController`, `clearAuthenticatedSession`, `refreshAuthenticatedSession`, `invalidateAccommodationReviewCaches`, and `invalidateReservationPaymentCaches`.
