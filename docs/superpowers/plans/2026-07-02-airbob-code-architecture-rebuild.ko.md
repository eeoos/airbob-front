# Airbob Frontend Code Architecture Rebuild Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for independent review/implementation tasks. Use `superpowers:test-driven-development` for every code-changing task. Keep backend/API/DB/server code read-only unless the user explicitly approves backend edits.

**Goal:** Airbnb 스타일 디자인 시스템을 적용하기 전에 Airbob 프론트엔드 코드를 다시 다루기 쉬운 구조로 만든다. 현재 화면 동작과 URL/API 계약은 보존하되, 페이지에 몰려 있는 UI/상태/API/라우팅 책임을 공용 모듈과 기능 단위로 분리한다.

**Architecture:** 기존 CRA/React/TypeScript/CSS Modules 구조 위에서 점진적으로 `shared`, `features`, `pages` 계층을 만든다. `pages`는 라우트 진입점과 화면 조립만 담당하게 줄이고, 재사용 UI는 `shared/ui`, API 기반 상태 로직은 `features/*/hooks` 또는 `features/*/api`로 이동한다. 시각 디자인 변경은 이 계획의 목표가 아니며, 현재 스타일을 최대한 유지한다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, CSS Modules, Jest/React Testing Library.

---

## 현재 기준선

이미 완료된 기반 작업:

- `npm run verify` 기준선 복구.
- 라우트 경로와 URL builder를 `src/routes/paths.ts`로 중앙화.
- API 응답 envelope 검증을 `src/api/response.ts`로 중앙화.
- 인증 보호 라우트를 `src/routes/RequireAuth.tsx`로 분리.
- CSS token scaffold를 `src/styles/tokens.css`에 추가.

아직 남은 구조 문제:

- `AccommodationEdit`, `AccommodationDetail`, `Search`, `Map`, `Wishlist`, `SearchBar`가 너무 크고 한 파일에 책임이 많다.
- 페이지 컴포넌트가 API 호출, loading/error/empty 상태, form state, URL query, modal state, navigation을 직접 처리한다.
- 공용 버튼/입력/카드/상태 화면이 없어 디자인 적용 시 페이지별 CSS를 계속 직접 고쳐야 한다.
- 페이지별 CSS Modules가 사실상 디자인 시스템 역할을 하고 있어 스타일 일관성이 낮다.
- 테스트가 주로 계약/유틸 중심이고, 공용 UI와 페이지 흐름 테스트가 부족하다.

---

## 목표 파일 구조

점진적으로 아래 구조를 만든다.

```text
src/
  shared/
    ui/
      Button/
      TextField/
      Card/
      StateView/
      index.ts
    layout/
    lib/
  features/
    auth/
    reservations/
    wishlist/
    accommodations/
    search/
  pages/
    Auth/
    Reservations/
    Profile/
    Search/
    AccommodationDetail/
    AccommodationEdit/
```

규칙:

- `shared/ui`: API, router, business domain을 모르는 순수 UI.
- `shared/lib`: format, className merge, query helper처럼 domain이 약한 유틸.
- `features/*`: 특정 업무 도메인의 API 호출 조합, hooks, domain UI.
- `pages/*`: route param/query를 읽고 feature/shared 컴포넌트를 조립한다.
- 기존 `components/*`는 바로 삭제하지 않고, 새 구조로 이동 가능한 것부터 점진 이전한다.

---

## 리팩토링 원칙

- 매 작업은 테스트 먼저 작성한다.
- 매 작업 후 `npm run verify -- --no-cache`가 통과해야 한다.
- 기존 URL, query key, API endpoint, request/response shape는 바꾸지 않는다.
- 백엔드 코드는 읽을 수는 있지만 수정하지 않는다.
- Airbnb `design.md` 적용, UI library 도입, 대규모 시각 변경은 이 계획 이후에 한다.
- `AccommodationEdit`, `AccommodationDetail`, `Search`, `Map`은 고위험 파일이다. 먼저 공용 기반과 작은 페이지 migration을 끝낸 뒤 다룬다.

---

### Task 1: 공용 UI primitive 추가

