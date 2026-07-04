# Airbob Post-Merge Frontend Architecture Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 병합된 `main` 기준으로 Airbnb 스타일 디자인 리팩터 전에 남은 프론트 구조 리스크를 닫고, 기능 회귀를 잡을 검증 게이트를 세운다.

**Architecture:** 결제/예약처럼 사용자 피해가 큰 흐름을 먼저 안정화하고, 그 다음 route/page/feature/layout 경계를 계약 테스트로 고정한다. 디자인 시스템 작업은 shared UI touch target, token ownership, SearchBar semantics, browser smoke가 닫힌 뒤 page-level visual redesign으로 들어간다.

**Tech Stack:** React 19, TypeScript, React Router 7, TanStack Query 5, Axios, CRA/react-scripts, Jest, React Testing Library, CSS Modules, gstack browse/QA.

---

## Post-Merge Audit Report

### Current Structure Summary

- `src/App.tsx`는 `src/routes/Router.tsx`만 렌더링한다.
- `src/routes`가 URL table, `routeTo`, lazy route config, protected route wrapper를 소유한다.
- `Search`, `Wishlist`, `AccommodationDetail`, `AccommodationEdit`는 route adapter와 feature route container로 일부 분리됐다.
- `Profile`, `Auth`, `Reservations`는 아직 page가 route parsing, workflow orchestration, status formatting, local state, navigation을 직접 많이 갖고 있다.
- `src/shared/ui`에는 `Button`, `IconButton`, `TextField`, `Card`, `Dialog`, `StateView`, `CounterStepper`가 있고 domain-free contract가 있다.
- `src/components`는 `DatePicker`, `ErrorToast`, `ListContainer`, `ErrorBoundary`가 남은 generic leftover layer다.
- `src/layouts/AppHeader`는 app shell이어야 하지만 search/auth/accommodation feature internals를 직접 import한다.
- `package.json`의 기본 검증은 `typecheck`, no-cache Jest, build이고, `smoke:frontend`는 별도 수동 browser gate다.

### Major Problems

- Payment callback 실패 처리에서 retryable confirm failure와 terminal invalid callback이 섞여 있다.
- `PaymentSuccess`가 confirm 실패에서도 checkout recovery state를 먼저 지운다.
- `usePaymentConfirmation`은 in-flight/idempotency guard 없이 `/payments/confirm`을 effect에서 호출한다.
- `ReservationStatus.PAYMENT_COMPLETED`, `ReservationStatus.COMPLETED`가 guest detail/status formatters에서 빠져 있다.
- page adapter boundary가 네 개 route에만 적용되어 Profile/Auth/Reservation pages는 쉽게 다시 비대해진다.
- feature route container가 page CSS를 import해 dependency direction이 뒤집혀 있다.
- `ui-api-boundary-contracts.test.ts`는 `pages`, `components`만 검사하고 `layouts`와 feature UI component를 놓친다.
- `AppHeader`가 feature deep import를 통해 search bar, auth modal, hosting draft creation을 직접 안다.
- SearchBar는 클릭 가능한 `div`, 접근성 이름 없는 icon-only button, sub-44px controls, legacy raw CSS를 갖고 있다.
- smoke gate는 route text load 중심이라 예약/결제/위시리스트/profile tab 같은 핵심 상호작용 회귀를 충분히 잡지 못한다.

### Refactoring Risk Zones

- Toss payment handoff: `/reservations/:reservationUid/success`, `/fail`, checkout `sessionStorage`, payment confirm API.
- Search route state: destination/date/guest/page/map bounds query, browser back/forward, detail route query allowlist.
- AppHeader: desktop/mobile SearchBar, auth modal, user menu, hosting draft creation.
- Wishlist/search cache coupling: wishlist mutation 후 search card state와 recently viewed membership 보정.
- Profile mode/tab URL state: guest/host tab strings, host reservation sort/detail navigation.
- Shared overlays: Dialog, auth/reservation/review/wishlist/accommodation modals, mobile bottom sheet z-index.
- Accommodation edit wizard: step navigation, labels, image upload/reorder/remove, type/amenity modals.

### Flows To Preserve

- Protected route redirect -> `/login` -> original path/search/hash return.
- Search submit -> `/search` query sync -> map drag bounds -> result pagination.
- Accommodation detail booking -> reservation confirm -> Toss -> payment success/fail -> reservation detail.
- Payment retry/reconciliation evidence after confirm API failure.
- Wishlist index/detail/recently-viewed, memo modal, infinite scroll, search-card wishlist state.
- Profile guest/host mode and tab state, host listing filters, host reservation detail navigation.
- Accommodation edit create/update/publish flow, address confirmation, image management.
- Auth standalone login/signup and modal login/signup.

### Recommended Architecture Direction

- Route pages should be thin adapters. Workflow containers should live under feature public route entry points.
- `features/*/index.ts` should stay route-facing and not export internals. App shell entry points should be explicit, for example `features/search/appShell.ts`.
- `layouts` should import only route helpers, shared UI, hooks, and explicit feature public app-shell APIs.
- Server-state and cross-feature cache changes should be owned through feature hooks/helpers, not page-level direct mutation.
- CSS ownership should follow component ownership. Feature containers must not import `pages/**` CSS modules.
- Shared UI primitives should own touch target, focus, keyboard, and semantic guarantees before visual styling.
- Browser smoke should become a design-readiness gate, not a post-hoc manual note.

