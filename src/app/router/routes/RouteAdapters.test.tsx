import type { ReactElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AccommodationConfirmRoute } from "./AccommodationConfirmRoute";
import { AccommodationDetailRoute } from "./AccommodationDetailRoute";
import { AccommodationEditRoute } from "./AccommodationEditRoute";
import { LoginRoute } from "./LoginRoute";
import { PaymentFailRoute } from "./PaymentFailRoute";
import { PaymentSuccessRoute } from "./PaymentSuccessRoute";
import { ProfileRoute } from "./ProfileRoute";
import { ReservationDetailRoute } from "./ReservationDetailRoute";
import { SearchRoute } from "./SearchRoute";
import { WishlistRoute } from "./WishlistRoute";

type Navigate = (target: string) => void;
type QueryRouteProps = {
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
};
type CapturedProps = {
  accommodation: {
    accommodationId?: string;
    authIntent?: {
      cancelPending(): void;
      generation: {
        generation: number;
        intent: {
          type: string;
          accommodationId: number;
        };
        isCurrent(): boolean;
      } | null;
      request(intent: {
        type: "reservation.start";
        accommodationId: number;
        checkIn: string;
        checkOut: string;
        adultCount: number;
        childCount: number;
        infantCount: number;
        petCount: number;
        couponId: number | null;
      }): boolean;
    };
    bookingSearchParams: URLSearchParams;
    navigate: Navigate;
  };
  confirm: {
    accommodationId?: string;
    locationState: unknown;
    navigate: Navigate;
  };
  detail: {
    locationState: unknown;
    navigate: Navigate;
    reservationUid?: string;
  };
  edit: {
    accommodationId?: string;
    isNewDraft: boolean;
    onNavigateToHostProfile: () => void;
  };
  login: { locationState: unknown; navigate: Navigate };
  paymentFail: {
    navigate: Navigate;
    reason?: string;
    reservationUid?: string;
    searchParams: URLSearchParams;
  };
  paymentSuccess: {
    navigate: Navigate;
    reservationUid?: string;
    searchParams: URLSearchParams;
  };
  profile: QueryRouteProps;
  search: QueryRouteProps & {
    wishlistAuthIntent: {
      request(accommodationId: number): number;
      cancel(attemptId: number): void;
      resumed: {
        attemptId: number;
        accommodationId: number;
        isCurrent(): boolean;
      } | null;
      completeResume(attemptId: number): void;
    };
  };
  wishlist: QueryRouteProps;
};

const mockCapturedProps: Partial<CapturedProps> = {};
const mockUseAuthIntent = jest.fn();
const mockUseSession = jest.fn();
const mockRequestAuthIntent = jest.fn();
const mockCancelAuthIntent = jest.fn();
const mockClaimAuthIntent = jest.fn();
const mockIsCurrentSession = jest.fn();

function mockRoute<Key extends keyof CapturedProps>(
  key: Key,
  actionName: string,
  action?: (props: CapturedProps[Key]) => void,
) {
  return (props: CapturedProps[Key]) => {
    const React = require("react");
    mockCapturedProps[key] = props;

    return React.createElement(
      "button",
      { onClick: () => action?.(props), type: "button" },
      actionName,
    );
  };
}

function mockFinishLogin(props: CapturedProps["login"]) {
  const from = (
    props.locationState as {
      from?: { hash?: string; pathname?: string; search?: string };
    } | null
  )?.from;
  const target = from?.pathname
    ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
    : "/";

  props.navigate(target);
}

