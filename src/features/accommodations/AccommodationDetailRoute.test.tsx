import { fireEvent, render, screen } from "@testing-library/react";
import type { AccommodationDetail } from "../../types/accommodation";
import type { ReviewInfo } from "../../types/review";
import { AccommodationDetailRoute } from "./AccommodationDetailRoute";

const mockUseApiError = jest.fn();
const mockUseAuth = jest.fn();
const mockUseAccommodationBooking = jest.fn();
const mockUseAccommodationCoupons = jest.fn();
const mockUseAccommodationDetail = jest.fn();
const mockUseAccommodationImageGallery = jest.fn();
const mockUseAccommodationReviews = jest.fn();
const mockHandleReserve = jest.fn();
const mockReloadAccommodation = jest.fn();
let mockBookingCardProps: {
  bookingView: {
    basePriceLabel: string;
  };
  bookingState?: {
    nights: number;
  };
  bookingActions?: {
    onReserve: () => void;
  };
  couponState?: {
    payablePrice: number;
  };
  couponActions?: object;
  nights?: number;
  onReserve?: () => void;
  payablePrice?: number;
  selectedCouponId?: number | null;
  setSelectedCouponId?: (couponId: number | null) => void;
};

jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => mockUseApiError(),
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../auth/appShell", () => ({
  AuthModal: ({
    isOpen,
    onClose,
    onSuccess,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
  }) => (
    <section data-testid="auth-modal" data-open={String(isOpen)}>
      {isOpen && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onSuccess?.();
          }}
        >
          auth success
        </button>
      )}
    </section>
  ),
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
  WishlistModal: ({
    accommodationId,
    isOpen,
    onClose,
    onSuccess,
  }: {
    accommodationId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void | Promise<void>;
  }) => (
    <section
      data-testid="wishlist-modal"
      data-accommodation-id={accommodationId}
      data-open={String(isOpen)}
    >
      {isOpen && (
        <>
          <button type="button" onClick={onClose}>
            close wishlist
          </button>
          <button type="button" onClick={onSuccess}>
            wishlist success
          </button>
        </>
      )}
    </section>
  ),
}));

jest.mock("./components/AccommodationBookingCard", () => ({
  AccommodationBookingCard: (
    props: typeof mockBookingCardProps,
  ) => {
    mockBookingCardProps = props;
    const nights = props.bookingState?.nights ?? props.nights ?? 0;
    const payablePrice =
      props.couponState?.payablePrice ?? props.payablePrice ?? 0;
    const onReserve =
      props.bookingActions?.onReserve ?? props.onReserve ?? jest.fn();

    return (
      <aside data-testid="booking-card">
        <div>{props.bookingView.basePriceLabel}</div>
        <div>{`${nights}박`}</div>
        <div>{`결제 금액 ${payablePrice.toLocaleString()}`}</div>
        <button type="button" onClick={onReserve}>
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

const renderDetailRoute = () =>
  render(
    <AccommodationDetailRoute
      accommodationId="7"
      bookingSearchParams={
        new URLSearchParams(
          "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
        )
      }
      setBookingSearchParams={jest.fn()}
      navigate={jest.fn()}
    />
  );

describe("AccommodationDetailRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBookingCardProps = undefined as unknown as typeof mockBookingCardProps;
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
      handleIssueCoupon: jest.fn(),
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
    expect(mockBookingCardProps.selectedCouponId).toBeUndefined();
    expect(mockBookingCardProps.setSelectedCouponId).toBeUndefined();
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

  it("opens auth for unauthenticated wishlist saves and resumes the pending wishlist modal after auth success", () => {
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

    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "false"
    );

    fireEvent.click(screen.getByRole("button", { name: "auth success" }));

    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-open",
      "false"
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("wishlist-modal")).toHaveAttribute(
      "data-accommodation-id",
      "7"
    );
  });
});
