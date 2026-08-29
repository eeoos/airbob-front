import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import type { AccommodationDetail } from "../../types/accommodation";
import type { CouponInfo } from "../../types/coupon";
import type { ReviewInfo } from "../../types/review";
import { AccommodationDetailRoute } from "./AccommodationDetailRoute";
import type {
  AccommodationDetailAuthIntent,
  AccommodationDetailAuthIntentController,
  AccommodationDetailAuthIntentGeneration,
} from "./AccommodationDetailRoute";
import type {
  AccommodationBookingActions,
  AccommodationBookingState,
  AccommodationCouponActions,
  AccommodationCouponState,
} from "./components/AccommodationBookingCard";
import type { AccommodationBookingViewModel } from "./lib/accommodationBookingViewModel";
import type { WishlistModalCommandPort } from "../wishlist/appShell";

const mockUseApiError = jest.fn();
const mockUseAuth = jest.fn();
const mockUseAccommodationBooking = jest.fn();
const mockUseAccommodationCoupons = jest.fn();
const mockUseAccommodationDetail = jest.fn();
const mockUseAccommodationImageGallery = jest.fn();
const mockUseAccommodationReviews = jest.fn();
const mockHandleReserve = jest.fn();
const mockHandleIssueCoupon = jest.fn();
const mockReloadAccommodation = jest.fn();
const mockRequestAuthIntent = jest.fn(() => true);
const mockCancelAuthIntent = jest.fn();
let mockAuthModalProps:
  | {
      isOpen: boolean;
      onClose: () => void;
      onSuccess?: () => void;
    }
  | undefined;
let mockWishlistModalProps:
  | {
      accommodationId: number;
      commands: WishlistModalCommandPort;
      isOpen: boolean;
      onClose: () => void;
      scope: AuthenticatedSessionScope;
    }
  | undefined;

const wishlistScope: AuthenticatedSessionScope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 3,
};
const wishlistCommands: WishlistModalCommandPort = {
  addAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: true,
  }),
  removeAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: false,
  }),
  createAndAddAccommodation: jest.fn().mockResolvedValue({
    status: "applied",
    isInAnyWishlist: true,
    wishlistId: 11,
  }),
};
const wishlistMembership = {
  commands: wishlistCommands,
  scope: wishlistScope,
};
type MockBookingCardProps = {
  bookingView: AccommodationBookingViewModel;
  isAuthenticated: boolean;
  bookingState: AccommodationBookingState;
  bookingActions: AccommodationBookingActions;
  couponState: AccommodationCouponState;
  couponActions: AccommodationCouponActions;
  nights?: number;
  onReserve?: () => void;
  payablePrice?: number;
  coupons?: CouponInfo[];
  isLoadingCoupons?: boolean;
  selectedCoupon?: CouponInfo | null;
  selectedCouponId?: number | null;
  setSelectedCouponId?: (couponId: number | null) => void;
  issuingCouponId?: number | null;
  couponDiscount?: number;
  handleIssueCoupon?: (coupon: CouponInfo) => void | Promise<void>;
};
let mockBookingCardProps: MockBookingCardProps;

jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => mockUseApiError(),
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../auth/appShell", () => ({
  AuthModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }) => {
    mockAuthModalProps = props;
    return (
      <section data-testid="auth-modal" data-open={String(props.isOpen)}>
        {props.isOpen && (
          <>
            <button type="button" onClick={props.onClose}>
              close auth
            </button>
            <button type="button" onClick={props.onSuccess}>
              legacy auth success
            </button>
          </>
        )}
      </section>
    );
  },
}));

jest.mock("../reviews/appShell", () => ({
  ...jest.requireActual("../reviews/appShell"),
  ReviewModal: ({
    isOpen,
    totalCount,
  }: {
    isOpen: boolean;
    totalCount: number;
  }) => (
    <section
      data-testid="review-modal"
      data-open={String(isOpen)}
      data-total-count={totalCount}
    />
  ),
}));