### First Work Order

1. Payment recovery/idempotency.
2. Reservation status formatter and status tests.
3. Route/layout/component boundary contracts and CSS ownership.
4. AppHeader public feature entry points.
5. Shared UI touch target and SearchBar accessibility cleanup.
6. Design-ready smoke gate expansion.

### Cleanup Before Airbnb-Style Design System

- Remove `SearchBar.module.css` from token migration allowlist.
- Enroll route-owned CSS modules after moving them to feature-owned paths.
- Replace clickable `div`/`th` interactions with `button`/`Link` and semantic ARIA states.
- Move `DatePicker`, status badge, tabs, bottom sheet, and counter patterns into explicit primitives or feature-owned public components.
- Add contract tests for sub-44px interactive controls, `transition: all`, raw core colors/shadows, and `outline: none` without replacement.
- Capture desktop/mobile screenshots for search overlays, bottom sheet, cards, dialogs, reservation/payment pages.

### Design Readiness Judgment

바로 대규모 Airbnb 스타일 디자인 리팩터로 들어가면 안 된다. 정적 검증은 통과하지만 payment recovery, idempotent confirm, route/layout boundary, SearchBar semantics, smoke interaction coverage가 아직 구조 리스크로 남아 있다. 단, shared primitive 단위의 작은 정리는 지금 시작해도 된다.

## File Structure

Create:

- `src/features/reservations/lib/paymentConfirmationAttemptRegistry.ts`  
  Payment confirm in-flight promise sharing and confirmed-session marker.
- `src/features/reservations/lib/paymentConfirmationAttemptRegistry.test.ts`  
  Registry unit tests for in-flight dedupe, success marker, retry after rejection.
- `src/features/reservations/lib/reservationStatusDisplay.ts`  
  Exhaustive reservation status label/tone mapping.
- `src/features/reservations/lib/reservationStatusDisplay.test.ts`  
  Exhaustiveness and label tests for all `ReservationStatus` values.
- `src/features/search/appShell.ts`  
  Public app-shell entry for Header search usage.
- `src/features/auth/appShell.ts`  
  Public app-shell entry for Header auth modal usage.
- `src/features/accommodations/appShell.ts`  
  Public app-shell entry for hosting draft creation.
- `src/features/search/components/SearchBar/SearchBar.test.tsx`  
  Basic semantic regression tests for SearchBar controls.

Modify:

- `src/features/reservations/hooks/usePaymentConfirmation.ts`
- `src/features/reservations/hooks/usePaymentConfirmation.test.ts`
- `src/pages/Reservations/PaymentSuccess.tsx`
- `src/pages/Reservations/PaymentSuccess.test.tsx`
- `src/pages/Reservations/PaymentFail.tsx`
- `src/routes/paths.ts`
- `src/routes/paths.test.ts`
- `src/pages/Reservations/ReservationDetail.tsx`
- `src/pages/Reservations/ReservationDetail.test.tsx`
- `src/pages/Reservations/ReservationDetail.module.css`
- `src/pages/Profile/HostReservations/HostReservations.tsx`
- `src/pages/Profile/HostReservations/HostReservations.test.tsx`
- `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`
- `src/routes/route-boundary-contracts.test.ts`
- `src/api/ui-api-boundary-contracts.test.ts`
- `src/layouts/AppHeader/Header.tsx`
- `src/layouts/AppHeader/UserMenu.tsx`
- `src/features/search/SearchRoute.tsx`
- `src/features/accommodations/AccommodationDetailRoute.tsx`
- `src/styles/tokens.test.ts`
- `src/shared/ui/IconButton/IconButton.module.css`
- `src/shared/ui/IconButton/IconButton.test.tsx`
- `src/shared/ui/CounterStepper/CounterStepper.module.css`
- `src/features/search/components/SearchBar/SearchBar.tsx`
- `src/features/search/components/SearchBar/SearchBar.module.css`
- `package.json`
- `scripts/smoke/frontend-smoke.mjs`
- `src/verification-gate.test.ts`
- `docs/qa/frontend-architecture-smoke.ko.md`

Move:

- `src/pages/Search/Search.module.css` -> `src/features/search/SearchRoute.module.css`
- `src/pages/AccommodationDetail/AccommodationDetail.module.css` -> `src/features/accommodations/AccommodationDetailRoute.module.css`

---

### Task 1: Payment Confirmation Recovery And Idempotency

