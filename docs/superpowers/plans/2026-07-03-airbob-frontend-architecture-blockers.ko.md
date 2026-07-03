# Airbob Frontend Architecture Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every code-changing task. Steps use checkbox (`- [x]`) syntax for tracking. Backend/API/DB/server code is read-only unless the user explicitly approves backend edits.

**Goal:** Airbnb `design.md` 적용 전에 최종 구조 감사에서 발견된 보안, 결제, 게시, async state, modal/accessibility, verification blocker를 제거한다.

**Architecture:** 기존 CRA/React/TypeScript/CSS Modules 구조와 백엔드 API 계약은 유지한다. `pages`는 route param/query와 화면 조립을 맡고, API/비동기 상태는 `features/*` hook에 둔다. 공용 modal/focus/body-lock 정책은 `shared/ui`로 수렴시켜 디자인 시스템이 한 지점에서 적용되게 한다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, CSS Modules, Jest/React Testing Library, gstack QA.

---

## 범위

포함:

- Google Maps InfoWindow HTML escaping.
- PaymentSuccess confirm 결과별 navigation 정리.
- AccommodationEdit publish 전 save/upload 보장.
- Search/reservation list stale response guard.
- Wishlist mutation error UI 반환.
- Dialog 기반 modal 수렴의 첫 vertical slice와 body scroll lock 공용화.
- verification contract 강화.

제외:

- Airbnb `design.md` 시각 디자인 적용.
- UI library 도입.
- 백엔드/API/DB/server 코드 수정.
- API endpoint, request body, response shape 변경.

## Task A: Map InfoWindow HTML Escaping

**Files:**
- Modify: `src/components/Map/lib/infoWindowContent.ts`
- Modify: `src/components/Map/lib/infoWindowContent.test.ts`

- [x] **Step 1: failing test 추가**

`infoWindowContent.test.ts`에 아래 테스트를 추가한다.

```ts
it("escapes API-provided text and thumbnail attributes before injecting HTML", () => {
  const html = buildInfoWindowContent({
    accommodation: createAccommodation({
      name: `<img src=x onerror="alert(1)">`,
      address_summary: {
        country: `KR"><script>alert(1)</script>`,
        state: null,
        city: `<Seoul>`,
        district: `Mapo & Hongdae`,
      },
    }),
    thumbnailUrl: `https://cdn.example.com/thumb.jpg" onerror="alert(1)`,
    checkIn: null,
    checkOut: null,
    canToggleWishlist: false,
  });

  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  expect(html).toContain("&lt;Seoul&gt;, Mapo &amp; Hongdae");
  expect(html).toContain(
    `src="https://cdn.example.com/thumb.jpg&quot; onerror=&quot;alert(1)"`
  );
  expect(html).not.toContain(`<img src=x onerror="alert(1)">`);
  expect(html).not.toContain(`<script>alert(1)</script>`);
});
```

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/Map/lib/infoWindowContent.test.ts
```

Expected: 새 escaping 테스트가 FAIL.

- [x] **Step 3: HTML escape helper 구현**

`infoWindowContent.ts`에 `escapeHtml`을 추가하고, `accommodation.name`, `locationText`, `thumbnailUrl`, currency text를 HTML 출력 전에 escape한다.

```ts
const escapeHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
```

- [x] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/Map/lib/infoWindowContent.test.ts
```

Expected: PASS.

## Task B: PaymentSuccess 결과 분기 수정

**Files:**
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.test.tsx`

- [x] **Step 1: failed/skipped 테스트 추가**

`PaymentSuccess.test.tsx`에 `confirmed`, `failed`, `skipped` 테스트를 추가한다.

```tsx
it("routes confirmed payment confirmation to the reservation detail page", async () => {
  mockUsePaymentConfirmation.mockReturnValue({
    result: { error: null, status: "confirmed" },
  });

  render(<PaymentSuccess />);

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123");
  });
});

it("routes failed payment confirmation to the failure page", async () => {
  mockUsePaymentConfirmation.mockReturnValue({
    result: { error: new Error("confirm failed"), status: "failed" },
  });

  render(<PaymentSuccess />);

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith(
      "/reservations/reservation-123/fail"
    );
  });
});

it("routes skipped payment confirmation to the failure page", async () => {
  mockUsePaymentConfirmation.mockReturnValue({
    result: { error: null, status: "skipped" },
  });

  render(<PaymentSuccess />);

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith(
      "/reservations/reservation-123/fail"
    );
  });
});
```

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/pages/Reservations/PaymentSuccess.test.tsx
```

Expected: `failed` 또는 `skipped` 케이스가 FAIL.

- [x] **Step 3: navigation 분기 수정**

`PaymentSuccess.tsx`에서 `result.status === "confirmed"`일 때만 `reservationDetail`로 이동하고, `invalid | failed | skipped`은 `paymentFail`로 이동한다.

- [x] **Step 4: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/pages/Reservations/PaymentSuccess.test.tsx src/features/reservations/hooks/usePaymentConfirmation.test.ts
```

Expected: PASS.

