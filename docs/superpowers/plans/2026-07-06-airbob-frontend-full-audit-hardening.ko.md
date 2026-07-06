# Airbob Frontend Full Audit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 리팩토링에 들어가기 전에, 2026-07-06 전체 프론트 점검에서 드러난 URL/query, cache, feature boundary, UI accessibility, verification gate 리스크를 닫는다.

**Architecture:** 기존 feature-first 구조와 thin page adapter는 유지한다. URL/query canonicalization은 shared/routes 쪽으로 끌어올리고, feature 간 cache/state 접근은 public seam과 query key contract로 제한한다. 디자인 변경은 하지 않고, shared primitive와 고위험 CSS가 Airbnb 스타일을 받을 수 있는 구조와 검증만 먼저 만든다.

**Tech Stack:** React 19, TypeScript 4.9, React Router 7, TanStack Query 5, Axios, CRA/react-scripts, Jest, React Testing Library, CSS Modules, gstack smoke/browser QA.

---

## Starting State From Full Audit

- Base branch: `main`
- Audit branch: `codex/frontend-full-audit-plan`
- Latest merged baseline during audit: `3b4dcac` (`Merge pull request #7 from eeoos/codex/frontend-structure-first-refactor`)
- `npm run typecheck`: passed
- `npm run verify:pre-redesign`: passed with 175 suites and 839 tests, then build passed
- `npm run lint -- --format compact`: failed with 81 problems
- `npm run smoke:frontend:strict`: blocked before browser execution because `AIRBOB_QA_EMAIL`, `AIRBOB_QA_PASSWORD`, and `GSTACK_BROWSE_BIN` were not set
- Build warnings remain: stale `baseline-browser-mapping`, stale `browserslist/caniuse-lite`, and `react-hooks/exhaustive-deps` in `src/features/search/hooks/useSearchResults.ts`

## Files And Ownership

Create:

- `src/shared/lib/urlSearchParams.ts` - domain-free URLSearchParams helpers used by routes and feature query keys.
- `src/shared/lib/urlSearchParams.test.ts` - canonicalization and append helper tests.
- `src/features/reservations/publicCache.ts` - public reservation cache invalidation seam for payment/review/profile flows.
- `src/features/reservations/publicCache.test.ts` - reservation cache invalidation contract.
- `src/features/reservations/appShell.ts` - explicit reservation feature surface for profile shell composition.

Modify:

- `src/routes/routeQuery.ts` - re-export shared URLSearchParams helpers to keep existing route imports working while features stop importing routes.
- `src/routes/route-boundary-contracts.test.ts` - remove route feature-import allowlist after route query and app-shell seams are explicit.
- `src/features/search/lib/searchParams.ts` - sanitize search query signatures and import shared URL helpers.
- `src/features/search/queryKeys.ts` - stop importing from routes.
- `src/features/search/queryKeys.test.ts` - assert query keys only receive canonical safe signatures.
- `src/features/search/hooks/useSearchResults.ts` - remove the build warning by making memo dependencies align with actual inputs.
- `src/features/search/hooks/useSearchResults.test.tsx` - preserve pagination, map-drag, and wishlist patch behavior after signature changes.
- `src/features/wishlist/queryKeys.ts` - stop importing from routes.
- `src/features/wishlist/queryKeys.test.ts` - keep canonical wishlist key behavior.
- `src/features/accommodations/queryKeys.ts` - own review query keys under accommodation query keys.
- `src/features/accommodations/hooks/useAccommodationReviews.ts` - use accommodation review query key helpers.
- `src/features/accommodations/hooks/useAccommodationReviews.test.ts` - preserve first page, load-more, stale response, and error behavior.
- `src/features/reviews/hooks/useReviewCreate.ts` - invalidate review keys through `accommodationQueryKeys`.
- `src/features/reviews/hooks/useReviewCreate.test.ts` - preserve review success and image-upload partial failure invalidations.
- `src/features/reservations/PaymentSuccessRoute.tsx` - invalidate reservation caches after confirmed payment before redirect.
- `src/features/reservations/PaymentSuccessRoute.test.tsx` - assert confirmed/fail/invalid payment cache behavior.
- `src/features/reservations/index.ts` - keep route-only public barrel unchanged.
- `src/features/profile/ProfileRoute.tsx` - import reservation panels through `features/reservations/appShell`.
- `src/query/sessionCacheBoundary.ts` - expose query root registration metadata or keep roots testable.
- `src/query/sessionCacheBoundary.test.ts` - enforce every user-scoped query root is registered for session clear/refresh.
- `src/components/DatePicker/DatePicker.tsx` - add descriptive month navigation labels.
- `src/components/DatePicker/DatePicker.test.tsx` - assert accessible month navigation.
- `src/features/reviews/ReviewCreateRoute.tsx` - label back icon button and set button type.
- `src/features/reservations/ReservationDetailRoute.tsx` - label image overlay back button and set button type.
- `src/features/wishlist/components/WishlistDetailView.tsx` - label back icon button.
- `src/layouts/AppHeader/UserMenu.tsx` - add menu `id`, `aria-controls`, menu roles, and Escape close.
- `src/layouts/AppHeader/UserMenu.test.tsx` - assert menu a11y contract.
- `src/styles/tokens.test.ts` - enroll shared UI CSS and MainLayout into token ownership.
- `src/layouts/MainLayout.module.css` - replace raw page color/height literals with existing tokens.
- `scripts/smoke/frontend-smoke.mjs` - allow isolated smoke report root for tests.
- `src/verification-gate.test.ts` - assert smoke report isolation and keep smoke env checks.
- `docs/architecture/frontend-structure-refactor.md` - record post-audit structural findings and remaining execution order.

