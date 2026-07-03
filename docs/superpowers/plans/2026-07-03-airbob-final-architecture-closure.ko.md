# Airbob Final Frontend Architecture Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every code-changing task. Steps use checkbox (`- [ ]`) syntax for tracking. Backend/API/DB/server code is read-only unless the user explicitly approves backend edits.

**Goal:** Airbnb `design.md` 시각 리팩토링 전에 남은 P1/P2 프론트 구조 blocker를 닫아, 디자인 시스템을 안전하게 입힐 수 있는 React 구조로 마감한다.

**Architecture:** 기존 CRA/React/TypeScript/CSS Modules 구조와 백엔드 API 계약은 유지한다. 페이지는 route/query 조립만 맡기고, 상태 변경 intent는 feature hook의 명시 함수로 노출한다. 공용 modal/focus/body-lock 정책과 디자인 token은 `shared/ui`와 `src/styles/tokens.css`로 수렴시킨다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, CSS Modules, Jest/React Testing Library.

---

## 범위

포함:

- Header logo navigation semantic/accessibility 수정.
- Google Maps InfoWindow raw HTML escape hatch를 typed/accessibility-aware boundary로 정리.
- stale rejected async request regression tests 추가.
- AccommodationEdit final publish에서 detail-address confirm -> pending image upload -> publish 순서 보장.
- Search wishlist reconciliation이 raw `setAccommodations` setter를 받지 않게 경계 정리.
- 디자인 진입점 CSS hard-coded color/radius/shadow를 token으로 교체.
- Auth/Reservation 핵심 모달을 `shared/ui/Dialog`로 수렴하고 contract test 추가.

제외:

- Airbnb `design.md` 시각 디자인 적용.
- UI library 도입.
- 백엔드/API/DB/server 코드 수정.
- ReviewModal/AccommodationActionModal 전체 이관. 이번 작업 후에도 남은 debt로 기록하고, 디자인 pass에서 직접 만질 때 `Dialog`로 이관한다.

## Task A: Header Logo Semantic Navigation

**Files:**
- Create: `src/components/Header/Header.test.tsx`
- Modify: `src/components/Header/Header.tsx`
- Modify: `src/components/Header/Header.module.css`

- [x] **Step 1: failing test 추가**

`Header.test.tsx`를 만들고 logo가 keyboard/screen-reader semantic link인지 검증한다.

```tsx
expect(screen.getByRole("link", { name: "Airbob 홈으로 이동" })).toHaveAttribute("href", "/");
```

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/Header/Header.test.tsx
```

Expected: logo가 `div`라 link query가 FAIL.

- [x] **Step 3: minimal implementation**

`Header.tsx`에서 logo wrapper를 `Link`로 바꾸고 `aria-label="Airbob 홈으로 이동"`을 준다. `useNavigate`와 click handler는 제거한다.

- [x] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/Header/Header.test.tsx
```

Expected: PASS.

## Task B: Map InfoWindow Escape Hatch Formalization

**Files:**
- Modify: `src/components/Map/lib/infoWindowContent.ts`
- Modify: `src/components/Map/lib/infoWindowContent.test.ts`
- Modify: `src/components/Map/Map.tsx`
- Modify: `src/types/google-maps.d.ts`

- [x] **Step 1: failing test 추가**

`infoWindowContent.test.ts`에 raw HTML 버튼 접근성 계약을 추가한다.

```ts
expect(html).toContain('aria-label="위시리스트에서 제거"');
expect(html).toContain('aria-pressed="true"');
expect(html).toContain('aria-label="지도 숙소 카드 닫기"');
expect(html).toContain("O&#39;Hare");
```

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/Map/lib/infoWindowContent.test.ts
```

Expected: aria attributes/single-quote assertion이 FAIL.

- [x] **Step 3: minimal implementation**

InfoWindow 문자열에 `aria-label`, `aria-pressed`, `type="button"`을 추가하고 inline style 값은 token constants로 모은다. `Window.toggleWishlist` 타입을 `src/types/google-maps.d.ts`에 선언하고 `Map.tsx`의 `(window as any)` assignment를 typed `window.toggleWishlist`/`window.closeInfoWindow`로 바꾼다.

- [x] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/Map/lib/infoWindowContent.test.ts && npm run typecheck
```

