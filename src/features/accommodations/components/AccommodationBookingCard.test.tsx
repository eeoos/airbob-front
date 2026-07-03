import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AccommodationDetail } from "../../../types/accommodation";
import { CouponInfo } from "../../../types/coupon";
import { AccommodationBookingCard } from "./AccommodationBookingCard";

jest.mock("../../../components/DatePicker/DatePicker", () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="date-picker">
      <button type="button" onClick={onClose}>
        close date picker
      </button>
    </div>
  ),
}));

const accommodation: AccommodationDetail = {
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "APARTMENT",
  base_price: 100000,
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
    latitude: 37.5,
    longitude: 127,
  },
  host: {
    id: 1,
    nickname: "호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
  },
  amenities: [],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

const coupon: CouponInfo = {
  id: 3,
  name: "만원 쿠폰",
  description: null,
  discount_type: "FIXED_AMOUNT",
  discount_value: 10000,
  min_payment_price: null,
  max_discount_amount: null,
  start_date: "2026-07-01",
  end_date: "2026-07-31",
  total_quantity: 10,
  issued_quantity: 2,
};

const renderBookingCard = (
  overrides: Partial<
    React.ComponentProps<typeof AccommodationBookingCard>
  > = {}
) => {
  const props: React.ComponentProps<typeof AccommodationBookingCard> = {
    accommodation,
    isAuthenticated: true,
    payablePrice: 190000,
    nights: 2,
    totalPrice: 200000,
    checkIn: new Date(2026, 6, 10),
    checkOut: new Date(2026, 6, 12),
    formatDate: (date) =>
      date
        ? `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(
            2,
            "0"
          )}. ${String(date.getDate()).padStart(2, "0")}.`
        : "",
    handleDateSelect: jest.fn(),
    dateSectionRef: React.createRef<HTMLDivElement>(),
    datePickerRef: React.createRef<HTMLDivElement>(),
    guestPickerRef: React.createRef<HTMLDivElement>(),
    isDatePickerOpen: false,
    setIsDatePickerOpen: jest.fn(),
    isGuestPickerOpen: false,
    setIsGuestPickerOpen: jest.fn(),
    adultCount: 2,
    setAdultCount: jest.fn(),
    childCount: 1,
    setChildCount: jest.fn(),
    infantCount: 0,
    setInfantCount: jest.fn(),
    petCount: 0,
    setPetCount: jest.fn(),
    coupons: [coupon],
    isLoadingCoupons: false,
    selectedCoupon: coupon,
    selectedCouponId: coupon.id,
    setSelectedCouponId: jest.fn(),
    issuingCouponId: null,
    couponDiscount: 10000,
    handleIssueCoupon: jest.fn(),
    isReserving: false,
    onReserve: jest.fn(),
    ...overrides,
  };

  render(<AccommodationBookingCard {...props} />);

  return props;
};

describe("AccommodationBookingCard", () => {
  it("renders booking price, dates, guest summary, coupon, and reserve action", () => {
    const props = renderBookingCard();

    expect(screen.getByText("₩190,000")).toBeInTheDocument();
    expect(screen.getByText("· 2박")).toBeInTheDocument();
    expect(screen.getByText("2026. 07. 10.")).toBeInTheDocument();
    expect(screen.getByText("2026. 07. 12.")).toBeInTheDocument();
    expect(screen.getByText("게스트 3명")).toBeInTheDocument();
    expect(screen.getAllByText("만원 쿠폰")).toHaveLength(2);
    expect(screen.getByText("-₩10,000")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "예약하기" }));

    expect(props.onReserve).toHaveBeenCalledTimes(1);
  });

  it("opens date picker through controlled state and closes via DatePicker callback", () => {
    const setIsDatePickerOpen = jest.fn();
    renderBookingCard({ isDatePickerOpen: true, setIsDatePickerOpen });

    expect(screen.getByTestId("date-picker")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close date picker" }));

    expect(setIsDatePickerOpen).toHaveBeenCalledWith(false);
  });

  it("updates guest counts through guest picker controls", () => {
    const setAdultCount = jest.fn();
    renderBookingCard({
      isGuestPickerOpen: true,
      setAdultCount,
    });

    fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);

    expect(setAdultCount).toHaveBeenCalledWith(3);
  });

  it("clears and applies coupons from the booking card", () => {
    const setSelectedCouponId = jest.fn();
    const handleIssueCoupon = jest.fn();
    renderBookingCard({
      selectedCoupon: coupon,
      selectedCouponId: coupon.id,
      setSelectedCouponId,
      handleIssueCoupon,
    });

    fireEvent.click(screen.getByRole("button", { name: "해제" }));
    fireEvent.click(screen.getByRole("button", { name: "적용 중" }));

    expect(setSelectedCouponId).toHaveBeenCalledWith(null);
    expect(handleIssueCoupon).toHaveBeenCalledWith(coupon);
  });

  it("disables the reserve button while a reservation is being created", () => {
    const props = renderBookingCard({ isReserving: true });

    const reserveButton = screen.getByRole("button", { name: "예약 중..." });

    expect(reserveButton).toBeDisabled();

    fireEvent.click(reserveButton);

    expect(props.onReserve).not.toHaveBeenCalled();
  });
});
