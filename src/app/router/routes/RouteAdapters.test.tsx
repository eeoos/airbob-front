import { useState, type ReactElement, type ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type {
  ListingEditorAccommodation,
  ListingEditorQueryPort,
} from "../../../features/accommodations/listing-editor/public";
import type { ListingEditorPublicationPort } from "../../../workflows/listing-editor";
import type { ProfileControllerProps } from "../../../screens/profile/public";
import type { SessionSubject } from "../../../platform/session/sessionScope";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AccommodationDetailRoute } from "./AccommodationDetailRoute";
import { AccommodationEditRoute } from "./AccommodationEditRoute";
import { LoginRoute } from "./LoginRoute";
import { ProfileRoute } from "./ProfileRoute";
import { ReservationDetailRoute } from "./ReservationDetailRoute";
import { ReviewCreateRoute } from "./ReviewCreateRoute";
import { SearchRoute } from "./SearchRoute";
import { SignupRoute } from "./SignupRoute";
import { WishlistRoute } from "./WishlistRoute";
import { createReviewSubmissionResultState } from "../codecs/reviewSubmissionResultCodec";

type CapturedProps = {
  accommodation: {
    accommodationId: number | null;
    authIntent: {
      cancelPending(): void;
      claimed: {
        attemptId: number;
        intent: {
          type: string;
          accommodationId: number;
        };
        isCurrent(): boolean;
      } | null;
      completeClaim(attemptId: number): void;
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
    bookingRouteState: {
      checkIn?: string;
      checkOut?: string;
      adultOccupancy: number;
      childOccupancy: number;
      infantOccupancy: number;
      petOccupancy: number;
    };
    checkoutHandoff: {
      commit(input: {
        session: { subject: string; epoch: number };
        reservation: {
          reservationUid: string;
          orderName: string;
          amount: number;
          customerEmail: string;
          customerName: string;
        };
        intent: {
          accommodationId: number;
          checkIn: string;
          checkOut: string;
          adultCount: number;
          childCount: number;
          infantCount: number;
          petCount: number;
        };
        appliedCoupon: null;
      }): void;
    };
    onReplaceBookingDates(checkIn: string | null, checkOut: string | null): void;
    routeLease: { isCurrent(): boolean };
    wishlistMembership?: {
      commands: object;
      scope: { subject: string; epoch: number };
    };
  };
  detail: {
    variant: "guest";
    feedbackMessage: string | null;
    navigation: {
      back(): void;
      backToProfile(): void;
      openAccommodation(accommodationId: number): void;
      openReview(reservationUid: string): void;
    };
    reservationUid: string;
    scope: { subject: string; epoch: number };
  };
  reviewCreate: {
    reservationUid: string | null;
    routeLease: { isCurrent(): boolean };
    onComplete(
      reservationUid: string,
      result: "success" | "image-upload-failed",
    ): void;
  };
  edit: {
    accommodationId: number;
    instanceId: string;
    isNewDraft: boolean;
    onNavigateToHostProfile: () => void;
    publication: ListingEditorPublicationPort;
    query: ListingEditorQueryPort;
    routeLease: { isCurrent(): boolean };
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
  profile: ProfileControllerProps;
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
const mockReservationDetailRenderProps: CapturedProps["detail"][] = [];
const mockUseAuthIntent = vi.fn();
const mockUseSession = vi.fn();
const mockRequestAuthIntent = vi.fn();
const mockCancelAuthIntent = vi.fn();
const mockClaimAuthIntent = vi.fn();
const mockIsCurrentSession = vi.fn();
const mockCaptureAuthenticatedSession = vi.fn();
const mockSessionLogin = vi.fn();
const mockSignup = vi.fn();
const mockWishlistCommands = {
  addAccommodation: vi.fn(),
  createAndAddAccommodation: vi.fn(),
  deleteWishlist: vi.fn(),
  dispose: vi.fn(),
  removeAccommodation: vi.fn(),
  removeRecentlyViewed: vi.fn(),
  saveMemo: vi.fn(),
};
const mockOpenInNewTab = vi.fn();
const mockIsCurrentHistoryEntry = vi.fn();
const mockRefreshAccommodationDetail = vi.fn();
const mockRefreshHostListings = vi.fn();

function mockRoute<Key extends keyof CapturedProps>(
  key: Key,
  actionName: string,
  action?: (props: CapturedProps[Key]) => void,
) {
  return function MockRoute(props: CapturedProps[Key]) {
    mockCapturedProps[key] = props;

    return (
      <button type="button" onClick={() => action?.(props)}>
        {actionName}
      </button>
    );
  };
}

vi.mock("../../../screens/auth/public", () => ({
  AuthController: (
    props: CapturedProps["login"] | CapturedProps["signup"],
  ) => {
    mockCapturedProps[props.mode] = props as never;
    return (
      <button type="button" onClick={props.onSuccess}>
        {props.mode === "login" ? "로그인 성공" : "회원가입 성공"}
      </button>
    );
  },
}));
vi.mock("../../../screens/wishlist/public", () => ({
  WishlistController: mockRoute(
    "wishlist",
    "위시리스트 보기 변경",
    (props) => props.navigation.openRecentlyViewed(),
  ),
}));
vi.mock("../../../screens/search/public", () => ({
  SearchController: mockRoute("search", "검색 페이지 변경", (props) =>
    props.navigation.openPage(2),
  ),
}));
vi.mock("../../../screens/review-create/public", () => ({
  ReviewCreateController: mockRoute(
    "reviewCreate",
    "리뷰 작성 완료",
    (props) =>
      props.onComplete("reservation-42", "image-upload-failed"),
  ),
}));
vi.mock("../../../screens/accommodation-edit/public", () => ({
  AccommodationEditController: mockRoute(
    "edit",
    "호스트 프로필로 이동",
    (props) => props.onNavigateToHostProfile(),
  ),
}));
vi.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    isCurrentHistoryEntry: (...args: unknown[]) =>
      mockIsCurrentHistoryEntry(...args),
    openInNewTab: (...args: unknown[]) => mockOpenInNewTab(...args),
  },
}));
vi.mock("../../../features/auth/ports/AuthCommandProvider", () => ({
  useAuthCommands: () => ({ signup: mockSignup }),
}));
vi.mock("../../../screens/accommodation-detail/public", () => ({
  AccommodationDetailController: mockRoute(
    "accommodation",
    "숙소 상세 계속",
  ),
}));
vi.mock("../../../features/accommodations/detail/public", async () => ({
  ...(await vi.importActual<
    typeof import("../../../features/accommodations/detail/public")
  >("../../../features/accommodations/detail/public")),
  createAccommodationDetailQueryCacheProjection: () => ({
    detailRefreshRequired: (...args: unknown[]) =>
      mockRefreshAccommodationDetail(...args),
  }),
}));
vi.mock("../../../features/profile/public", () => ({
  createHostListingQueryCacheProjection: () => ({
    refreshRequired: (...args: unknown[]) =>
      mockRefreshHostListings(...args),
  }),
}));
vi.mock("../../../workflows/auth-intent", async () => ({
  ...(await vi.importActual<typeof import("../../../workflows/auth-intent")>(
    "../../../workflows/auth-intent",
  )),
  useAuthIntent: () => mockUseAuthIntent(),
}));
vi.mock("../../../workflows/wishlist-membership", () => ({
  WishlistMembershipProvider: ({
    children,
  }: {
    readonly children: ReactNode;
  }) => <>{children}</>,
  useWishlistMembership: () => mockWishlistCommands,
}));
vi.mock("../../session/useSession", () => ({
  useSession: () => mockUseSession(),
}));
vi.mock("../../../screens/reservation-detail/public", () => ({
  ReservationDetailController: (props: CapturedProps["detail"]) => {
    const [mountedReservationUid] = useState(props.reservationUid);
    mockCapturedProps.detail = props;
    mockReservationDetailRenderProps.push(props);

    return (
      <>
        <span data-testid="mounted-reservation-uid">
          {mountedReservationUid}
        </span>
        <button
          type="button"
          onClick={() => props.navigation.openAccommodation(42)}
        >
          예약 상세 계속
        </button>
      </>
    );
  },
}));
vi.mock("../../../screens/profile/public", () => ({
  ProfileController: mockRoute("profile", "프로필 보기 변경", (props) =>
    props.navigation.changeHostSection("reservations"),
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
    <>
      <output data-testid="current-location">
        {`${location.pathname}${location.search}${location.hash}`}
      </output>
      <output data-testid="current-location-state">
        {JSON.stringify(location.state)}
      </output>
    </>
  );
}

function ReservationDetailTransitionHarness() {
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        onClick={() => navigate("/reservations/reservation-43")}
      >
        다른 예약 보기
      </button>
      <ReservationDetailRoute />
    </>
  );
}

const renderAdapter = (
  routePath: string,
  initialEntry: TestEntry,
  element: ReactElement,
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
};

const captured = <Key extends keyof CapturedProps>(key: Key) => {
  const props = mockCapturedProps[key];
  expect(props).toBeDefined();
  return props as CapturedProps[Key];
};

const expectLocation = (location: string) =>
  expect(screen.getByTestId("current-location")).toHaveTextContent(location);

beforeEach(() => {
  mockReservationDetailRenderProps.length = 0;
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
  mockRefreshAccommodationDetail.mockReset();
  mockRefreshAccommodationDetail.mockResolvedValue(undefined);
  mockRefreshHostListings.mockReset();
  mockRefreshHostListings.mockResolvedValue(undefined);
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

    expect(captured("accommodation")).toMatchObject({
      accommodationId: 42,
      bookingRouteState: {
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        adultOccupancy: 1,
        childOccupancy: 0,
        infantOccupancy: 0,
        petOccupancy: 0,
      },
    });

    act(() =>
      captured("accommodation").onReplaceBookingDates(
        "2026-07-20",
        "2026-07-22",
      ),
    );
    expectLocation(
      "/accommodations/42?checkIn=2026-07-20&checkOut=2026-07-22",
    );
  });

  it("rejects checkout storage and navigation after the captured route entry is stale", () => {
    sessionStorage.clear();
    renderAdapter(
      "/accommodations/:id",
      "/accommodations/42",
      <AccommodationDetailRoute />,
    );
    mockIsCurrentHistoryEntry.mockReturnValue(false);

    expect(() =>
      act(() =>
        captured("accommodation").checkoutHandoff.commit({
        session: { subject: "subject:member_7", epoch: 3 },
        reservation: {
          reservationUid: "reservation-42",
          orderName: "테스트 숙소 2박",
          amount: 200000,
          customerEmail: "guest@example.invalid",
          customerName: "게스트",
        },
        intent: {
          accommodationId: 42,
          checkIn: "2026-07-20",
          checkOut: "2026-07-22",
          adultCount: 1,
          childCount: 0,
          infantCount: 0,
          petCount: 0,
        },
          appliedCoupon: null,
        }),
      ),
    ).toThrow("Checkout handoff is no longer current.");

    expectLocation("/accommodations/42");
    expect(
      sessionStorage.getItem("airbob:reservation-checkout:42"),
    ).toBeNull();
    expect(
      sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toBeNull();
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
      expect(captured("accommodation").authIntent.claimed).toMatchObject({
        attemptId: 12,
        intent: pending.intent,
      }),
    );
    expect(mockClaimAuthIntent).toHaveBeenCalledTimes(1);
    expect(
      captured("accommodation").authIntent.claimed?.isCurrent(),
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
    expect(captured("accommodation").authIntent.claimed).toBeNull();
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
    expect(captured("accommodation").authIntent.claimed).toBeNull();
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

  it("owns the review route lease and typed partial-success navigation", async () => {
    renderAdapter(
      "/reservations/:reservationUid/review",
      "/reservations/reservation-42/review",
      <ReviewCreateRoute />,
    );

    expect(captured("reviewCreate").reservationUid).toBe("reservation-42");
    expect(captured("reviewCreate").routeLease.isCurrent()).toBe(true);
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성 완료" }),
    );

    expectLocation("/reservations/reservation-42");
    expect(screen.getByTestId("current-location-state")).toHaveTextContent(
      JSON.stringify(createReviewSubmissionResultState("image-upload-failed")),
    );
  });

  it("maps and consumes the typed review partial-success state once", async () => {
    const state = createReviewSubmissionResultState("image-upload-failed");
    renderAdapter(
      "/reservations/:reservationUid",
      { pathname: "/reservations/reservation-42", state },
      <ReservationDetailRoute />,
    );

    expect(captured("detail")).toMatchObject({
      feedbackMessage: "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
      reservationUid: "reservation-42",
      variant: "guest",
    });
    await waitFor(() =>
      expect(screen.getByTestId("current-location-state")).toHaveTextContent(
        "null",
      ),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "예약 상세 계속" }),
    );
    expectLocation("/accommodations/42");
  });

  it("remounts the legacy detail boundary when the route reuses a different reservation uid", async () => {
    renderAdapter(
      "/reservations/:reservationUid",
      "/reservations/reservation-42",
      <ReservationDetailTransitionHarness />,
    );

    expect(screen.getByTestId("mounted-reservation-uid")).toHaveTextContent(
      "reservation-42",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "다른 예약 보기" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("mounted-reservation-uid")).toHaveTextContent(
        "reservation-43",
      ),
    );
    expect(captured("detail").reservationUid).toBe("reservation-43");
  });

  it("does not carry a consumed review warning into another reused reservation route", async () => {
    const state = createReviewSubmissionResultState("image-upload-failed");
    renderAdapter(
      "/reservations/:reservationUid",
      { pathname: "/reservations/reservation-42", state },
      <ReservationDetailTransitionHarness />,
    );

    expect(captured("detail")).toMatchObject({
      feedbackMessage: "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
      reservationUid: "reservation-42",
    });
    await waitFor(() =>
      expect(screen.getByTestId("current-location-state")).toHaveTextContent(
        "null",
      ),
    );
    mockReservationDetailRenderProps.length = 0;

    await userEvent.click(
      screen.getByRole("button", { name: "다른 예약 보기" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("mounted-reservation-uid")).toHaveTextContent(
        "reservation-43",
      ),
    );
    const reusedRouteProps = mockReservationDetailRenderProps.filter(
      ({ reservationUid }) => reservationUid === "reservation-43",
    );
    expect(reusedRouteProps).not.toHaveLength(0);
    expect(reusedRouteProps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feedbackMessage: null,
          reservationUid: "reservation-43",
        }),
      ]),
    );
    expect(
      reusedRouteProps.every(
        ({ feedbackMessage }) => feedbackMessage === null,
      ),
    ).toBe(true);
  });

  it("rejects free-form reservation detail feedback", () => {
    renderAdapter(
      "/reservations/:reservationUid",
      {
        pathname: "/reservations/reservation-42",
        state: { toastMessage: "injected copy" },
      },
      <ReservationDetailRoute />,
    );

    expect(captured("detail").feedbackMessage).toBeNull();
    expect(screen.getByTestId("current-location-state")).toHaveTextContent(
      '{"toastMessage":"injected copy"}',
    );
  });

  it("validates edit draft provenance and navigates to the host profile", async () => {
    const { queryClient } = renderAdapter(
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
      accommodationId: 42,
      isNewDraft: true,
    });
    expect(captured("edit").instanceId).toContain("listing-editor:");
    expect(captured("edit").routeLease.isCurrent()).toBe(true);
    const projected: ListingEditorAccommodation = {
      id: 42,
      name: "Projected listing",
      description: null,
      type: null,
      basePrice: null,
      currency: null,
      checkInTime: null,
      checkOutTime: null,
      address: null,
      occupancyPolicy: null,
      amenities: [],
      images: [],
    };
    captured("edit").query.setHostDetail({
      accommodation: projected,
      accommodationId: 42,
      scope: { subject: "subject:member_7" as SessionSubject, epoch: 1 },
    });
    expect(
      queryClient.getQueryData([
        "accommodation",
        "listing-editor",
        42,
        {
          session: { subject: "subject:member_7", epoch: 1 },
        },
      ]),
    ).toEqual(projected);
    await userEvent.click(
      screen.getByRole("button", { name: "호스트 프로필로 이동" }),
    );
    expectLocation("/profile?mode=host");
  });

  it("awaits the editor input's exact scoped cache refresh", async () => {
    const failure = new Error("detail invalidation failed");
    const changedScope = {
      subject: "subject:editor-publication" as SessionSubject,
      epoch: 9,
    };
    mockRefreshAccommodationDetail.mockRejectedValueOnce(failure);
    renderAdapter(
      "/accommodations/:id/edit",
      "/accommodations/42/edit",
      <AccommodationEditRoute />,
    );

    await expect(
      captured("edit").publication.publishEditorChanged({
        accommodationId: 84,
        outcome: "saved",
        scope: changedScope,
      }),
    ).rejects.toBe(failure);
    expect(mockRefreshAccommodationDetail).toHaveBeenCalledWith({
      accommodationId: 84,
      scope: changedScope,
    });
    expect(mockRefreshHostListings).toHaveBeenCalledWith({
      scope: changedScope,
    });
  });

  it("maps profile URL state and replaces it through typed navigation", async () => {
    renderAdapter(
      "/profile",
      "/profile?mode=guest&tab=upcoming",
      <ProfileRoute />,
    );

    expect(captured("profile").routeView).toEqual({
      variant: "guest",
      activeTab: "upcoming",
      filterType: "UPCOMING",
    });
    await userEvent.click(
      screen.getByRole("button", { name: "프로필 보기 변경" }),
    );
    expectLocation("/profile?mode=host&tab=reservations-upcoming");
  });
});