jest.mock("../../../features/auth/LoginRoute", () => ({
  LoginRoute: mockRoute("login", "로그인 성공", mockFinishLogin),
}));
jest.mock("../../../features/accommodations/AccommodationDetailRoute", () => ({
  AccommodationDetailRoute: mockRoute("accommodation", "숙소 상세 계속"),
}));
jest.mock("../../../workflows/auth-intent", () => ({
  ...jest.requireActual("../../../workflows/auth-intent"),
  useAuthIntent: () => mockUseAuthIntent(),
}));
jest.mock("../../session/useSession", () => ({
  useSession: () => mockUseSession(),
}));
jest.mock("../../../features/reservations/ReservationConfirmRoute", () => ({
  ReservationConfirmRoute: mockRoute("confirm", "예약 확인 계속", (props) =>
    props.navigate("/confirm-next"),
  ),
}));
jest.mock("../../../features/reservations/ReservationDetailRoute", () => ({
  ReservationDetailRoute: mockRoute("detail", "예약 상세 계속", (props) =>
    props.navigate("/reservation-next"),
  ),
}));
jest.mock("../../../features/reservations/PaymentSuccessRoute", () => ({
  PaymentSuccessRoute: mockRoute("paymentSuccess", "결제 성공 계속"),
}));
jest.mock("../../../features/reservations/PaymentFailRoute", () => ({
  PaymentFailRoute: mockRoute("paymentFail", "결제 실패 계속"),
}));
jest.mock(
  "../../../features/accommodations/edit/AccommodationEditRoute",
  () => ({
    AccommodationEditRoute: mockRoute("edit", "호스트 프로필로 이동", (props) =>
      props.onNavigateToHostProfile(),
    ),
  }),
);
jest.mock("../../../features/search/SearchRoute", () => ({
  SearchRoute: mockRoute("search", "검색 조건 변경", (props) =>
    props.setSearchParams(new URLSearchParams("destination=Busan&page=2")),
  ),
}));
jest.mock("../../../features/wishlist/WishlistRoute", () => ({
  WishlistRoute: mockRoute("wishlist", "위시리스트 보기 변경", (props) =>
    props.setSearchParams(new URLSearchParams("view=recently-viewed")),
  ),
}));
jest.mock("../../../features/profile/ProfileRoute", () => ({
  ProfileRoute: mockRoute("profile", "프로필 보기 변경", (props) =>
    props.setSearchParams(
      new URLSearchParams("mode=host&tab=reservations-upcoming"),
    ),
  ),
}));

type TestEntry =
  | string
  | {
      pathname: string;
      search?: string;
      state?: unknown;
    };

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="current-location">
      {`${location.pathname}${location.search}${location.hash}`}
    </output>
  );
}