jest.mock("../wishlist/appShell", () => ({
  WishlistModal: (props: {
    accommodationId: number;
    commands: WishlistModalCommandPort;
    isOpen: boolean;
    onClose: () => void;
    scope: AuthenticatedSessionScope;
  }) => {
    mockWishlistModalProps = props;
    return (
      <section
        data-testid="wishlist-modal"
        data-accommodation-id={props.accommodationId}
        data-open={String(props.isOpen)}
      >
        {props.isOpen && (
          <button type="button" onClick={props.onClose}>
            close wishlist
          </button>
        )}
      </section>
    );
  },
}));

jest.mock("./components/AccommodationBookingCard", () => ({
  AccommodationBookingCard: (props: MockBookingCardProps) => {
    mockBookingCardProps = props;

    return (
      <aside data-testid="booking-card">
        <div>{props.bookingView.basePriceLabel}</div>
        <div>{`${props.bookingState.nights}박`}</div>
        <div>{`결제 금액 ${props.bookingState.payablePrice.toLocaleString()}`}</div>
        <button type="button" onClick={props.bookingActions.onReserve}>
          예약하기
        </button>
      </aside>
    );
  },
}));

jest.mock("./components/AccommodationDescriptionModal", () => ({
  AccommodationDescriptionModal: ({
    description,
    isOpen,
  }: {
    description: string;
    isOpen: boolean;
  }) => (
    <section data-testid="description-modal" data-open={String(isOpen)}>
      {description}
    </section>
  ),
}));

jest.mock("./components/AccommodationHero", () => ({
  __esModule: true,
  default: ({
    detailView,
    onOpenGallery,
    onSave,
  }: {
    detailView: { title: string };
    onOpenGallery: (imageIndex: number) => void;
    onSave: () => void;
  }) => (
    <section data-testid="accommodation-hero">
      <h1>{detailView.title}</h1>
      <button type="button" onClick={onSave}>
        저장
      </button>
      <button type="button" onClick={() => onOpenGallery(0)}>
        사진 보기
      </button>
    </section>
  ),
}));

jest.mock("./components/AccommodationImageGalleryModal", () => ({
  AccommodationImageGalleryModal: ({
    accommodationName,
    isOpen,
  }: {
    accommodationName: string;
    isOpen: boolean;
  }) => (
    <section data-testid="image-gallery-modal" data-open={String(isOpen)}>
      {accommodationName}
    </section>
  ),
}));

jest.mock("./components/AccommodationLocationSection", () => ({
  AccommodationLocationSection: ({
    detailView,
  }: {
    detailView: { locationLabel: string };
  }) => (
    <section data-testid="location-section">
      {detailView.locationLabel}
    </section>
  ),
}));

jest.mock("./components/AccommodationOverview", () => ({
  AccommodationOverview: ({
    detailView,
    onOpenDescription,
  }: {
    detailView: { description: string };
    onOpenDescription: () => void;
  }) => (
    <section data-testid="overview-section">
      <p>{detailView.description}</p>
      <button type="button" onClick={onOpenDescription}>
        설명 더 보기
      </button>
    </section>
  ),
}));

jest.mock("./components/AccommodationReviewsSection", () => ({
  AccommodationReviewsSection: ({
    onOpenReviews,
    reviewSummary,
    reviews,
  }: {
    onOpenReviews: () => void;
    reviewSummary: {
      averageRating: number;
      reviewCount: number;
    };
    reviews: unknown[];
  }) => (
    <section data-testid="reviews-section">
      <h2>{`후기 ${reviewSummary.reviewCount}개`}</h2>
      <div>{`평점 ${reviewSummary.averageRating}`}</div>
      <div>{`표시 리뷰 ${reviews.length}개`}</div>
      <button type="button" onClick={onOpenReviews}>
        후기 모두 보기
      </button>
    </section>
  ),
}));

jest.mock("./hooks/useAccommodationBooking", () => ({
  useAccommodationBooking: (options: unknown) =>
    mockUseAccommodationBooking(options),
}));

jest.mock("./hooks/useAccommodationCoupons", () => ({
  useAccommodationCoupons: (options: unknown) =>
    mockUseAccommodationCoupons(options),
}));