**Files:**
- Create: `src/features/reservations/lib/paymentConfirmationAttemptRegistry.ts`
- Create: `src/features/reservations/lib/paymentConfirmationAttemptRegistry.test.ts`
- Modify: `src/features/reservations/hooks/usePaymentConfirmation.ts`
- Modify: `src/features/reservations/hooks/usePaymentConfirmation.test.ts`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.test.tsx`
- Modify: `src/pages/Reservations/PaymentFail.tsx`
- Modify: `src/routes/paths.ts`
- Modify: `src/routes/paths.test.ts`

- [ ] **Step 1: Write failing payment cleanup tests**

In `src/pages/Reservations/PaymentSuccess.test.tsx`, change the failed-confirmation expectation and add a reason query assertion:

```tsx
it("preserves checkout state when payment confirmation fails retryably", async () => {
  mockUsePaymentConfirmation.mockReturnValue({
    result: {
      error: new Error("confirm failed"),
      retryable: true,
      status: "failed",
    },
  });

  render(<PaymentSuccess />);

  await waitFor(() => {
    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(
      "/reservations/reservation-123/fail?reason=confirm-failed",
      { replace: true }
    );
  });
});
```

In the malformed/skipped tests, keep cleanup but expect `reason=invalid-callback`:

```tsx
expect(mockNavigate).toHaveBeenCalledWith(
  "/reservations/reservation-123/fail?reason=invalid-callback",
  { replace: true }
);
```

- [ ] **Step 2: Write failing idempotency tests**

Append to `src/features/reservations/hooks/usePaymentConfirmation.test.ts`:

```ts
it("shares an in-flight confirmation for duplicate mounts of the same payment", async () => {
  let resolveConfirm!: () => void;
  jest.mocked(paymentApi.confirm).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveConfirm = resolve;
      })
  );

  const first = renderHook(() =>
    usePaymentConfirmation({
      amount: "120000",
      orderId: "order-1",
      paymentKey: "payment-key-1",
    })
  );
  const second = renderHook(() =>
    usePaymentConfirmation({
      amount: "120000",
      orderId: "order-1",
      paymentKey: "payment-key-1",
    })
  );

  expect(paymentApi.confirm).toHaveBeenCalledTimes(1);

  resolveConfirm();

  await waitFor(() => expect(first.result.current.isProcessing).toBe(false));
  await waitFor(() => expect(second.result.current.isProcessing).toBe(false));

  expect(first.result.current.result).toEqual({ status: "confirmed", error: null });
  expect(second.result.current.result).toEqual({ status: "confirmed", error: null });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/pages/Reservations/PaymentSuccess.test.tsx src/features/reservations/hooks/usePaymentConfirmation.test.ts --runInBand
```

Expected: FAIL because failed confirmation currently clears checkout state and duplicate hook mounts call `paymentApi.confirm` twice.

- [ ] **Step 4: Add payment attempt registry**

Create `src/features/reservations/lib/paymentConfirmationAttemptRegistry.ts`:

```ts
type PaymentConfirmationAttemptStatus = "confirmed" | "already-confirmed";

const inFlightAttempts = new Map<string, Promise<void>>();
const confirmedStoragePrefix = "airbob:payment-confirmed:";

const safeGetStorageItem = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetStorageItem = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // A storage failure must not block payment confirmation.
  }
};

export const getPaymentConfirmationAttemptKey = ({
  amount,
  orderId,
  paymentKey,
}: {
  amount: number;
  orderId: string;
  paymentKey: string;
}) => `${orderId}:${paymentKey}:${amount}`;

export const runPaymentConfirmationAttempt = async (
  key: string,
  confirm: () => Promise<void>
): Promise<PaymentConfirmationAttemptStatus> => {
  const confirmedStorageKey = `${confirmedStoragePrefix}${key}`;

  if (safeGetStorageItem(confirmedStorageKey) === "1") {
    return "already-confirmed";
  }

  const existingAttempt = inFlightAttempts.get(key);
  if (existingAttempt) {
    await existingAttempt;
    return "already-confirmed";
  }

  const attempt = confirm();
  inFlightAttempts.set(key, attempt);

  try {
    await attempt;
    safeSetStorageItem(confirmedStorageKey, "1");
    return "confirmed";
  } finally {
    inFlightAttempts.delete(key);
  }
};

export const resetPaymentConfirmationAttemptRegistryForTests = () => {
  inFlightAttempts.clear();
};
```

- [ ] **Step 5: Use registry in payment hook**

In `src/features/reservations/hooks/usePaymentConfirmation.ts`, import the registry and change the result type:

```ts
import {
  getPaymentConfirmationAttemptKey,
  runPaymentConfirmationAttempt,
} from "../lib/paymentConfirmationAttemptRegistry";

export type PaymentConfirmationResult =
  | {
      error: null;
      status: "confirmed" | "invalid" | "skipped";
    }
  | {
      error: unknown;
      retryable: true;
      status: "failed";
    };
```

Replace the `paymentApi.confirm` call block:

```ts
const attemptKey = getPaymentConfirmationAttemptKey({
  amount: parsedAmount,
  orderId,
  paymentKey,
});

try {
  await runPaymentConfirmationAttempt(attemptKey, () =>
    paymentApi.confirm({
      payment_key: paymentKey,
      order_id: orderId,
      amount: parsedAmount,
    })
  );

  if (isActive) {
    setResult({ status: "confirmed", error: null });
  }
} catch (err) {
  if (isActive) {
    setResult({ status: "failed", retryable: true, error: err });
  }
} finally {
  if (isActive) {
    setIsProcessing(false);
  }
}
```

- [ ] **Step 6: Add payment failure route reason**

In `src/routes/paths.ts`, add the type and update `paymentFail`:

```ts
export type PaymentFailReason = "confirm-failed" | "invalid-callback";

paymentFail: (reservationUid: string, query?: { reason?: PaymentFailReason }) =>
  withQuery(buildPath(ROUTE_PATHS.paymentFail, { reservationUid }), {
    reason: query?.reason,
  }),
