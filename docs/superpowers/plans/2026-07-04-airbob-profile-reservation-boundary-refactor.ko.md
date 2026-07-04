# Airbob Profile And Reservation Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pages/Profile` and `pages/Reservations`에 남은 route/workflow 책임을 `features/profile`, `features/reservations`, `features/reviews`의 public route boundary로 이동해 Airbnb 스타일 디자인 작업 전에 page adapter 구조를 일관화한다.

**Architecture:** `pages/*`는 router primitive를 읽고 feature route container에 props를 넘기는 thin adapter로 유지한다. Profile shell/list panel/display mapping은 feature-owned component/lib로 옮기고, payment/review/reservation detail flow는 기존 payment recovery와 checkout state contract를 유지하면서 feature route container로 이동한다. Search/Accommodation 대형 container split과 token/style 디자인 시스템 강화는 이 계획의 후속 작업으로 분리한다.

**Tech Stack:** React 19, TypeScript, React Router 7, TanStack Query 5, Jest, React Testing Library, CSS Modules, CRA/react-scripts, gstack browse smoke gate.

---

## Scope Check

이번 계획은 **Profile + Reservations route/workflow boundary**만 다룬다. 다음 영역은 의도적으로 제외한다.

- `src/features/search/SearchRoute.tsx` controller/layout split
- `src/features/accommodations/AccommodationDetailRoute.tsx` controller/screen/modal split
- `src/features/accommodations/edit/**` wizard shell split
- Airbnb visual token rollout, SearchBar/SearchRoute hardcoded color cleanup, new `StatusBadge`/`Tabs`/`IconToggleButton` primitives

이 범위 제한이 필요한 이유는 Profile/Reservations가 예약, 결제, 리뷰, 호스트 플로우를 함께 건드리기 때문에 여기만으로도 충분히 큰 behavioral surface를 가진다.

## Current Structure Summary

- `src/pages/Profile/Profile.tsx`가 URL parsing, duplicate `mode`/`activeTab` local state, tab alias mapping, sidebar rendering, filter translation을 직접 가진다.
- `src/pages/Profile/GuestTrips/GuestTrips.tsx`, `HostReservations.tsx`, `HostListings.tsx`는 hook wiring, infinite scroll observer, display formatting, navigation, modal reload workflow를 page layer에서 가진다.
- `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`는 route param, redirect, detail hook, date/night/price math, accommodation navigation을 직접 가진다.
- `src/pages/Reservations/PaymentSuccess.tsx`와 `PaymentFail.tsx`는 route parsing, checkout cleanup, replace navigation policy를 직접 가진다.
- `src/pages/Reservations/ReservationDetail.tsx`는 385 lines로 route-state toast, redirect, payment/bank/date display, review eligibility, virtual-account rendering, map URL, layout을 함께 가진다.
- `src/pages/Reservations/ReservationConfirm.tsx`는 checkout-state read, summary math, Toss handoff, payment error handling, full UI rendering을 직접 가진다.
- `src/pages/Reservations/ReviewCreate.tsx`는 review form state, image validation/object URL lifecycle, submit routing, upload-failure toast handoff를 직접 가진다.

## Target Structure

- `src/pages/Profile/Profile.tsx`: `useSearchParams()`만 읽고 `ProfileRoute`로 넘긴다.
- `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`: `useParams()`와 `useNavigate()`만 읽고 `HostReservationDetailRoute`로 넘긴다.
- `src/pages/Reservations/*.tsx`: router primitive adapter가 되고 page-local business/display logic을 갖지 않는다.
- `src/features/profile`: profile shell, tab mapping, host listings panel을 소유한다.
- `src/features/reservations`: guest trips panel, host reservations panel, host reservation detail route, payment route containers, reservation detail/confirm route containers를 소유한다.
- `src/features/reviews`: review create route and image selection lifecycle를 소유한다.
- `src/routes/route-boundary-contracts.test.ts`와 `src/api/ui-api-boundary-contracts.test.ts`가 page/layout/shared UI에서 feature internals를 직접 찌르는 회귀를 막는다.

## File Structure

Create:

- `src/features/profile/ProfileRoute.tsx` - profile route state orchestration and mode/tab panel selection.
- `src/features/profile/ProfileRoute.test.tsx` - profile URL state, mode switch, tab switch regression tests.
- `src/features/profile/components/ProfileShell.tsx` - profile header/sidebar shell with domain-free button rendering.
- `src/features/profile/components/ProfileShell.test.tsx` - shell mode/nav click tests.
- `src/features/profile/HostListingsPanel.tsx` - moved host listings workflow.
- `src/features/profile/HostListingsPanel.module.css` - moved host listings CSS.
- `src/features/profile/HostListingsPanel.test.tsx` - moved host listing behavior tests.
- `src/features/profile/lib/profileTabs.ts` - route tab to active tab/filter/status mapping.
- `src/features/profile/lib/profileTabs.test.ts` - exhaustive profile tab mapping tests.
- `src/features/reservations/GuestTripsPanel.tsx` - moved guest trips workflow.
- `src/features/reservations/GuestTripsPanel.module.css` - moved guest trips CSS.
- `src/features/reservations/GuestTripsPanel.test.tsx` - moved guest trips behavior tests.
- `src/features/reservations/HostReservationsPanel.tsx` - moved host reservations list/table workflow.
- `src/features/reservations/HostReservationsPanel.module.css` - moved host reservations CSS.
- `src/features/reservations/HostReservationsPanel.test.tsx` - moved host reservations behavior tests.
- `src/features/reservations/HostReservationDetailRoute.tsx` - host reservation detail route container.
- `src/features/reservations/HostReservationDetailRoute.module.css` - moved host reservation detail CSS.
- `src/features/reservations/HostReservationDetailRoute.test.tsx` - detail route rendering/navigation tests.
- `src/features/reservations/PaymentSuccessRoute.tsx` - payment success route container.
- `src/features/reservations/PaymentSuccessRoute.test.tsx` - payment success routing/cleanup tests.
- `src/features/reservations/PaymentFailRoute.tsx` - payment fail route container.
- `src/features/reservations/PaymentFailRoute.test.tsx` - fail route cleanup/navigation tests.
- `src/features/reservations/ReservationDetailRoute.tsx` - guest reservation detail route container.
- `src/features/reservations/ReservationDetailRoute.module.css` - moved reservation detail CSS.
- `src/features/reservations/ReservationDetailRoute.test.tsx` - detail display/navigation/toast tests.
- `src/features/reservations/ReservationConfirmRoute.tsx` - reservation confirm route container.
- `src/features/reservations/ReservationConfirmRoute.module.css` - moved reservation confirm CSS.
- `src/features/reservations/ReservationConfirmRoute.test.tsx` - checkout summary/payment handoff route tests.
- `src/features/reservations/lib/guestTripGroups.ts` - guest reservation grouping/date range helpers.
- `src/features/reservations/lib/guestTripGroups.test.ts` - grouping/date range tests.
- `src/features/reservations/lib/hostReservationSort.ts` - host reservation sort helper.
- `src/features/reservations/lib/hostReservationSort.test.ts` - sort helper tests.
- `src/features/reservations/lib/reservationDateDisplay.ts` - Korean date/date-time/range formatting helpers.
- `src/features/reservations/lib/reservationDateDisplay.test.ts` - display formatting tests.
- `src/features/reservations/lib/reservationDetailDisplay.ts` - reservation detail display and review eligibility helpers.
- `src/features/reservations/lib/reservationDetailDisplay.test.ts` - detail helper tests.
- `src/features/reservations/lib/reservationCheckoutSummary.ts` - confirm-page nights/guest/price/coupon summary helpers.
- `src/features/reservations/lib/reservationCheckoutSummary.test.ts` - checkout summary tests.
- `src/features/reviews/ReviewCreateRoute.tsx` - review create route container.
- `src/features/reviews/ReviewCreateRoute.test.tsx` - review routing/upload-failure tests.
- `src/features/reviews/hooks/useReviewImageSelection.ts` - selected image/object URL lifecycle.
- `src/features/reviews/hooks/useReviewImageSelection.test.ts` - image validation/revoke tests.

Move:

- `src/pages/Profile/GuestTrips/GuestTrips.tsx` -> `src/features/reservations/GuestTripsPanel.tsx`
- `src/pages/Profile/GuestTrips/GuestTrips.module.css` -> `src/features/reservations/GuestTripsPanel.module.css`
- `src/pages/Profile/GuestTrips/GuestTrips.test.tsx` -> `src/features/reservations/GuestTripsPanel.test.tsx`
- `src/pages/Profile/HostReservations/HostReservations.tsx` -> `src/features/reservations/HostReservationsPanel.tsx`
- `src/pages/Profile/HostReservations/HostReservations.module.css` -> `src/features/reservations/HostReservationsPanel.module.css`
- `src/pages/Profile/HostReservations/HostReservations.test.tsx` -> `src/features/reservations/HostReservationsPanel.test.tsx`
- `src/pages/Profile/HostListings/HostListings.tsx` -> `src/features/profile/HostListingsPanel.tsx`
- `src/pages/Profile/HostListings/HostListings.module.css` -> `src/features/profile/HostListingsPanel.module.css`
- `src/pages/Profile/HostListings/HostListings.test.tsx` -> `src/features/profile/HostListingsPanel.test.tsx`
- `src/pages/Profile/HostReservationDetail/HostReservationDetail.module.css` -> `src/features/reservations/HostReservationDetailRoute.module.css`
- `src/pages/Reservations/ReservationDetail.module.css` -> `src/features/reservations/ReservationDetailRoute.module.css`
- `src/pages/Reservations/ReservationConfirm.module.css` -> `src/features/reservations/ReservationConfirmRoute.module.css`

