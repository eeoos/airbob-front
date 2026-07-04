# Airbob Current Architecture Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every code-changing task. Steps use checkbox (`- [ ]`) syntax for tracking. Backend/API/DB/server code is read-only unless the user explicitly approves backend edits.

**Goal:** Airbnb 스타일 디자인 리팩터 전에 Airbob 프론트엔드의 라우팅, 서버 상태, 컴포넌트 ownership, 대형 페이지, 스타일 토큰 경계를 안정화한다.

**Architecture:** 현재 CRA/React/TypeScript/CSS Modules와 기존 URL/API 계약은 유지한다. `routes`는 URL/auth/layout 정책, `pages`는 route param/query와 화면 조립, `features/*`는 도메인 UI/API 상태/workflow, `shared/ui`는 도메인을 모르는 primitive만 담당하게 만든다.

**Tech Stack:** CRA 5, React 19, React Router 7, TanStack Query 5, Axios, TypeScript 4.9, CSS Modules, Jest/React Testing Library.

---

## Scope

포함:

- 라우팅/검색 query 오염 방지.
- 서버 상태를 React Query boundary로 수렴하는 첫 vertical slices.
- `components`, `pages`, `features`, `shared/ui` ownership 정리.
- `Search`, `Wishlist`, `AccommodationEdit`, `AccommodationDetail` 대형 화면 분해.
- Airbnb 스타일 적용 전 token/shared primitive 기반 정리.
- 현재 수동 QA 문서와 architecture contract test 강화.

제외:

- 백엔드/API/DB/server 로직 수정.
- API endpoint, request body, response shape 변경.
- Airbnb 시각 디자인 적용.
- Vite/Vitest 마이그레이션.
- 결제 provider 또는 Toss API 계약 변경.

## Protected Flows

- Header/Home/SearchBar 검색 -> `/search` query -> 결과/지도 동기화.
- `/search` desktop/mobile, map bounds search, marker select, bottom sheet snap states.
- 검색/지도/위시리스트 카드 -> 숙소 상세 새 탭 이동과 검색 query 보존.
- 비로그인 액션 -> AuthModal/Login -> 원래 액션 재개.
- 숙소 상세 날짜/게스트/쿠폰/예약 생성 -> 예약 확인 -> Toss success/fail -> 예약 상세.
- Wishlist index/recently viewed/detail/memo modal/infinite load.
- Profile guest/host tab deep link, host listings, host reservations, host reservation detail.
- UserMenu host draft create -> `/accommodations/:id/edit?mode=create`.
- AccommodationEdit address/photos/info/time/publish, image upload, detail-address confirm, save and exit.

## File Structure Target

- Modify: `src/routes/paths.ts`
  - URL contract types must be route-owned, not imported from feature internals.
- Modify: `src/features/search/lib/searchParams.ts`
  - Search URL construction should use an allowlist instead of cloning unrelated page params.
- Modify: `src/features/search/hooks/useSearchResults.ts`
  - Convert server reads to React Query while preserving the public hook API initially.
- Modify: `src/features/wishlist/hooks/useWishlistData.ts`
  - Split list/detail/recently-viewed queries and mutations.
- Modify: `src/pages/Wishlist/Wishlist.tsx`
  - Split into route shell plus feature views/dialog.
- Move: `src/pages/AccommodationEdit/components/*` -> `src/features/accommodations/edit/components/*`
  - Keep route page thin.
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
  - Extract edit screen orchestration from route shell.
- Move or re-home: `src/components/Header/*`
  - Treat as app shell/layout, not generic component.
- Move or split: `src/components/AccommodationCard/AccommodationCard.Search.tsx`
  - Put search-specific adapter under `features/search`.
- Modify: `src/styles/tokens.css`
  - Add spacing, status, control-size, and motion tokens before visual redesign.
- Modify: `src/styles/tokens.test.ts`
  - Expand token migration guard from curated allowlist to explicit migration registry.

---

### Task 1: Lock Architecture Boundary Contracts

**Files:**
- Create: `src/routes/route-boundary-contracts.test.ts`
- Modify: `src/components/components-boundary-contracts.test.ts`
- Modify: `src/api/ui-api-boundary-contracts.test.ts`
- Modify: `src/shared/ui/shared-ui-boundary-contracts.test.ts`