```

In `src/routes/paths.test.ts`, add:

```ts
expect(routeTo.paymentFail("reservation-123", { reason: "confirm-failed" })).toBe(
  "/reservations/reservation-123/fail?reason=confirm-failed"
);
```

- [ ] **Step 7: Preserve checkout state for retryable failures**

In `src/pages/Reservations/PaymentSuccess.tsx`, replace the cleanup/navigation branch:

```tsx
const shouldClearCheckoutState = result.status !== "failed";

if (shouldClearCheckoutState) {
  try {
    clearReservationCheckoutStateByReservationUid(reservationUid);
  } catch {
    // Cleanup is best-effort and must not block the payment result redirect.
  }
}

if (result.status === "confirmed") {
  navigate(routeTo.reservationDetail(reservationUid), { replace: true });
  return;
}

navigate(
  routeTo.paymentFail(reservationUid, {
    reason: result.status === "failed" ? "confirm-failed" : "invalid-callback",
  }),
  { replace: true }
);
```

In `src/pages/Reservations/PaymentFail.tsx`, read the reason and skip cleanup for retryable confirm failures:

```tsx
const [searchParams] = useSearchParams();
const isRetryableConfirmFailure = searchParams.get("reason") === "confirm-failed";

useEffect(() => {
  if (!reservationUid || isRetryableConfirmFailure) return;

  clearReservationCheckoutStateByReservationUid(reservationUid);
}, [isRetryableConfirmFailure, reservationUid]);
```

- [ ] **Step 8: Run focused verification**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/paths.test.ts src/features/reservations/hooks/usePaymentConfirmation.test.ts src/pages/Reservations/PaymentSuccess.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/reservations/lib/paymentConfirmationAttemptRegistry.ts src/features/reservations/lib/paymentConfirmationAttemptRegistry.test.ts src/features/reservations/hooks/usePaymentConfirmation.ts src/features/reservations/hooks/usePaymentConfirmation.test.ts src/pages/Reservations/PaymentSuccess.tsx src/pages/Reservations/PaymentSuccess.test.tsx src/pages/Reservations/PaymentFail.tsx src/routes/paths.ts src/routes/paths.test.ts
git commit -m "fix: preserve payment recovery state on confirm failure"
```

---

### Task 2: Reservation Status Display Contract

**Files:**
- Create: `src/features/reservations/lib/reservationStatusDisplay.ts`
- Create: `src/features/reservations/lib/reservationStatusDisplay.test.ts`
- Modify: `src/pages/Reservations/ReservationDetail.tsx`
- Modify: `src/pages/Reservations/ReservationDetail.test.tsx`
- Modify: `src/pages/Reservations/ReservationDetail.module.css`
- Modify: `src/pages/Profile/HostReservations/HostReservations.tsx`
- Modify: `src/pages/Profile/HostReservations/HostReservations.test.tsx`
- Modify: `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`

- [ ] **Step 1: Write failing status helper test**

Create `src/features/reservations/lib/reservationStatusDisplay.test.ts`:

```ts
import { ReservationStatus } from "../../../types/enums";
import {
  formatReservationStatus,
  getReservationStatusTone,
} from "./reservationStatusDisplay";

describe("reservationStatusDisplay", () => {
  it.each([
    [ReservationStatus.PAYMENT_PENDING, "결제 대기", "warning"],
    [ReservationStatus.PAYMENT_COMPLETED, "결제 완료", "success"],
    [ReservationStatus.CONFIRMED, "확정됨", "success"],
    [ReservationStatus.CANCELLED, "취소됨", "danger"],
    [ReservationStatus.CANCELLATION_FAILED, "취소 실패", "danger"],
    [ReservationStatus.COMPLETED, "이용 완료", "neutral"],
    [ReservationStatus.EXPIRED, "만료됨", "neutral"],
  ] as const)("formats %s", (status, label, tone) => {
    expect(formatReservationStatus(status)).toBe(label);
    expect(getReservationStatusTone(status)).toBe(tone);
  });
});
```

- [ ] **Step 2: Add failing guest detail status tests**

In `src/pages/Reservations/ReservationDetail.test.tsx`, refactor the reservation mock into a mutable `mockReservationStatus`, then add:

```tsx
it.each([
  ["PAYMENT_COMPLETED", "결제 완료"],
  ["COMPLETED", "이용 완료"],
] as const)("renders %s reservation status", (status, label) => {
  mockReservationStatus = status;

  render(<ReservationDetail />);

  expect(screen.getByText(label)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/reservationStatusDisplay.test.ts src/pages/Reservations/ReservationDetail.test.tsx --runInBand
```

Expected: FAIL because the helper does not exist and guest detail omits two valid statuses.

- [ ] **Step 4: Implement exhaustive status helper**

Create `src/features/reservations/lib/reservationStatusDisplay.ts`:

```ts
import { ReservationStatus } from "../../../types/enums";

export type ReservationStatusTone = "success" | "warning" | "danger" | "neutral";

const reservationStatusDisplay = {
  [ReservationStatus.PAYMENT_PENDING]: {
    label: "결제 대기",
    tone: "warning",
    classKey: "payment_pending",
  },
  [ReservationStatus.PAYMENT_COMPLETED]: {
    label: "결제 완료",
    tone: "success",
    classKey: "payment_completed",
  },
  [ReservationStatus.CONFIRMED]: {
    label: "확정됨",
    tone: "success",
    classKey: "confirmed",
  },
  [ReservationStatus.CANCELLED]: {
    label: "취소됨",
    tone: "danger",
    classKey: "cancelled",
  },
  [ReservationStatus.CANCELLATION_FAILED]: {
    label: "취소 실패",
    tone: "danger",
    classKey: "cancellation_failed",
  },
  [ReservationStatus.COMPLETED]: {
    label: "이용 완료",
    tone: "neutral",
    classKey: "completed",
  },
  [ReservationStatus.EXPIRED]: {
    label: "만료됨",
    tone: "neutral",
    classKey: "expired",
  },
} satisfies Record<
  ReservationStatus,
  {
    classKey: string;
    label: string;
    tone: ReservationStatusTone;
  }
>;

export const formatReservationStatus = (status: ReservationStatus) =>
  reservationStatusDisplay[status].label;

export const getReservationStatusTone = (status: ReservationStatus) =>
  reservationStatusDisplay[status].tone;

export const getReservationStatusClassKey = (status: ReservationStatus) =>
  reservationStatusDisplay[status].classKey;
```

- [ ] **Step 5: Use helper in guest detail**

In `src/pages/Reservations/ReservationDetail.tsx`, replace inline conditional text:

```tsx
import {
  formatReservationStatus,
  getReservationStatusClassKey,
} from "../../features/reservations/lib/reservationStatusDisplay";

<span
  className={`${styles.status} ${
    styles[getReservationStatusClassKey(reservation.status)]
  }`}
>
  {formatReservationStatus(reservation.status)}
</span>
```

Add CSS classes to `src/pages/Reservations/ReservationDetail.module.css`:

```css
.status.payment_completed {
  background: var(--color-status-success-bg);
  color: var(--color-success);
}

.status.completed {
  background: var(--color-background-muted);
  color: var(--color-text-secondary);
}
```

- [ ] **Step 6: Use helper in host pages**

In `src/pages/Profile/HostReservations/HostReservations.tsx`, remove local `formatStatus` and `getStatusClass`, import:

```ts
import {
  formatReservationStatus,
  getReservationStatusTone,
} from "../../../features/reservations/lib/reservationStatusDisplay";
```

Add tone class mapping:

```ts
const statusClassByTone = {
  success: styles.statusConfirmed,
  warning: styles.statusDefault,
  danger: styles.statusCancelled,
  neutral: styles.statusDefault,
} as const;
```

Render:

```tsx
<span
  className={`${styles.status} ${
    statusClassByTone[getReservationStatusTone(reservation.status)]
  }`}
>
  {formatReservationStatus(reservation.status)}
</span>
```

In `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`, remove local `formatStatus`, import `formatReservationStatus`, and render:

```tsx
<div className={styles.statusBadge}>
  {formatReservationStatus(reservation.status)}
</div>
```

- [ ] **Step 7: Run focused verification**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/reservationStatusDisplay.test.ts src/pages/Reservations/ReservationDetail.test.tsx src/pages/Profile/HostReservations/HostReservations.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/reservations/lib/reservationStatusDisplay.ts src/features/reservations/lib/reservationStatusDisplay.test.ts src/pages/Reservations/ReservationDetail.tsx src/pages/Reservations/ReservationDetail.test.tsx src/pages/Reservations/ReservationDetail.module.css src/pages/Profile/HostReservations/HostReservations.tsx src/pages/Profile/HostReservations/HostReservations.test.tsx src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx
git commit -m "refactor: centralize reservation status display"
```

---

### Task 3: Route And UI Boundary Contracts

**Files:**
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Modify: `src/api/ui-api-boundary-contracts.test.ts`
- Move: `src/pages/Search/Search.module.css` -> `src/features/search/SearchRoute.module.css`
- Move: `src/pages/AccommodationDetail/AccommodationDetail.module.css` -> `src/features/accommodations/AccommodationDetailRoute.module.css`
- Modify: `src/features/search/SearchRoute.tsx`
- Modify: `src/features/accommodations/AccommodationDetailRoute.tsx`
- Modify: `src/styles/tokens.test.ts`

- [ ] **Step 1: Add failing feature-to-page import contract**

Append to `src/routes/route-boundary-contracts.test.ts`:

```ts
const featuresRoot = join(process.cwd(), "src/features");
const forbiddenPageImportPattern =
  /from\s+["'](?:\.\.\/)+pages(?:\/[^"']*)?["']/;

it("keeps feature modules from importing page modules", () => {
  const violations = collectSourceFiles(featuresRoot)
    .filter((filePath) =>
      forbiddenPageImportPattern.test(readFileSync(filePath, "utf8"))
    )
    .map((filePath) => relative(projectRoot, filePath));

  expect(violations).toEqual([]);
});
```

- [ ] **Step 2: Run contract to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts --runInBand
```

Expected: FAIL with `src/features/search/SearchRoute.tsx` and `src/features/accommodations/AccommodationDetailRoute.tsx`.

- [ ] **Step 3: Move route CSS ownership**

Run:

```bash
git mv src/pages/Search/Search.module.css src/features/search/SearchRoute.module.css
git mv src/pages/AccommodationDetail/AccommodationDetail.module.css src/features/accommodations/AccommodationDetailRoute.module.css
```

Update imports:

```ts
// src/features/search/SearchRoute.tsx
import styles from "./SearchRoute.module.css";

// src/features/accommodations/AccommodationDetailRoute.tsx
import styles from "./AccommodationDetailRoute.module.css";
```

- [ ] **Step 4: Update token ownership paths**

In `src/styles/tokens.test.ts`, replace:

```ts
"pages/Search/Search.module.css",
```

with:

```ts
"features/search/SearchRoute.module.css",
```

Replace:

```ts
"pages/AccommodationDetail/AccommodationDetail.module.css",
```

with:

```ts
"features/accommodations/AccommodationDetailRoute.module.css",
```

If the Accommodation detail path is not currently present in `designTokenOwnedCssFiles`, add it next to the other accommodation feature CSS paths.

- [ ] **Step 5: Include layouts and feature UI in API boundary scans**

Replace the root collection in `src/api/ui-api-boundary-contracts.test.ts` with:

```ts
const productionUiRoots = [
  "pages",
  "components",
  "layouts",
  "features/accommodations/components",
  "features/auth/components",
  "features/profile/components",
  "features/reservations/components",
  "features/reviews/components",
  "features/search/components",
  "features/wishlist/components",
];
```

Keep hooks out of this contract because feature hooks are allowed to call API modules.