Modify:

- `src/pages/Profile/Profile.tsx`
- `src/pages/Profile/Profile.routeState.test.tsx`
- `src/pages/Profile/profile-responsive-contracts.test.ts`
- `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`
- `src/pages/Reservations/PaymentSuccess.tsx`
- `src/pages/Reservations/PaymentSuccess.test.tsx`
- `src/pages/Reservations/PaymentFail.tsx`
- `src/pages/Reservations/PaymentFail.test.tsx`
- `src/pages/Reservations/ReservationDetail.tsx`
- `src/pages/Reservations/ReservationDetail.test.tsx`
- `src/pages/Reservations/ReservationConfirm.tsx`
- `src/pages/Reservations/ReviewCreate.tsx`
- `src/pages/Reservations/ReviewCreate.test.tsx`
- `src/features/profile/index.ts`
- `src/features/profile/hooks/index.ts`
- `src/features/reservations/index.ts`
- `src/features/reservations/hooks/index.ts`
- `src/features/reviews/index.ts`
- `src/routes/route-boundary-contracts.test.ts`
- `src/api/ui-api-boundary-contracts.test.ts`
- `src/styles/tokens.test.ts`
- `docs/qa/frontend-architecture-smoke.ko.md`

---

### Task 1: Profile Tab Mapping Helpers

**Files:**
- Create: `src/features/profile/lib/profileTabs.ts`
- Create: `src/features/profile/lib/profileTabs.test.ts`
- Modify: `src/features/profile/lib/profileRouteState.ts`

- [ ] **Step 1: Write failing profile tab helper tests**

Create `src/features/profile/lib/profileTabs.test.ts`:

```ts
import {
  getActiveProfileTab,
  getGuestTripsFilterFromTab,
  getHostListingStatusFromTab,
  getHostReservationsFilterFromTab,
  getProfileTabForGuestTripsFilter,
  getProfileTabForHostListingStatus,
  getProfileTabForHostReservationsFilter,
  isHostListingTab,
  isHostReservationTab,
} from "./profileTabs";

describe("profile tab helpers", () => {
  it("maps route aliases to active UI tabs", () => {
    expect(getActiveProfileTab("trips")).toBe("upcoming");
    expect(getActiveProfileTab("listings")).toBe("listings-published");
    expect(getActiveProfileTab("reservations")).toBe("reservations-upcoming");
    expect(getActiveProfileTab("cancelled")).toBe("cancelled");
  });

  it("maps guest trip tabs to reservation filters", () => {
    expect(getGuestTripsFilterFromTab("trips")).toBe("UPCOMING");
    expect(getGuestTripsFilterFromTab("upcoming")).toBe("UPCOMING");
    expect(getGuestTripsFilterFromTab("past")).toBe("PAST");
    expect(getGuestTripsFilterFromTab("cancelled")).toBe("CANCELLED");
    expect(getProfileTabForGuestTripsFilter("PAST")).toBe("past");
  });

  it("maps host listing tabs to listing status filters", () => {
    expect(isHostListingTab("listings")).toBe(true);
    expect(isHostListingTab("reservations")).toBe(false);
    expect(getHostListingStatusFromTab("listings")).toBe("PUBLISHED");
    expect(getHostListingStatusFromTab("listings-draft")).toBe("DRAFT");
    expect(getHostListingStatusFromTab("listings-unpublished")).toBe("UNPUBLISHED");
    expect(getProfileTabForHostListingStatus("UNPUBLISHED")).toBe("listings-unpublished");
  });

  it("maps host reservation tabs to reservation filters", () => {
    expect(isHostReservationTab("reservations")).toBe(true);
    expect(isHostReservationTab("listings")).toBe(false);
    expect(getHostReservationsFilterFromTab("reservations")).toBe("UPCOMING");
    expect(getHostReservationsFilterFromTab("reservations-past")).toBe("PAST");
    expect(getHostReservationsFilterFromTab("reservations-cancelled")).toBe("CANCELLED");
    expect(getProfileTabForHostReservationsFilter("CANCELLED")).toBe("reservations-cancelled");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/profile/lib/profileTabs.test.ts --runInBand
```

Expected: FAIL because `profileTabs.ts` does not exist.

- [ ] **Step 3: Add profile tab helpers**

Create `src/features/profile/lib/profileTabs.ts`:

```ts
import type { ProfileRouteTab } from "./profileRouteState";
import type { ReservationFilterType } from "../../../types/reservation";

export type ProfileActiveTab =
  | "upcoming"
  | "past"
  | "cancelled"
  | "listings-published"
  | "listings-draft"
  | "listings-unpublished"
  | "reservations-upcoming"
  | "reservations-past"
  | "reservations-cancelled";

export type HostListingStatusType = "PUBLISHED" | "DRAFT" | "UNPUBLISHED";

export const getActiveProfileTab = (tab: ProfileRouteTab): ProfileActiveTab => {
  if (tab === "trips") return "upcoming";
  if (tab === "listings") return "listings-published";
  if (tab === "reservations") return "reservations-upcoming";
  return tab;
};

export const getGuestTripsFilterFromTab = (
  tab: ProfileRouteTab
): ReservationFilterType => {
  if (tab === "past") return "PAST";
  if (tab === "cancelled") return "CANCELLED";
  return "UPCOMING";
};

export const getProfileTabForGuestTripsFilter = (
  filter: ReservationFilterType
): ProfileRouteTab => {
  if (filter === "PAST") return "past";
  if (filter === "CANCELLED") return "cancelled";
  return "upcoming";
};

export const isHostListingTab = (tab: ProfileRouteTab) =>
  tab === "listings" ||
  tab === "listings-published" ||
  tab === "listings-draft" ||
  tab === "listings-unpublished";

export const getHostListingStatusFromTab = (
  tab: ProfileRouteTab
): HostListingStatusType => {
  if (tab === "listings-draft") return "DRAFT";
  if (tab === "listings-unpublished") return "UNPUBLISHED";
  return "PUBLISHED";
};

export const getProfileTabForHostListingStatus = (
  status: HostListingStatusType
): ProfileRouteTab => {
  if (status === "DRAFT") return "listings-draft";
  if (status === "UNPUBLISHED") return "listings-unpublished";
  return "listings-published";
};

export const isHostReservationTab = (tab: ProfileRouteTab) =>
  tab === "reservations" ||
  tab === "reservations-upcoming" ||
  tab === "reservations-past" ||
  tab === "reservations-cancelled";

export const getHostReservationsFilterFromTab = (
  tab: ProfileRouteTab
): ReservationFilterType => {
  if (tab === "reservations-past") return "PAST";
  if (tab === "reservations-cancelled") return "CANCELLED";
  return "UPCOMING";
};

export const getProfileTabForHostReservationsFilter = (
  filter: ReservationFilterType
): ProfileRouteTab => {
  if (filter === "PAST") return "reservations-past";
  if (filter === "CANCELLED") return "reservations-cancelled";
  return "reservations-upcoming";
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/profile/lib/profileTabs.test.ts src/features/profile/lib/profileRouteState.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/lib/profileTabs.ts src/features/profile/lib/profileTabs.test.ts src/features/profile/lib/profileRouteState.test.ts
git commit -m "refactor: centralize profile tab mapping"
```

---

### Task 2: Reservation Display Helper Extraction

**Files:**
- Create: `src/features/reservations/lib/guestTripGroups.ts`
- Create: `src/features/reservations/lib/guestTripGroups.test.ts`
- Create: `src/features/reservations/lib/reservationDateDisplay.ts`
- Create: `src/features/reservations/lib/reservationDateDisplay.test.ts`
- Create: `src/features/reservations/lib/hostReservationSort.ts`
- Create: `src/features/reservations/lib/hostReservationSort.test.ts`

- [ ] **Step 1: Write date/grouping helper tests**

Create `src/features/reservations/lib/guestTripGroups.test.ts`:

```ts
import type { MyReservationInfo } from "../../../types/reservation";
import { formatGuestTripDateRange, groupGuestTripsByYear } from "./guestTripGroups";

const makeTrip = (
  reservationId: number,
  checkInDate: string,
  checkOutDate: string
): MyReservationInfo =>
  ({
    reservation_id: reservationId,
    reservation_uid: `guest-${reservationId}`,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    accommodation: {
      id: reservationId,
      name: `숙소 ${reservationId}`,
      thumbnail_url: null,
    },
  }) as MyReservationInfo;

describe("guest trip display helpers", () => {
  it("groups trips by descending check-in year", () => {
    const groups = groupGuestTripsByYear([
      makeTrip(1, "2025-01-10", "2025-01-12"),
      makeTrip(2, "2026-03-10", "2026-03-12"),
      makeTrip(3, "2025-04-10", "2025-04-12"),
    ]);

    expect(groups.map((group) => group.year)).toEqual([2026, 2025]);
    expect(groups[1].reservations.map((trip) => trip.reservation_uid)).toEqual([
      "guest-1",
      "guest-3",
    ]);
  });

  it("formats same-month, same-year, and cross-year date ranges", () => {
    expect(formatGuestTripDateRange("2026-07-10", "2026-07-12")).toBe(
      "2026년 7월 10일 ~ 12일"
    );
    expect(formatGuestTripDateRange("2026-07-30", "2026-08-02")).toBe(
      "2026년 7월 30일 ~ 8월 2일"
    );
    expect(formatGuestTripDateRange("2026-12-31", "2027-01-02")).toBe(
      "2026년 12월 31일 ~ 2027년 1월 2일"
    );
  });
});
```