Do not modify:

- Backend/API/DB/server contracts.
- Actual secret values.
- Toss payment SDK contract.
- `verify` default gate until lint and smoke prerequisites are truly stable.
- Shared UI behavioral contracts such as Dialog focus trap, body scroll lock, and focus restore.

## Task 1: Sanitize URL Query Signatures And Remove Feature-To-Route Helper Imports

**Files:**

- Create: `src/shared/lib/urlSearchParams.ts`
- Create: `src/shared/lib/urlSearchParams.test.ts`
- Modify: `src/routes/routeQuery.ts`
- Modify: `src/features/search/lib/searchParams.ts`
- Modify: `src/features/search/queryKeys.ts`
- Modify: `src/features/search/queryKeys.test.ts`
- Modify: `src/features/search/lib/searchParams.test.ts`
- Modify: `src/features/search/hooks/useSearchResults.ts`
- Modify: `src/features/search/hooks/useSearchResults.test.tsx`
- Modify: `src/features/wishlist/queryKeys.ts`
- Modify: `src/features/wishlist/queryKeys.test.ts`

- [ ] **Step 1: Write shared URL helper tests**

Create `src/shared/lib/urlSearchParams.test.ts`:

```ts
import {
  appendDefinedSearchParam,
  toCanonicalSearchString,
} from "./urlSearchParams";

describe("urlSearchParams helpers", () => {
  it("appends only meaningful values", () => {
    const params = new URLSearchParams();

    appendDefinedSearchParam(params, "destination", "Seoul");
    appendDefinedSearchParam(params, "page", 2);
    appendDefinedSearchParam(params, "empty", "");
    appendDefinedSearchParam(params, "nullish", null);
    appendDefinedSearchParam(params, "missing", undefined);

    expect(params.toString()).toBe("destination=Seoul&page=2");
  });

  it("canonicalizes params by key while preserving duplicate values", () => {
    const params = new URLSearchParams();
    params.append("page", "2");
    params.append("destination", "Seoul");
    params.append("destination", "Busan");

    expect(toCanonicalSearchString(params)).toBe(
      "destination=Seoul&destination=Busan&page=2",
    );
  });
});
```