## Task C: AccommodationEdit Publish 전 저장/업로드 보장

**Files:**
- Modify: `src/features/accommodations/edit/hooks/useAccommodationEditSave.ts`
- Modify: `src/features/accommodations/edit/hooks/useAccommodationEditSave.test.ts`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`

- [x] **Step 1: publish가 update 후 publish 하는 테스트 추가**

`useAccommodationEditSave.test.ts`에 변경된 form data publish 테스트를 추가한다.

```ts
it("saves changed form data before publishing", async () => {
  const initialFormData = createFilledFormData();
  const formData = {
    ...initialFormData,
    name: "게시 직전 변경",
  };

  const { result } = renderHook(() =>
    useAccommodationEditSave({
      accommodationId: "3",
      currentStep: 5,
      isNewDraft: false,
      formData,
      initialFormData,
      imageItems,
      initialImageItems: imageItems,
      clearError,
      handleError,
      setIsSaving,
      navigateToHostProfile,
      updateAccommodation,
      publishAccommodation,
    })
  );

  await act(async () => {
    await result.current.handlePublish({ preventDefault: jest.fn() });
  });

  expect(updateAccommodation).toHaveBeenCalledWith(3, {
    name: "게시 직전 변경",
  });
  expect(publishAccommodation).toHaveBeenCalledWith(3);
  expect(updateAccommodation.mock.invocationCallOrder[0]).toBeLessThan(
    publishAccommodation.mock.invocationCallOrder[0]
  );
});
```

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/accommodations/edit/hooks/useAccommodationEditSave.test.ts
```

Expected: `updateAccommodation` 호출 기대가 FAIL.

- [x] **Step 3: hook에 publishBeforeSave 지원**

`runPublish`에서 `getUpdateData()`를 계산하고 변경이 있으면 `updateAccommodation`을 먼저 호출한 뒤 `publishAccommodation`을 호출한다.

- [x] **Step 4: page에서 pending image upload 후 publish**

`AccommodationEdit.tsx`의 submit handler를 `handlePublish`에 직접 연결하지 않고, `currentStep === 5`일 때 `uploadPendingImages()` 성공 후 publish하도록 page-local submit handler를 만든다.

- [x] **Step 5: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/accommodations/edit/hooks/useAccommodationEditSave.test.ts src/pages/AccommodationEdit/AccommodationEdit.test.tsx
```

Expected: PASS.

## Task D: Search/Reservation Stale Response Guard

**Files:**
- Modify: `src/features/search/hooks/useSearchResults.ts`
- Modify: `src/features/search/hooks/useSearchResults.test.tsx`
- Modify: `src/features/reservations/hooks/useReservationList.ts`
- Modify: `src/features/reservations/hooks/useGuestTrips.test.ts`
- Modify: `src/features/reservations/hooks/useHostReservations.test.ts`

- [x] **Step 1: Search stale response 실패 테스트 추가**

`useSearchResults.test.tsx`에 두 요청의 resolve 순서를 뒤집는 테스트를 추가한다.

- [x] **Step 2: Reservation stale response 실패 테스트 추가**

`useGuestTrips.test.ts`에 filter rerender 후 이전 응답이 늦게 resolve되어도 최신 filter 결과만 남는 테스트를 추가한다.

- [x] **Step 3: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/hooks/useSearchResults.test.tsx src/features/reservations/hooks/useGuestTrips.test.ts
```

Expected: stale response 테스트 FAIL.

- [x] **Step 4: request id guard 구현**

`useSearchResults`와 `useReservationList`에 `requestIdRef`를 두고, 최신 request id만 state를 갱신하게 한다.

- [x] **Step 5: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/hooks/useSearchResults.test.tsx src/features/reservations/hooks/useGuestTrips.test.ts src/features/reservations/hooks/useHostReservations.test.ts
```

Expected: PASS.

## Task E: Wishlist Mutation Error UI와 Modal Accessibility First Slice

**Files:**
- Modify: `src/features/wishlist/hooks/useWishlistSelection.ts`
- Modify: `src/features/wishlist/hooks/useWishlistSelection.test.ts`
- Modify: `src/features/wishlist/hooks/useCreateWishlist.ts`
- Modify: `src/features/wishlist/hooks/useCreateWishlist.test.ts`
- Modify: `src/components/WishlistModal/WishlistModal.tsx`
- Modify: `src/components/CreateWishlistModal/CreateWishlistModal.tsx`
- Modify: `src/shared/ui/Dialog/Dialog.tsx`

- [x] **Step 1: wishlist hooks가 error/clearError 반환하는 테스트 추가**

`useWishlistSelection.test.ts`와 `useCreateWishlist.test.ts`에 실패 시 `error`가 반환되는 테스트를 추가한다.

- [x] **Step 2: 실패 확인**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/wishlist/hooks/useWishlistSelection.test.ts src/features/wishlist/hooks/useCreateWishlist.test.ts
```

Expected: `error` property 기대가 FAIL.

- [x] **Step 3: hooks 반환값 확장**