- [ ] **Step 1: Add route boundary test**

Create `src/routes/route-boundary-contracts.test.ts`:

```ts
import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

const routesRoot = join(process.cwd(), "src/routes");
const sourceExtensions = [".ts", ".tsx"];
const forbiddenFeatureImportPattern =
  /from\s+["'](?:\.\.\/)+(?:features)(?:\/[^"']*)?["']/;

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    const isSource =
      sourceExtensions.some((extension) => entry.name.endsWith(extension)) &&
      !entry.name.includes(".test.") &&
      !entry.name.endsWith(".d.ts");

    return isSource ? [entryPath] : [];
  });

describe("route boundary contracts", () => {
  it("keeps route URL contracts independent from feature internals", () => {
    const violations = collectSourceFiles(routesRoot)
      .filter((filePath) =>
        forbiddenFeatureImportPattern.test(readFileSync(filePath, "utf8"))
      )
      .map((filePath) => relative(process.cwd(), filePath));

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts --runInBand
```

Expected: FAIL because `src/routes/paths.ts` imports feature route-state types.

- [ ] **Step 3: Add component ownership guard**

Update `src/components/components-boundary-contracts.test.ts` so `allowedWorkflowFiles` does not permanently allow `Header/Header.tsx` and `Header/UserMenu.tsx`. Temporarily allow them through an explicit migration list named `appShellMigrationAllowlist`:

```ts
const appShellMigrationAllowlist = new Set(["Header/Header.tsx", "Header/UserMenu.tsx"]);
```

Expected: The test documents that Header is app-shell debt, not generic component ownership.

- [ ] **Step 4: Run boundary tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath \
  src/routes/route-boundary-contracts.test.ts \
  src/components/components-boundary-contracts.test.ts \
  src/api/ui-api-boundary-contracts.test.ts \
  src/shared/ui/shared-ui-boundary-contracts.test.ts \
  --runInBand
```

Expected: only the new route boundary test fails before Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/routes/route-boundary-contracts.test.ts src/components/components-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts src/shared/ui/shared-ui-boundary-contracts.test.ts
git commit -m "test: lock frontend architecture boundaries"
```

---

### Task 2: Fix Route URL Ownership And Search Query Pollution

**Files:**
- Modify: `src/routes/paths.ts`
- Modify: `src/routes/paths.test.ts`
- Modify: `src/features/search/lib/searchParams.ts`
- Modify: `src/features/search/lib/searchParams.test.ts`

- [ ] **Step 1: Move route query types into `paths.ts`**

In `src/routes/paths.ts`, remove imports from `features/*` and define route-owned types:

```ts
export type WishlistRouteView = "index" | "recently-viewed" | "wishlist-detail";
export type ProfileRouteMode = "guest" | "host";
export type ProfileRouteTab =
  | "trips"
  | "reservations"
  | "listings"
  | "host-reservations";
```

Keep `routeTo.wishlist()` and `routeTo.profile()` output unchanged.

- [ ] **Step 2: Update feature route-state imports**

Where feature files need those types, import them from `src/routes/paths.ts` instead of defining duplicate feature-owned URL types.

Expected affected files:

```txt
src/features/profile/lib/profileRouteState.ts
src/features/wishlist/lib/wishlistRouteState.ts
```

- [ ] **Step 3: Add search allowlist test**

Add this test to `src/features/search/lib/searchParams.test.ts`:

```ts
it("does not carry unrelated route query params into search navigation", () => {
  const currentParams = new URLSearchParams("mode=host&tab=reservations&id=10&view=recently-viewed&page=3");

  const result = buildSearchNavigationParams(currentParams, {
    destination: "서울",
    selectedPlace: null,
    checkIn: null,
    checkOut: null,
    adultOccupancy: 2,
    childOccupancy: 0,
    infantOccupancy: 0,
    petOccupancy: 0,
  });

  expect(result.get("destination")).toBe("서울");
  expect(result.get("adultOccupancy")).toBe("2");
  expect(result.get("mode")).toBeNull();
  expect(result.get("tab")).toBeNull();
  expect(result.get("id")).toBeNull();
  expect(result.get("view")).toBeNull();
  expect(result.get("page")).toBeNull();
});
```