- [ ] **Step 2: Run the new shared helper test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/shared/lib/urlSearchParams.test.ts
```

Expected: FAIL because `src/shared/lib/urlSearchParams.ts` does not exist.

- [ ] **Step 3: Create the shared URL helper**

Create `src/shared/lib/urlSearchParams.ts`:

```ts
export const appendDefinedSearchParam = (
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) => {
  if (value === null || value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
};

export const toCanonicalSearchString = (params: URLSearchParams) =>
  Array.from(params.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .reduce((nextParams, [key, value]) => {
      nextParams.append(key, value);
      return nextParams;
    }, new URLSearchParams())
    .toString();
```

- [ ] **Step 4: Make `routes/routeQuery.ts` a compatibility re-export**

Replace `src/routes/routeQuery.ts` with:

```ts
export {
  appendDefinedSearchParam,
  toCanonicalSearchString,
} from "../shared/lib/urlSearchParams";
```

- [ ] **Step 5: Move feature query key imports off `routes/routeQuery`**

In `src/features/search/queryKeys.ts`, replace the route import and narrow the accepted input:

```ts
import { toCanonicalSearchString } from "../../shared/lib/urlSearchParams";

type QueryParamsSignature = string;

const toCanonicalQueryKeySignature = (paramsSignature: QueryParamsSignature) =>
  paramsSignature
    ? toCanonicalSearchString(new URLSearchParams(paramsSignature))
    : "";

export const searchQueryKeys = {
  all: ["search"] as const,
  results: (paramsSignature: QueryParamsSignature) =>
    [
      ...searchQueryKeys.all,
      "results",
      toCanonicalQueryKeySignature(paramsSignature),
    ] as const,
};
```

In `src/features/wishlist/queryKeys.ts`, replace the route import but keep the current string input behavior:

```ts
import { toCanonicalSearchString } from "../../shared/lib/urlSearchParams";

type QueryParamsSignature = string;

const toCanonicalQueryKeySignature = (paramsSignature: QueryParamsSignature) =>
  paramsSignature
    ? toCanonicalSearchString(new URLSearchParams(paramsSignature))
    : "";
```

- [ ] **Step 6: Sanitize search signatures before they reach query keys**

In `src/features/search/lib/searchParams.ts`, replace:

```ts
import { toCanonicalSearchString } from "../../../routes/routeQuery";
```

with:

```ts
import { toCanonicalSearchString } from "../../../shared/lib/urlSearchParams";
```

Then replace `getSearchParamsSignature` with:

```ts
export const getSearchParamsSignature = (params: URLSearchParams): string =>
  toCanonicalSearchString(pickSearchParams(params));
```

- [ ] **Step 7: Update search query key tests**

Modify `src/features/search/queryKeys.test.ts`:

```ts
import { searchQueryKeys } from "./queryKeys";

describe("searchQueryKeys", () => {
  it("builds stable search result keys from canonical signatures", () => {
    expect(searchQueryKeys.results("destination=Seoul&page=2")).toEqual([
      "search",
      "results",
      "destination=Seoul&page=2",
    ]);
  });

  it("canonicalizes equivalent search signatures independent of insertion order", () => {
    expect(searchQueryKeys.results("page=2&destination=Seoul")).toEqual(
      searchQueryKeys.results("destination=Seoul&page=2"),
    );
  });
});
```

- [ ] **Step 8: Add search signature sanitization tests**

In `src/features/search/lib/searchParams.test.ts`, add:

```ts
import { getSearchParamsSignature } from "./searchParams";

describe("getSearchParamsSignature", () => {
  it("drops non-search params from query cache signatures", () => {
    const params = new URLSearchParams(
      "destination=Seoul&page=2&token=secret&email=a@example.com&memberId=999",
    );

    expect(getSearchParamsSignature(params)).toBe("destination=Seoul&page=2");
  });
});
```

If `searchParams.test.ts` already imports from `./searchParams`, merge `getSearchParamsSignature` into the existing import instead of adding a second import statement.

- [ ] **Step 9: Remove the `useSearchResults` build warning**

In `src/features/search/hooks/useSearchResults.ts`, replace:

```ts
const searchParamsSignature = useMemo(
  () => getSearchParamsSignature(searchParams),
  [searchParams, searchParamsString],
);
```

with:

```ts
const searchParamsSignature = useMemo(
  () => getSearchParamsSignature(new URLSearchParams(searchParamsString)),
  [searchParamsString],
);
```

- [ ] **Step 10: Run focused verification for Task 1**

Run:

```bash
npm run test:ci:no-cache -- --runInBand \
  src/shared/lib/urlSearchParams.test.ts \
  src/features/search/queryKeys.test.ts \
  src/features/search/lib/searchParams.test.ts \
  src/features/search/hooks/useSearchResults.test.tsx \
  src/features/wishlist/queryKeys.test.ts
npm run typecheck
CI=true npm run build
```

Expected:

- Tests PASS.
- Typecheck PASS.
- `CI=true npm run build` does not fail on the previous `react-hooks/exhaustive-deps` warning from `useSearchResults.ts`.

- [ ] **Step 11: Commit Task 1**

```bash
git add \
  src/shared/lib/urlSearchParams.ts \
  src/shared/lib/urlSearchParams.test.ts \
  src/routes/routeQuery.ts \
  src/features/search/lib/searchParams.ts \
  src/features/search/queryKeys.ts \
  src/features/search/queryKeys.test.ts \
  src/features/search/lib/searchParams.test.ts \
  src/features/search/hooks/useSearchResults.ts \
  src/features/search/hooks/useSearchResults.test.tsx \
  src/features/wishlist/queryKeys.ts \
  src/features/wishlist/queryKeys.test.ts
git commit -m "fix: sanitize frontend query cache signatures"
```

## Task 2: Centralize Review And Payment Cache Boundaries

**Files:**

- Modify: `src/features/accommodations/queryKeys.ts`
- Create: `src/features/accommodations/queryKeys.test.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationReviews.ts`
- Modify: `src/features/accommodations/hooks/useAccommodationReviews.test.ts`
- Modify: `src/features/reviews/hooks/useReviewCreate.ts`
- Modify: `src/features/reviews/hooks/useReviewCreate.test.ts`
- Create: `src/features/reservations/publicCache.ts`
- Create: `src/features/reservations/publicCache.test.ts`
- Modify: `src/features/reservations/PaymentSuccessRoute.tsx`
- Modify: `src/features/reservations/PaymentSuccessRoute.test.tsx`

- [ ] **Step 1: Write accommodation review query key tests**

Create `src/features/accommodations/queryKeys.test.ts`:

```ts
import { ReviewSortType } from "../../types/enums";
import { accommodationQueryKeys } from "./queryKeys";

describe("accommodationQueryKeys", () => {
  it("builds review keys under the accommodation query root", () => {
    expect(accommodationQueryKeys.reviewsRoot(12)).toEqual([
      "accommodation",
      "reviews",
      12,
    ]);

    expect(
      accommodationQueryKeys.reviews({
        accommodationId: 12,
        cursor: "cursor-1",
        size: 6,
        sortType: ReviewSortType.LATEST,
      }),
    ).toEqual([
      "accommodation",
      "reviews",
      12,
      ReviewSortType.LATEST,
      6,
      "cursor-1",
    ]);
  });

  it("uses stable missing and first-page sentinels", () => {
    expect(
      accommodationQueryKeys.reviews({
        accommodationId: null,
        cursor: null,
        size: 6,
        sortType: ReviewSortType.LATEST,
      }),
    ).toEqual([
      "accommodation",
      "reviews",
      "missing",
      ReviewSortType.LATEST,
      6,
      "first",
    ]);
  });
});
```

- [ ] **Step 2: Run the new key test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/features/accommodations/queryKeys.test.ts
```

Expected: FAIL because `reviewsRoot` and `reviews` do not exist yet.

- [ ] **Step 3: Add review keys to `accommodationQueryKeys`**

Modify `src/features/accommodations/queryKeys.ts`:

```ts
import { ReviewSortType } from "../../types/enums";

export const accommodationQueryKeys = {
  all: ["accommodation"] as const,
  detailRoot: ["accommodation", "detail"] as const,
  detail: (accommodationId: number | null, authRefreshIndex: number) =>
    [
      ...accommodationQueryKeys.detailRoot,
      accommodationId ?? "missing",
      authRefreshIndex,
    ] as const,
  couponsRoot: ["accommodation", "coupons"] as const,
  validCoupons: () =>
    [...accommodationQueryKeys.couponsRoot, "valid"] as const,
  reviewsRoot: (accommodationId: number | string | null | undefined) =>
    [
      ...accommodationQueryKeys.all,
      "reviews",
      accommodationId ?? "missing",
    ] as const,
  reviews: ({
    accommodationId,
    cursor,
    size,
    sortType,
  }: {
    accommodationId: number | string | null | undefined;
    cursor: string | null | undefined;
    size: number;
    sortType: ReviewSortType;
  }) =>
    [
      ...accommodationQueryKeys.reviewsRoot(accommodationId),
      sortType,
      size,
      cursor ?? "first",
    ] as const,
};
```

- [ ] **Step 4: Use review keys in accommodation review loading**

In `src/features/accommodations/hooks/useAccommodationReviews.ts`, import `accommodationQueryKeys`:

```ts
import { accommodationQueryKeys } from "../queryKeys";
```

Replace the local `accommodationReviewsQueryKey` helper with:

```ts
const accommodationReviewsQueryKey = (
  accommodationId: string | undefined,
  cursor: string | null,
) =>
  accommodationQueryKeys.reviews({
    accommodationId: accommodationId ?? null,
    cursor,
    size: REVIEW_PAGE_SIZE,
    sortType: ReviewSortType.LATEST,
  });
```

- [ ] **Step 5: Use review keys in review create invalidation**

In `src/features/reviews/hooks/useReviewCreate.ts`, import `accommodationQueryKeys`:

```ts
import { accommodationQueryKeys } from "../../accommodations/queryKeys";
```

Replace the hard-coded review invalidation:

```ts
queryClient.invalidateQueries({
  queryKey: [
    "accommodation",
    "reviews",
    String(reviewedReservation.accommodation.id),
  ],
}),
```

with:

```ts
queryClient.invalidateQueries({
  queryKey: accommodationQueryKeys.reviewsRoot(
    reviewedReservation.accommodation.id,
  ),
}),
```

- [ ] **Step 6: Write reservation public cache tests**

Create `src/features/reservations/publicCache.test.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import {
  invalidateReservationPaymentCaches,
} from "./publicCache";
import { reservationQueryKeys } from "./queryKeys";

describe("reservation public cache", () => {
  it("invalidates guest detail and list caches after payment confirmation", () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateReservationPaymentCaches(queryClient, "reservation-1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.guestReservationDetail("reservation-1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.guestReservationsRoot,
    });
  });
});
```

- [ ] **Step 7: Create the reservation public cache seam**

Create `src/features/reservations/publicCache.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import { reservationQueryKeys } from "./queryKeys";

export const invalidateReservationPaymentCaches = (
  queryClient: QueryClient,
  reservationUid: string,
) => {
  queryClient.invalidateQueries({
    queryKey: reservationQueryKeys.guestReservationDetail(reservationUid),
  });
  queryClient.invalidateQueries({
    queryKey: reservationQueryKeys.guestReservationsRoot,
  });
};
```

- [ ] **Step 8: Invalidate reservation caches in `PaymentSuccessRoute`**

In `src/features/reservations/PaymentSuccessRoute.tsx`, add imports:

```ts
import { useQueryClient } from "@tanstack/react-query";
import { invalidateReservationPaymentCaches } from "./publicCache";
```

Inside `PaymentSuccessRoute`, add:

```ts
const queryClient = useQueryClient();
```

Change the effect to run redirect work through an async inner function:

```ts
useEffect(() => {
  let isActive = true;

  const clearCheckoutState = (reservationUidToClear: string) => {
    try {
      clearReservationCheckoutStateByReservationUid(reservationUidToClear);
    } catch {
      // Cleanup is best-effort and must not block the payment result redirect.
    }
  };

  const finishPaymentRedirect = async () => {
    if (!reservationUid) {
      navigate(routeTo.profile(), { replace: true });
      return;
    }

    const result = isPaymentQueryIncomplete
      ? ({ error: null, status: "skipped" } as const)
      : confirmationResult;

    if (!result) return;

    if (result.status === "failed") {
      if (result.retryable !== true) {
        clearCheckoutState(reservationUid);
      }
      navigate(routeTo.paymentFail(reservationUid, { reason: "confirm-failed" }), {
        replace: true,
      });
      return;
    }

    clearCheckoutState(reservationUid);

    if (result.status === "confirmed") {
      invalidateReservationPaymentCaches(queryClient, reservationUid);
      if (!isActive) return;
      navigate(routeTo.reservationDetail(reservationUid), { replace: true });
      return;
    }

    navigate(routeTo.paymentFail(reservationUid, { reason: "invalid-callback" }), {
      replace: true,
    });
  };

  void finishPaymentRedirect();

  return () => {
    isActive = false;
  };
}, [
  confirmationResult,
  isPaymentQueryIncomplete,
  navigate,
  queryClient,
  reservationUid,
]);
```

- [ ] **Step 9: Update payment route tests for cache invalidation**

In `src/features/reservations/PaymentSuccessRoute.test.tsx`, add a test that renders a confirmed payment route with a `QueryClientProvider`, spies on `invalidateQueries`, and expects:

```ts
expect(invalidateQueriesSpy).toHaveBeenCalledWith({
  queryKey: reservationQueryKeys.guestReservationDetail("reservation-1"),
});
expect(invalidateQueriesSpy).toHaveBeenCalledWith({
  queryKey: reservationQueryKeys.guestReservationsRoot,
});
```

Use the existing test wrapper style in the file. Keep the assertions after `await waitFor(() => expect(navigate).toHaveBeenCalled())` so Query invalidation and navigation have both run.

- [ ] **Step 10: Run focused verification for Task 2**

Run:

```bash
npm run test:ci:no-cache -- --runInBand \
  src/features/accommodations/queryKeys.test.ts \
  src/features/accommodations/hooks/useAccommodationReviews.test.ts \
  src/features/reviews/hooks/useReviewCreate.test.ts \
  src/features/reservations/publicCache.test.ts \
  src/features/reservations/PaymentSuccessRoute.test.tsx
npm run typecheck
```

Expected: all focused tests PASS and typecheck PASS.

- [ ] **Step 11: Commit Task 2**

```bash
git add \
  src/features/accommodations/queryKeys.ts \
  src/features/accommodations/queryKeys.test.ts \
  src/features/accommodations/hooks/useAccommodationReviews.ts \
  src/features/accommodations/hooks/useAccommodationReviews.test.ts \
  src/features/reviews/hooks/useReviewCreate.ts \
  src/features/reviews/hooks/useReviewCreate.test.ts \
  src/features/reservations/publicCache.ts \
  src/features/reservations/publicCache.test.ts \
  src/features/reservations/PaymentSuccessRoute.tsx \
  src/features/reservations/PaymentSuccessRoute.test.tsx
git commit -m "fix: centralize review and payment cache boundaries"
```

## Task 3: Tighten Feature Boundary Contracts And Profile Reservation Surface

**Files:**

- Create: `src/features/reservations/appShell.ts`
- Modify: `src/features/profile/ProfileRoute.tsx`
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Modify: `src/routes/navigation-contracts.test.ts`
- Modify: `docs/architecture/frontend-structure-refactor.md`

- [ ] **Step 1: Write the failing profile/reservation boundary test**

In `src/routes/route-boundary-contracts.test.ts`, add this test inside `describe("route boundary contracts", ...)`:

```ts
it("keeps cross-feature profile composition on reservation app-shell APIs", () => {
  const profileRouteSource = readFileSync(
    join(process.cwd(), "src/features/profile/ProfileRoute.tsx"),
    "utf8",
  );

  expect(profileRouteSource).toContain("../reservations/appShell");
  expect(profileRouteSource).not.toMatch(
    /from\s+["']\.\.\/reservations\/(?:GuestTripsPanel|HostReservationsPanel)["']/,
  );
});
```

- [ ] **Step 2: Run the boundary test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/routes/route-boundary-contracts.test.ts
```

Expected: FAIL because `ProfileRoute.tsx` imports reservation panels directly.

- [ ] **Step 3: Add the reservation app-shell seam**

Create `src/features/reservations/appShell.ts`:

```ts
export { GuestTripsPanel } from "./GuestTripsPanel";
export { HostReservationsPanel } from "./HostReservationsPanel";
```

- [ ] **Step 4: Move ProfileRoute to the app-shell seam**

In `src/features/profile/ProfileRoute.tsx`, replace:

```ts
import { GuestTripsPanel } from "../reservations/GuestTripsPanel";
import { HostReservationsPanel } from "../reservations/HostReservationsPanel";
```

with:

```ts
import {
  GuestTripsPanel,
  HostReservationsPanel,
} from "../reservations/appShell";
```

- [ ] **Step 5: Remove route feature import allowlist pressure**

In `src/routes/route-boundary-contracts.test.ts`, keep the existing `allowedRouteFeatureImportPatterns` for this task if Task 1 did not move every route-query helper yet. Add this comment above the allowlist:

```ts
// This allowlist must shrink to zero when route query contracts move fully
// under src/routes or src/shared. Do not add new feature lib imports here.
```

Then add a regression test:

```ts
it("does not add new route feature import allowlist entries", () => {
  expect(allowedRouteFeatureImportPatterns).toHaveLength(4);
});
```

- [ ] **Step 6: Run focused boundary tests**

Run:

```bash
npm run test:ci:no-cache -- --runInBand \
  src/routes/route-boundary-contracts.test.ts \
  src/routes/navigation-contracts.test.ts \
  src/features/profile/ProfileRoute.test.tsx \
  src/features/reservations/GuestTripsPanel.test.tsx \
  src/features/reservations/HostReservationsPanel.test.tsx
npm run typecheck
```

Expected: all focused tests PASS and typecheck PASS.

- [ ] **Step 7: Document the boundary decision**

In `docs/architecture/frontend-structure-refactor.md`, add this bullet under `## Decisions`:

```md
- Feature-to-feature route composition uses explicit `appShell.ts` seams; public `index.ts` barrels remain route-container-only for page adapters.
```

- [ ] **Step 8: Commit Task 3**

```bash
git add \
  src/features/reservations/appShell.ts \
  src/features/profile/ProfileRoute.tsx \
  src/routes/route-boundary-contracts.test.ts \
  src/routes/navigation-contracts.test.ts \
  docs/architecture/frontend-structure-refactor.md
git commit -m "refactor: formalize profile reservation app shell boundary"
```

## Task 4: Close High-Impact UI Accessibility And Token Readiness Gaps

**Files:**

- Modify: `src/components/DatePicker/DatePicker.tsx`
- Modify: `src/components/DatePicker/DatePicker.test.tsx`
- Modify: `src/features/reviews/ReviewCreateRoute.tsx`
- Modify: `src/features/reviews/ReviewCreateRoute.test.tsx`
- Modify: `src/features/reservations/ReservationDetailRoute.tsx`
- Modify: `src/features/reservations/ReservationDetailRoute.test.tsx`
- Modify: `src/features/wishlist/components/WishlistDetailView.tsx`
- Modify: `src/features/wishlist/components/WishlistViews.test.tsx`
- Modify: `src/layouts/AppHeader/UserMenu.tsx`
- Modify: `src/layouts/AppHeader/UserMenu.test.tsx`
- Modify: `src/layouts/MainLayout.module.css`
- Modify: `src/styles/tokens.test.ts`

- [ ] **Step 1: Add DatePicker accessibility tests**

In `src/components/DatePicker/DatePicker.test.tsx`, add:

```tsx
it("labels month navigation buttons for screen readers", () => {
  render(
    <DatePicker
      checkIn={null}
      checkOut={null}
      onClose={jest.fn()}
      onDateSelect={jest.fn()}
      unavailableDates={[]}
    />,
  );

  expect(
    screen.getByRole("button", { name: "이전 달 보기" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "다음 달 보기" }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Add labels to DatePicker month buttons**

In `src/components/DatePicker/DatePicker.tsx`, update the previous/next buttons:

```tsx
<button
  aria-label="이전 달 보기"
  className={styles.monthNavButton}
  type="button"
  onClick={handlePrevMonth}
>
  ←
</button>
```

```tsx
<button
  aria-label="다음 달 보기"
  className={styles.monthNavButton}
  type="button"
  onClick={handleNextMonth}
>
  →
</button>
```

- [ ] **Step 3: Add route back-button accessibility tests**

In the relevant route tests, add assertions for named back buttons:

```tsx
expect(screen.getByRole("button", { name: /뒤로 가기|돌아가기/ })).toBeInTheDocument();
```

Apply this to:

- `src/features/reviews/ReviewCreateRoute.test.tsx`
- `src/features/reservations/ReservationDetailRoute.test.tsx`
- `src/features/wishlist/components/WishlistViews.test.tsx`

- [ ] **Step 4: Label icon-only route back buttons**

In `src/features/reviews/ReviewCreateRoute.tsx`, change the icon-only back button to:

```tsx
<button
  aria-label="뒤로 가기"
  className={styles.backButton}
  type="button"
  onClick={() => navigate(-1)}
>
```

In `src/features/reservations/ReservationDetailRoute.tsx`, change the image overlay back button to:

```tsx
<button
  aria-label="뒤로 가기"
  className={styles.backButtonOnImage}
  type="button"
  onClick={() => navigate(-1)}
>
```

In `src/features/wishlist/components/WishlistDetailView.tsx`, change the back button to:

```tsx
<button
  aria-label="위시리스트 목록으로 돌아가기"
  className={styles.backButton}
  type="button"
  onClick={onBack}
>
```

- [ ] **Step 5: Add UserMenu menu semantics tests**

In `src/layouts/AppHeader/UserMenu.test.tsx`, add:

```tsx
it("connects the menu button to a named menu and closes on Escape", async () => {
  const user = userEvent.setup();
  render(<UserMenu />);

  const menuButton = screen.getByRole("button", { name: "사용자 메뉴" });
  await user.click(menuButton);

  const menu = screen.getByRole("menu", { name: "사용자 메뉴" });
  expect(menuButton).toHaveAttribute("aria-controls", menu.id);
  expect(menuButton).toHaveAttribute("aria-expanded", "true");

  await user.keyboard("{Escape}");

  expect(screen.queryByRole("menu", { name: "사용자 메뉴" })).not.toBeInTheDocument();
  expect(menuButton).toHaveAttribute("aria-expanded", "false");
});
```

- [ ] **Step 6: Add UserMenu menu roles and Escape behavior**

In `src/layouts/AppHeader/UserMenu.tsx`, add a menu id:

```ts
const userMenuId = "app-header-user-menu";
```

Update the menu button:

```tsx
<button
  aria-controls={isMenuOpen ? userMenuId : undefined}
  aria-expanded={isMenuOpen}
  aria-label="사용자 메뉴"
  className={styles.menuButton}
  onClick={() => setIsMenuOpen(!isMenuOpen)}
  onKeyDown={(event) => {
    if (event.key === "Escape") {
      setIsMenuOpen(false);
    }
  }}
  type="button"
>
```

Update the dropdown:

```tsx
<div
  aria-label="사용자 메뉴"
  className={styles.menuDropdown}
  id={userMenuId}
  onKeyDown={(event) => {
    if (event.key === "Escape") {
      setIsMenuOpen(false);
    }
  }}
  role="menu"
>
```

Add `role="menuitem"` and `type="button"` to each dropdown item button.

- [ ] **Step 7: Enroll shared UI CSS and MainLayout into token checks**

In `src/styles/tokens.test.ts`, add shared primitive CSS files to `designTokenOwnedCssFiles`:

```ts
const sharedPrimitiveCssFiles = [
  "shared/ui/Button/Button.module.css",
  "shared/ui/Card/Card.module.css",
  "shared/ui/ClickableCard/ClickableCard.module.css",
  "shared/ui/CounterStepper/CounterStepper.module.css",
  "shared/ui/Dialog/Dialog.module.css",
  "shared/ui/IconButton/IconButton.module.css",
  "shared/ui/ListingCard/ListingCard.module.css",
  "shared/ui/OverlaySurface/OverlaySurface.module.css",
  "shared/ui/PageShell/PageShell.module.css",
  "shared/ui/StateView/StateView.module.css",
  "shared/ui/StatusBadge/StatusBadge.module.css",
  "shared/ui/Tabs/Tabs.module.css",
  "shared/ui/TextField/TextField.module.css",
  "shared/ui/ToastHost/ToastHost.module.css",
  "layouts/MainLayout.module.css",
];
```

Then spread the list into `designTokenOwnedCssFiles`:

```ts
const designTokenOwnedCssFiles = [
  ...sharedPrimitiveCssFiles,
  "features/wishlist/components/CreateWishlistModal/CreateWishlistModal.module.css",
  "features/wishlist/components/WishlistModal/WishlistModal.module.css",
  "features/reviews/components/ReviewModal/ReviewModal.module.css",
  "features/accommodations/components/AccommodationActionModal/AccommodationActionModal.module.css",
  "features/search/components/SearchAccommodationCard.module.css",
  "features/search/SearchRoute.module.css",
  "pages/Wishlist/Wishlist.module.css",
  "features/profile/components/ProfileShell.module.css",
  "features/profile/HostListingsPanel.module.css",
  "features/accommodations/AccommodationDetailRoute.module.css",
  "features/accommodations/components/AccommodationBookingCard.module.css",
  "features/accommodations/components/AccommodationHero.module.css",
  "features/accommodations/components/AccommodationLocationSection.module.css",
  "features/accommodations/components/AccommodationOverview.module.css",
  "features/accommodations/components/AccommodationReviewsSection.module.css",
  "features/accommodations/components/AccommodationDescriptionModal.module.css",
  "features/accommodations/components/AccommodationImageGalleryModal.module.css",
  "features/search/components/SearchBar/SearchBar.module.css",
  ...newlyTokenOwnedCssFiles,
];
```

- [ ] **Step 8: Tokenize MainLayout literals**

In `src/layouts/MainLayout.module.css`, replace raw page literals with existing tokens:

```css
.layout {
  min-height: var(--layout-viewport-height);
  background-color: var(--color-background-page);
}
```

Keep existing class names and layout behavior unchanged.

- [ ] **Step 9: Run focused UI verification**

Run:

```bash
npm run test:ci:no-cache -- --runInBand \
  src/components/DatePicker/DatePicker.test.tsx \
  src/features/reviews/ReviewCreateRoute.test.tsx \
  src/features/reservations/ReservationDetailRoute.test.tsx \
  src/features/wishlist/components/WishlistViews.test.tsx \
  src/layouts/AppHeader/UserMenu.test.tsx \
  src/styles/tokens.test.ts \
  src/shared/ui/shared-ui-boundary-contracts.test.ts \
  src/layouts/main-layout-contracts.test.ts
npm run typecheck
```

Expected: all focused tests PASS and typecheck PASS.

- [ ] **Step 10: Commit Task 4**

```bash
git add \
  src/components/DatePicker/DatePicker.tsx \
  src/components/DatePicker/DatePicker.test.tsx \
  src/features/reviews/ReviewCreateRoute.tsx \
  src/features/reviews/ReviewCreateRoute.test.tsx \
  src/features/reservations/ReservationDetailRoute.tsx \
  src/features/reservations/ReservationDetailRoute.test.tsx \
  src/features/wishlist/components/WishlistDetailView.tsx \
  src/features/wishlist/components/WishlistViews.test.tsx \
  src/layouts/AppHeader/UserMenu.tsx \
  src/layouts/AppHeader/UserMenu.test.tsx \
  src/layouts/MainLayout.module.css \
  src/styles/tokens.test.ts
git commit -m "fix: close pre-redesign accessibility and token gaps"
```

## Task 5: Isolate Smoke Test Side Effects And Keep Gates Honest

**Files:**

- Modify: `scripts/smoke/frontend-smoke.mjs`
- Modify: `src/verification-gate.test.ts`
- Modify: `.env.example`
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`
- Modify: `docs/architecture/frontend-structure-refactor.md`

- [ ] **Step 1: Write smoke report root override tests**

In `src/verification-gate.test.ts`, add a test near the existing smoke subprocess tests:

```ts
test("frontend smoke writes reports under an override root during harness tests", () => {
  const tempReportRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airbob-smoke-report-"),
  );

  const result = spawnSync("node", [frontendSmokePath], {
    cwd: projectRoot,
    encoding: "utf8",
    env: isolatedSmokeSubprocessEnv({
      AIRBOB_FRONTEND_URL: "http://127.0.0.1:9",
      AIRBOB_QA_EMAIL: "fake-user@example.invalid",
      AIRBOB_QA_PASSWORD: "fake-password",
      AIRBOB_SMOKE_REPORT_ROOT: tempReportRoot,
      GSTACK_BROWSE_BIN: "node",
    }),
  });

  expect(result.status).not.toBe(0);
  expect(fs.existsSync(tempReportRoot)).toBe(true);
  expect(fs.existsSync(path.join(projectRoot, ".gstack", "qa-reports"))).toBe(false);
});
```

- [ ] **Step 2: Run the new verification test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
```

Expected: FAIL if the smoke wrapper ignores `AIRBOB_SMOKE_REPORT_ROOT` or writes into `.gstack/qa-reports`.

- [ ] **Step 3: Add smoke report root override**

In `scripts/smoke/frontend-smoke.mjs`, replace:

```js
const REPORT_ROOT = join(".gstack", "qa-reports");
const SCREENSHOT_ROOT = join(REPORT_ROOT, "screenshots");
```

with:

```js
const REPORT_ROOT =
  process.env.AIRBOB_SMOKE_REPORT_ROOT?.trim() || join(".gstack", "qa-reports");
const SCREENSHOT_ROOT = join(REPORT_ROOT, "screenshots");
```

- [ ] **Step 4: Document the override**

In `.env.example`, add:

```dotenv
AIRBOB_SMOKE_REPORT_ROOT=.gstack/qa-reports
```

In `docs/qa/frontend-architecture-smoke.ko.md`, add a short note under the local setup section:

```md
`AIRBOB_SMOKE_REPORT_ROOT` can point smoke artifacts at a temporary directory during harness tests. Normal manual QA can leave it unset so reports continue under `.gstack/qa-reports`.
```

- [ ] **Step 5: Keep default gates unchanged**

In `docs/architecture/frontend-structure-refactor.md`, keep these facts explicit:

```md
- `verify` remains the default static local gate and still excludes lint and strict smoke.
- `verify:design-ready` remains the explicit browser-backed gate because it needs live credentials, stable reservation UIDs, gstack browse, and seeded search data.
```

- [ ] **Step 6: Run verification-gate checks**

Run:

```bash
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
npm run smoke:frontend:strict
```

Expected:

- `src/verification-gate.test.ts` PASS.
- `npm run smoke:frontend:strict` still exits before browser when required env vars are missing and prints the missing names.

- [ ] **Step 7: Commit Task 5**

```bash
git add \
  scripts/smoke/frontend-smoke.mjs \
  src/verification-gate.test.ts \
  .env.example \
  docs/qa/frontend-architecture-smoke.ko.md \
  docs/architecture/frontend-structure-refactor.md
git commit -m "test: isolate frontend smoke report artifacts"
```

## Task 6: Full Verification And Handoff

**Files:**

- Modify: `docs/architecture/frontend-structure-refactor.md`
- Modify: `docs/solutions/workflow-issues/frontend-architecture-verification-loop.md`

- [ ] **Step 1: Update architecture docs with completed audit follow-ups**

In `docs/architecture/frontend-structure-refactor.md`, add:

```md
## Post-Audit Follow-Up

- Search query cache keys are based on preserved search params only.
- Review query keys live under `accommodationQueryKeys`.
- Payment success invalidates guest reservation detail and list caches before redirect.
- Profile-to-reservation composition uses `features/reservations/appShell`.
- Shared UI and MainLayout CSS are enrolled in token ownership checks.
- Smoke artifacts can be redirected to a temp report root during harness tests.
```

- [ ] **Step 2: Update the solution learning**

In `docs/solutions/workflow-issues/frontend-architecture-verification-loop.md`, add one paragraph under `## Guidance`:

```md
After a broad architecture merge, rerun a full-audit pass before visual styling. The second pass should look for remaining private URL/query dependencies, cache keys outside feature query key modules, public seams that are implied but not tested, CSS Modules outside token ownership, and verification scripts that leave local artifacts during tests.
```

- [ ] **Step 3: Run the complete pre-redesign gate**

Run:

```bash
npm run verify:pre-redesign
```

Expected:

- `tsc --noEmit` PASS.
- `react-scripts test --watchAll=false --no-cache --runInBand` PASS with the full suite.
- `react-scripts build` PASS.
- No `react-hooks/exhaustive-deps` warning remains for `src/features/search/hooks/useSearchResults.ts`.
- Existing Browserslist and `baseline-browser-mapping` freshness warnings may remain.

- [ ] **Step 4: Run lint visibility**

Run:

```bash
npm run lint -- --format compact
```

Expected:

- If lint still fails, the remaining count must be lower than the 81-problem audit baseline and the remaining items must be documented in `docs/architecture/frontend-structure-refactor.md`.
- If lint passes, run `npm run lint:strict` and update `package.json` only after confirming `lint:strict` passes locally.

- [ ] **Step 5: Run strict smoke preflight**

Run:

```bash
npm run smoke:frontend:strict
```

Expected without local smoke env:

- Command exits before browser execution.
- Output names `AIRBOB_QA_EMAIL`, `AIRBOB_QA_PASSWORD`, and `GSTACK_BROWSE_BIN`.

Expected with local smoke env:

- Browser smoke covers desktop/mobile home, search, wishlist, profile host listings, accommodation detail, accommodation edit, reservation detail, and host reservation detail.
- If `AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS=true`, search result assertions must use seeded data and fail when no cards render.

- [ ] **Step 6: Commit Task 6**

```bash
git add \
  docs/architecture/frontend-structure-refactor.md \
  docs/solutions/workflow-issues/frontend-architecture-verification-loop.md
git commit -m "docs: record frontend full audit hardening results"
```

## Execution Notes

- Run one task per commit.
- Do not broaden a task when a focused test exposes unrelated failures.
- Do not promote `lint:strict` into `verify` until strict lint passes.
- Do not put `smoke:frontend:strict` into default `verify`; it needs live credentials, browser tooling, stable reservation fixtures, and seeded search data.
- Keep the current user flows intact: auth return paths, search map-drag and wishlist login resume, detail booking with coupon state, Toss success/fail, profile mode/tab URLs, host listing actions, edit wizard save/publish, and review partial image-upload failure.

## Self-Review

- Spec coverage: The plan covers route/page boundaries, state/API/query boundaries, styling/design-system readiness, verification/smoke hardening, and high-risk user flow preservation.
- Placeholder scan: The plan contains no unresolved placeholder entries and every code-changing task names exact files, exact commands, and expected outcomes.
- Type consistency: New helpers use `appendDefinedSearchParam`, `toCanonicalSearchString`, `accommodationQueryKeys`, `reservationQueryKeys`, and existing route/test names exactly as present in the current codebase.
- Scope control: CRA-to-Vite migration, broad visual restyling, backend/API/server changes, and default smoke promotion are explicitly excluded.