Create `src/features/reservations/lib/reservationDateDisplay.test.ts`:

```ts
import { formatKoreanDate, formatKoreanDateTime, formatNullablePrice } from "./reservationDateDisplay";

describe("reservation date display", () => {
  it("formats Korean date and date-time labels", () => {
    expect(formatKoreanDate("2026-07-10")).toBe("2026년 7월 10일");
    expect(formatKoreanDateTime("2026-07-10T15:30:00")).toContain("2026년 7월 10일");
  });

  it("formats nullable payment amounts", () => {
    expect(formatNullablePrice(null)).toBe("-");
    expect(formatNullablePrice(120000)).toBe("₩120,000");
  });
});
```

Create `src/features/reservations/lib/hostReservationSort.test.ts`:

```ts
import type { HostReservationInfo } from "../../../types/reservation";
import { sortHostReservations } from "./hostReservationSort";

const makeReservation = (
  reservationUid: string,
  checkInDate: string,
  checkOutDate: string,
  createdAt: string
): HostReservationInfo =>
  ({
    reservation_uid: reservationUid,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    created_at: createdAt,
  }) as HostReservationInfo;

describe("host reservation sort", () => {
  const reservations = [
    makeReservation("first", "2026-07-10", "2026-07-12", "2026-01-01T00:00:00"),
    makeReservation("second", "2026-07-08", "2026-07-11", "2026-01-03T00:00:00"),
  ];

  it("sorts by a date column descending by default", () => {
    expect(sortHostReservations(reservations, "check_in", "desc").map((item) => item.reservation_uid)).toEqual([
      "first",
      "second",
    ]);
  });

  it("sorts by created_at ascending", () => {
    expect(sortHostReservations(reservations, "created_at", "asc").map((item) => item.reservation_uid)).toEqual([
      "first",
      "second",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/guestTripGroups.test.ts src/features/reservations/lib/reservationDateDisplay.test.ts src/features/reservations/lib/hostReservationSort.test.ts --runInBand
```

Expected: FAIL because helper files do not exist.

- [ ] **Step 3: Add helper implementations**

Create `src/features/reservations/lib/guestTripGroups.ts`:

```ts
import type { MyReservationInfo } from "../../../types/reservation";

export interface GuestTripsYearGroup {
  year: number;
  reservations: MyReservationInfo[];
}

export const groupGuestTripsByYear = (
  reservations: MyReservationInfo[]
): GuestTripsYearGroup[] => {
  const grouped = reservations.reduce<Record<number, MyReservationInfo[]>>(
    (groups, reservation) => {
      const year = new Date(reservation.check_in_date).getFullYear();
      return {
        ...groups,
        [year]: [...(groups[year] ?? []), reservation],
      };
    },
    {}
  );

  return Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a)
    .map((year) => ({ year, reservations: grouped[year] }));
};

export const formatGuestTripDateRange = (
  checkIn: string,
  checkOut: string
): string => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const checkInYear = checkInDate.getFullYear();
  const checkOutYear = checkOutDate.getFullYear();
  const checkInMonth = checkInDate.getMonth() + 1;
  const checkOutMonth = checkOutDate.getMonth() + 1;
  const checkInDay = checkInDate.getDate();
  const checkOutDay = checkOutDate.getDate();

  if (checkInYear === checkOutYear && checkInMonth === checkOutMonth) {
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutDay}일`;
  }

  if (checkInYear === checkOutYear) {
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutMonth}월 ${checkOutDay}일`;
  }

  return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutYear}년 ${checkOutMonth}월 ${checkOutDay}일`;
};
```

Create `src/features/reservations/lib/reservationDateDisplay.ts`:

```ts
export const formatKoreanDate = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export const formatKoreanDateTime = (dateString: string): string =>
  new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatNullablePrice = (price: number | null | undefined): string =>
  price == null ? "-" : `₩${price.toLocaleString()}`;
```

Create `src/features/reservations/lib/hostReservationSort.ts`:

```ts
import type { HostReservationInfo } from "../../../types/reservation";

export type HostReservationSortColumn = "check_in" | "check_out" | "created_at";
export type HostReservationSortOrder = "asc" | "desc";

const getSortValue = (
  reservation: HostReservationInfo,
  column: HostReservationSortColumn
) => {
  if (column === "check_in") return reservation.check_in_date;
  if (column === "check_out") return reservation.check_out_date;
  return reservation.created_at;
};

export const sortHostReservations = (
  reservations: HostReservationInfo[],
  column: HostReservationSortColumn,
  order: HostReservationSortOrder
) =>
  [...reservations].sort((a, b) => {
    const comparison = getSortValue(a, column).localeCompare(getSortValue(b, column));
    return order === "asc" ? comparison : -comparison;
  });

export const getNextHostReservationSort = (
  currentColumn: HostReservationSortColumn,
  currentOrder: HostReservationSortOrder,
  nextColumn: HostReservationSortColumn
) => {
  if (currentColumn !== nextColumn) {
    return { column: nextColumn, order: "desc" as const };
  }

  return {
    column: nextColumn,
    order: currentOrder === "asc" ? ("desc" as const) : ("asc" as const),
  };
};
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/guestTripGroups.test.ts src/features/reservations/lib/reservationDateDisplay.test.ts src/features/reservations/lib/hostReservationSort.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/reservations/lib/guestTripGroups.ts src/features/reservations/lib/guestTripGroups.test.ts src/features/reservations/lib/reservationDateDisplay.ts src/features/reservations/lib/reservationDateDisplay.test.ts src/features/reservations/lib/hostReservationSort.ts src/features/reservations/lib/hostReservationSort.test.ts
git commit -m "refactor: extract reservation display helpers"
```

---

### Task 3: Move Profile List Panels Into Feature Boundaries

**Files:**
- Move: `src/pages/Profile/GuestTrips/GuestTrips.tsx` -> `src/features/reservations/GuestTripsPanel.tsx`
- Move: `src/pages/Profile/GuestTrips/GuestTrips.module.css` -> `src/features/reservations/GuestTripsPanel.module.css`
- Move: `src/pages/Profile/GuestTrips/GuestTrips.test.tsx` -> `src/features/reservations/GuestTripsPanel.test.tsx`
- Move: `src/pages/Profile/HostReservations/HostReservations.tsx` -> `src/features/reservations/HostReservationsPanel.tsx`
- Move: `src/pages/Profile/HostReservations/HostReservations.module.css` -> `src/features/reservations/HostReservationsPanel.module.css`
- Move: `src/pages/Profile/HostReservations/HostReservations.test.tsx` -> `src/features/reservations/HostReservationsPanel.test.tsx`
- Move: `src/pages/Profile/HostListings/HostListings.tsx` -> `src/features/profile/HostListingsPanel.tsx`
- Move: `src/pages/Profile/HostListings/HostListings.module.css` -> `src/features/profile/HostListingsPanel.module.css`
- Move: `src/pages/Profile/HostListings/HostListings.test.tsx` -> `src/features/profile/HostListingsPanel.test.tsx`
- Modify: `src/features/reservations/index.ts`
- Modify: `src/features/profile/index.ts`
- Modify: `src/pages/Profile/Profile.tsx`

- [ ] **Step 1: Move files with git**

Run:

```bash
git mv src/pages/Profile/GuestTrips/GuestTrips.tsx src/features/reservations/GuestTripsPanel.tsx
git mv src/pages/Profile/GuestTrips/GuestTrips.module.css src/features/reservations/GuestTripsPanel.module.css
git mv src/pages/Profile/GuestTrips/GuestTrips.test.tsx src/features/reservations/GuestTripsPanel.test.tsx
git mv src/pages/Profile/HostReservations/HostReservations.tsx src/features/reservations/HostReservationsPanel.tsx
git mv src/pages/Profile/HostReservations/HostReservations.module.css src/features/reservations/HostReservationsPanel.module.css
git mv src/pages/Profile/HostReservations/HostReservations.test.tsx src/features/reservations/HostReservationsPanel.test.tsx
git mv src/pages/Profile/HostListings/HostListings.tsx src/features/profile/HostListingsPanel.tsx
git mv src/pages/Profile/HostListings/HostListings.module.css src/features/profile/HostListingsPanel.module.css
git mv src/pages/Profile/HostListings/HostListings.test.tsx src/features/profile/HostListingsPanel.test.tsx
rmdir src/pages/Profile/GuestTrips src/pages/Profile/HostReservations src/pages/Profile/HostListings
```

Expected: files move without content changes.

- [ ] **Step 2: Update panel names and imports**

In `src/features/reservations/GuestTripsPanel.tsx`:

```ts
import React from "react";
import { useNavigate } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { routeTo } from "../../routes/paths";
import { EmptyState, LoadingState } from "../../shared/ui";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
import { getImageUrl } from "../../utils/image";
import { useGuestTrips } from "./hooks";
import {
  formatGuestTripDateRange,
  groupGuestTripsByYear,
} from "./lib/guestTripGroups";
import styles from "./GuestTripsPanel.module.css";
```

Rename the component and export:

```ts
export interface GuestTripsPanelProps {
  filterType: "UPCOMING" | "PAST" | "CANCELLED";
}