- [ ] **Step 4: Implement search query allowlist**

In `src/features/search/lib/searchParams.ts`, make `buildSearchNavigationParams()` start from a new `URLSearchParams()` and copy only search-owned keys when a value should be preserved:

```ts
const SEARCH_QUERY_KEYS_TO_PRESERVE = [
  "destination",
  "latitude",
  "longitude",
  "topLeftLat",
  "topLeftLng",
  "bottomRightLat",
  "bottomRightLng",
  "checkIn",
  "checkOut",
  "adultOccupancy",
  "childOccupancy",
  "infantOccupancy",
  "petOccupancy",
] as const;

const pickSearchParams = (params: URLSearchParams) => {
  const nextParams = new URLSearchParams();

  SEARCH_QUERY_KEYS_TO_PRESERVE.forEach((key) => {
    const value = params.get(key);
    if (value !== null && value !== "") {
      nextParams.set(key, value);
    }
  });

  return nextParams;
};
```

Then use `pickSearchParams(currentParams)` inside `buildSearchNavigationParams()`.

- [ ] **Step 5: Run route/search tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath \
  src/routes/paths.test.ts \
  src/routes/route-boundary-contracts.test.ts \
  src/features/search/lib/searchParams.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/paths.ts src/routes/paths.test.ts src/routes/route-boundary-contracts.test.ts src/features/search/lib/searchParams.ts src/features/search/lib/searchParams.test.ts src/features/profile/lib/profileRouteState.ts src/features/wishlist/lib/wishlistRouteState.ts
git commit -m "refactor: own route URL contracts in routes"
```

---

### Task 3: Make Search Results A React Query Server-State Slice

**Files:**
- Modify: `src/api/accommodations.ts`
- Modify: `src/features/search/queryKeys.ts`
- Modify: `src/features/search/hooks/useSearchResults.ts`
- Modify: `src/features/search/hooks/useSearchResults.test.tsx`

- [ ] **Step 1: Add AbortSignal support to search API**

Change `accommodationApi.search` signature without changing request shape:

```ts
search: async (
  params: AccommodationSearchRequest,
  signal?: AbortSignal
): Promise<AccommodationSearchResponse> => {
  return requestApi(() =>
    client.get<ApiResponse<AccommodationSearchResponse>>("/search/accommodations", {
      params,
      signal,
    })
  );
},
```

- [ ] **Step 2: Add query-key coverage**

Ensure `src/features/search/queryKeys.ts` has:

```ts
export const searchQueryKeys = {
  all: ["search"] as const,
  results: (paramsSignature: string) =>
    [...searchQueryKeys.all, "results", paramsSignature] as const,
};
```

- [ ] **Step 3: Convert `useSearchResults` internals**

Keep the existing return shape so `src/pages/Search/Search.tsx` does not change in this task. Internally:

```ts
const query = useQuery({
  queryKey: searchQueryKeys.results(searchParamsString),
  queryFn: ({ signal }) =>
    accommodationApi.search(buildSearchRequestFromParams(searchParams, { page }), signal),
  placeholderData: (previousData) => previousData,
});
```

Keep URL/page/map side effects local:

- page reset on destination change.
- `requestMapBoundsUpdate()`.
- `setIsMapDragMode()`.
- `window.scrollTo()` on explicit page navigation.

- [ ] **Step 4: Replace local wishlist patch with query cache patch**

Inside `updateAccommodationWishlistStatus`, use `queryClient.setQueryData()` for the active search query key:

```ts
queryClient.setQueryData<AccommodationSearchResponse>(
  searchQueryKeys.results(searchParamsString),
  (previous) =>
    previous
      ? {
          ...previous,
          stay_search_result_listing: previous.stay_search_result_listing.map((accommodation) =>
            accommodation.id === accommodationId
              ? { ...accommodation, is_in_wishlist: isInWishlist }
              : accommodation
          ),
        }
      : previous
);
```

- [ ] **Step 5: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath \
  src/features/search/hooks/useSearchResults.test.tsx \
  src/features/search/queryKeys.test.ts \
  src/api/request.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/api/accommodations.ts src/features/search/queryKeys.ts src/features/search/hooks/useSearchResults.ts src/features/search/hooks/useSearchResults.test.tsx
git commit -m "refactor: manage search results with react query"
```

