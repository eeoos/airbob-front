# Airbob Architecture Stabilization Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 리팩터 전에 URL/auth 계약, Search query 계약, feature/component ownership, server-state 경계를 먼저 안정화한다.

**Architecture:** 현재 CRA/React/TypeScript/CSS Modules 구조와 백엔드 API 계약은 유지한다. `pages`는 route/query 조립, `features/*`는 도메인 상태/API orchestration, `shared/ui`는 도메인을 모르는 primitive, `routes`는 URL/auth/layout 정책을 담당하도록 경계를 강화한다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, TanStack Query, CSS Modules, Jest/React Testing Library.

---

## File Structure

- Modify: `src/pages/Auth/Login/Login.tsx`
  - 보호 route에서 저장한 `location.state.from`을 로그인 성공 후 소비한다.
- Modify: `src/pages/Auth/Login/Login.test.tsx`
  - 기존 home redirect 테스트를 return target 테스트로 확장한다.
- Modify: `src/features/search/lib/searchParams.ts`
  - SearchBar에서 날짜를 지웠을 때 stale `checkIn/checkOut` query가 남지 않게 한다.
- Modify: `src/features/search/lib/searchParams.test.ts`
  - stale date query 제거 계약을 추가한다.
- Modify: `src/features/search/hooks/useSearchBarState.ts`
  - browser global 대신 React Router의 현재 `urlSearchParams`를 source of truth로 사용한다.
- Modify: `src/features/search/hooks/useSearchBarState.test.tsx`
  - URL query 생성 시 browser global이 아니라 현재 router params를 기준으로 삼는지 검증한다.
- Modify: `src/components/Header/Header.tsx`
  - Search map drag 판정을 `getViewportFromSearchParams` helper로 통일한다.
- Modify: `src/components/Header/Header.test.tsx`
  - malformed viewport query가 map drag mode로 오판되지 않는지 검증한다.
- Later Modify: `src/components/components-boundary-contracts.test.ts`
  - feature-aware component 예외 목록을 줄인다.
- Later Move: `src/components/WishlistModal/*` -> `src/features/wishlist/components/WishlistModal/*`
- Later Move: `src/components/CreateWishlistModal/*` -> `src/features/wishlist/components/CreateWishlistModal/*`
- Later Move: `src/components/AccommodationActionModal/*` -> `src/features/accommodations/components/AccommodationActionModal/*`
- Later Create: `src/features/search/queryKeys.ts`, `src/features/wishlist/queryKeys.ts`, `src/features/profile/queryKeys.ts`, `src/features/reservations/queryKeys.ts`
  - TanStack Query migration의 query key entrypoint를 만든다.

## Protected Flows

- Protected route deep link -> login -> original route restore.
- Header/Home/SearchBar search query generation.
- Search text query, Google Place query, map bounds query, pagination.
- Search mobile/desktop map drag mode display.
- Wishlist modal and accommodation action modal behavior while moving ownership.
- Existing backend API endpoint, request body, response shape.

## Task 1: URL/Auth/Search Contract Fixes

**Files:**
- Modify: `src/pages/Auth/Login/Login.tsx`
- Modify: `src/pages/Auth/Login/Login.test.tsx`
- Modify: `src/features/search/lib/searchParams.ts`
- Modify: `src/features/search/lib/searchParams.test.ts`
- Modify: `src/features/search/hooks/useSearchBarState.ts`
- Modify: `src/features/search/hooks/useSearchBarState.test.tsx`
- Modify: `src/components/Header/Header.tsx`
- Modify: `src/components/Header/Header.test.tsx`

- [x] **Step 1: Write failing tests for Login return target**

Update the `react-router-dom` mock in `src/pages/Auth/Login/Login.test.tsx`:

```tsx
let mockLocationState: unknown = null;

jest.mock("react-router-dom", () => ({
  useLocation: () => ({ state: mockLocationState }),
  useNavigate: () => mockNavigate,
}), { virtual: true });
```

Add a `beforeEach` reset:

```tsx
mockLocationState = null;
```

Replace the existing redirect assertion test name and add the return-target case:

```tsx
it("submits credentials and redirects home when no return target exists", async () => {
  render(<Login />);

  await userEvent.type(screen.getByLabelText("이메일"), "user@example.com");
  await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "로그인" }));

  await waitFor(() => {
    expect(mockLogin).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
  });
  expect(mockNavigate).toHaveBeenCalledWith("/");
});

it("redirects to the protected route return target after login", async () => {
  mockLocationState = {
    from: {
      pathname: "/profile",
      search: "?mode=host&tab=reservations",
      hash: "#calendar",
    },
  };

  render(<Login />);

  await userEvent.type(screen.getByLabelText("이메일"), "host@example.com");
  await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "로그인" }));

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith(
      "/profile?mode=host&tab=reservations#calendar"
    );
  });
});
```

- [x] **Step 2: Run Login test to verify it fails**

Run:

```bash
npm run test:ci -- --runTestsByPath src/pages/Auth/Login/Login.test.tsx
```

Expected: FAIL because `Login` still ignores `location.state.from`.

- [x] **Step 3: Implement Login return target**

Update `src/pages/Auth/Login/Login.tsx` imports:

```tsx
import { useLocation, useNavigate } from "react-router-dom";
```

Add helpers above the component:

```tsx
type AuthReturnLocation = {
  pathname?: unknown;
  search?: unknown;
  hash?: unknown;
};

const getAuthReturnPath = (state: unknown): string | null => {
  if (typeof state !== "object" || state === null || !("from" in state)) {
    return null;
  }

  const from = (state as { from?: AuthReturnLocation }).from;
  if (typeof from !== "object" || from === null) {
    return null;
  }

  const pathname = typeof from.pathname === "string" ? from.pathname : "";
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return null;
  }

  const search = typeof from.search === "string" ? from.search : "";
  const hash = typeof from.hash === "string" ? from.hash : "";
  return `${pathname}${search}${hash}`;
};
```

Use location in the component and navigate to the return target:

```tsx
const location = useLocation();
...
navigate(getAuthReturnPath(location.state) ?? routeTo.home());
```

- [x] **Step 4: Write failing tests for stale Search query and Header viewport**

Add to `src/features/search/lib/searchParams.test.ts`:

```ts
it("removes stale dates when a new search has no selected dates", () => {
  const existing = new URLSearchParams(
    "destination=old&checkIn=2026-07-10&checkOut=2026-07-12&page=2"
  );

  const params = buildSearchNavigationParams(existing, {
    destination: "Jeju",
    selectedPlace: null,
    checkIn: null,
    checkOut: null,
    adultOccupancy: 1,
    childOccupancy: 0,
    infantOccupancy: 0,
    petOccupancy: 0,
  });

  expect(params.get("destination")).toBe("Jeju");
  expect(params.has("checkIn")).toBe(false);
  expect(params.has("checkOut")).toBe(false);
  expect(params.has("page")).toBe(false);
});
```

Add to `src/features/search/hooks/useSearchBarState.test.tsx`:

```tsx
it("builds search params from router params instead of browser global search", () => {
  placesState.inputText = "Jeju";
  currentSearchParams = new URLSearchParams("destination=Seoul&page=3");
  setBrowserSearch(
    "?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&page=3"
  );

  const { result } = renderHook(() => useSearchBarState());

  act(() => {
    result.current.handleSearch();
  });

  expect(mockNavigate).toHaveBeenCalledWith(
    "/search?destination=Jeju&adultOccupancy=1&childOccupancy=0&infantOccupancy=0&petOccupancy=0"
  );
});
```

Update `src/components/Header/Header.test.tsx` mock to expose mutable route state:

```tsx
let mockPathname = "/";
let mockSearchParams = new URLSearchParams();
const mockSearchBar = jest.fn();
```

Replace the SearchBar mock:

```tsx
jest.mock("../../features/search/components/SearchBar", () => ({
  SearchBar: (props: { isMapDragMode?: boolean }) => {
    mockSearchBar(props);
    return <div data-testid="search-bar" />;
  },
}));
```

Use mutable router values:

```tsx
useLocation: () => ({ pathname: mockPathname }),
useSearchParams: () => [mockSearchParams, jest.fn()],
```