export const GuestTripsPanel: React.FC<GuestTripsPanelProps> = ({ filterType }) => {
  // Move the existing JSX body here, then replace local IntersectionObserver,
  // groupReservationsByYear, and formatDateRange with helpers.
};
```

Use the shared observer hook in the component:

```ts
const observerTarget = useIntersectionLoadMore({
  hasNext,
  isLoadingMore,
  loadMore,
});
```

In `src/features/reservations/HostReservationsPanel.tsx`, use:

```ts
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { routeTo } from "../../routes/paths";
import { EmptyState, LoadingState } from "../../shared/ui";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
import { useHostReservations } from "./hooks";
import {
  formatReservationStatus,
  getReservationStatusTone,
} from "./lib/reservationStatusDisplay";
import { formatKoreanDate, formatNullablePrice } from "./lib/reservationDateDisplay";
import {
  getNextHostReservationSort,
  HostReservationSortColumn,
  HostReservationSortOrder,
  sortHostReservations,
} from "./lib/hostReservationSort";
import styles from "./HostReservationsPanel.module.css";
```

In `src/features/profile/HostListingsPanel.tsx`, use:

```ts
import React from "react";
import { AccommodationActionModal } from "../accommodations/components/AccommodationActionModal";
import { useHostListings } from "./hooks";
import styles from "./HostListingsPanel.module.css";
```

If the moved tests import old relative paths, update them to the new feature-relative paths and renamed component names.

- [ ] **Step 3: Export route-facing panels**

In `src/features/reservations/index.ts`, export:

```ts
export { GuestTripsPanel } from "./GuestTripsPanel";
export type { GuestTripsPanelProps } from "./GuestTripsPanel";
export { HostReservationsPanel } from "./HostReservationsPanel";
export type { HostReservationsPanelProps } from "./HostReservationsPanel";
```

In `src/features/profile/index.ts`, export:

```ts
export { HostListingsPanel } from "./HostListingsPanel";
export type { HostListingsPanelProps } from "./HostListingsPanel";
```

Keep existing exports temporarily until `ProfileRoute` replaces direct page imports in Task 4. Remove hook exports only after no page imports need them.

- [ ] **Step 4: Update current Profile page imports**

In `src/pages/Profile/Profile.tsx`, replace old panel imports:

```ts
import { HostListingsPanel } from "../../features/profile";
import { GuestTripsPanel, HostReservationsPanel } from "../../features/reservations";
```

Replace JSX component names:

```tsx
<GuestTripsPanel filterType={...} />
<HostListingsPanel statusType={...} onStatusChange={...} />
<HostReservationsPanel filterType={...} onFilterChange={...} />
```

- [ ] **Step 5: Run moved panel tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/GuestTripsPanel.test.tsx src/features/reservations/HostReservationsPanel.test.tsx src/features/profile/HostListingsPanel.test.tsx src/features/reservations/lib/guestTripGroups.test.ts src/features/reservations/lib/reservationDateDisplay.test.ts src/features/reservations/lib/hostReservationSort.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Profile/Profile.tsx src/features/reservations/GuestTripsPanel.tsx src/features/reservations/GuestTripsPanel.module.css src/features/reservations/GuestTripsPanel.test.tsx src/features/reservations/HostReservationsPanel.tsx src/features/reservations/HostReservationsPanel.module.css src/features/reservations/HostReservationsPanel.test.tsx src/features/profile/HostListingsPanel.tsx src/features/profile/HostListingsPanel.module.css src/features/profile/HostListingsPanel.test.tsx src/features/reservations/index.ts src/features/profile/index.ts
git commit -m "refactor: move profile panels into feature boundaries"
```

---

### Task 4: ProfileRoute And Thin Profile Page

**Files:**
- Create: `src/features/profile/components/ProfileShell.tsx`
- Create: `src/features/profile/components/ProfileShell.test.tsx`
- Create: `src/features/profile/ProfileRoute.tsx`
- Create: `src/features/profile/ProfileRoute.test.tsx`
- Modify: `src/pages/Profile/Profile.tsx`
- Modify: `src/pages/Profile/Profile.routeState.test.tsx`
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Modify: `src/api/ui-api-boundary-contracts.test.ts`

- [ ] **Step 1: Write failing page adapter and boundary tests**

Append to `src/routes/route-boundary-contracts.test.ts`:

```ts
it("keeps Profile page as a thin adapter to the profile feature route", () => {
  const pageSource = readFileSync(
    join(process.cwd(), "src/pages/Profile/Profile.tsx"),
    "utf8"
  );

  expect(pageSource).toContain("../../features/profile");
  expect(pageSource).toContain("ProfileRoute");
  expect(pageSource).not.toMatch(/\.\/GuestTrips|\.\/HostListings|\.\/HostReservations/);
  expect(pageSource).not.toContain("getActiveTabFromRouteTab");
  expect(pageSource).not.toContain("useState");
});
```

Create `src/features/profile/ProfileRoute.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileRoute } from "./ProfileRoute";

const mockSetSearchParams = jest.fn();
const mockBuildProfileRouteSearchParams = jest.fn((state) => {
  const params = new URLSearchParams();
  params.set("builtMode", state.mode);
  params.set("builtTab", state.tab);
  return params;
});

jest.mock("./lib/profileRouteState", () => {
  const actual = jest.requireActual("./lib/profileRouteState");
  return {
    ...actual,
    buildProfileRouteSearchParams: (state: unknown) =>
      mockBuildProfileRouteSearchParams(state),
  };
});

jest.mock("../reservations", () => ({
  GuestTripsPanel: () => <div data-testid="guest-trips" />,
  HostReservationsPanel: () => <div data-testid="host-reservations" />,
}));

jest.mock("./HostListingsPanel", () => ({
  HostListingsPanel: ({ onStatusChange }: { onStatusChange: (status: "DRAFT") => void }) => (
    <button type="button" onClick={() => onStatusChange("DRAFT")}>
      draft listings
    </button>
  ),
}));

describe("ProfileRoute", () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockBuildProfileRouteSearchParams.mockClear();
  });

  it("uses route-state builder when switching to host mode", async () => {
    render(
      <ProfileRoute
        searchParams={new URLSearchParams("")}
        setSearchParams={mockSetSearchParams}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "호스트" }));

    expect(mockBuildProfileRouteSearchParams).toHaveBeenCalledWith({
      mode: "host",
      tab: "listings",
    });
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      new URLSearchParams("builtMode=host&builtTab=listings"),
      { replace: true }
    );
  });

  it("maps host listing status changes back into route state", async () => {
    render(
      <ProfileRoute
        searchParams={new URLSearchParams("mode=host&tab=listings")}
        setSearchParams={mockSetSearchParams}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "draft listings" }));

    expect(mockBuildProfileRouteSearchParams).toHaveBeenCalledWith({
      mode: "host",
      tab: "listings-draft",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts src/features/profile/ProfileRoute.test.tsx --runInBand
```

Expected: FAIL because `ProfileRoute` does not exist and `Profile.tsx` is not a thin adapter.

- [ ] **Step 3: Add ProfileShell**

Create `src/features/profile/components/ProfileShell.tsx`:

```tsx
import React from "react";
import type { ProfileRouteMode } from "../lib/profileRouteState";
import type { ProfileActiveTab } from "../lib/profileTabs";
import styles from "../../../pages/Profile/Profile.module.css";

interface ProfileShellProps {
  mode: ProfileRouteMode;
  activeTab: ProfileActiveTab;
  onModeChange: (mode: ProfileRouteMode) => void;
  onGuestTabChange: (tab: "upcoming" | "past" | "cancelled") => void;
  onHostListingsClick: () => void;
  onHostReservationsClick: () => void;
  children: React.ReactNode;
}

export const ProfileShell: React.FC<ProfileShellProps> = ({
  activeTab,
  children,
  mode,
  onGuestTabChange,
  onHostListingsClick,
  onHostReservationsClick,
  onModeChange,
}) => (
  <div className={styles.container}>
    <div className={styles.header}>
      <h1 className={styles.title}>프로필</h1>
      <div className={styles.modeToggle}>
        <button
          type="button"
          className={`${styles.toggleButton} ${mode === "guest" ? styles.active : ""}`}
          onClick={() => onModeChange("guest")}
        >
          게스트
        </button>
        <button
          type="button"
          className={`${styles.toggleButton} ${mode === "host" ? styles.active : ""}`}
          onClick={() => onModeChange("host")}
        >
          호스트
        </button>
      </div>
    </div>
    <div className={styles.content}>
      <div className={styles.sidebar}>
        {mode === "guest" ? (
          <nav className={styles.nav} aria-label="게스트 프로필">
            {[
              ["upcoming", "다가올 여행"],
              ["past", "이전 여행"],
              ["cancelled", "취소된 여행"],
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={`${styles.navItem} ${activeTab === tab ? styles.active : ""}`}
                onClick={() => onGuestTabChange(tab as "upcoming" | "past" | "cancelled")}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : (
          <nav className={styles.nav} aria-label="호스트 프로필">
            <button
              type="button"
              className={`${styles.navItem} ${
                activeTab.startsWith("listings") ? styles.active : ""
              }`}
              onClick={onHostListingsClick}
            >
              숙소 관리
            </button>
            <button
              type="button"
              className={`${styles.navItem} ${
                activeTab.startsWith("reservations") ? styles.active : ""
              }`}
              onClick={onHostReservationsClick}
            >
              예약 관리
            </button>
          </nav>
        )}
      </div>
      <div className={styles.main}>{children}</div>
    </div>
  </div>
);
```