jest.mock("./hooks/useAccommodationDetail", () => ({
  useAccommodationDetail: (options: unknown) =>
    mockUseAccommodationDetail(options),
}));

jest.mock("./hooks/useAccommodationImageGallery", () => ({
  useAccommodationImageGallery: (options: unknown) =>
    mockUseAccommodationImageGallery(options),
}));

jest.mock("./hooks/useAccommodationReviews", () => ({
  useAccommodationReviews: (options: unknown) =>
    mockUseAccommodationReviews(options),
}));

const accommodation: AccommodationDetail = {
  id: 7,
  name: "남산 전망 숙소",
  description: "서울 중심의 조용한 숙소입니다.",
  type: "APARTMENT",
  base_price: 120000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: [],
  is_in_wishlist: false,
  address_summary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "중구",
  },
  coordinate: {
    latitude: 37.5512,
    longitude: 126.9882,
  },
  host: {
    id: 10,
    nickname: "호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
  },
  amenities: [],
  images: [
    { id: 1, image_url: "/images/hero-1.jpg" },
    { id: 2, image_url: "/images/hero-2.jpg" },
  ],
  review_summary: {
    total_count: 12,
    average_rating: 4.8,
  },
};

const review: ReviewInfo = {
  id: 3,
  rating: 5,
  content: "다시 방문하고 싶은 숙소입니다.",
  reviewed_at: "2026-07-01T00:00:00",
  reviewer: {
    id: 20,
    nickname: "게스트",
    thumbnail_image_url: null,
  },
  images: [],
};

const createAuthIntentGeneration = (
  intent: AccommodationDetailAuthIntent,
  isCurrent = true,
): AccommodationDetailAuthIntentGeneration => ({
  generation: 23,
  intent,
  isCurrent: jest.fn(() => isCurrent),
});

const createAuthIntentController = (
  generation: AccommodationDetailAuthIntentGeneration | null = null,
): AccommodationDetailAuthIntentController => ({
  generation,
  request: mockRequestAuthIntent,
  cancelPending: mockCancelAuthIntent,
});

const detailRouteElement = (
  authIntent = createAuthIntentController(),
  membership: typeof wishlistMembership | null = wishlistMembership,
) => (
    <AccommodationDetailRoute
      authIntent={authIntent}
      accommodationId="7"
      bookingSearchParams={
        new URLSearchParams(
          "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
        )
      }
      setBookingSearchParams={jest.fn()}
      navigate={jest.fn()}
      wishlistMembership={membership ?? undefined}
    />
  );

const renderDetailRoute = (
  authIntent = createAuthIntentController(),
  membership: typeof wishlistMembership | null = wishlistMembership,
) => render(detailRouteElement(authIntent, membership));

