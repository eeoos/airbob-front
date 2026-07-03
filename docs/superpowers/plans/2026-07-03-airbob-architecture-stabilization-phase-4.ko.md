# Airbob Architecture Stabilization Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 시스템 적용 전에 남은 feature ownership, modal scroll-lock, z-index/token 경계를 안정화한다.

**Architecture:** `src/components`는 generic UI만 남기고 검색 지도와 리뷰 모달은 feature 소유로 이동한다. Modal body scroll lock은 shared UI primitive에서 제공하는 hook으로 통합하고, CSS overlay/z-index는 token contract 테스트로 회귀를 막는다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, CSS Modules, Jest/React Testing Library.

---

## File Structure

- Move: `src/components/Map/*` -> `src/features/search/components/SearchMap/*`
  - 검색 페이지 전용 Google Map workflow를 search feature ownership으로 이동한다.
- Modify: `src/pages/Search/Search.tsx`
  - `Map` import를 feature path로 바꾼다.
- Move: `src/components/ReviewModal/*` -> `src/features/reviews/components/ReviewModal/*`
  - 후기 모달을 reviews feature ownership으로 이동한다.
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`
  - `ReviewModal` import를 feature path로 바꾼다.
- Create: `src/shared/ui/useBodyScrollLock.ts`
  - body scroll lock counting/restoration을 Dialog와 legacy feature modals가 공유한다.
- Create: `src/shared/ui/useBodyScrollLock.test.tsx`
  - 중첩 lock과 이전 overflow 복구를 검증한다.
- Modify: `src/shared/ui/Dialog/Dialog.tsx`
  - 기존 module-local scroll-lock 구현을 shared hook으로 대체한다.
- Modify: `src/shared/ui/index.ts`
  - `useBodyScrollLock`을 export한다.
- Modify: `src/features/reviews/components/ReviewModal/ReviewModal.tsx`
  - 직접 `document.body.style.overflow`를 제거하고 shared hook을 사용한다.
- Modify: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx`
  - 직접 `document.body.style.overflow`를 제거하고 shared hook을 사용한다.
- Modify: `src/components/components-boundary-contracts.test.ts`
  - `Map`과 `ReviewModal`이 generic components에 다시 생기지 않도록 금지한다.
- Modify: `src/shared/ui/shared-ui-boundary-contracts.test.ts`
  - modal scroll-lock 경계를 `Dialog` 또는 `useBodyScrollLock`으로 강제한다.
- Modify: `src/styles/tokens.test.ts`
  - moved modal CSS도 token-owned CSS 목록에 포함한다.

## Protected Flows

- Search page desktop/mobile map rendering and map marker helper tests.
- Accommodation detail review modal open/close behavior.
- Host listing action modal open/close and action behavior.
- Auth/Reservation modals using `Dialog`.
- Existing z-index token values and overlay stacking.

## Task 1: Move Search Map Into Search Feature Ownership

**Files:**
- Move: `src/components/Map/*` -> `src/features/search/components/SearchMap/*`
- Modify: `src/pages/Search/Search.tsx`
- Modify: `src/components/components-boundary-contracts.test.ts`

- [x] **Step 1: Add boundary test for forbidden generic workflow directories**

Add this test to `src/components/components-boundary-contracts.test.ts`:

```ts
it("keeps search map workflow out of generic components", () => {
  const forbiddenWorkflowDirectories = ["Map", "ReviewModal"];

  const existingForbiddenDirectories = forbiddenWorkflowDirectories.filter(
    (directoryName) => {
      try {
        readdirSync(join(componentsRoot, directoryName));
        return true;
      } catch {
        return false;
      }
    }
  );

  expect(existingForbiddenDirectories).toEqual([]);
});
```

- [x] **Step 2: Run boundary test and verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/components-boundary-contracts.test.ts
```

Expected: FAIL with `["Map", "ReviewModal"]`.

- [x] **Step 3: Move Map files**

Run:

```bash
mkdir -p src/features/search/components
git mv src/components/Map src/features/search/components/SearchMap
```

Update imports in `src/features/search/components/SearchMap/Map.tsx`:

```tsx
import { AccommodationSearchInfo } from "../../../../types/accommodation";
import { getImageUrl } from "../../../../utils/image";
import { useGoogleMapsScript } from "../../../../hooks/useGoogleMapsScript";
import { routeTo } from "../../../../routes/paths";
```

Update `src/pages/Search/Search.tsx`:

```tsx
import { Map } from "../../features/search/components/SearchMap";
```

- [x] **Step 4: Run moved map tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/components/SearchMap/lib/infoWindowContent.test.ts src/features/search/components/SearchMap/lib/infoWindowDom.test.ts src/features/search/components/SearchMap/lib/mapBounds.test.ts src/features/search/components/SearchMap/lib/mapExpandControl.test.ts src/features/search/components/SearchMap/lib/markerIcon.test.ts src/components/components-boundary-contracts.test.ts
```