---

### Task 4: Split Wishlist Data Into Query-Owned Slices

**Files:**
- Modify: `src/features/wishlist/queryKeys.ts`
- Create: `src/features/wishlist/hooks/useWishlistListsQuery.ts`
- Create: `src/features/wishlist/hooks/useWishlistDetailQuery.ts`
- Create: `src/features/wishlist/hooks/useRecentlyViewedQuery.ts`
- Modify: `src/features/wishlist/hooks/useWishlistData.ts`
- Modify: `src/features/wishlist/hooks/useWishlistData.test.ts`

- [ ] **Step 1: Expand wishlist query keys**

```ts
export const wishlistQueryKeys = {
  all: ["wishlist"] as const,
  lists: (paramsSignature: string) =>
    [...wishlistQueryKeys.all, "lists", paramsSignature] as const,
  detail: (wishlistId: number, paramsSignature = "") =>
    [...wishlistQueryKeys.all, "detail", wishlistId, paramsSignature] as const,
  recentlyViewed: () => [...wishlistQueryKeys.all, "recentlyViewed"] as const,
};
```

- [ ] **Step 2: Add query hooks**

Create one hook per server read. Use `useInfiniteQuery` for cursor pagination and keep `WISHLIST_PAGE_SIZE = 20`.

- [ ] **Step 3: Convert mutations**

Use `useMutation` for:

- `deleteWishlist`
- `removeRecentlyViewed`
- `removeFromWishlist`
- `saveWishlistAccommodationMemo`

Each mutation must either invalidate the affected query key or patch the specific query data with `queryClient.setQueryData()`.

- [ ] **Step 4: Keep `useWishlistData` as compatibility facade**

`useWishlistData` should still return the same names consumed by `Wishlist.tsx`, but internally compose query hooks.

- [ ] **Step 5: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath \
  src/features/wishlist/hooks/useWishlistData.test.ts \
  src/features/wishlist/queryKeys.test.ts \
  src/pages/Wishlist/Wishlist.routeState.test.tsx \
  src/pages/Wishlist/Wishlist.memoModal.test.tsx \
  --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/wishlist/queryKeys.ts src/features/wishlist/hooks src/pages/Wishlist/Wishlist.routeState.test.tsx src/pages/Wishlist/Wishlist.memoModal.test.tsx
git commit -m "refactor: split wishlist server state queries"
```

---

### Task 5: Decompose Wishlist Page Views

**Files:**
- Create: `src/features/wishlist/components/WishlistIndexView.tsx`
- Create: `src/features/wishlist/components/RecentlyViewedView.tsx`
- Create: `src/features/wishlist/components/WishlistDetailView.tsx`
- Create: `src/features/wishlist/components/WishlistMemoDialog.tsx`
- Modify: `src/pages/Wishlist/Wishlist.tsx`
- Modify: `src/pages/Wishlist/Wishlist.module.css`

- [ ] **Step 1: Extract memo modal to Dialog**

Create `WishlistMemoDialog.tsx` using shared `Dialog`:

```tsx
import { Dialog } from "../../../shared/ui";

interface WishlistMemoDialogProps {
  isOpen: boolean;
  memoText: string;
  onChangeMemoText: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
  onSave: () => void;
}

export function WishlistMemoDialog({
  isOpen,
  memoText,
  onChangeMemoText,
  onClear,
  onClose,
  onSave,
}: WishlistMemoDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="메모 추가" size="sm">
      <textarea
        value={memoText}
        onChange={(event) => onChangeMemoText(event.target.value)}
        maxLength={250}
        aria-label="메모"
      />
      <div>{memoText.length}/250자</div>
      <button type="button" onClick={onClear}>모두 지우기</button>
      <button type="button" onClick={onSave} disabled={!memoText.trim()}>저장</button>
    </Dialog>
  );
}
```

- [ ] **Step 2: Extract three wishlist views**

Move only JSX and event props. Do not move data fetching in this task.

- `WishlistIndexView`: page title, recently viewed card, wishlist grid, list sentinel.
- `RecentlyViewedView`: back/edit controls, grouped recently viewed cards.
- `WishlistDetailView`: selected wishlist header, accommodation cards, memo open, detail sentinel.

- [ ] **Step 3: Keep route shell thin**

`src/pages/Wishlist/Wishlist.tsx` should compose hooks and choose one of the three views. Target size: under 220 lines.

- [ ] **Step 4: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath \
  src/pages/Wishlist/Wishlist.routeState.test.tsx \
  src/pages/Wishlist/Wishlist.memoModal.test.tsx \
  src/features/wishlist/components/WishlistModal/WishlistModal.test.tsx \
  --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/wishlist/components src/pages/Wishlist/Wishlist.tsx src/pages/Wishlist/Wishlist.module.css
git commit -m "refactor: split wishlist page views"
```

