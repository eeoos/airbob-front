import type { ReactElement, ReactNode } from "react";
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
import { SignupRoute } from "./SignupRoute";
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
    wishlistMembership?: {
      commands: object;
      scope: { subject: string; epoch: number };
    };
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
  login: {
    mode: "login";
    submitLogin: (credentials: { email: string; password: string }) => Promise<void>;
    canComplete: () => boolean;
    onSuccess: () => void;
    onAlternate: () => void;
  };
  signup: {
    mode: "signup";
    submitSignup: (command: {
      nickname: string;
      email: string;
      password: string;
    }) => Promise<void>;
    canComplete: () => boolean;
    onSuccess: () => void;
    onAlternate: () => void;
  };
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
  search: {
    isAuthenticated: boolean;
    navigation: {
      getAccommodationHref(accommodationId: number): string;
      openAccommodation(accommodationId: number): void;
      openPage(page: number): void;
      replaceMapBounds(bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
      }): void;
      scrollResultsToTop(): void;
    };
    routeState: {
      destination?: string;
      page: number;
      adultOccupancy: number;
      childOccupancy: number;
      infantOccupancy: number;
      petOccupancy: number;
    };
    scope: { subject: string | null; epoch: number };
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
    wishlistMembership?: {
      commands: object;
      scope: { subject: string; epoch: number };
    };
  };
  wishlist: {
    navigation: {
      openIndex(): void;
      replaceWithIndex(): void;
      openRecentlyViewed(): void;
      openWishlistDetail(wishlistId: number): void;
      openAccommodation(accommodationId: number): void;
    };
    scope: { subject: string; epoch: number };
    view:
      | { kind: "index" }
      | { kind: "recently-viewed" }
      | { kind: "wishlist-detail"; wishlistId: number };
  };
};

const mockCapturedProps: Partial<CapturedProps> = {};
const mockUseAuthIntent = jest.fn();
const mockUseSession = jest.fn();
const mockRequestAuthIntent = jest.fn();
const mockCancelAuthIntent = jest.fn();
const mockClaimAuthIntent = jest.fn();
const mockIsCurrentSession = jest.fn();
const mockCaptureAuthenticatedSession = jest.fn();
const mockSessionLogin = jest.fn();
const mockSignup = jest.fn();
const mockWishlistCommands = {
  addAccommodation: jest.fn(),
  createAndAddAccommodation: jest.fn(),
  deleteWishlist: jest.fn(),
  dispose: jest.fn(),
  removeAccommodation: jest.fn(),
  removeRecentlyViewed: jest.fn(),
  saveMemo: jest.fn(),
};
const mockOpenInNewTab = jest.fn();
const mockIsCurrentHistoryEntry = jest.fn();

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