Expected: PASS.

## Task 2: Move Review Modal And Centralize Scroll Lock

**Files:**
- Move: `src/components/ReviewModal/*` -> `src/features/reviews/components/ReviewModal/*`
- Create: `src/shared/ui/useBodyScrollLock.ts`
- Create: `src/shared/ui/useBodyScrollLock.test.tsx`
- Modify: `src/shared/ui/Dialog/Dialog.tsx`
- Modify: `src/shared/ui/index.ts`
- Modify: `src/features/reviews/components/ReviewModal/ReviewModal.tsx`
- Modify: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`
- Modify: `src/shared/ui/shared-ui-boundary-contracts.test.ts`

- [x] **Step 1: Write scroll-lock hook tests**

Create `src/shared/ui/useBodyScrollLock.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { useBodyScrollLock } from "./useBodyScrollLock";

describe("useBodyScrollLock", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("locks body scroll while active and restores the previous overflow", () => {
    document.body.style.overflow = "auto";

    const { rerender, unmount } = renderHook(
      ({ isLocked }) => useBodyScrollLock(isLocked),
      { initialProps: { isLocked: true } }
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender({ isLocked: false });

    expect(document.body.style.overflow).toBe("auto");

    unmount();

    expect(document.body.style.overflow).toBe("auto");
  });

  it("keeps body locked until the last nested lock is released", () => {
    const first = renderHook(({ isLocked }) => useBodyScrollLock(isLocked), {
      initialProps: { isLocked: true },
    });
    const second = renderHook(({ isLocked }) => useBodyScrollLock(isLocked), {
      initialProps: { isLocked: true },
    });

    expect(document.body.style.overflow).toBe("hidden");

    first.unmount();

    expect(document.body.style.overflow).toBe("hidden");

    second.unmount();

    expect(document.body.style.overflow).toBe("");
  });
});
```

- [x] **Step 2: Expand modal boundary test**

Replace `dialogOwnedModalFiles` in `src/shared/ui/shared-ui-boundary-contracts.test.ts` with:

```ts
const scrollLockOwnedModalFiles = [
  "features/auth/components/AuthModal/AuthModal.tsx",
  "features/reservations/components/ReservationModal/ReservationModal.tsx",
  "features/reviews/components/ReviewModal/ReviewModal.tsx",
  "features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx",
];
```

Replace the assertions with:

```ts
const hasSharedScrollBoundary =
  source.includes("<Dialog") || source.includes("useBodyScrollLock(");

if (!hasSharedScrollBoundary) {
  fileViolations.push(`${relativePath}: missing shared scroll-lock boundary`);
}

if (source.includes("document.body.style.overflow")) {
  fileViolations.push(`${relativePath}: owns body scroll lock`);
}
```

- [x] **Step 3: Run tests and verify failures**

Run:

```bash
npm run test:ci -- --runTestsByPath src/shared/ui/useBodyScrollLock.test.tsx src/shared/ui/shared-ui-boundary-contracts.test.ts
```

Expected: FAIL because the hook does not exist and moved modal paths do not exist yet.

- [x] **Step 4: Move ReviewModal files**

Run:

```bash
mkdir -p src/features/reviews/components
git mv src/components/ReviewModal src/features/reviews/components/ReviewModal
```

Update imports in `src/features/reviews/components/ReviewModal/ReviewModal.tsx`:

```tsx
import { useBodyScrollLock } from "../../../../shared/ui";
import { ReviewInfo } from "../../../../types/review";
import { ReviewSortType } from "../../../../types/enums";
import { getImageUrl } from "../../../../utils/image";
```

Replace the `useEffect` body-scroll block with:

```tsx
useBodyScrollLock(isOpen);
```

Update `src/pages/AccommodationDetail/AccommodationDetail.tsx`:

```tsx
import { ReviewModal } from "../../features/reviews/components/ReviewModal/ReviewModal";
```

- [x] **Step 5: Implement shared scroll lock hook**

Create `src/shared/ui/useBodyScrollLock.ts`:

```ts
import { useEffect } from "react";

let activeScrollLockCount = 0;
let previousBodyOverflow = "";