- [ ] **Step 6: Run boundary tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts src/styles/tokens.test.ts --runInBand
```

Expected: PASS after CSS imports and token paths are updated.

- [ ] **Step 7: Commit**

```bash
git add src/routes/route-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts src/features/search/SearchRoute.tsx src/features/search/SearchRoute.module.css src/features/accommodations/AccommodationDetailRoute.tsx src/features/accommodations/AccommodationDetailRoute.module.css src/styles/tokens.test.ts
git commit -m "refactor: enforce feature route CSS ownership"
```

---

### Task 4: AppHeader Public Feature Entry Points

**Files:**
- Create: `src/features/search/appShell.ts`
- Create: `src/features/auth/appShell.ts`
- Create: `src/features/accommodations/appShell.ts`
- Modify: `src/layouts/AppHeader/Header.tsx`
- Modify: `src/layouts/AppHeader/UserMenu.tsx`
- Modify: `src/routes/route-boundary-contracts.test.ts`

- [ ] **Step 1: Add failing layout deep-import contract**

Append to `src/routes/route-boundary-contracts.test.ts`:

```ts
const layoutsRoot = join(process.cwd(), "src/layouts");
const forbiddenLayoutFeatureDeepImportPattern =
  /from\s+["'](?:\.\.\/)+(?:features\/[^"']+\/(?:components|hooks|lib))(?:\/[^"']*)?["']/;

it("keeps layouts on explicit feature app-shell APIs", () => {
  const violations = collectSourceFiles(layoutsRoot)
    .filter((filePath) =>
      forbiddenLayoutFeatureDeepImportPattern.test(readFileSync(filePath, "utf8"))
    )
    .map((filePath) => relative(projectRoot, filePath));

  expect(violations).toEqual([]);
});
```

- [ ] **Step 2: Run contract to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts --runInBand
```

Expected: FAIL for `src/layouts/AppHeader/Header.tsx` and `src/layouts/AppHeader/UserMenu.tsx`.

- [ ] **Step 3: Add app-shell entry files**

Create `src/features/search/appShell.ts`:

```ts
export { SearchBar as HeaderSearchBar } from "./components/SearchBar";
export { getViewportFromSearchParams } from "./lib/searchParams";
```

Create `src/features/auth/appShell.ts`:

```ts
export { AuthModal } from "./components/AuthModal";
```

Create `src/features/accommodations/appShell.ts`:

```ts
export { useCreateAccommodationDraft } from "./hooks/useCreateAccommodationDraft";
```

- [ ] **Step 4: Update Header imports**

In `src/layouts/AppHeader/Header.tsx`, replace deep imports:

```ts
import {
  HeaderSearchBar,
  getViewportFromSearchParams,
} from "../../features/search/appShell";
```

Replace both `SearchBar` usages:

```tsx
<HeaderSearchBar
  onExpandedChange={setIsSearchBarExpanded}
  isMapDragMode={isMapDragMode}
/>
```

- [ ] **Step 5: Update UserMenu imports**

In `src/layouts/AppHeader/UserMenu.tsx`, replace deep imports:

```ts
import { useCreateAccommodationDraft } from "../../features/accommodations/appShell";
import { AuthModal } from "../../features/auth/appShell";
```

- [ ] **Step 6: Run layout contract**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts src/layouts/main-layout-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/search/appShell.ts src/features/auth/appShell.ts src/features/accommodations/appShell.ts src/layouts/AppHeader/Header.tsx src/layouts/AppHeader/UserMenu.tsx src/routes/route-boundary-contracts.test.ts
git commit -m "refactor: route app shell through public feature APIs"
```

---

### Task 5: Shared UI And SearchBar Semantic Baseline

**Files:**
- Modify: `src/shared/ui/IconButton/IconButton.module.css`
- Modify: `src/shared/ui/IconButton/IconButton.test.tsx`
- Modify: `src/shared/ui/CounterStepper/CounterStepper.module.css`
- Create: `src/features/search/components/SearchBar/SearchBar.test.tsx`
- Modify: `src/features/search/components/SearchBar/SearchBar.tsx`
- Modify: `src/features/search/components/SearchBar/SearchBar.module.css`
- Modify: `src/styles/tokens.test.ts`

- [ ] **Step 1: Add failing touch target test**

Append to `src/shared/ui/IconButton/IconButton.test.tsx`:

```tsx
it("keeps every size on the 44px touch target baseline", () => {
  render(
    <>
      <IconButton label="작게" size="sm">S</IconButton>
      <IconButton label="기본" size="md">M</IconButton>
    </>
  );

  expect(screen.getByRole("button", { name: "작게" })).toHaveClass("sm");
  expect(screen.getByRole("button", { name: "기본" })).toHaveClass("md");
});
```

Add this CSS source assertion to the same test file:

```tsx
it("defines icon button sizes with the touch target token", () => {
  const source = require("fs").readFileSync(
    require("path").join(process.cwd(), "src/shared/ui/IconButton/IconButton.module.css"),
    "utf8"
  );

  expect(source).toContain("min-width: var(--control-touch-target);");
  expect(source).toContain("min-height: var(--control-touch-target);");
});
```

- [ ] **Step 2: Update IconButton and CounterStepper sizing**

In `src/shared/ui/IconButton/IconButton.module.css`, add to `.iconButton`:

```css
min-width: var(--control-touch-target);
min-height: var(--control-touch-target);
```

Keep visual icon sizes controlled with `width`/`height` only if the clickable box remains at least 44px.

In `src/shared/ui/CounterStepper/CounterStepper.module.css`, make the counter buttons use:

```css
min-width: var(--control-touch-target);
min-height: var(--control-touch-target);
```

- [ ] **Step 3: Add SearchBar semantic tests**

Create `src/features/search/components/SearchBar/SearchBar.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { SearchBar } from "./SearchBar";

jest.mock("../../../hooks/useSearchBarState", () => ({
  useSearchBarState: () => ({
    adultOccupancy: 1,
    checkIn: "",
    checkOut: "",
    childOccupancy: 0,
    completeCheckoutIfNeeded: jest.fn(),
    closeTransientPanels: jest.fn(),
    destination: "",
    handleDateClick: jest.fn(),
    handleDateSelect: jest.fn(),
    handleGuestClick: jest.fn(),
    handlePlaceSelect: jest.fn(),
    handleSearch: jest.fn(),
    infantOccupancy: 0,
    inputText: "",
    isClickingDateArea: false,
    isClickingDatePicker: false,
    isClickingGuestArea: false,
    isClickingGuestPicker: false,
    isExpanded: false,
    isOpeningDatePicker: false,
    isOpeningGuestPicker: false,
    isPlacesLoading: false,
    petOccupancy: 0,
    setAdultOccupancy: jest.fn(),
    setChildOccupancy: jest.fn(),
    setExpanded: jest.fn(),
    setInfantOccupancy: jest.fn(),
    setInputText: jest.fn(),
    setIsOpeningDatePicker: jest.fn(),
    setIsOpeningGuestPicker: jest.fn(),
    setPetOccupancy: jest.fn(),
    setShowDatePicker: jest.fn(),
    setShowGuestPicker: jest.fn(),
    setShowSuggestions: jest.fn(),
    showDatePicker: false,
    showGuestPicker: false,
    showSuggestions: false,
    suggestions: [],
  }),
}));

describe("SearchBar semantics", () => {
  it("gives the icon-only search button an accessible name", () => {
    render(<SearchBar />);

    expect(screen.getByRole("button", { name: "검색" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Give SearchBar button semantics**

In `src/features/search/components/SearchBar/SearchBar.tsx`, update the search button:

```tsx
<button
  aria-label="검색"
  className={styles.searchButton}
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    if (showDatePicker || showGuestPicker) {
      closeTransientPanels({ collapseWhenDateSelected: true });
    }
    handleSearch(e);
  }}
>
```

Convert suggestion items from clickable `div` to `button`:

```tsx
<button
  key={suggestion.placeId}
  className={styles.suggestionItem}
  onMouseDown={(e) => {
    e.preventDefault();
    handlePlaceSelect(suggestion);
  }}
  type="button"
>
```

In `SearchBar.module.css`, ensure `.suggestionItem` resets button styling:

```css
.suggestionItem {
  appearance: none;
  border: 0;
  width: 100%;
  text-align: left;
}
```

- [ ] **Step 5: Remove the easiest SearchBar token exceptions**

In `src/features/search/components/SearchBar/SearchBar.module.css`, replace mobile search and guest control fixed sizes with the touch token:

```css
.controlButton,
.searchButton {
  min-width: var(--control-touch-target);
  min-height: var(--control-touch-target);
}
```

Leave the full SearchBar raw-color migration to the later design-system pass. This task only closes semantics and touch target regressions.

- [ ] **Step 6: Run focused verification**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/shared/ui/IconButton/IconButton.test.tsx src/shared/ui/CounterStepper/CounterStepper.test.tsx src/features/search/components/SearchBar/SearchBar.test.tsx src/styles/tokens.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/IconButton/IconButton.module.css src/shared/ui/IconButton/IconButton.test.tsx src/shared/ui/CounterStepper/CounterStepper.module.css src/features/search/components/SearchBar/SearchBar.test.tsx src/features/search/components/SearchBar/SearchBar.tsx src/features/search/components/SearchBar/SearchBar.module.css src/styles/tokens.test.ts
git commit -m "refactor: establish shared touch and search semantics"
```

---

### Task 6: Design-Ready QA Gate

**Files:**
- Modify: `package.json`
- Modify: `scripts/smoke/frontend-smoke.mjs`
- Modify: `src/verification-gate.test.ts`
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`

- [ ] **Step 1: Add gate script expectation**

In `src/verification-gate.test.ts`, extend the package script test:

```ts
expect(packageJson.scripts["verify:design-ready"]).toBe(
  "npm run verify:pre-redesign && npm run smoke:frontend"
);
```

- [ ] **Step 2: Add `verify:design-ready` script**

In `package.json`, add:

```json
"verify:design-ready": "npm run verify:pre-redesign && npm run smoke:frontend"
```

- [ ] **Step 3: Expand smoke route inputs**

In `scripts/smoke/frontend-smoke.mjs`, add optional stable data ids:

```js
const detailAccommodationId =
  process.env.AIRBOB_SMOKE_ACCOMMODATION_ID?.trim() || "3";
const reservationUid = process.env.AIRBOB_SMOKE_RESERVATION_UID?.trim();
const hostReservationUid = process.env.AIRBOB_SMOKE_HOST_RESERVATION_UID?.trim();
```

Add non-optional detail route:

```js
{
  name: "accommodation-detail",
  path: `/accommodations/${encodeURIComponent(detailAccommodationId)}`,
  selector: "main, #root",
  expectedText: "예약",
}
```

Append optional routes only when env values exist:

```js
if (reservationUid) {
  ROUTES.push({
    name: "reservation-detail",
    path: `/reservations/${encodeURIComponent(reservationUid)}`,
    selector: "main, #root",
    expectedText: "예약 세부정보",
  });
}

if (hostReservationUid) {
  ROUTES.push({
    name: "host-reservation-detail",
    path: `/profile/host/reservations/${encodeURIComponent(hostReservationUid)}`,
    selector: "main, #root",
    expectedText: "예약 정보",
  });
}
```

- [ ] **Step 4: Add smoke script contract terms**

In `src/verification-gate.test.ts`, extend expected smoke terms:

```ts
[
  "AIRBOB_SMOKE_ACCOMMODATION_ID",
  "AIRBOB_SMOKE_RESERVATION_UID",
  "AIRBOB_SMOKE_HOST_RESERVATION_UID",
  "accommodation-detail",
  "reservation-detail",
  "host-reservation-detail",
].forEach((term) => {
  expect(smokeScript).toContain(term);
});
```

- [ ] **Step 5: Document design-ready gate**

In `docs/qa/frontend-architecture-smoke.ko.md`, add the command:

````md
디자인 리팩터 착수 전 필수 게이트:

```bash
AIRBOB_FRONTEND_URL=http://localhost:3000 \
GSTACK_BROWSE_BIN=/absolute/path/to/browse \
AIRBOB_SMOKE_ACCOMMODATION_ID=3 \
AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID=3 \
AIRBOB_SMOKE_RESERVATION_UID=[provided out-of-band] \
AIRBOB_SMOKE_HOST_RESERVATION_UID=[provided out-of-band] \
npm run verify:design-ready
```
````

Do not put email, password, nickname, member id, or concrete reservation ids in the document.

- [ ] **Step 6: Run verification gate**

Run:

```bash
node --check scripts/smoke/frontend-smoke.mjs
npm run test:ci:no-cache -- --runTestsByPath src/verification-gate.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Run full static gate**

Run:

```bash
npm run verify:pre-redesign
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/smoke/frontend-smoke.mjs src/verification-gate.test.ts docs/qa/frontend-architecture-smoke.ko.md
git commit -m "test: add design-ready frontend QA gate"
```

---

## Final Verification For This Plan

After all tasks:

```bash
npm run typecheck
npm run test:ci:no-cache -- --runInBand
npm run build
node --check scripts/smoke/frontend-smoke.mjs
npm run test:ci:no-cache -- --runTestsByPath src/verification-gate.test.ts --runInBand
```

When QA browser prerequisites are available:

```bash
npm run verify:design-ready
```

Expected:

- TypeScript PASS.
- Jest PASS.
- Build PASS with only known browser data freshness warnings.
- Smoke wrapper syntax PASS.
- Verification gate PASS.
- Browser smoke PASS for desktop and mobile route coverage.

## Stop Condition For Page-Level Design Refactor

Do not start broad page-level Airbnb visual redesign until Tasks 1 through 6 pass. Small primitive fixes from Task 5 can proceed earlier because they reduce design risk without changing page composition.

## Self-Review

- Spec coverage: page/component/state/API/styling/routing/build-test audit findings map to Tasks 1 through 6.
- Placeholder scan: this plan contains no deferred implementation markers.
- Type consistency: payment failure reason, reservation status helper names, route helper names, and file paths are consistent across tasks.