Add tests:

```tsx
beforeEach(() => {
  mockPathname = "/";
  mockSearchParams = new URLSearchParams();
  mockSearchBar.mockClear();
});

it("passes map drag mode only when all viewport params are valid", () => {
  mockPathname = "/search";
  mockSearchParams = new URLSearchParams(
    "topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128"
  );

  render(<Header />);

  expect(mockSearchBar).toHaveBeenCalledWith(
    expect.objectContaining({ isMapDragMode: true })
  );
});

it("does not pass map drag mode for partial viewport params", () => {
  mockPathname = "/search";
  mockSearchParams = new URLSearchParams("topLeftLat=38&topLeftLng=126");

  render(<Header />);

  expect(mockSearchBar).toHaveBeenCalledWith(
    expect.objectContaining({ isMapDragMode: false })
  );
});
```

- [x] **Step 5: Run Search/Header tests to verify failures**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/lib/searchParams.test.ts src/features/search/hooks/useSearchBarState.test.tsx src/components/Header/Header.test.tsx
```

Expected: FAIL on stale date removal and Header partial viewport behavior.

- [x] **Step 6: Implement Search/Header fixes**

In `src/features/search/lib/searchParams.ts`, replace the optional date setters with deletion-aware branches:

```ts
if (input.checkIn) {
  params.set("checkIn", formatDateForSearchParam(input.checkIn));
} else {
  params.delete("checkIn");
}

if (input.checkOut) {
  params.set("checkOut", formatDateForSearchParam(input.checkOut));
} else {
  params.delete("checkOut");
}
```

In `src/features/search/hooks/useSearchBarState.ts`, replace:

```ts
new URLSearchParams(window.location.search)
```

with:

```ts
urlSearchParams
```

and add `urlSearchParams` to the `handleSearch` dependency list.

In `src/components/Header/Header.tsx`, import and use the shared viewport parser:

```tsx
import { getViewportFromSearchParams } from "../../features/search/lib/searchParams";
...
const hasViewport = getViewportFromSearchParams(searchParams) !== null;
const isMapDragMode =
  location.pathname === ROUTE_PATHS.search &&
  !searchParams.get("destination") &&
  hasViewport;
```

- [x] **Step 7: Run focused tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/pages/Auth/Login/Login.test.tsx src/features/search/lib/searchParams.test.ts src/features/search/hooks/useSearchBarState.test.tsx src/components/Header/Header.test.tsx
```

Expected: PASS.

- [x] **Step 8: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

## Task 2: Move Wishlist Workflow Components Into Feature Ownership

**Files:**
- Move: `src/components/WishlistModal/*` -> `src/features/wishlist/components/WishlistModal/*`
- Move: `src/components/CreateWishlistModal/*` -> `src/features/wishlist/components/CreateWishlistModal/*`
- Modify: imports in `src/pages/Wishlist/Wishlist.tsx`, `src/pages/Search/Search.tsx`, `src/pages/AccommodationDetail/AccommodationDetail.tsx`, and tests.
- Modify: `src/components/components-boundary-contracts.test.ts`

- [x] **Step 1: Write boundary test expectation**

Edit `src/components/components-boundary-contracts.test.ts` so `allowedWorkflowFiles` removes:

```ts
"CreateWishlistModal/CreateWishlistModal.tsx",
"WishlistModal/WishlistModal.tsx",
```

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/components-boundary-contracts.test.ts
```

Expected: FAIL until files move or imports are corrected.

- [x] **Step 2: Move files and update imports**

Move the directories with `git mv`, then update relative imports so the moved files import `Dialog`, `ErrorToast`, `getImageUrl`, `types/wishlist`, and hooks from their new feature location.

Expected import shape in `WishlistModal.tsx`:

```tsx
import { WishlistInfo } from "../../../../types/wishlist";
import { useWishlistSelection } from "../../hooks/useWishlistSelection";
import { getImageUrl } from "../../../../utils/image";
import { Dialog } from "../../../../shared/ui";
import { CreateWishlistModal } from "../CreateWishlistModal/CreateWishlistModal";
import { ErrorToast } from "../../../../components/ErrorToast";
```

- [x] **Step 3: Update callers**

Update callers to import from the feature path:

```tsx
import { WishlistModal } from "../../features/wishlist/components/WishlistModal";
```

or the equivalent relative path for deeper files.

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/components-boundary-contracts.test.ts src/features/wishlist/components/WishlistModal/WishlistModal.test.tsx src/features/wishlist/components/CreateWishlistModal/CreateWishlistModal.test.tsx src/features/wishlist/components/WishlistModal/WishlistModalStyles.test.ts src/pages/Wishlist/Wishlist.routeState.test.tsx src/pages/Wishlist/Wishlist.memoModal.test.tsx src/styles/tokens.test.ts
```