export const useBodyScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (!isLocked) {
      return;
    }

    if (activeScrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    activeScrollLockCount += 1;

    return () => {
      activeScrollLockCount = Math.max(0, activeScrollLockCount - 1);

      if (activeScrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        previousBodyOverflow = "";
      }
    };
  }, [isLocked]);
};
```

Update `src/shared/ui/index.ts`:

```ts
export { useBodyScrollLock } from "./useBodyScrollLock";
```

Update `src/shared/ui/Dialog/Dialog.tsx`:

```tsx
import { useBodyScrollLock } from "../useBodyScrollLock";
...
useBodyScrollLock(isOpen);
```

Remove `openDialogCount` and `previousBodyOverflow` from `Dialog.tsx`.

- [x] **Step 6: Update AccommodationActionModal scroll lock**

Update imports in `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx`:

```tsx
import React, { useEffect } from "react";
import { useBodyScrollLock } from "../../../../shared/ui";
```

Add after the hook setup:

```tsx
useBodyScrollLock(isOpen);
```

Replace the body-scroll `useEffect` with:

```tsx
useEffect(() => {
  if (!isOpen) {
    clearError();
  }
}, [isOpen, clearError]);
```

- [x] **Step 7: Run modal tests and boundary tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/shared/ui/useBodyScrollLock.test.tsx src/shared/ui/Dialog/Dialog.test.tsx src/shared/ui/shared-ui-boundary-contracts.test.ts src/components/components-boundary-contracts.test.ts
```

Expected: PASS.

## Task 3: Token Gate For Moved Modal CSS

**Files:**
- Modify: `src/styles/tokens.test.ts`
- Modify: `src/features/reviews/components/ReviewModal/ReviewModal.module.css`
- Modify: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.module.css`

- [x] **Step 1: Add moved modal CSS files to design token ownership**

Add these files to `designTokenOwnedCssFiles` in `src/styles/tokens.test.ts`:

```ts
"features/reviews/components/ReviewModal/ReviewModal.module.css",
"features/accommodations/components/AccommodationActionModal/AccommodationActionModal.module.css",
```

- [x] **Step 2: Run token test and verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/styles/tokens.test.ts
```

Expected: FAIL with literal color/radius/shadow offenders in the moved modal CSS.

- [x] **Step 3: Replace core literals with tokens**

In `ReviewModal.module.css` and `AccommodationActionModal.module.css`, replace:

```css
background: white;
background-color: #f7f7f7;
color: #222222;
color: white;
border: 1px solid #dddddd;
border-bottom: 1px solid #ebebeb;
border-radius: 8px;
border-radius: 12px;
border-radius: 50%;
box-shadow: 0 2px 16px rgba(0, 0, 0, 0.18);
aspect-ratio: 1;
```

with:

```css
background: var(--color-background-page);
background-color: var(--color-background-muted);
color: var(--color-text-primary);
color: var(--color-text-inverse);
border: 1px solid var(--color-border-default);
border-bottom: 1px solid var(--color-border-subtle);
border-radius: var(--radius-md);
border-radius: var(--radius-lg);
border-radius: var(--radius-pill);
box-shadow: var(--shadow-md);
aspect-ratio: var(--card-media-ratio);
```

Keep local `z-index: 10` and `z-index: 100` only for local stacking inside the modal unless they are app overlay values.

- [x] **Step 4: Run token tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/styles/tokens.test.ts
```

Expected: PASS.

## Task 4: Verification

**Files:**
- No new source changes unless verification reveals regressions in the files above.

- [x] **Step 1: Run focused Phase 4 tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/components/SearchMap/lib/infoWindowContent.test.ts src/features/search/components/SearchMap/lib/infoWindowDom.test.ts src/features/search/components/SearchMap/lib/mapBounds.test.ts src/features/search/components/SearchMap/lib/mapExpandControl.test.ts src/features/search/components/SearchMap/lib/markerIcon.test.ts src/shared/ui/useBodyScrollLock.test.tsx src/shared/ui/Dialog/Dialog.test.tsx src/shared/ui/shared-ui-boundary-contracts.test.ts src/components/components-boundary-contracts.test.ts src/styles/tokens.test.ts
```

Expected: PASS.

- [x] **Step 2: Run full verification**

Run:

```bash
npm run verify
```

Expected: PASS.

- [x] **Step 3: Run gstack QA smoke if browser-impacting changes need inspection**

Start the app:

```bash
BROWSER=none npm start
```

Use gstack browse on:

```text
1. /search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2
2. /accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2
```

Expected: page renders without new console runtime exceptions. Backend 401 is acceptable in local unauthenticated mode and should be recorded as an environment limitation.

## Self-Review

- Spec coverage: Covers Map ownership, modal scroll-lock hierarchy, and token/z-index readiness without applying a new visual skin.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps are present.
- Type consistency: `SearchMap`, `ReviewModal`, and `useBodyScrollLock` paths are consistent across tasks.