const renderAdapter = (
  routePath: string,
  initialEntry: TestEntry,
  element: ReactElement,
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path={routePath} element={element} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

const captured = <Key extends keyof CapturedProps>(key: Key) => {
  const props = mockCapturedProps[key];
  expect(props).toBeDefined();
  return props as CapturedProps[Key];
};

const expectLocation = (location: string) =>
  expect(screen.getByTestId("current-location")).toHaveTextContent(location);

beforeEach(() => {
  for (const key of Object.keys(mockCapturedProps)) {
    delete mockCapturedProps[key as keyof CapturedProps];
  }
  mockRequestAuthIntent.mockReset();
  mockCancelAuthIntent.mockReset();
  mockClaimAuthIntent.mockReset();
  mockIsCurrentSession.mockReset();
  mockIsCurrentSession.mockReturnValue(true);
  mockUseAuthIntent.mockReturnValue({
    pending: null,
    request: mockRequestAuthIntent,
    cancel: mockCancelAuthIntent,
    claim: mockClaimAuthIntent,
  });
  mockUseSession.mockReturnValue({
    state: { status: "anonymous" },
    isCurrentSession: mockIsCurrentSession,
  });
});

describe("app route adapter contracts", () => {
  it("registers and cancels normalized accommodation auth intent data", () => {
    mockRequestAuthIntent.mockReturnValue(41);
    renderAdapter(
      "/accommodations/:id",
      "/accommodations/42?checkIn=2026-07-10&checkOut=2026-07-12",
      <AccommodationDetailRoute />,
    );
    const authIntent = captured("accommodation").authIntent;
    expect(authIntent).toBeDefined();

    act(() => {
      expect(
        authIntent?.request({
          type: "reservation.start",
          accommodationId: 42,
          checkIn: "2026-07-10",
          checkOut: "2026-07-12",
          adultCount: 2,
          childCount: 1,
          infantCount: 0,
          petCount: 0,
          couponId: null,
        }),
      ).toBe(true);
    });

    expect(mockRequestAuthIntent).toHaveBeenCalledWith({
      type: "reservation.start",
      accommodationId: 42,
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      petCount: 0,
      couponId: null,
    });

    act(() => authIntent?.cancelPending());
    expect(mockCancelAuthIntent).toHaveBeenCalledWith(41);
  });

  it("atomically claims a matching current-location accommodation intent", async () => {
    const session = { epoch: 5, subject: "subject:member_1" };
    const pending = {
      attemptId: 12,
      intent: { type: "wishlist.open", accommodationId: 42 },
      source: { locationKey: "default", path: "/accommodations/42" },
    };
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      isCurrentSession: mockIsCurrentSession,
    });
    mockUseAuthIntent.mockReturnValue({
      pending,
      request: mockRequestAuthIntent,
      cancel: mockCancelAuthIntent,
      claim: mockClaimAuthIntent,
    });
    mockClaimAuthIntent.mockImplementation((predicate) =>
      predicate(pending.intent) ? { ...pending, session } : null,
    );

    renderAdapter(
      "/accommodations/:id",
      "/accommodations/42",
      <AccommodationDetailRoute />,
    );

    await waitFor(() =>
      expect(captured("accommodation").authIntent?.generation).toMatchObject({
        generation: 12,
        intent: pending.intent,
      }),
    );
    expect(mockClaimAuthIntent).toHaveBeenCalledTimes(1);
    expect(
      captured("accommodation").authIntent?.generation?.isCurrent(),
    ).toBe(true);
    expect(mockIsCurrentSession).toHaveBeenCalledWith(session);
  });

  it.each([
    [
      "source path",
      {
        attemptId: 13,
        intent: { type: "wishlist.open", accommodationId: 42 },
        source: { locationKey: "default", path: "/accommodations/41" },
      },
    ],
    [
      "source location key",
      {
        attemptId: 15,
        intent: { type: "wishlist.open", accommodationId: 42 },
        source: { locationKey: "previous", path: "/accommodations/42" },
      },
    ],
    [
      "resource id",
      {
        attemptId: 14,
        intent: { type: "coupon.issue", accommodationId: 41, couponId: 3 },
        source: { locationKey: "default", path: "/accommodations/42" },
      },
    ],
  ])("does not claim a pending intent with mismatched %s", async (_case, pending) => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      isCurrentSession: mockIsCurrentSession,
    });
    mockUseAuthIntent.mockReturnValue({
      pending,
      request: mockRequestAuthIntent,
      cancel: mockCancelAuthIntent,
      claim: mockClaimAuthIntent,
    });

    renderAdapter(
      "/accommodations/:id",
      "/accommodations/42",
      <AccommodationDetailRoute />,
    );
    await Promise.resolve();

    expect(mockClaimAuthIntent).not.toHaveBeenCalled();
    expect(captured("accommodation").authIntent?.generation).toBeNull();
  });

  it("retains a pending accommodation intent when login fails", async () => {
    const pending = {
      attemptId: 16,
      intent: { type: "wishlist.open", accommodationId: 42 },
      source: { locationKey: "default", path: "/accommodations/42" },
    };
    mockUseSession.mockReturnValue({
      state: { status: "error", reason: "identity-change" },
      isCurrentSession: mockIsCurrentSession,
    });
    mockUseAuthIntent.mockReturnValue({
      pending,
      request: mockRequestAuthIntent,
      cancel: mockCancelAuthIntent,
      claim: mockClaimAuthIntent,
    });

    renderAdapter(
      "/accommodations/:id",
      "/accommodations/42",
      <AccommodationDetailRoute />,
    );
    await Promise.resolve();

    expect(mockClaimAuthIntent).not.toHaveBeenCalled();
    expect(mockCancelAuthIntent).not.toHaveBeenCalled();
    expect(captured("accommodation").authIntent?.generation).toBeNull();
  });

  it("registers and cancels search wishlist auth intent data", () => {
    mockRequestAuthIntent.mockReturnValue(51);
    renderAdapter(
      "/search",
      "/search?destination=Seoul",
      <SearchRoute />,
    );

    const bridge = captured("search").wishlistAuthIntent;
    expect(bridge.resumed).toBeNull();
    expect(bridge.request(77)).toBe(51);
    expect(mockRequestAuthIntent).toHaveBeenCalledWith({
      type: "wishlist.open",
      accommodationId: 77,
    });

    bridge.cancel(51);
    expect(mockCancelAuthIntent).toHaveBeenCalledWith(51);
  });

  it("delivers an atomically claimed wishlist intent to the new search owner", async () => {
    const session = { epoch: 6, subject: "subject:member_2" };
    const claimed = {
      attemptId: 52,
      intent: { type: "wishlist.open", accommodationId: 88 },
      source: { locationKey: "default", path: "/search" },
      session,
    };
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      isCurrentSession: mockIsCurrentSession,
    });
    mockClaimAuthIntent.mockReturnValueOnce(claimed).mockReturnValue(null);

    renderAdapter("/search", "/search", <SearchRoute />);

    await waitFor(() =>
      expect(captured("search").wishlistAuthIntent.resumed).toMatchObject({
        accommodationId: 88,
        attemptId: 52,
      }),
    );
    expect(mockClaimAuthIntent).toHaveBeenCalledTimes(1);
    expect(
      captured("search").wishlistAuthIntent.resumed?.isCurrent(),
    ).toBe(true);
    expect(mockIsCurrentSession).toHaveBeenCalledWith(session);

    act(() => {
      captured("search").wishlistAuthIntent.completeResume(52);
    });
    await waitFor(() =>
      expect(captured("search").wishlistAuthIntent.resumed).toBeNull(),
    );
  });

  it("restores a validated login return target", async () => {
    const from = {
      pathname: "/profile",
      search: "?mode=host&tab=reservations",
      hash: "#calendar",
    };
    renderAdapter(
      "/login",
      { pathname: "/login", state: { from } },
      <LoginRoute />,
    );

    expect(captured("login").locationState).toEqual({ from });
    await userEvent.click(screen.getByRole("button", { name: "로그인 성공" }));
    expectLocation("/profile?mode=host&tab=reservations#calendar");
  });

  it("drops a hostile login return target", async () => {
    renderAdapter(
      "/login",
      {
        pathname: "/login",
        state: {
          from: { pathname: "//evil.example/steal", search: "", hash: "" },
        },
      },
      <LoginRoute />,
    );

    expect(captured("login").locationState).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "로그인 성공" }));
    expectLocation("/");
  });

  it("injects confirmation params, state, and navigation", async () => {
    const state = { amount: 120000, reservationUid: "reservation-42" };
    renderAdapter(
      "/accommodations/:id/confirm",
      { pathname: "/accommodations/42/confirm", state },
      <AccommodationConfirmRoute />,
    );

    expect(captured("confirm")).toMatchObject({
      accommodationId: "42",
      locationState: state,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "예약 확인 계속" }),
    );
    expectLocation("/confirm-next");
  });

  it("injects reservation detail params, state, and navigation", async () => {
    const state = { toastMessage: "리뷰 이미지 업로드 실패" };
    renderAdapter(
      "/reservations/:reservationUid",
      { pathname: "/reservations/reservation-42", state },
      <ReservationDetailRoute />,
    );

    expect(captured("detail")).toMatchObject({
      locationState: state,
      reservationUid: "reservation-42",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "예약 상세 계속" }),
    );
    expectLocation("/reservation-next");
  });

  it("injects payment success params and callback query", () => {
    const query =
      "paymentKey=payment-key-1&orderId=reservation-42&amount=120000";
    renderAdapter(
      "/reservations/:reservationUid/success",
      {
        pathname: "/reservations/reservation-42/success",
        search: `?${query}`,
      },
      <PaymentSuccessRoute />,
    );

    expect(captured("paymentSuccess").reservationUid).toBe("reservation-42");
    expect(captured("paymentSuccess").searchParams.toString()).toBe(query);
  });

  it("injects payment failure params, callback query, and parsed reason", () => {
    const query =
      "reason=confirm-failed&paymentKey=key&orderId=reservation-42&amount=120000";
    renderAdapter(
      "/reservations/:reservationUid/fail",
      {
        pathname: "/reservations/reservation-42/fail",
        search: `?${query}`,
      },
      <PaymentFailRoute />,
    );

    expect(captured("paymentFail")).toMatchObject({
      reason: "confirm-failed",
      reservationUid: "reservation-42",
    });
    expect(captured("paymentFail").searchParams.toString()).toBe(query);
  });

  it("validates edit draft provenance and navigates to the host profile", async () => {
    renderAdapter(
      "/accommodations/:id/edit",
      {
        pathname: "/accommodations/42/edit",
        state: {
          accommodationEdit: {
            accommodationId: "42",
            source: "created-draft",
          },
        },
      },
      <AccommodationEditRoute />,
    );

    expect(captured("edit")).toMatchObject({
      accommodationId: "42",
      isNewDraft: true,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "호스트 프로필로 이동" }),
    );
    expectLocation("/profile?mode=host");
  });

  it.each([
    {
      action: "검색 조건 변경",
      element: <SearchRoute />,
      initial: "/search?destination=Seoul&page=1",
      key: "search",
      next: "/search?destination=Busan&page=2",
      path: "/search",
      query: "destination=Seoul&page=1",
    },
    {
      action: "위시리스트 보기 변경",
      element: <WishlistRoute />,
      initial: "/wishlist?id=7",
      key: "wishlist",
      next: "/wishlist?view=recently-viewed",
      path: "/wishlist",
      query: "id=7",
    },
    {
      action: "프로필 보기 변경",
      element: <ProfileRoute />,
      initial: "/profile?mode=guest&tab=upcoming",
      key: "profile",
      next: "/profile?mode=host&tab=reservations-upcoming",
      path: "/profile",
      query: "mode=guest&tab=upcoming",
    },
  ] as const)("passes and mutates $key URL state", async (testCase) => {
    renderAdapter(testCase.path, testCase.initial, testCase.element);

    expect(captured(testCase.key).searchParams.toString()).toBe(testCase.query);
    await userEvent.click(
      screen.getByRole("button", { name: testCase.action }),
    );
    expectLocation(testCase.next);
  });
});