This intentionally imports the existing profile CSS for this task. CSS ownership moves only if `Profile.module.css` is split in a later design-system plan.

- [ ] **Step 4: Add ProfileRoute**

Create `src/features/profile/ProfileRoute.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { GuestTripsPanel, HostReservationsPanel } from "../reservations";
import { HostListingsPanel } from "./HostListingsPanel";
import { ProfileShell } from "./components/ProfileShell";
import {
  buildProfileRouteSearchParams,
  parseProfileRouteState,
  ProfileRouteMode,
  ProfileRouteState,
} from "./lib/profileRouteState";
import {
  getActiveProfileTab,
  getGuestTripsFilterFromTab,
  getHostListingStatusFromTab,
  getHostReservationsFilterFromTab,
  getProfileTabForGuestTripsFilter,
  getProfileTabForHostListingStatus,
  getProfileTabForHostReservationsFilter,
  isHostListingTab,
} from "./lib/profileTabs";

interface ProfileRouteProps {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

export const ProfileRoute: React.FC<ProfileRouteProps> = ({
  searchParams,
  setSearchParams,
}) => {
  const initialRouteState = parseProfileRouteState(searchParams);
  const [routeState, setRouteState] = useState<ProfileRouteState>(initialRouteState);

  useEffect(() => {
    setRouteState(parseProfileRouteState(searchParams));
  }, [searchParams]);

  const setProfileRouteState = (state: ProfileRouteState) => {
    setRouteState(state);
    setSearchParams(buildProfileRouteSearchParams(state), { replace: true });
  };

  const activeTab = getActiveProfileTab(routeState.tab);

  const setMode = (mode: ProfileRouteMode) => {
    setProfileRouteState({
      mode,
      tab: mode === "host" ? "listings" : "upcoming",
    });
  };

  return (
    <ProfileShell
      mode={routeState.mode}
      activeTab={activeTab}
      onModeChange={setMode}
      onGuestTabChange={(tab) => setProfileRouteState({ mode: "guest", tab })}
      onHostListingsClick={() =>
        setProfileRouteState({ mode: "host", tab: "listings-published" })
      }
      onHostReservationsClick={() =>
        setProfileRouteState({ mode: "host", tab: "reservations-upcoming" })
      }
    >
      {routeState.mode === "guest" ? (
        <GuestTripsPanel filterType={getGuestTripsFilterFromTab(routeState.tab)} />
      ) : isHostListingTab(routeState.tab) ? (
        <HostListingsPanel
          statusType={getHostListingStatusFromTab(routeState.tab)}
          onStatusChange={(status) =>
            setProfileRouteState({
              mode: "host",
              tab: getProfileTabForHostListingStatus(status),
            })
          }
        />
      ) : (
        <HostReservationsPanel
          filterType={getHostReservationsFilterFromTab(routeState.tab)}
          onFilterChange={(filter) =>
            setProfileRouteState({
              mode: "host",
              tab: getProfileTabForHostReservationsFilter(filter),
            })
          }
        />
      )}
    </ProfileShell>
  );
};
```

- [ ] **Step 5: Thin Profile page and export ProfileRoute**

Replace `src/pages/Profile/Profile.tsx` with:

```tsx
import React from "react";
import { useSearchParams } from "react-router-dom";
import { ProfileRoute } from "../../features/profile";

const Profile: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <ProfileRoute
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
};

export default Profile;
```

Update `src/features/profile/index.ts`:

```ts
export { ProfileRoute } from "./ProfileRoute";
export { HostListingsPanel } from "./HostListingsPanel";
export type { HostListingsPanelProps } from "./HostListingsPanel";
```

- [ ] **Step 6: Run profile route tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/profile/ProfileRoute.test.tsx src/pages/Profile/Profile.routeState.test.tsx src/routes/route-boundary-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/profile/ProfileRoute.tsx src/features/profile/ProfileRoute.test.tsx src/features/profile/components/ProfileShell.tsx src/features/profile/components/ProfileShell.test.tsx src/features/profile/index.ts src/pages/Profile/Profile.tsx src/pages/Profile/Profile.routeState.test.tsx src/routes/route-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts
git commit -m "refactor: route profile through feature container"
```

---

### Task 5: Host Reservation Detail Feature Route

**Files:**
- Create: `src/features/reservations/HostReservationDetailRoute.tsx`
- Create: `src/features/reservations/HostReservationDetailRoute.test.tsx`
- Move: `src/pages/Profile/HostReservationDetail/HostReservationDetail.module.css` -> `src/features/reservations/HostReservationDetailRoute.module.css`
- Modify: `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx`
- Modify: `src/features/reservations/index.ts`
- Modify: `src/styles/tokens.test.ts`

- [ ] **Step 1: Write failing thin-adapter contract**

Append to `src/routes/route-boundary-contracts.test.ts`:

```ts
it("keeps HostReservationDetail page as an adapter to the reservations feature route", () => {
  const pageSource = readFileSync(
    join(process.cwd(), "src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx"),
    "utf8"
  );

  expect(pageSource).toContain("../../../features/reservations");
  expect(pageSource).toContain("HostReservationDetailRoute");
  expect(pageSource).not.toContain("useHostReservationDetail");
  expect(pageSource).not.toContain("formatReservationStatus");
});
```

- [ ] **Step 2: Move CSS and add route container**

Run:

```bash
git mv src/pages/Profile/HostReservationDetail/HostReservationDetail.module.css src/features/reservations/HostReservationDetailRoute.module.css
```

Create `src/features/reservations/HostReservationDetailRoute.tsx` by moving the current rendering body from `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx` and changing only the route inputs:

```tsx
import React, { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { routeTo } from "../../routes/paths";
import { getImageUrl } from "../../utils/image";
import { calculateNights } from "../../utils/date";
import { LoadingState } from "../../shared/ui";
import { useHostReservationDetail } from "./hooks";
import { formatReservationStatus } from "./lib/reservationStatusDisplay";
import { formatKoreanDate, formatNullablePrice } from "./lib/reservationDateDisplay";
import styles from "./HostReservationDetailRoute.module.css";

interface HostReservationDetailRouteProps {
  navigate: NavigateFunction;
  reservationUid?: string;
}

export const HostReservationDetailRoute: React.FC<HostReservationDetailRouteProps> = ({
  navigate,
  reservationUid,
}) => {
  const { error, clearError, isLoading, reservation } =
    useHostReservationDetail(reservationUid);

  useEffect(() => {
    if (!reservationUid) {
      navigate(routeTo.profile(), { replace: true });
    }
  }, [reservationUid, navigate]);

  // Move the page's loading, error, empty, and detail rendering branches here.
  // Replace local date/price helpers with formatKoreanDate and formatNullablePrice.
};
```

The rendering move in this task is mechanical: transfer the page's existing JSX into this component, replace only the helper calls named above, and keep labels, class names, navigation targets, and loading/error branches unchanged.

- [ ] **Step 3: Thin page adapter**

Replace `src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx` with:

```tsx
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HostReservationDetailRoute } from "../../../features/reservations";

const HostReservationDetail: React.FC = () => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <HostReservationDetailRoute
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
};

