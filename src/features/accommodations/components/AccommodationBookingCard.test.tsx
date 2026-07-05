import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CouponInfo } from "../../../types/coupon";
import type { AccommodationBookingViewModel } from "../lib/accommodationBookingViewModel";
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

const bookingView: AccommodationBookingViewModel = {
  basePrice: 100000,
  basePriceLabel: "₩100,000",
  unavailableDates: [],
  guestLimits: {
    maxAdultsAndChildren: 4,
    maxInfants: 1,
    maxPets: 0,
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
    bookingView,
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
    expect(screen.getByText("2박 x ₩100,000")).toBeInTheDocument();
    expect(screen.getByText("-₩10,000")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "예약하기" }));

    expect(props.onReserve).toHaveBeenCalledTimes(1);
  });

  it("exposes date and guest pickers through semantic disclosure buttons", () => {
    renderBookingCard({
      isDatePickerOpen: true,
      isGuestPickerOpen: true,
    });

    const dateButton = screen.getByRole("button", { name: /체크인/ });
    const guestButton = screen.getByRole("button", { name: /인원/ });

    expect(dateButton).toHaveAttribute("type", "button");
    expect(dateButton).toHaveAttribute("aria-expanded", "true");
    expect(dateButton).toHaveAttribute("aria-controls", "booking-date-picker");
    expect(document.getElementById("booking-date-picker")).toContainElement(
      screen.getByTestId("date-picker")
    );

    expect(guestButton).toHaveAttribute("type", "button");
    expect(guestButton).toHaveAttribute("aria-expanded", "true");
    expect(guestButton).toHaveAttribute(
      "aria-controls",
      "booking-guest-picker"
    );
    expect(document.getElementById("booking-guest-picker")).toContainElement(
      screen.getByText("성인")
    );
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

    expect(
      screen.getByRole("button", { name: "성인 줄이기" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "성인 늘리기" }));

    expect(setAdultCount).toHaveBeenCalledWith(3);
  });

  it("uses booking view guest limits to bound guest picker controls", () => {
    renderBookingCard({
      adultCount: 2,
      childCount: 1,
      isGuestPickerOpen: true,
      bookingView: {
        ...bookingView,
        guestLimits: {
          maxAdultsAndChildren: 3,
          maxInfants: 0,
          maxPets: 0,
        },
      },
    });

    expect(screen.getByRole("button", { name: "성인 늘리기" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "어린이 늘리기" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "유아 늘리기" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "반려동물 늘리기" })
    ).toBeDisabled();
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