Expected: PASS.

## Task C: Stale Rejected Async Request Coverage

**Files:**
- Modify: `src/features/search/hooks/useSearchResults.test.tsx`
- Modify: `src/features/reservations/hooks/useGuestTrips.test.ts`

- [x] **Step 1: stale rejection tests 추가**

Search initial request, Search page request, reservation first-page request, reservation load-more request가 최신 성공 응답 이후 늦게 reject되어도 `handleError`를 호출하지 않는 테스트를 추가한다.

- [x] **Step 2: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/hooks/useSearchResults.test.tsx src/features/reservations/hooks/useGuestTrips.test.ts
```

Expected: 현재 guard가 맞으면 PASS. PASS하면 production 변경 없이 coverage-only로 완료한다.

## Task D: AccommodationEdit Publish Confirm Before Upload

**Files:**
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.test.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`

- [x] **Step 1: failing test 추가**

최종 단계에서 상세주소가 비어 있고 pending image가 있을 때 submit하면 upload가 즉시 실행되지 않고 confirm modal이 먼저 뜨는 테스트를 추가한다. confirm 이후에만 upload -> publish 순서가 실행되어야 한다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/pages/AccommodationEdit/AccommodationEdit.test.tsx
```

Expected: 현재는 upload가 먼저 실행되거나 confirm이 뜨지 않아 FAIL.

- [x] **Step 3: minimal implementation**

`handlePublishSubmit`에서 detail-address 확인이 필요하면 `requestDetailAddressConfirm(() => void publishAfterUpload())`로 defer한다. `publishAfterUpload` 내부에서만 `uploadPendingImages()` 후 `handlePublish()`를 호출한다.

- [x] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/pages/AccommodationEdit/AccommodationEdit.test.tsx
```

Expected: PASS.

## Task E: Search Wishlist State Boundary

**Files:**
- Modify: `src/features/search/hooks/useSearchResults.ts`
- Modify: `src/features/search/hooks/useSearchResults.test.tsx`
- Modify: `src/features/search/hooks/useSearchWishlistModal.ts`
- Modify: `src/features/search/hooks/useSearchWishlistModal.test.ts`
- Modify: `src/pages/Search/Search.tsx`

- [x] **Step 1: failing test 추가**

`useSearchResults`가 `updateAccommodationWishlistStatus(accommodationId, isInWishlist)`를 반환하고 raw `setAccommodations`를 반환하지 않는 테스트를 추가한다. `useSearchWishlistModal` 테스트는 `onWishlistStatusChange` callback을 기대하게 바꾼다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/hooks/useSearchResults.test.tsx src/features/search/hooks/useSearchWishlistModal.test.ts
```

Expected: 새 API가 없어 FAIL.

- [x] **Step 3: minimal implementation**

`useSearchResults` 내부 setter는 숨기고 명시적 updater만 반환한다. `useSearchWishlistModal`은 reconciliation 결과를 `onWishlistStatusChange(id, isInAnyWishlist)`로 알린다. `Search.tsx`는 updater를 전달한다.

- [x] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/hooks/useSearchResults.test.tsx src/features/search/hooks/useSearchWishlistModal.test.ts
```

Expected: PASS.

## Task F: Design Token Cleanup For Touched CSS

**Files:**
- Modify: `src/styles/tokens.test.ts`
- Modify: `src/components/CreateWishlistModal/CreateWishlistModal.module.css`
- Modify: `src/components/WishlistModal/WishlistModal.module.css`
- Modify: `src/components/AccommodationCard/BaseAccommodationCard.module.css`
- Modify: `src/components/AccommodationCard/AccommodationCard.Search.module.css`

- [x] **Step 1: failing token contract 추가**