**Purpose:** 디자인 시스템 적용 전 모든 페이지가 공유할 최소 UI 부품을 만든다. 아직 페이지 migration은 하지 않는다.

**Files:**

- Create: `src/shared/ui/Button/Button.tsx`
- Create: `src/shared/ui/Button/Button.module.css`
- Create: `src/shared/ui/Button/Button.test.tsx`
- Create: `src/shared/ui/Button/index.ts`
- Create: `src/shared/ui/TextField/TextField.tsx`
- Create: `src/shared/ui/TextField/TextField.module.css`
- Create: `src/shared/ui/TextField/TextField.test.tsx`
- Create: `src/shared/ui/TextField/index.ts`
- Create: `src/shared/ui/Card/Card.tsx`
- Create: `src/shared/ui/Card/Card.module.css`
- Create: `src/shared/ui/Card/Card.test.tsx`
- Create: `src/shared/ui/Card/index.ts`
- Create: `src/shared/ui/StateView/StateView.tsx`
- Create: `src/shared/ui/StateView/StateView.module.css`
- Create: `src/shared/ui/StateView/StateView.test.tsx`
- Create: `src/shared/ui/StateView/index.ts`
- Create: `src/shared/ui/index.ts`

- [ ] **Step 1: 테스트 작성**

Verify:

```bash
npm run test:ci -- --runTestsByPath \
  src/shared/ui/Button/Button.test.tsx \
  src/shared/ui/TextField/TextField.test.tsx \
  src/shared/ui/Card/Card.test.tsx \
  src/shared/ui/StateView/StateView.test.tsx
```

Expected: components가 없어서 실패한다.

- [ ] **Step 2: UI primitive 구현**

Required behavior:

- `Button`
  - `variant`: `primary | secondary | ghost | danger`
  - `size`: `sm | md | lg`
  - `fullWidth`
  - `isLoading`
  - `loadingLabel`
  - native button props 지원
- `TextField`
  - `label`, `error`, `hint`
  - accessible `id`, `aria-invalid`, `aria-describedby`
  - native input props 지원
- `Card`
  - `padding`: `none | sm | md | lg`
  - `interactive`
  - generic wrapper props 지원
- `StateView`
  - `LoadingState`, `EmptyState`, `ErrorState`
  - title/description/action slot 지원

- [ ] **Step 3: 검증**

Run:

```bash
npm run verify -- --no-cache
```

- [ ] **Step 4: Commit**

```bash
git add src/shared
git commit -m "feat: add shared UI primitives"
```

---

### Task 2: Auth 화면을 공용 UI로 이전

**Purpose:** 작은 페이지부터 실제 migration을 검증한다. 로그인/회원가입은 구조가 비교적 작고, 입력/버튼/카드 primitive의 실제 사용처가 된다.

**Files:**

- Modify: `src/pages/Auth/Login/Login.tsx`
- Modify: `src/pages/Auth/Login/Login.module.css`
- Modify: `src/pages/Auth/Signup/Signup.tsx`
- Modify: `src/pages/Auth/Signup/Signup.module.css`
- Create if useful: `src/pages/Auth/Login/Login.test.tsx`
- Create if useful: `src/pages/Auth/Signup/Signup.test.tsx`

- [ ] 기존 동작 확인: 입력값, submit, error message, redirect, signup/login 이동.
- [ ] 중복 button/input/card markup을 `shared/ui`로 교체.
- [ ] 페이지 CSS는 layout 전용으로 줄인다.
- [ ] 페이지 테스트로 기본 form 흐름을 고정한다.
- [ ] `npm run verify -- --no-cache` 통과.
- [ ] Commit: `refactor: migrate auth pages to shared UI`

---

### Task 3: 반복 상태 화면 정리

**Purpose:** loading/error/empty UI가 페이지마다 흩어진 문제를 줄인다.

**Candidate files:**

- `src/pages/Wishlist/Wishlist.tsx`
- `src/pages/Profile/GuestTrips/GuestTrips.tsx`
- `src/pages/Profile/HostReservations/HostReservations.tsx`
- `src/pages/Profile/HostListings/HostListings.tsx`
- `src/pages/Reservations/Reservations.tsx`

