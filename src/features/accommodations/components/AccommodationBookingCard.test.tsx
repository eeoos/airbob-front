import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AccommodationBookingCouponViewModel } from "../lib/accommodationBookingSectionsViewModel";
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

const coupon: AccommodationBookingCouponViewModel = {
  actionLabel: "적용 중",
  discount: 10000,
  id: 3,
  isApplicable: true,
  isIssuing: false,
  isSelected: true,
  metadataLabel: "10,000원 할인 · 남은 수량 8장",
  name: "만원 쿠폰",
};

type BookingCardProps = React.ComponentProps<typeof AccommodationBookingCard>;
type BookingCardOverrides = Partial<
  Omit<
    BookingCardProps,
    "bookingActions" | "bookingState" | "couponActions" | "couponState"
  >
> & {
  bookingActions?: Partial<BookingCardProps["bookingActions"]>;
  bookingState?: Partial<BookingCardProps["bookingState"]>;
  couponActions?: Partial<BookingCardProps["couponActions"]>;
  couponState?: Partial<BookingCardProps["couponState"]>;
};

const createBookingCardProps = (): BookingCardProps => ({
    bookingView,
    isAuthenticated: true,
    bookingState: {
      payablePrice: 190000,
      nights: 2,
      totalPrice: 200000,
      checkIn: new Date(2026, 6, 10),
      checkOut: new Date(2026, 6, 12),
      dateSectionRef: React.createRef<HTMLDivElement>(),
      datePickerRef: React.createRef<HTMLDivElement>(),
      guestPickerRef: React.createRef<HTMLDivElement>(),
      isDatePickerOpen: false,
      isGuestPickerOpen: false,
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      petCount: 0,
      isReserving: false,
    },
    bookingActions: {
      formatDate: (date) =>
        date
          ? `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(
              2,
              "0"
            )}. ${String(date.getDate()).padStart(2, "0")}.`
          : "",
      handleDateSelect: jest.fn(),
      setIsDatePickerOpen: jest.fn(),
      setIsGuestPickerOpen: jest.fn(),
      setAdultCount: jest.fn(),
      setChildCount: jest.fn(),
      setInfantCount: jest.fn(),
      setPetCount: jest.fn(),
      onReserve: jest.fn(),
    },
    couponState: {
      coupons: [coupon],
      isLoadingCoupons: false,
      selectedCoupon: coupon,
      couponDiscount: 10000,
    },
    couponActions: {
      setSelectedCouponId: jest.fn(),
      handleIssueCoupon: jest.fn(),
    },
});

const renderBookingCard = (overrides: BookingCardOverrides = {}) => {
  const baseProps = createBookingCardProps();
  const props: BookingCardProps = {
    ...baseProps,
    ...overrides,
    bookingState: {
      ...baseProps.bookingState,
      ...overrides.bookingState,
    },
    bookingActions: {
      ...baseProps.bookingActions,
      ...overrides.bookingActions,
    },
    couponState: {
      ...baseProps.couponState,
      ...overrides.couponState,
    },
    couponActions: {
      ...baseProps.couponActions,
      ...overrides.couponActions,
    },
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

    expect(props.bookingActions.onReserve).toHaveBeenCalledTimes(1);
  });

  it("exposes date and guest pickers through semantic disclosure buttons", () => {
    renderBookingCard({
      bookingState: {
        isDatePickerOpen: true,
        isGuestPickerOpen: true,
      },
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
    renderBookingCard({
      bookingState: { isDatePickerOpen: true },
      bookingActions: { setIsDatePickerOpen },
    });

    expect(screen.getByTestId("date-picker")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close date picker" }));

    expect(setIsDatePickerOpen).toHaveBeenCalledWith(false);
  });

  it("updates guest counts through guest picker controls", () => {
    const setAdultCount = jest.fn();
    renderBookingCard({
      bookingState: { isGuestPickerOpen: true },
      bookingActions: { setAdultCount },
    });

    expect(
      screen.getByRole("button", { name: "성인 줄이기" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "성인 늘리기" }));

    expect(setAdultCount).toHaveBeenCalledWith(3);
  });

  it("uses booking view guest limits to bound guest picker controls", () => {
    renderBookingCard({
      bookingState: {
        adultCount: 2,
        childCount: 1,
        isGuestPickerOpen: true,
      },
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
      couponState: {
        selectedCoupon: coupon,
      },
      couponActions: {
        setSelectedCouponId,
        handleIssueCoupon,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "해제" }));
    fireEvent.click(screen.getByRole("button", { name: "적용 중" }));

    expect(setSelectedCouponId).toHaveBeenCalledWith(null);
    expect(handleIssueCoupon).toHaveBeenCalledWith(coupon);
  });

  it("disables the reserve button while a reservation is being created", () => {
    const props = renderBookingCard({ bookingState: { isReserving: true } });

    const reserveButton = screen.getByRole("button", { name: "예약 중..." });

    expect(reserveButton).toBeDisabled();

    fireEvent.click(reserveButton);

    expect(props.bookingActions.onReserve).not.toHaveBeenCalled();
  });
});