`useWishlistSelection`과 `useCreateWishlist`가 `error`, `clearError`를 반환하게 한다.

- [x] **Step 4: Wishlist/CreateWishlist modal에 ErrorToast와 Dialog 적용**

두 modal을 `shared/ui/Dialog` 기반으로 바꾸고, 실패 시 `ErrorToast`를 표시한다. `WishlistModal`의 clickable wishlist item은 `button type="button"`으로 바꾼다.

- [x] **Step 5: 검증**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/wishlist/hooks/useWishlistSelection.test.ts src/features/wishlist/hooks/useCreateWishlist.test.ts
```

Expected: PASS.

## Task F: Verification Contract 강화

**Files:**
- Modify: `src/routes/navigation-contracts.test.ts`
- Modify: `src/styles/tokens.test.ts`
- Create: `src/shared/ui/shared-ui-boundary-contracts.test.ts`
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`

- [x] **Step 1: navigation scan을 동적 수집으로 보강**

`src/pages`와 `src/components` production 파일 중 `navigate(` 또는 `window.open(`을 쓰는 파일을 자동 수집하고 direct internal route string을 금지한다.

- [x] **Step 2: shared/ui boundary test 추가**

`src/shared/ui/**/*.{ts,tsx}` production 파일에서 `api`, `routes`, `pages`, `features` import를 금지한다.

- [x] **Step 3: token z-index contract 강화**

`tokens.css` 제외 production CSS/TSX에서 numeric `z-index` 신규 사용을 리포트하고, overlay 계층은 `var(--z-*)`만 허용한다.

- [x] **Step 4: QA 문서 보강**

QA checklist에 `AccommodationEdit` 저장/이미지/게시, `ReservationConfirm -> Toss -> PaymentSuccess -> ReservationDetail`, `Host reservation detail`을 추가한다. 자격 증명 값은 문서에 저장하지 않는다.

- [x] **Step 5: 전체 검증**

Run:

```bash
npm run verify
```

Expected: typecheck, Jest, build 모두 PASS.

## Task G: Final Audit Follow-up

**Files:**
- Modify: `src/features/search/hooks/useSearchResults.ts`
- Modify: `src/features/search/hooks/useSearchResults.test.tsx`
- Modify: `src/components/AccommodationCard/AccommodationCard.Search.tsx`
- Modify: `src/components/AccommodationCard/BaseAccommodationCard.tsx`
- Modify: `src/components/ErrorToast/ErrorToast.tsx`
- Modify: `src/shared/ui/Dialog/Dialog.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.test.tsx`
- Modify: `src/features/reservations/hooks/useGuestTrips.test.ts`
- Modify: `src/components/Map/lib/infoWindowContent.test.ts`
- Modify: `src/components/WishlistModal/WishlistModal.test.tsx`
- Create: `src/components/CreateWishlistModal/CreateWishlistModal.test.tsx`

- [x] **Step 1: Search pagination stale guard 추가**

서브에이전트 감사에서 발견된 `handlePageChange` direct API path에도 `requestIdRef` guard를 적용하고, 이전 page request가 최신 destination search를 덮지 않는 테스트를 추가했다.

- [x] **Step 2: Core card 접근성 보강**

`AccommodationCardSearch`의 card action을 keyboard-accessible link로 만들고, wishlist toggle에 `aria-label`, `aria-pressed`를 추가했다. `BaseAccommodationCard`도 keyboard-accessible button으로 정리했다.

- [x] **Step 3: Dialog/ErrorToast 접근성 보강**

`Dialog`가 autofocus child를 덮어쓰지 않게 했고, `ErrorToast`에 `role="alert"`, `aria-live`, close button accessible name을 추가했다.

- [x] **Step 4: Publish/upload page-level test 추가**

`AccommodationEdit` 최종 제출에서 pending image upload가 publish보다 먼저 실행되고 upload 실패 시 publish가 호출되지 않는 테스트를 추가했다.

- [x] **Step 5: Test contract gap 보강**

reservation load-more stale response, InfoWindow non-KRW/fallback escaping, Wishlist/CreateWishlist modal Dialog/error rendering, toast z-index dynamic scan, router link/direct route contract를 추가했다.

- [x] **Step 6: Final re-review P2 정리**

Dialog 이관 후 남은 Wishlist/CreateWishlist dead CSS selector를 제거했고, autofocus child가 있는 Dialog도 닫힘 후 focus를 복원하도록 수정했다. Reservation `loadMore`는 state commit 전 중복 호출도 막는 ref guard를 추가했다.

## 최종 판정 기준

- `npm run verify` 통과.
- P1 findings 제거.
- production `pages/components` 직접 API import 없음.
- `InfoWindow` API text escaping 테스트 존재.
- `PaymentSuccess`는 `confirmed`만 성공 상세로 이동.
- `AccommodationEdit` publish 전 save/upload 경로가 보장됨.
- `Search`/reservation list stale response 테스트 존재.
- Wishlist modal failure가 사용자에게 표시됨.
- Dialog 기반 modal 수렴이 최소 1개 핵심 modal vertical slice에서 시작됨.