jest.mock("../../../screens/auth/public", () => ({
  AuthController: (
    props: CapturedProps["login"] | CapturedProps["signup"],
  ) => {
    const React = require("react");
    mockCapturedProps[props.mode] = props as never;
    return React.createElement(
      "button",
      { onClick: props.onSuccess, type: "button" },
      props.mode === "login" ? "로그인 성공" : "회원가입 성공",
    );
  },
}));
jest.mock("../../../screens/wishlist/public", () => ({
  WishlistController: mockRoute(
    "wishlist",
    "위시리스트 보기 변경",
    (props) => props.navigation.openRecentlyViewed(),
  ),
}));
jest.mock("../../../screens/search/public", () => ({
  SearchController: mockRoute("search", "검색 페이지 변경", (props) =>
    props.navigation.openPage(2),
  ),
}));
jest.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    isCurrentHistoryEntry: (...args: unknown[]) =>
      mockIsCurrentHistoryEntry(...args),
    openInNewTab: (...args: unknown[]) => mockOpenInNewTab(...args),
  },
}));
jest.mock("../../../features/auth/ports/AuthCommandProvider", () => ({
  useAuthCommands: () => ({ signup: mockSignup }),
}));
jest.mock("../../../features/accommodations/AccommodationDetailRoute", () => ({
  AccommodationDetailRoute: mockRoute("accommodation", "숙소 상세 계속"),
}));
jest.mock("../../../workflows/auth-intent", () => ({
  ...jest.requireActual("../../../workflows/auth-intent"),
  useAuthIntent: () => mockUseAuthIntent(),
}));
jest.mock("../../../workflows/wishlist-membership", () => ({
  WishlistMembershipProvider: ({
    children,
  }: {
    readonly children: ReactNode;
  }) => <>{children}</>,
  useWishlistMembership: () => mockWishlistCommands,
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
  mockCaptureAuthenticatedSession.mockReset();
  mockCaptureAuthenticatedSession.mockReturnValue({
    subject: "subject:member_7",
    epoch: 3,
  });
  mockSessionLogin.mockReset();
  mockSessionLogin.mockResolvedValue(undefined);
  mockSignup.mockReset();
  mockSignup.mockResolvedValue(undefined);
  mockOpenInNewTab.mockReset();
  mockIsCurrentHistoryEntry.mockReset();
  mockIsCurrentHistoryEntry.mockReturnValue(true);
  mockUseAuthIntent.mockReturnValue({
    pending: null,
    request: mockRequestAuthIntent,
    cancel: mockCancelAuthIntent,
    claim: mockClaimAuthIntent,
  });
  mockUseSession.mockReturnValue({
    state: { status: "anonymous", epoch: 0 },
    isCurrentSession: mockIsCurrentSession,
    captureAuthenticatedSession: mockCaptureAuthenticatedSession,
    login: mockSessionLogin,
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
      captureAuthenticatedSession: mockCaptureAuthenticatedSession,
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
    expect(captured("accommodation").wishlistMembership).toEqual({
      commands: mockWishlistCommands,
      scope: { subject: "subject:member_7", epoch: 3 },
    });
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
      captureAuthenticatedSession: mockCaptureAuthenticatedSession,
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
      captureAuthenticatedSession: mockCaptureAuthenticatedSession,
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

  it("owns normalized search state, history commands, and booking-safe detail navigation", async () => {
    renderAdapter(
      "/search",
      "/search?destination=Seoul&page=1&adultOccupancy=2&token=secret",
      <SearchRoute />,
    );

    expect(captured("search")).toMatchObject({
      isAuthenticated: false,
      routeState: {
        destination: "Seoul",
        page: 1,
        adultOccupancy: 2,
        childOccupancy: 0,
        infantOccupancy: 0,
        petOccupancy: 0,
      },
      scope: { subject: null, epoch: 0 },
    });
    act(() => captured("search").navigation.openAccommodation(42));
    expect(mockOpenInNewTab).toHaveBeenCalledWith(
      "/accommodations/42?adultOccupancy=2",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "검색 페이지 변경" }),
    );
    expectLocation(
      "/search?destination=Seoul&page=2&adultOccupancy=2&token=secret",
    );

    act(() =>
      captured("search").navigation.replaceMapBounds({
        north: 38,
        south: 37,
        east: 128,
        west: 126,
      }),
    );
    expectLocation(
      "/search?adultOccupancy=2&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128",
    );
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
      captureAuthenticatedSession: mockCaptureAuthenticatedSession,
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
    expect(captured("search").wishlistMembership).toEqual({
      commands: mockWishlistCommands,
      scope: { subject: "subject:member_7", epoch: 3 },
    });

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

    expect(captured("login").submitLogin).toBe(mockSessionLogin);
    expect(captured("login").canComplete()).toBe(true);
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

    await userEvent.click(screen.getByRole("button", { name: "로그인 성공" }));
    expectLocation("/");
  });

  it("rejects login completion after the browser leaves the captured route entry", () => {
    mockIsCurrentHistoryEntry.mockReturnValue(false);
    renderAdapter("/login", "/login", <LoginRoute />);

    expect(captured("login").canComplete()).toBe(false);
    expect(mockIsCurrentHistoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/login" }),
    );
  });

  it("injects the feature signup command and navigates to login", async () => {
    renderAdapter("/signup", "/signup", <SignupRoute />);

    expect(captured("signup").submitSignup).toBe(mockSignup);
    expect(captured("signup").canComplete()).toBe(true);
    await userEvent.click(
      screen.getByRole("button", { name: "회원가입 성공" }),
    );
    expectLocation("/login");
  });

  it("parses wishlist URL state once and owns typed navigation commands", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      isCurrentSession: mockIsCurrentSession,
      captureAuthenticatedSession: mockCaptureAuthenticatedSession,
    });
    renderAdapter(
      "/wishlist",
      "/wishlist?id=7#memo",
      <WishlistRoute />,
    );

    expect(captured("wishlist")).toMatchObject({
      scope: { subject: "subject:member_7", epoch: 3 },
      view: { kind: "wishlist-detail", wishlistId: 7 },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "위시리스트 보기 변경" }),
    );
    expectLocation("/wishlist?view=recently-viewed#memo");

    act(() => captured("wishlist").navigation.replaceWithIndex());
    expectLocation("/wishlist#memo");
    act(() => captured("wishlist").navigation.openAccommodation(42));
    expect(mockOpenInNewTab).toHaveBeenCalledWith("/accommodations/42");
  });

  it("does not mount the wishlist screen without an authenticated scope", () => {
    mockCaptureAuthenticatedSession.mockReturnValue(null);

    renderAdapter("/wishlist", "/wishlist", <WishlistRoute />);

    expect(mockCapturedProps.wishlist).toBeUndefined();
    expect(
      screen.queryByRole("button", { name: "위시리스트 보기 변경" }),
    ).not.toBeInTheDocument();
  });

  it("does not mount the wishlist screen with a non-current scope", () => {
    mockIsCurrentSession.mockReturnValue(false);

    renderAdapter("/wishlist", "/wishlist", <WishlistRoute />);

    expect(mockCapturedProps.wishlist).toBeUndefined();
    expect(mockIsCurrentSession).toHaveBeenCalledWith({
      subject: "subject:member_7",
      epoch: 3,
    });
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