위 네 CSS 파일에서 core color/radius/shadow literal 사용을 금지하는 테스트를 추가한다. 허용값은 `transparent`, `none`, `currentColor`, SVG-only 값이 아닌 design token `var(--color-*)`, `var(--radius-*)`, `var(--shadow-*)`다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/styles/tokens.test.ts
```

Expected: hard-coded literals 때문에 FAIL.

- [x] **Step 3: minimal implementation**

해당 CSS의 `#222222`, `#717171`, `#f7f7f7`, `#dddddd`, `#b0b0b0`, `#ff385c`, `#ffffff`, `white`, `black`, core `border-radius`, core `box-shadow`를 token으로 교체한다.

- [x] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/styles/tokens.test.ts
```

Expected: PASS.

## Task G: Auth/Reservation Dialog Integration

**Files:**
- Modify: `src/components/AuthModal/AuthModal.test.tsx`
- Modify: `src/components/AuthModal/AuthModal.tsx`
- Modify: `src/components/AuthModal/AuthModal.module.css`
- Modify: `src/components/ReservationModal/ReservationModal.test.tsx`
- Modify: `src/components/ReservationModal/ReservationModal.tsx`
- Modify: `src/components/ReservationModal/ReservationModal.module.css`
- Modify: `src/shared/ui/shared-ui-boundary-contracts.test.ts`

- [x] **Step 1: failing tests 추가**

Auth/Reservation modal이 accessible dialog로 렌더되고, 두 파일이 직접 `document.body.style.overflow`를 조작하지 않는 contract test를 추가한다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/AuthModal/AuthModal.test.tsx src/components/ReservationModal/ReservationModal.test.tsx src/shared/ui/shared-ui-boundary-contracts.test.ts
```

Expected: 현재 Auth/Reservation은 직접 overlay/scroll-lock을 들고 있어 FAIL.

- [x] **Step 3: minimal implementation**

두 모달을 `shared/ui/Dialog`로 감싼다. 기존 form/payment 로직은 유지하고, manual body scroll-lock effect와 custom overlay shell은 제거한다.

- [x] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/AuthModal/AuthModal.test.tsx src/components/ReservationModal/ReservationModal.test.tsx src/shared/ui/shared-ui-boundary-contracts.test.ts
```

Expected: PASS.

## Task H: Final Verification

**Files:**
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`
- Modify: `docs/solutions/workflow-issues/frontend-architecture-verification-loop.md`

- [x] **Step 1: QA/docs 업데이트**

새로 닫은 구조 항목과 남은 modal debt를 문서화한다. QA 자격 증명 값은 문서에 저장하지 않는다.

- [x] **Step 2: 전체 검증**

Run:

```bash
npm run verify
git diff --check
```

Expected: typecheck, Jest, build, whitespace check PASS.

## 완료 판정

- P1: Header semantic, InfoWindow typed/accessibility escape hatch, stale rejected request tests 제거.
- P2: AccommodationEdit confirm/upload 순서, Search wishlist updater boundary, touched CSS token cleanup, Auth/Reservation Dialog 수렴 완료.
- Airbnb `design.md` 적용은 이 계획 완료 후 가능. Review/AccommodationAction modal은 디자인 pass에서 직접 만질 때 `Dialog`로 이관한다.

## 2026-07-03 Phase 8 Pre-Design Closure

- Removed unreferenced generic custom modals and locked the `src/components` boundary against `DateChangeModal`/`GuestChangeModal` returning.
- Stabilized fullscreen gallery overlay accessibility by moving `AccommodationImageGalleryModal` onto the shared `Dialog` primitive and labelled controls.
- Expanded token, z-index, and breakpoint contracts for high-impact pre-design screens: Search, Wishlist, Profile, accommodation booking/hero/reviews/description/gallery.
- Ran gstack report-only browser QA for search/map/detail/gallery/booking/modal/protected-route flows.
- Verification: `npm run typecheck`, full `npm run test:ci:no-cache -- --runInBand`, `npm run build`, focused contract suites, and QA report `.gstack/qa-reports/qa-report-localhost-3002-2026-07-03-phase8.md`.