Expected: update test paths if needed; final result PASS.

## Task 3: Move Accommodation Action Workflow Into Feature Ownership

**Files:**
- Move: `src/components/AccommodationActionModal/*` -> `src/features/accommodations/components/AccommodationActionModal/*`
- Modify: `src/pages/Profile/HostListings/HostListings.tsx`
- Modify: `src/components/components-boundary-contracts.test.ts`

- [x] **Step 1: Tighten boundary test**

Remove this allowed workflow file:

```ts
"AccommodationActionModal/AccommodationActionModal.tsx",
```

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/components-boundary-contracts.test.ts
```

Expected: FAIL until the component is moved.

- [x] **Step 2: Move files and update imports**

Use `git mv` for the directory. Expected import shape:

```tsx
import { MyAccommodationInfo } from "../../../../types/accommodation";
import { AccommodationStatus } from "../../../../types/enums";
import { useAccommodationActions } from "../../hooks/useAccommodationActions";
import { ErrorToast } from "../../../../components/ErrorToast";
import { getImageUrl } from "../../../../utils/image";
import { routeTo } from "../../../../routes/paths";
```

- [x] **Step 3: Update HostListings**

Replace:

```tsx
import { AccommodationActionModal } from "../../../components/AccommodationActionModal";
```

with:

```tsx
import { AccommodationActionModal } from "../../../features/accommodations/components/AccommodationActionModal";
```

- [x] **Step 4: Run focused tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/components-boundary-contracts.test.ts src/pages/Profile/HostListings/HostListings.test.tsx src/features/accommodations/hooks/useAccommodationActions.test.ts
```

Expected: PASS.

## Task 4: Create Query Key Entry Points Before Server-State Migration

**Files:**
- Create: `src/features/search/queryKeys.ts`
- Create: `src/features/wishlist/queryKeys.ts`
- Create: `src/features/profile/queryKeys.ts`
- Create: `src/features/reservations/queryKeys.ts`
- Create: matching `*.test.ts` files.

- [x] **Step 1: Write query key tests**

Create tests with stable readonly tuple expectations. Example for Search:

```ts
import { searchQueryKeys } from "./queryKeys";

describe("searchQueryKeys", () => {
  it("builds stable search result keys from params", () => {
    expect(
      searchQueryKeys.results("destination=Seoul&page=2")
    ).toEqual(["search", "results", "destination=Seoul&page=2"]);
  });
});
```

- [x] **Step 2: Implement minimal query key modules**

Example:

```ts
export const searchQueryKeys = {
  all: ["search"] as const,
  results: (paramsSignature: string) =>
    [...searchQueryKeys.all, "results", paramsSignature] as const,
};
```

- [x] **Step 3: Run focused tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/queryKeys.test.ts src/features/wishlist/queryKeys.test.ts src/features/profile/queryKeys.test.ts src/features/reservations/queryKeys.test.ts
```

Expected: PASS.

## Task 5: Self-Review And Gate

**Files:**
- Modify: this plan only if implementation findings require sequencing changes.

- [x] **Step 1: Run focused architecture gates**

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

## Self-Review

- Spec coverage: The plan covers URL/auth, Search route query, component ownership, server-state preparation, and design-system prerequisites without backend/API/DB/server changes.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps are present.
- Type consistency: `AuthReturnLocation`, `searchQueryKeys`, and route helper names match existing project conventions.