---

### Task 6: Move Accommodation Edit UI Into Feature Ownership

**Files:**
- Move: `src/pages/AccommodationEdit/components/*` -> `src/features/accommodations/edit/components/*`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.test.tsx`
- Modify: `src/pages/AccommodationEdit/components/AccommodationEditComponents.test.tsx`

- [ ] **Step 1: Move components without changing behavior**

Move files and update imports only. Keep CSS modules with the moved components.

Expected target imports in `AccommodationEdit.tsx`:

```ts
import { AccommodationTypeModal } from "../../features/accommodations/edit/components/AccommodationTypeModal";
import { AmenityModal } from "../../features/accommodations/edit/components/AmenityModal";
import { DetailAddressConfirmModal } from "../../features/accommodations/edit/components/DetailAddressConfirmModal";
import { InfoStep } from "../../features/accommodations/edit/components/InfoStep";
import { LocationStep } from "../../features/accommodations/edit/components/LocationStep";
import { PhotosStep } from "../../features/accommodations/edit/components/PhotosStep";
import { PublishStep } from "../../features/accommodations/edit/components/PublishStep";
import { TimeStep } from "../../features/accommodations/edit/components/TimeStep";
```

- [ ] **Step 2: Add pages boundary test**

Create or update a boundary test that prevents future `src/pages/*/components` feature UI directories, except route-only one-off wrappers.

- [ ] **Step 3: Extract edit screen component**

Create `src/features/accommodations/edit/components/AccommodationEditScreen.tsx` and move step rendering, sidebar, modal rendering, and button group there.

`src/pages/AccommodationEdit/AccommodationEdit.tsx` should own only:

- `useParams`
- `useNavigate`
- `useSearchParams`
- hook composition
- passing props to `AccommodationEditScreen`

- [ ] **Step 4: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath \
  src/pages/AccommodationEdit/AccommodationEdit.test.tsx \
  src/features/accommodations/edit/hooks/useAccommodationEditForm.test.ts \
  src/features/accommodations/edit/hooks/useAccommodationEditSave.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AccommodationEdit src/features/accommodations/edit src/components/components-boundary-contracts.test.ts
git commit -m "refactor: move accommodation edit UI into feature"
```

---

### Task 7: Clean App-Shell And Search-Specific Component Ownership

**Files:**
- Move: `src/components/Header/*` -> `src/layouts/AppHeader/*`
- Move: `src/components/AccommodationCard/AccommodationCard.Search.tsx` -> `src/features/search/components/SearchAccommodationCard.tsx`
- Move: `src/components/AccommodationCard/AccommodationCard.Search.module.css` -> `src/features/search/components/SearchAccommodationCard.module.css`
- Modify: `src/layouts/MainLayout.tsx`
- Modify: `src/features/search/components/SearchResultsList.tsx`
- Modify: `src/components/components-boundary-contracts.test.ts`

- [ ] **Step 1: Move Header to app shell**

Update `MainLayout` import:

```ts
import { Header } from "./AppHeader";
```

Expected: `src/components` no longer contains layout/app-shell workflow code.

- [ ] **Step 2: Move search card to search feature**

Update `SearchResultsList` to import from the new feature path:

```ts
import { SearchAccommodationCard } from "./SearchAccommodationCard";
```

- [ ] **Step 3: Remove Header allowlist**

Delete `Header/Header.tsx` and `Header/UserMenu.tsx` from any generic component allowlist.

- [ ] **Step 4: Run focused tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath \
  src/components/components-boundary-contracts.test.ts \
  src/components/Header/Header.test.tsx \
  src/features/search/components/SearchResultsList.test.tsx \
  src/components/AccommodationCard/AccommodationCard.Search.test.tsx \
  --runInBand
```

Expected: tests are moved or updated to new paths and PASS.

- [ ] **Step 5: Commit**

```bash
git add src/layouts src/features/search/components src/components
git commit -m "refactor: clarify app shell and search component ownership"
```

---

### Task 8: Prepare Style Foundation Before Airbnb Visual Pass

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/tokens.test.ts`
- Modify: `src/features/auth/components/AuthModal/AuthModal.module.css`
- Modify: `src/features/reservations/components/ReservationModal/ReservationModal.module.css`
- Modify: `src/App.css`

- [ ] **Step 1: Add missing token groups**

Add spacing, control, status, and motion tokens:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --control-height-sm: 32px;
  --control-height-md: 40px;
  --control-height-lg: 48px;
  --color-status-success-bg: #e6f7f5;
  --color-status-danger-bg: #ffe5e5;
  --motion-duration-fast: 150ms;
  --motion-duration-base: 200ms;
  --motion-ease-standard: ease;
}
```

- [ ] **Step 2: Remove stale CRA CSS**

If `src/App.css` is not imported anywhere, delete it. If any test expects it, update the test to assert the app uses `src/index.css` and `src/styles/tokens.css` instead.

- [ ] **Step 3: Remove stale modal overlay CSS**

Delete unused `.overlay`, `.modal`, and local close-button shell styles from `AuthModal.module.css` and `ReservationModal.module.css` after confirming their components render `Dialog`.

- [ ] **Step 4: Add token migration registry**

In `tokens.test.ts`, define a registry of CSS files allowed to still contain hard-coded colors during migration. Keep it explicit:

```ts
const tokenMigrationAllowlist = new Set([
  "src/pages/Reservations/ReservationDetail.module.css",
  "src/pages/AccommodationEdit/components/EditForm.module.css",
  "src/features/search/components/SearchBar/SearchBar.module.css",
]);
```

New or cleaned files should not be added to this list without a reason.

- [ ] **Step 5: Run style tests**

```bash
npm run test:ci:no-cache -- --runTestsByPath \
  src/styles/tokens.test.ts \
  src/styles/design-system-contracts.test.ts \
  src/shared/ui/Dialog/Dialog.test.tsx \
  --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/styles src/features/auth/components/AuthModal src/features/reservations/components/ReservationModal src/App.css
git commit -m "refactor: prepare style token foundation"
```

---

### Task 9: Run Full Verification And Browser Smoke

**Files:**
- Modify if needed: `docs/qa/frontend-architecture-smoke.ko.md`

- [ ] **Step 1: Run static verification**

```bash
npm run typecheck
npm run test:ci:no-cache -- --runInBand
npm run build
```

Expected: all pass.

- [ ] **Step 2: Run architecture smoke checklist**

Use `docs/qa/frontend-architecture-smoke.ko.md` and record:

- desktop 1280px search/detail/reservation/wishlist/profile flows.
- mobile 375px search bottom sheet/modal/detail/profile flows.
- console errors.
- failed network requests.
- screenshot paths.

- [ ] **Step 3: Do not begin visual redesign yet**

Only after Tasks 1-9 pass, start a separate Airbnb design-system implementation plan.

- [ ] **Step 4: Commit QA doc updates if evidence was added**

```bash
git add docs/qa/frontend-architecture-smoke.ko.md
git commit -m "docs: record frontend architecture smoke verification"
```

## Final Decision Gate

Proceed to Airbnb-style visual redesign only when all are true:

- route boundary tests pass.
- server state vertical slices for search and wishlist use React Query.
- `Wishlist.tsx` and `AccommodationEdit.tsx` are thin enough that CSS/markup changes do not touch API orchestration.
- app-shell/generic component ownership is explicit.
- stale modal/App CSS is removed.
- `npm run typecheck`, no-cache Jest, and build pass.
- manual browser smoke has evidence for desktop and mobile protected flows.

Until then, design work should stay blocked behind structural cleanup.