- [ ] 반복되는 loading/error/empty 상태를 찾는다.
- [ ] `LoadingState`, `EmptyState`, `ErrorState`로 교체한다.
- [ ] 기존 문구와 조건 분기를 보존한다.
- [ ] 필요한 경우 page-level smoke test를 추가한다.
- [ ] `npm run verify -- --no-cache` 통과.
- [ ] Commit: `refactor: use shared async state views`

---

### Task 4: 예약/Profile feature hooks 분리

**Purpose:** 페이지에서 API 호출과 pagination/filter 상태를 떼어낸다.

**Target structure:**

```text
src/features/reservations/
  hooks/
    useGuestTrips.ts
    useHostReservations.ts
  index.ts
```

**Candidate files:**

- `src/pages/Profile/GuestTrips/GuestTrips.tsx`
- `src/pages/Profile/HostReservations/HostReservations.tsx`
- `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`

- [ ] hook contract 테스트를 먼저 작성한다.
- [ ] API 호출, loading/error, reload/loadMore 같은 상태를 hook으로 이동한다.
- [ ] 페이지는 렌더링과 이벤트 wiring만 담당하게 줄인다.
- [ ] URL/query/navigation 계약은 변경하지 않는다.
- [ ] `npm run verify -- --no-cache` 통과.
- [ ] Commit: `refactor: extract reservation profile hooks`

---

### Task 5: Wishlist feature 분리

**Purpose:** wishlist API, modal, list state가 페이지에 몰린 문제를 줄인다.

**Target structure:**

```text
src/features/wishlist/
  hooks/
  components/
  index.ts
```

- [ ] `Wishlist.tsx`의 API state와 modal state를 분리한다.
- [ ] `CreateWishlistModal`, `WishlistModal`과의 경계를 명확히 한다.
- [ ] route builder 사용을 유지한다.
- [ ] `npm run verify -- --no-cache` 통과.
- [ ] Commit: `refactor: extract wishlist feature state`

---

### Task 6: 대형 페이지 분해 계획 작성

**Purpose:** 고위험 파일을 실제로 쪼개기 전에 별도 세부 계획을 만든다.

High-risk files:

- `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- `src/pages/AccommodationDetail/AccommodationDetail.tsx`
- `src/pages/Search/Search.tsx`
- `src/components/Map/Map.tsx`
- `src/components/SearchBar/SearchBar.tsx`

Required output:

- 각 파일의 책임 목록.
- 분리할 컴포넌트/hook 후보.
- 유지해야 할 user flow.
- 테스트/브라우저 QA 기준.
- migration 순서.

Commit:

```bash
git commit -m "docs: plan large page decomposition"
```

---

## Airbnb Design 적용 전 완료 기준

Airbnb `design.md` 적용 전에 최소한 아래가 끝나야 한다.

- `shared/ui` primitive 존재.
- Auth 또는 Wishlist 같은 작은 화면에서 실제 primitive migration 경험 확보.
- loading/error/empty 상태 화면 공용화.
- `pages`와 `features/shared` 경계가 적어도 1~2개 도메인에서 검증됨.
- 대형 페이지 분해 계획 존재.
- `npm run verify -- --no-cache` 통과.

그 후에 해야 할 일:

1. Airbnb `design.md`를 가져온다.
2. 현재 `src/styles/tokens.css`와 비교한다.
3. design token을 `shared/ui`에 먼저 적용한다.
4. 작은 페이지부터 시각 migration을 진행한다.
5. 마지막에 `Search`, `AccommodationDetail`, `AccommodationEdit`, `Map`을 다룬다.

---

## 현재 판단

바로 디자인 리팩토링으로 들어가면 위험하다. 먼저 구조 정리가 필요하다.

이유:

- 현재 디자인을 적용할 공용 UI 계층이 없다.
- 큰 페이지가 API/state/layout/style을 모두 들고 있어 시각 변경이 기능 회귀로 이어질 가능성이 높다.
- 반응형을 다시 다듬으려면 CSS를 페이지별로 고치는 대신 token과 shared component 단위가 먼저 필요하다.

따라서 다음 실행 순서는 `Task 1 -> Task 2 -> Task 3 -> Task 4/5 -> Task 6 -> Airbnb design.md 적용`이다.