export default HostReservationDetail;
```

Update `src/features/reservations/index.ts`:

```ts
export { HostReservationDetailRoute } from "./HostReservationDetailRoute";
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts src/features/reservations/HostReservationDetailRoute.test.tsx src/features/reservations/hooks/useHostReservationDetail.test.ts src/features/reservations/lib/reservationStatusDisplay.test.ts src/features/reservations/lib/reservationDateDisplay.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx src/features/reservations/HostReservationDetailRoute.tsx src/features/reservations/HostReservationDetailRoute.module.css src/features/reservations/HostReservationDetailRoute.test.tsx src/features/reservations/index.ts src/routes/route-boundary-contracts.test.ts src/styles/tokens.test.ts
git commit -m "refactor: move host reservation detail route into feature"
```

---

### Task 6: Payment Success/Fail Feature Routes

**Files:**
- Create: `src/features/reservations/PaymentSuccessRoute.tsx`
- Create: `src/features/reservations/PaymentSuccessRoute.test.tsx`
- Create: `src/features/reservations/PaymentFailRoute.tsx`
- Create: `src/features/reservations/PaymentFailRoute.test.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.test.tsx`
- Modify: `src/pages/Reservations/PaymentFail.tsx`
- Modify: `src/pages/Reservations/PaymentFail.test.tsx`
- Modify: `src/features/reservations/index.ts`
- Modify: `src/routes/route-boundary-contracts.test.ts`

- [ ] **Step 1: Add route adapter boundary tests**

Append to `src/routes/route-boundary-contracts.test.ts`:

```ts
it("keeps payment callback pages as adapters to reservation feature routes", () => {
  const successSource = readFileSync(
    join(process.cwd(), "src/pages/Reservations/PaymentSuccess.tsx"),
    "utf8"
  );
  const failSource = readFileSync(
    join(process.cwd(), "src/pages/Reservations/PaymentFail.tsx"),
    "utf8"
  );

  expect(successSource).toContain("../../features/reservations");
  expect(successSource).toContain("PaymentSuccessRoute");
  expect(successSource).not.toContain("usePaymentConfirmation");
  expect(failSource).toContain("../../features/reservations");
  expect(failSource).toContain("PaymentFailRoute");
  expect(failSource).not.toContain("clearReservationCheckoutStateByReservationUid");
});
```

- [ ] **Step 2: Create PaymentSuccessRoute**

Move the current `PaymentSuccess` logic into `src/features/reservations/PaymentSuccessRoute.tsx` with explicit router props:

```tsx
import React, { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { routeTo } from "../../routes/paths";
import { usePaymentConfirmation } from "./hooks/usePaymentConfirmation";
import { clearReservationCheckoutStateByReservationUid } from "./lib/reservationCheckoutState";
import { parseTossSuccessRouteState } from "./lib/paymentRouteState";
import styles from "../../pages/Reservations/PaymentSuccess.module.css";

interface PaymentSuccessRouteProps {
  navigate: NavigateFunction;
  reservationUid?: string;
  searchParams: URLSearchParams;
}

export const PaymentSuccessRoute: React.FC<PaymentSuccessRouteProps> = ({
  navigate,
  reservationUid,
  searchParams,
}) => {
  const routeState = parseTossSuccessRouteState(reservationUid, searchParams);
  const confirmationResult = usePaymentConfirmation({
    amount: routeState.status === "valid" ? routeState.amount : null,
    orderId: routeState.status === "valid" ? routeState.orderId : null,
    paymentKey: routeState.status === "valid" ? routeState.paymentKey : null,
  });

  useEffect(() => {
    if (!reservationUid) {
      navigate(routeTo.profile(), { replace: true });
      return;
    }

    if (routeState.status !== "valid") {
      clearReservationCheckoutStateByReservationUid(reservationUid);
      navigate(routeTo.paymentFail(reservationUid, { reason: "invalid-callback" }), {
        replace: true,
      });
      return;
    }

    if (confirmationResult.result.status === "confirmed") {
      clearReservationCheckoutStateByReservationUid(reservationUid);
      navigate(routeTo.reservationDetail(reservationUid), { replace: true });
      return;
    }

    if (confirmationResult.result.status === "failed") {
      if (!confirmationResult.result.retryable) {
        clearReservationCheckoutStateByReservationUid(reservationUid);
      }
      navigate(routeTo.paymentFail(reservationUid, { reason: "confirm-failed" }), {
        replace: true,
      });
    }
  }, [confirmationResult.result, navigate, reservationUid, routeState.status]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>결제 승인 중</h1>
        <p>예약 정보를 확인하고 있습니다.</p>
      </div>
    </div>
  );
};
```

If the existing page uses different visible Korean copy, keep the existing copy when moving the JSX. Preserve all tests around retryable confirm failure and invalid callback.

- [ ] **Step 3: Create PaymentFailRoute and thin adapters**

Create `src/features/reservations/PaymentFailRoute.tsx`:

```tsx
import React, { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { routeTo } from "../../routes/paths";
import type { PaymentFailReason } from "../../routes/paths";
import { clearReservationCheckoutStateByReservationUid } from "./lib/reservationCheckoutState";
import styles from "../../pages/Reservations/PaymentFail.module.css";

interface PaymentFailRouteProps {
  navigate: NavigateFunction;
  reservationUid?: string;
  reason?: PaymentFailReason;
}

export const PaymentFailRoute: React.FC<PaymentFailRouteProps> = ({
  navigate,
  reason,
  reservationUid,
}) => {
  useEffect(() => {
    if (!reservationUid || reason === "confirm-failed") return;
    clearReservationCheckoutStateByReservationUid(reservationUid);
  }, [reason, reservationUid]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>결제에 실패했습니다</h1>
        {reservationUid && (
          <button
            type="button"
            onClick={() => navigate(routeTo.reservationDetail(reservationUid))}
          >
            예약 상세로 이동
          </button>
        )}
      </div>
    </div>
  );
};
```

Replace `src/pages/Reservations/PaymentSuccess.tsx` with:

```tsx
import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PaymentSuccessRoute } from "../../features/reservations";

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();

  return (
    <PaymentSuccessRoute
      navigate={navigate}
      reservationUid={reservationUid}
      searchParams={searchParams}
    />
  );
};

export default PaymentSuccess;
```

Replace `src/pages/Reservations/PaymentFail.tsx` with:

```tsx
import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PaymentFailRoute } from "../../features/reservations";
import type { PaymentFailReason } from "../../routes/paths";

const PaymentFail: React.FC = () => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const [searchParams] = useSearchParams();

  return (
    <PaymentFailRoute
      navigate={navigate}
      reservationUid={reservationUid}
      reason={(searchParams.get("reason") || undefined) as PaymentFailReason | undefined}
    />
  );
};

export default PaymentFail;
```

Update `src/features/reservations/index.ts`:

```ts
export { PaymentSuccessRoute } from "./PaymentSuccessRoute";
export { PaymentFailRoute } from "./PaymentFailRoute";
```

- [ ] **Step 4: Run focused payment tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/pages/Reservations/PaymentSuccess.test.tsx src/pages/Reservations/PaymentFail.test.tsx src/features/reservations/PaymentSuccessRoute.test.tsx src/features/reservations/PaymentFailRoute.test.tsx src/features/reservations/hooks/usePaymentConfirmation.test.ts src/features/reservations/lib/paymentConfirmationAttemptRegistry.test.ts src/features/reservations/lib/paymentRouteState.test.ts src/features/reservations/lib/reservationCheckoutState.test.ts src/routes/route-boundary-contracts.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Reservations/PaymentSuccess.tsx src/pages/Reservations/PaymentSuccess.test.tsx src/pages/Reservations/PaymentFail.tsx src/pages/Reservations/PaymentFail.test.tsx src/features/reservations/PaymentSuccessRoute.tsx src/features/reservations/PaymentSuccessRoute.test.tsx src/features/reservations/PaymentFailRoute.tsx src/features/reservations/PaymentFailRoute.test.tsx src/features/reservations/index.ts src/routes/route-boundary-contracts.test.ts
git commit -m "refactor: move payment callback routes into reservations feature"
```

---

### Task 7: Reservation Detail Feature Route

**Files:**
- Create: `src/features/reservations/ReservationDetailRoute.tsx`
- Create: `src/features/reservations/ReservationDetailRoute.test.tsx`
- Create: `src/features/reservations/lib/reservationDetailDisplay.ts`
- Create: `src/features/reservations/lib/reservationDetailDisplay.test.ts`
- Move: `src/pages/Reservations/ReservationDetail.module.css` -> `src/features/reservations/ReservationDetailRoute.module.css`
- Modify: `src/pages/Reservations/ReservationDetail.tsx`
- Modify: `src/pages/Reservations/ReservationDetail.test.tsx`
- Modify: `src/features/reservations/index.ts`
- Modify: `src/styles/tokens.test.ts`

- [ ] **Step 1: Write detail display helper tests**

Create `src/features/reservations/lib/reservationDetailDisplay.test.ts`:

```ts
import { canCreateReview, formatBankName, formatPaymentStatus } from "./reservationDetailDisplay";

describe("reservation detail display", () => {
  it("maps bank codes and payment status labels", () => {
    expect(formatBankName("KB")).toBe("국민은행");
    expect(formatBankName("UNKNOWN")).toBe("UNKNOWN");
    expect(formatPaymentStatus("PAYMENT_COMPLETED")).toBe("결제 완료");
  });

  it("allows review creation only for completed reservations without a review", () => {
    expect(canCreateReview({ status: "COMPLETED", has_review: false })).toBe(true);
    expect(canCreateReview({ status: "COMPLETED", has_review: true })).toBe(false);
    expect(canCreateReview({ status: "CANCELLED", has_review: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run helper test to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/reservationDetailDisplay.test.ts --runInBand
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Add detail display helper**

Create `src/features/reservations/lib/reservationDetailDisplay.ts`:

```ts
import type { ReservationStatus } from "../../../types/reservation";

const BANK_NAMES: Record<string, string> = {
  KB: "국민은행",
  SHINHAN: "신한은행",
  WOORI: "우리은행",
  HANA: "하나은행",
  NH: "농협은행",
  IBK: "기업은행",
  KAKAO: "카카오뱅크",
  TOSS: "토스뱅크",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  READY: "결제 대기",
  PAYMENT_COMPLETED: "결제 완료",
  DONE: "결제 완료",
  CANCELED: "결제 취소",
  ABORTED: "결제 실패",
  EXPIRED: "결제 만료",
};

export const formatBankName = (bankCode?: string | null) => {
  if (!bankCode) return "-";
  return BANK_NAMES[bankCode] ?? bankCode;
};

export const formatPaymentStatus = (status?: string | null) => {
  if (!status) return "-";
  return PAYMENT_STATUS_LABELS[status] ?? status;
};

export const canCreateReview = ({
  has_review,
  status,
}: {
  has_review?: boolean | null;
  status: ReservationStatus;
}) => status === "COMPLETED" && !has_review;
```

- [ ] **Step 4: Move CSS and add ReservationDetailRoute**

Run:

```bash
git mv src/pages/Reservations/ReservationDetail.module.css src/features/reservations/ReservationDetailRoute.module.css
```

Create `src/features/reservations/ReservationDetailRoute.tsx` by moving the current `ReservationDetail` body into a route container with explicit props:

```tsx
import React, { useEffect } from "react";
import type { Location, NavigateFunction } from "react-router-dom";
import { routeTo } from "../../routes/paths";
import { ErrorToast } from "../../components/ErrorToast";
import { LoadingState } from "../../shared/ui";
import { getImageUrl } from "../../utils/image";
import { useReservationDetail } from "./hooks";
import {
  formatReservationStatus,
  getReservationStatusClassKey,
} from "./lib/reservationStatusDisplay";
import {
  canCreateReview,
  formatBankName,
  formatPaymentStatus,
} from "./lib/reservationDetailDisplay";
import { formatKoreanDate, formatKoreanDateTime, formatNullablePrice } from "./lib/reservationDateDisplay";
import styles from "./ReservationDetailRoute.module.css";