describe("AccommodationDetailRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthModalProps = undefined;
    mockWishlistModalProps = undefined;
    mockRequestAuthIntent.mockReturnValue(true);
    mockBookingCardProps = undefined as unknown as MockBookingCardProps;
    mockUseApiError.mockReturnValue({
      error: null,
      handleError: jest.fn(),
      clearError: jest.fn(),
    });
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseAccommodationDetail.mockReturnValue({
      accommodation,
      isLoading: false,
      reloadAccommodation: mockReloadAccommodation,
    });
    mockUseAccommodationBooking.mockReturnValue({
      adultCount: 2,
      setAdultCount: jest.fn(),
      childCount: 0,
      setChildCount: jest.fn(),
      infantCount: 0,
      setInfantCount: jest.fn(),
      petCount: 0,
      setPetCount: jest.fn(),
      isGuestPickerOpen: false,
      setIsGuestPickerOpen: jest.fn(),
      isDatePickerOpen: false,
      setIsDatePickerOpen: jest.fn(),
      checkIn: new Date(2026, 6, 10),
      checkOut: new Date(2026, 6, 12),
      nights: 2,
      totalPrice: 240000,
      formatDate: (date: Date | null) =>
        date
          ? `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(
              2,
              "0"
            )}. ${String(date.getDate()).padStart(2, "0")}.`
          : "",
      handleDateSelect: jest.fn(),
      handleReserve: mockHandleReserve,
      isReserving: false,
    });
    mockUseAccommodationCoupons.mockReturnValue({
      coupons: [],
      isLoadingCoupons: false,
      selectedCoupon: null,
      selectedCouponId: null,
      setSelectedCouponId: jest.fn(),
      issuingCouponId: null,
      couponDiscount: 0,
      payablePrice: 240000,
      handleIssueCoupon: mockHandleIssueCoupon,
    });
    mockUseAccommodationReviews.mockReturnValue({
      reviews: [review],
      allReviews: [review],
      isReviewModalOpen: false,
      setIsReviewModalOpen: jest.fn(),
      expandedReviews: {},
    });
    mockUseAccommodationImageGallery.mockReturnValue({
      currentImageIndex: 0,
      setCurrentImageIndex: jest.fn(),
      mobileSlideIndex: 0,
      setMobileSlideIndex: jest.fn(),
      isImageGalleryOpen: false,
      openGallery: jest.fn(),
      closeGallery: jest.fn(),
      onTouchStart: jest.fn(),
      onTouchMove: jest.fn(),
      onTouchEnd: jest.fn(),
    });
  });

  it("passes grouped booking and coupon boundaries to the booking card", () => {
    renderDetailRoute();

    expect(mockBookingCardProps).toMatchObject({
      bookingState: expect.any(Object),
      bookingActions: expect.any(Object),
      couponState: expect.any(Object),
      couponActions: expect.any(Object),
    });
    expect(mockBookingCardProps.bookingState).toMatchObject({
      payablePrice: 240000,
      nights: 2,
    });
    expect(mockBookingCardProps.couponState).toMatchObject({
      couponDiscount: 0,
    });
    expect(mockBookingCardProps.bookingActions.onReserve).toEqual(
      expect.any(Function)
    );
    expect(mockBookingCardProps.coupons).toBeUndefined();
    expect(mockBookingCardProps.isLoadingCoupons).toBeUndefined();
    expect(mockBookingCardProps.selectedCoupon).toBeUndefined();
    expect(mockBookingCardProps.selectedCouponId).toBeUndefined();
    expect(mockBookingCardProps.setSelectedCouponId).toBeUndefined();
    expect(mockBookingCardProps.issuingCouponId).toBeUndefined();
    expect(mockBookingCardProps.couponDiscount).toBeUndefined();
    expect(mockBookingCardProps.handleIssueCoupon).toBeUndefined();
  });

  it("renders the loaded route shell with save, booking, overview, and reviews", () => {
    renderDetailRoute();

    expect(screen.getByTestId("accommodation-hero")).toContainElement(
      screen.getByRole("heading", { name: "남산 전망 숙소" })
    );
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    expect(screen.getByTestId("booking-card")).toHaveTextContent("₩120,000");
    expect(screen.getByTestId("booking-card")).toHaveTextContent("2박");
    expect(
      screen.getByRole("button", { name: "예약하기" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("overview-section")).toHaveTextContent(
      "서울 중심의 조용한 숙소입니다."
    );
    expect(screen.getByTestId("reviews-section")).toHaveTextContent("후기 12개");
    expect(screen.getByTestId("reviews-section")).toHaveTextContent("평점 4.8");
    expect(screen.getByTestId("location-section")).toHaveTextContent(
      "서울, 대한민국"
    );

    fireEvent.click(screen.getByRole("button", { name: "예약하기" }));

    expect(mockHandleReserve).toHaveBeenCalledWith({
      selectedCoupon: null,
      selectedCouponId: null,
      couponDiscount: 0,
    });
  });

  it("passes the current membership boundary and closes without reloading detail", () => {
    renderDetailRoute();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(mockWishlistModalProps).toMatchObject({
      accommodationId: 7,
      commands: wishlistCommands,
      scope: wishlistScope,
    });

    fireEvent.click(screen.getByRole("button", { name: "close wishlist" }));

    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
    expect(mockReloadAccommodation).not.toHaveBeenCalled();
    expect(wishlistCommands.addAccommodation).not.toHaveBeenCalled();
    expect(wishlistCommands.removeAccommodation).not.toHaveBeenCalled();
    expect(wishlistCommands.createAndAddAccommodation).not.toHaveBeenCalled();
  });

  it("does not render wishlist UI without a current injected membership boundary", () => {
    renderDetailRoute(createAuthIntentController(), null);

    expect(screen.queryByTestId("wishlist-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.queryByTestId("wishlist-modal")).not.toBeInTheDocument();
    expect(mockWishlistModalProps).toBeUndefined();
  });

  it("registers wishlist auth as data and leaves legacy AuthModal success domain-free", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    renderDetailRoute();

    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-open",
      "false"
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "false"
    );

    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(mockRequestAuthIntent).toHaveBeenCalledWith({
      type: "wishlist.open",
      accommodationId: 7,
    });

    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "false"
    );

    expect(mockAuthModalProps?.onSuccess).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "legacy auth success" }));

    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "false"
    );
  });

  it("cancels the exact pending auth intent when the modal is dismissed", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    renderDetailRoute();

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    fireEvent.click(screen.getByRole("button", { name: "close auth" }));

    expect(mockCancelAuthIntent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("opens the wishlist exactly for a current claimed generation", async () => {
    renderDetailRoute(
      createAuthIntentController(
        createAuthIntentGeneration({
          type: "wishlist.open",
          accommodationId: 7,
        }),
      ),
    );

    await waitFor(() =>
      expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
        "data-open",
        "true",
      ),
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-accommodation-id",
      "7",
    );
  });

  it("executes a matching reservation generation once across rerenders", async () => {
    const generation = createAuthIntentGeneration({
      type: "reservation.start",
      accommodationId: 7,
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      petCount: 0,
      couponId: null,
    });
    const controller = createAuthIntentController(generation);
    const view = renderDetailRoute(controller);

    await waitFor(() => expect(mockHandleReserve).toHaveBeenCalledTimes(1));
    view.rerender(detailRouteElement(controller));

    expect(mockHandleReserve).toHaveBeenCalledTimes(1);
    expect(mockHandleReserve).toHaveBeenCalledWith(
      {
        selectedCoupon: null,
        selectedCouponId: null,
        couponDiscount: 0,
      },
      generation,
    );
  });

  it("executes a matching coupon issue generation with the current coupon", async () => {
    const coupon: CouponInfo = {
      id: 31,
      name: "신규 쿠폰",
      description: null,
      discount_type: "FIXED_AMOUNT",
      discount_value: 10000,
      min_payment_price: null,
      max_discount_amount: null,
      start_date: "2026-07-01",
      end_date: "2026-12-31",
      total_quantity: null,
      issued_quantity: 0,
    };
    const handleIssueCoupon = jest.fn();
    mockUseAccommodationCoupons.mockReturnValue({
      coupons: [coupon],
      isLoadingCoupons: false,
      selectedCoupon: null,
      selectedCouponId: null,
      setSelectedCouponId: jest.fn(),
      issuingCouponId: null,
      couponDiscount: 0,
      payablePrice: 240000,
      handleIssueCoupon,
    });
    const generation = createAuthIntentGeneration({
      type: "coupon.issue",
      accommodationId: 7,
      couponId: coupon.id,
    });

    renderDetailRoute(createAuthIntentController(generation));

    await waitFor(() =>
      expect(handleIssueCoupon).toHaveBeenCalledWith(coupon, generation),
    );
  });

  it.each([
    [
      "stale session",
      createAuthIntentGeneration(
        { type: "wishlist.open", accommodationId: 7 },
        false,
      ),
    ],
    [
      "resource mismatch",
      createAuthIntentGeneration({
        type: "reservation.start",
        accommodationId: 8,
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        adultCount: 2,
        childCount: 0,
        infantCount: 0,
        petCount: 0,
        couponId: null,
      }),
    ],
  ])("does no domain work for a %s generation", async (_case, generation) => {
    renderDetailRoute(createAuthIntentController(generation));

    await Promise.resolve();

    expect(mockHandleReserve).not.toHaveBeenCalled();
    expect(mockHandleIssueCoupon).not.toHaveBeenCalled();
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });
});
