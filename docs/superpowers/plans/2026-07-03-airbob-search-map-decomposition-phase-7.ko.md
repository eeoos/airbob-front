# Airbob SearchMap Decomposition Phase 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SearchMap/Map.tsx`의 지도 SDK, 마커, bounds, InfoWindow, expand control 책임을 hook/utility 경계로 분해한다. 사용자 동작과 API/라우팅/서버 로직은 변경하지 않는다.

**Architecture:** `Map.tsx`는 Google Maps script 상태, hook 조합, loading/render shell만 소유한다. SDK side effect는 `hooks/` 아래로 이동하고, DOM string/marker icon/map bounds 순수 로직은 기존 `lib/`에 남긴다.

**Tech Stack:** React 19, TypeScript 4.9, CSS Modules, Google Maps JS API, Jest.

---

## File Structure

- Create: `src/features/search/components/SearchMap/types.ts`
  - 지도 props와 bounds/viewport 타입을 공유한다.
- Create: `src/features/search/components/SearchMap/hooks/useGoogleMapInstance.ts`
  - 지도 인스턴스 생성, 초기 viewport fit, map click/interaction listener, 초기 expand control 생성을 소유한다.
- Create: `src/features/search/components/SearchMap/hooks/useMapBoundsReporter.ts`
  - idle listener, 3초 debounce, bounds 변경 감지, loading overlay state를 소유한다.
- Create: `src/features/search/components/SearchMap/hooks/useAccommodationMarkers.ts`
  - 숙소 마커 생성/제거, marker icon cache, viewport/accommodation fitBounds 정책을 소유한다.
- Create: `src/features/search/components/SearchMap/hooks/useMapSelectionInfoWindow.ts`
  - selected/hovered marker icon 복원, InfoWindow 생성/닫기, 전역 bridge 함수를 소유한다.
- Create: `src/features/search/components/SearchMap/hooks/useMapExpandControl.ts`
  - 확장 버튼 업데이트와 Google Maps resize trigger를 소유한다.
- Modify: `src/features/search/components/SearchMap/Map.tsx`
  - hook 조합과 렌더링만 남긴다.
- Modify: `src/features/search/components/SearchMap/Map.module.css`
  - raw token/radius/shadow literal을 기존 token으로 정리한다.
- Create: `src/features/search/components/SearchMap/SearchMapStructure.test.ts`
  - `Map.tsx`가 Marker/InfoWindow/Blob/window bridge를 직접 소유하지 않도록 구조 계약을 추가한다.

---

### Task 1: Add Structure Contract

- [x] **Step 1: Add failing structure test**

Create `SearchMapStructure.test.ts` and assert that `Map.tsx` does not contain:

```ts
[
  "new window.google.maps.Marker",
  "new window.google.maps.InfoWindow",
  "new Blob",
  "window.toggleWishlist",
  "window.closeInfoWindow",
]
```

- [x] **Step 2: Run focused test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/components/SearchMap/SearchMapStructure.test.ts --runInBand
```

Expected: FAIL because `Map.tsx` still owns these responsibilities.

---

### Task 2: Extract Shared Types

- [x] **Step 1: Create `types.ts`**

Move `MapProps`, bounds type, and viewport type to `types.ts`. Export `SearchMapProps`, `SearchMapBounds`, and `SearchMapViewport`.

- [x] **Step 2: Update `Map.tsx` imports**

Use `SearchMapProps` from `types.ts` and keep the public export name `Map`.

---

### Task 3: Extract Map Instance and Bounds Hooks

- [x] **Step 1: Create `useGoogleMapInstance`**

Move initial map creation, viewport fit-on-create, click handler, map interaction listeners, and initial expand control creation.

- [x] **Step 2: Create `useMapBoundsReporter`**

Move idle listener, previous bounds tracking, debounce timer, and `isLoadingBounds` state.

---

### Task 4: Extract Marker and InfoWindow Hooks

- [x] **Step 1: Create `useAccommodationMarkers`**

Move marker creation, icon cache, hover animation, accommodation fitBounds policy, and marker cleanup.

- [x] **Step 2: Create `useMapSelectionInfoWindow`**

Move selected marker restoration, InfoWindow creation, InfoWindow chrome adjustment, global wishlist/close bridge, hovered marker sync, and selected icon persistence.

- [x] **Step 3: Create `useMapExpandControl`**

Move expansion button refresh and resize trigger effect.

---

### Task 5: Token Cleanup and Verification

- [x] **Step 1: Tokenize `Map.module.css`**

Replace raw radius/color/shadow values with existing design tokens where possible.

- [x] **Step 2: Run focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/search/components/SearchMap/SearchMapStructure.test.ts src/features/search/components/SearchMap/lib/mapBounds.test.ts src/features/search/components/SearchMap/lib/markerIcon.test.ts src/features/search/components/SearchMap/lib/infoWindowContent.test.ts src/features/search/components/SearchMap/lib/infoWindowDom.test.ts src/features/search/components/SearchMap/lib/mapExpandControl.test.ts src/styles/tokens.test.ts --runInBand
```

Expected: PASS.

- [x] **Step 3: Run typecheck, full Jest, build**

Run:

```bash
npm run typecheck
npm run test:ci:no-cache -- --runInBand
npm run build
```

Expected: PASS.

---

## Self-Review

- Scope guard: No backend/API/DB/server changes. No route behavior change.
- Risk guard: Keep existing Google Maps imperative behavior intact by moving code mostly verbatim before simplifying.
- Remaining after this phase: Broader page breakpoint consolidation can continue after SearchMap has stable hook boundaries.
- Follow-up plan: `docs/superpowers/plans/2026-07-03-airbob-pre-design-qa-overlay-token-phase-8.ko.md`