interface ReservationDetailRouteProps {
  locationState: unknown;
  navigate: NavigateFunction;
  reservationUid?: string;
}

export const ReservationDetailRoute: React.FC<ReservationDetailRouteProps> = ({
  locationState,
  navigate,
  reservationUid,
}) => {
  const { clearError, error, isLoading, reservation } = useReservationDetail(reservationUid);

  useEffect(() => {
    if (!reservationUid) {
      navigate(routeTo.profile(), { replace: true });
    }
  }, [reservationUid, navigate]);

  // Move the toast, loading, empty, and detail rendering branches from ReservationDetail.tsx.
  // Replace local display helpers with imported reservationDetailDisplay and reservationDateDisplay helpers.
};
```

- [ ] **Step 5: Thin ReservationDetail page**

Replace `src/pages/Reservations/ReservationDetail.tsx` with:

```tsx
import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ReservationDetailRoute } from "../../features/reservations";

const ReservationDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <ReservationDetailRoute
      locationState={location.state}
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
};

export default ReservationDetail;
```

Update `src/features/reservations/index.ts`:

```ts
export { ReservationDetailRoute } from "./ReservationDetailRoute";
```

- [ ] **Step 6: Run detail tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/pages/Reservations/ReservationDetail.test.tsx src/features/reservations/ReservationDetailRoute.test.tsx src/features/reservations/hooks/useReservationDetail.test.ts src/features/reservations/lib/reservationDetailDisplay.test.ts src/features/reservations/lib/reservationStatusDisplay.test.ts src/features/reservations/lib/reservationDateDisplay.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Reservations/ReservationDetail.tsx src/pages/Reservations/ReservationDetail.test.tsx src/features/reservations/ReservationDetailRoute.tsx src/features/reservations/ReservationDetailRoute.module.css src/features/reservations/ReservationDetailRoute.test.tsx src/features/reservations/lib/reservationDetailDisplay.ts src/features/reservations/lib/reservationDetailDisplay.test.ts src/features/reservations/index.ts src/styles/tokens.test.ts
git commit -m "refactor: move reservation detail route into feature"
```

---

### Task 8: Reservation Confirm Feature Route

**Files:**
- Create: `src/features/reservations/ReservationConfirmRoute.tsx`
- Create: `src/features/reservations/ReservationConfirmRoute.test.tsx`
- Create: `src/features/reservations/lib/reservationCheckoutSummary.ts`
- Create: `src/features/reservations/lib/reservationCheckoutSummary.test.ts`
- Move: `src/pages/Reservations/ReservationConfirm.module.css` -> `src/features/reservations/ReservationConfirmRoute.module.css`
- Modify: `src/pages/Reservations/ReservationConfirm.tsx`
- Modify: `src/features/reservations/index.ts`
- Modify: `src/styles/tokens.test.ts`

- [ ] **Step 1: Add checkout summary helper tests**

Create `src/features/reservations/lib/reservationCheckoutSummary.test.ts`:

```ts
import {
  calculateCheckoutNights,
  calculatePayableAmount,
  formatGuestSummary,
} from "./reservationCheckoutSummary";

describe("reservation checkout summary", () => {
  it("calculates nights from selected dates", () => {
    expect(calculateCheckoutNights("2026-07-10", "2026-07-12")).toBe(2);
  });

  it("formats guests without leaking empty categories", () => {
    expect(formatGuestSummary({ adultOccupancy: 2, childOccupancy: 1 })).toBe(
      "성인 2명, 어린이 1명"
    );
  });

  it("subtracts selected coupon discount without going below zero", () => {
    expect(calculatePayableAmount(120000, 30000)).toBe(90000);
    expect(calculatePayableAmount(120000, 150000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run helper test to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/lib/reservationCheckoutSummary.test.ts --runInBand
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Add checkout summary helper**

Create `src/features/reservations/lib/reservationCheckoutSummary.ts`:

```ts
export const calculateCheckoutNights = (checkIn: string, checkOut: string) => {
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
};

export const calculatePayableAmount = (
  totalAmount: number,
  couponDiscountAmount = 0
) => Math.max(0, totalAmount - couponDiscountAmount);

export const formatGuestSummary = ({
  adultOccupancy = 0,
  childOccupancy = 0,
  infantOccupancy = 0,
  petOccupancy = 0,
}: {
  adultOccupancy?: number;
  childOccupancy?: number;
  infantOccupancy?: number;
  petOccupancy?: number;
}) =>
  [
    adultOccupancy > 0 && `성인 ${adultOccupancy}명`,
    childOccupancy > 0 && `어린이 ${childOccupancy}명`,
    infantOccupancy > 0 && `유아 ${infantOccupancy}명`,
    petOccupancy > 0 && `반려동물 ${petOccupancy}마리`,
  ]
    .filter(Boolean)
    .join(", ");
```

- [ ] **Step 4: Move CSS and create route container**

Run:

```bash
git mv src/pages/Reservations/ReservationConfirm.module.css src/features/reservations/ReservationConfirmRoute.module.css
```

Create `src/features/reservations/ReservationConfirmRoute.tsx` by moving the existing `ReservationConfirm` body into a feature route container with explicit props:

```tsx
import React from "react";
import type { Location, NavigateFunction } from "react-router-dom";
import { routeTo } from "../../routes/paths";
import { readReservationCheckoutState } from "./lib/reservationCheckoutState";
import { useReservationConfirmAccommodation } from "./hooks/useReservationConfirmAccommodation";
import {
  calculateCheckoutNights,
  calculatePayableAmount,
  formatGuestSummary,
} from "./lib/reservationCheckoutSummary";
import styles from "./ReservationConfirmRoute.module.css";

interface ReservationConfirmRouteProps {
  accommodationId?: string;
  locationState: Location["state"];
  navigate: NavigateFunction;
}

export const ReservationConfirmRoute: React.FC<ReservationConfirmRouteProps> = ({
  accommodationId,
  locationState,
  navigate,
}) => {
  const checkoutState = readReservationCheckoutState(accommodationId, locationState);

  // Move ReservationConfirm rendering and Toss requestPayment behavior into this route.
  // Replace local summary math with reservationCheckoutSummary helpers.
};
```

Do not change Toss `successUrl`, `failUrl`, `orderId`, or checkout-state fallback behavior.

- [ ] **Step 5: Thin ReservationConfirm page**

Replace `src/pages/Reservations/ReservationConfirm.tsx` with:

```tsx
import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ReservationConfirmRoute } from "../../features/reservations";

const ReservationConfirm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <ReservationConfirmRoute
      accommodationId={id}
      locationState={location.state}
      navigate={navigate}
    />
  );
};

export default ReservationConfirm;
```

Update `src/features/reservations/index.ts`:

```ts
export { ReservationConfirmRoute } from "./ReservationConfirmRoute";
```

- [ ] **Step 6: Run confirm/payment focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reservations/ReservationConfirmRoute.test.tsx src/features/reservations/lib/reservationCheckoutSummary.test.ts src/features/reservations/hooks/useReservationConfirmAccommodation.test.ts src/features/reservations/lib/reservationCheckoutState.test.ts src/features/reservations/lib/tossPayments.test.ts src/features/accommodations/hooks/useAccommodationBooking.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Reservations/ReservationConfirm.tsx src/features/reservations/ReservationConfirmRoute.tsx src/features/reservations/ReservationConfirmRoute.module.css src/features/reservations/ReservationConfirmRoute.test.tsx src/features/reservations/lib/reservationCheckoutSummary.ts src/features/reservations/lib/reservationCheckoutSummary.test.ts src/features/reservations/index.ts src/styles/tokens.test.ts
git commit -m "refactor: move reservation confirm route into feature"
```

---

### Task 9: Review Create Feature Route

**Files:**
- Create: `src/features/reviews/ReviewCreateRoute.tsx`
- Create: `src/features/reviews/ReviewCreateRoute.test.tsx`
- Create: `src/features/reviews/hooks/useReviewImageSelection.ts`
- Create: `src/features/reviews/hooks/useReviewImageSelection.test.ts`
- Modify: `src/pages/Reservations/ReviewCreate.tsx`
- Modify: `src/pages/Reservations/ReviewCreate.test.tsx`
- Modify: `src/features/reviews/index.ts`
- Modify: `src/routes/route-boundary-contracts.test.ts`

- [ ] **Step 1: Add image selection hook tests**

Create `src/features/reviews/hooks/useReviewImageSelection.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { useReviewImageSelection } from "./useReviewImageSelection";

describe("useReviewImageSelection", () => {
  const file = new File(["image"], "review.png", { type: "image/png" });

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => "blob:review-image");
    URL.revokeObjectURL = jest.fn();
  });

  it("adds image files and revokes preview URLs when removed", () => {
    const { result, unmount } = renderHook(() => useReviewImageSelection());

    act(() => {
      result.current.addFiles([file]);
    });

    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0].previewUrl).toBe("blob:review-image");

    act(() => {
      result.current.removeImage(result.current.images[0].id);
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:review-image");

    unmount();
  });
});
```

- [ ] **Step 2: Run hook test to verify failure**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reviews/hooks/useReviewImageSelection.test.ts --runInBand
```

Expected: FAIL because hook does not exist.

- [ ] **Step 3: Add image selection hook**

Create `src/features/reviews/hooks/useReviewImageSelection.ts`:

```ts
import { useEffect, useState } from "react";

export interface ReviewImageItem {
  file: File;
  id: string;
  previewUrl: string;
}

let imageId = 0;

export const useReviewImageSelection = () => {
  const [images, setImages] = useState<ReviewImageItem[]>([]);

  const addFiles = (files: File[]) => {
    const nextItems = files.map((file) => ({
      file,
      id: `review-image-${imageId++}`,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((current) => [...current, ...nextItems]);
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  useEffect(
    () => () => {
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    },
    [images]
  );

  return { addFiles, images, removeImage, setImages };
};
```

- [ ] **Step 4: Create ReviewCreateRoute and thin page**

Create `src/features/reviews/ReviewCreateRoute.tsx` by moving existing `ReviewCreate` body and replacing local image state with `useReviewImageSelection`.

The route container must receive router inputs explicitly:

```tsx
import React from "react";
import type { NavigateFunction } from "react-router-dom";
import { routeTo } from "../../routes/paths";
import { useReviewCreate } from "./hooks";
import { useReviewImageSelection } from "./hooks/useReviewImageSelection";
import styles from "../../pages/Reservations/ReviewCreate.module.css";

interface ReviewCreateRouteProps {
  navigate: NavigateFunction;
  reservationUid?: string;
}

export const ReviewCreateRoute: React.FC<ReviewCreateRouteProps> = ({
  navigate,
  reservationUid,
}) => {
  const imageSelection = useReviewImageSelection();
  const reviewCreate = useReviewCreate(reservationUid);

  // Move the review form, validation, submit, success, and upload-failure routing behavior here.
};
```

Replace `src/pages/Reservations/ReviewCreate.tsx` with:

```tsx
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ReviewCreateRoute } from "../../features/reviews";

const ReviewCreate: React.FC = () => {
  const navigate = useNavigate();
  const { reservationUid } = useParams<{ reservationUid: string }>();

  return (
    <ReviewCreateRoute
      navigate={navigate}
      reservationUid={reservationUid}
    />
  );
};

export default ReviewCreate;
```

Update `src/features/reviews/index.ts`:

```ts
export { ReviewCreateRoute } from "./ReviewCreateRoute";
```

- [ ] **Step 5: Run review tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/pages/Reservations/ReviewCreate.test.tsx src/features/reviews/ReviewCreateRoute.test.tsx src/features/reviews/hooks/useReviewCreate.test.ts src/features/reviews/hooks/useReviewImageSelection.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Reservations/ReviewCreate.tsx src/pages/Reservations/ReviewCreate.test.tsx src/features/reviews/ReviewCreateRoute.tsx src/features/reviews/ReviewCreateRoute.test.tsx src/features/reviews/hooks/useReviewImageSelection.ts src/features/reviews/hooks/useReviewImageSelection.test.ts src/features/reviews/index.ts src/routes/route-boundary-contracts.test.ts
git commit -m "refactor: move review create route into feature"
```

---

### Task 10: Contract Tightening And Design-Ready Verification

**Files:**
- Modify: `src/routes/route-boundary-contracts.test.ts`
- Modify: `src/api/ui-api-boundary-contracts.test.ts`
- Modify: `src/styles/tokens.test.ts`
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`

- [ ] **Step 1: Tighten route and UI/API boundary contracts**

In `src/routes/route-boundary-contracts.test.ts`, ensure these page adapters are covered:

```ts
[
  "src/pages/Profile/Profile.tsx",
  "src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx",
  "src/pages/Reservations/PaymentSuccess.tsx",
  "src/pages/Reservations/PaymentFail.tsx",
  "src/pages/Reservations/ReservationDetail.tsx",
  "src/pages/Reservations/ReservationConfirm.tsx",
  "src/pages/Reservations/ReviewCreate.tsx",
].forEach((pagePath) => {
  const source = readFileSync(join(process.cwd(), pagePath), "utf8");
  expect(source).not.toMatch(/features\/(?:profile|reservations|reviews)\/(?:hooks|lib|components)\//);
});
```

In `src/api/ui-api-boundary-contracts.test.ts`, add `features/profile`, `features/reservations`, and `features/reviews` route containers to the allowed feature UI roots, while keeping shared UI domain-free.

- [ ] **Step 2: Update token ownership after CSS moves**

In `src/styles/tokens.test.ts`, replace old page CSS paths with moved feature CSS paths:

```ts
"src/features/reservations/GuestTripsPanel.module.css",
"src/features/reservations/HostReservationsPanel.module.css",
"src/features/reservations/HostReservationDetailRoute.module.css",
"src/features/reservations/ReservationDetailRoute.module.css",
"src/features/reservations/ReservationConfirmRoute.module.css",
"src/features/profile/HostListingsPanel.module.css",
```

Remove deleted page CSS paths from token contract fixtures.

- [ ] **Step 3: Update QA doc residual risk**

In `docs/qa/frontend-architecture-smoke.ko.md`, keep the existing skipped dynamic route section and add one note:

```markdown
- Profile/Reservations route-boundary refactor must pass `npm run verify:design-ready`.
- If `AIRBOB_SMOKE_RESERVATION_UID` and `AIRBOB_SMOKE_HOST_RESERVATION_UID` are unavailable, the generated smoke report must list those routes under `Skipped Dynamic Routes`; this is residual QA scope, not tested coverage.
```

Do not add actual QA credentials or real reservation UID values.

- [ ] **Step 4: Run focused boundary/style tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/routes/route-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts src/styles/tokens.test.ts src/verification-gate.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run full static gate**

Run:

```bash
npm run verify:pre-redesign
```

Expected: PASS. Existing `baseline-browser-mapping` and `caniuse-lite` freshness warnings may appear.

- [ ] **Step 6: Run smoke wrapper syntax and missing-env checks**

Run:

```bash
node --check scripts/smoke/frontend-smoke.mjs
env -u AIRBOB_QA_EMAIL -u AIRBOB_QA_PASSWORD -u GSTACK_BROWSE_BIN node scripts/smoke/frontend-smoke.mjs
```

Expected:

- `node --check` exits 0.
- missing-env command exits 1 and prints only env variable names, not credential values.

- [ ] **Step 7: Run browser smoke when local services are available**

Run with the thread-provided QA account through environment variables only:

```bash
AIRBOB_QA_EMAIL="<thread-provided-email>" \
AIRBOB_QA_PASSWORD="<thread-provided-password>" \
GSTACK_BROWSE_BIN=/Users/jaehoonchoi/gstack/browse/dist/browse \
AIRBOB_FRONTEND_URL=http://localhost:3000 \
npm run smoke:frontend
```

Expected: PASS. If guest/host reservation UIDs are not available, the generated report must list `reservation-detail` and `host-reservation-detail` under `Skipped Dynamic Routes`.

- [ ] **Step 8: Commit**

```bash
git add src/routes/route-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts src/styles/tokens.test.ts docs/qa/frontend-architecture-smoke.ko.md
git commit -m "test: lock profile reservation route boundaries"
```

---

## Execution Notes

- Do not modify backend/API/DB/server logic.
- Prefer `git mv` for file moves so history remains readable.
- Keep route pages thin but do not delete page-level tests until equivalent feature-route tests exist.
- Keep Korean user-facing labels unchanged unless a test explicitly documents a correction.
- Keep `features/*/index.ts` route-facing. Do not export deep hooks/libs from public barrels unless an existing route adapter still needs them during an intermediate task.
- If a moved CSS module is enrolled in `src/styles/tokens.test.ts`, update the path in the same commit as the move.
- Dynamic reservation smoke routes require stable data. Missing UIDs are a documented residual QA risk, not a failure of this structural refactor.

## Final Verification

Run before claiming completion:

```bash
git diff --check
npm run typecheck
npm run test:ci:no-cache -- --runInBand
npm run build
node --check scripts/smoke/frontend-smoke.mjs
env -u AIRBOB_QA_EMAIL -u AIRBOB_QA_PASSWORD -u GSTACK_BROWSE_BIN node scripts/smoke/frontend-smoke.mjs
```

Run `npm run smoke:frontend` when frontend/backend services and gstack browse are available. If valid `AIRBOB_SMOKE_RESERVATION_UID` and `AIRBOB_SMOKE_HOST_RESERVATION_UID` are available, include them to close skipped dynamic route coverage.

## Self-Review

- **Spec coverage:** Covers Profile page adapter, profile tab mapping, guest/host profile panels, host reservation detail, payment success/fail, reservation detail, reservation confirm, review create, boundary contracts, and smoke residual-risk documentation.
- **Out of scope by design:** SearchRoute, AccommodationDetailRoute, AccommodationEdit wizard split, and new shared design primitives are deferred to the next plan.
- **Plan hygiene:** Banned marker terms and vague deferred steps were checked and removed.
- **Type consistency:** Route tab, reservation filter, host listing status, sort column/order, and route container prop names are consistent across tasks.
