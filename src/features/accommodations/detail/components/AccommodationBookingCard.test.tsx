import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AccommodationBookingCouponViewModel } from "../lib/accommodationBookingSectionsViewModel";
import type { AccommodationBookingViewModel } from "../lib/accommodationBookingViewModel";
import { AccommodationBookingCard } from "./AccommodationBookingCard";

vi.mock("../../../../shared/ui", async () => {
  const actual = await vi.importActual<typeof import("../../../../shared/ui")>(
    "../../../../shared/ui",
  );

  return {
    ...actual,
    DatePicker: ({
      onClose,
      onEscape,
    }: {
      onClose: () => void;
      onEscape?: () => void;
    }) => (
      <div
        data-testid="date-picker"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            (onEscape ?? onClose)();
          }
        }}
      >
        <button type="button">date picker focus target</button>
        <button type="button" onClick={onClose}>
          close date picker
        </button>
      </div>
    ),
  };
});

const bookingView: AccommodationBookingViewModel = {
  basePrice: 100000,
  basePriceLabel: "₩100,000",
  availability: {
    selectionWindow: {
      startInclusive: "2026-07-10",
      endExclusive: "2027-07-10",
    },
    disabledRanges: [],
  },
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
    availabilityStatus: "ready",
    isStayReady: true,
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
    isReservationLocked: false,
    isReserving: false,
    quoteSnapshot: null,
    reservationStatus: "idle",
    selectionLocked: false,
    selectionState: "ready",
  },
  bookingActions: {
    formatDate: (date) =>
      date
        ? `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(
            2,
            "0",
          )}. ${String(date.getDate()).padStart(2, "0")}.`
        : "",
    handleDateSelect: vi.fn(),
    onDatePickerOpenChange: vi.fn(),
    onGuestPickerOpenChange: vi.fn(),
    onAdultCountChange: vi.fn(),
    onChildCountChange: vi.fn(),
    onInfantCountChange: vi.fn(),
    onPetCountChange: vi.fn(),
    onAbandonQuote: vi.fn(() => true),
    onReserve: vi.fn(),
    retryAvailability: vi.fn(),
  },
  couponState: {
    coupons: [coupon],
    errorMessage: null,
    isLoadingCoupons: false,
    selectedCoupon: coupon,
    couponDiscount: 10000,
  },
  couponActions: {
    onSelectedCouponIdChange: vi.fn(),
    handleIssueCoupon: vi.fn(),
  },
});

const setupBookingCard = (overrides: BookingCardOverrides = {}) => {
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
    const bookingProps = setupBookingCard();

    expect(screen.getByText("₩190,000")).toBeInTheDocument();
    expect(screen.getByText("· 2박")).toBeInTheDocument();
    expect(screen.getByText("2026. 07. 10.")).toBeInTheDocument();
    expect(screen.getByText("2026. 07. 12.")).toBeInTheDocument();
    expect(screen.getByText("게스트 3명")).toBeInTheDocument();
    expect(screen.getAllByText("만원 쿠폰")).toHaveLength(2);
    expect(screen.getByText("2박 x ₩100,000")).toBeInTheDocument();
    expect(screen.getByText("-₩10,000")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "예약하기" }));

    expect(bookingProps.bookingActions.onReserve).toHaveBeenCalledTimes(1);
  });

  it("fails date and reserve controls closed and retries an availability error", () => {
    const retryAvailability = vi.fn();
    setupBookingCard({
      bookingState: { availabilityStatus: "error" },
      bookingActions: { retryAvailability },
      bookingView: {
        ...bookingView,
        availability: { selectionWindow: null, disabledRanges: [] },
      },
    });

    expect(screen.getByRole("button", { name: /체크인/ })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "예약 가능 날짜 확인 필요" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "예약 가능한 날짜를 불러오지 못했습니다.",
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retryAvailability).toHaveBeenCalledTimes(1);
  });

  it("disables reservation with accurate copy when no stay is available", () => {
    setupBookingCard({
      bookingState: {
        checkIn: null,
        checkOut: null,
        isStayReady: false,
        nights: 0,
        payablePrice: 0,
        selectionState: "fully-booked",
        totalPrice: 0,
      },
    });

    expect(
      screen.getByRole("button", { name: "예약 가능한 날짜 없음" }),
    ).toBeDisabled();
  });

  it.each([
    ["incomplete", "체크인·체크아웃 선택"],
    ["invalid", "예약 날짜 다시 선택"],
    ["outside-window", "예약 날짜 다시 선택"],
    ["unavailable", "예약 날짜 다시 선택"],
  ] as const)(
    "disables a %s stay with corrective reserve copy",
    (selectionState, label) => {
      setupBookingCard({
        bookingState: {
          checkOut:
            selectionState === "incomplete" ? null : new Date(2026, 6, 12),
          isStayReady: false,
          selectionState,
        },
      });

      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    },
  );

  it("does not trust a ready label without complete positive-night endpoints", () => {
    setupBookingCard({
      bookingState: {
        checkOut: null,
        isStayReady: true,
        nights: 0,
        selectionState: "ready",
      },
    });

    expect(
      screen.getByRole("button", { name: "체크인·체크아웃 선택" }),
    ).toBeDisabled();
  });

  it.each([
    ["loading", "status"],
    ["error", "alert"],
  ] as const)(
    "immediately unmounts an open date picker and restores focus when availability becomes %s",
    (availabilityStatus, statusRole) => {
      const props = createBookingCardProps();
      const view = render(
        <AccommodationBookingCard
          {...props}
          bookingState={{ ...props.bookingState, isDatePickerOpen: true }}
        />,
      );
      expect(screen.getByTestId("date-picker")).toBeInTheDocument();
      screen.getByRole("button", { name: "date picker focus target" }).focus();

      view.rerender(
        <AccommodationBookingCard
          {...props}
          bookingState={{
            ...props.bookingState,
            availabilityStatus,
            isDatePickerOpen: true,
            isStayReady: false,
          }}
        />,
      );

      expect(screen.queryByTestId("date-picker")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /체크인/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      expect(
        screen.getByRole(statusRole, { name: "예약 가능 여부" }),
      ).toHaveFocus();
    },
  );

  it("returns availability-owned focus to the enabled date trigger after loading completes", () => {
    const props = createBookingCardProps();
    const view = render(
      <AccommodationBookingCard
        {...props}
        bookingState={{ ...props.bookingState, isDatePickerOpen: true }}
      />,
    );
    screen.getByRole("button", { name: "date picker focus target" }).focus();

    view.rerender(
      <AccommodationBookingCard
        {...props}
        bookingState={{
          ...props.bookingState,
          availabilityStatus: "loading",
          isDatePickerOpen: true,
          isStayReady: false,
        }}
      />,
    );
    expect(
      screen.getByRole("status", { name: "예약 가능 여부" }),
    ).toHaveFocus();

    view.rerender(
      <AccommodationBookingCard
        {...props}
        bookingState={{ ...props.bookingState, isDatePickerOpen: false }}
      />,
    );

    expect(screen.getByRole("button", { name: /체크인/ })).toHaveFocus();
  });

  it.each(["ready", "error"] as const)(
    "keeps retry focus owned through loading and restores it for a %s result",
    (terminalStatus) => {
      const retryAvailability = vi.fn(() => {
        expect(
          screen.getByRole("alert", { name: "예약 가능 여부" }),
        ).toHaveFocus();
      });
      const props = createBookingCardProps();
      const view = render(
        <AccommodationBookingCard
          {...props}
          bookingActions={{ ...props.bookingActions, retryAvailability }}
          bookingState={{
            ...props.bookingState,
            availabilityStatus: "error",
            isStayReady: false,
          }}
        />,
      );
      const retryButton = screen.getByRole("button", { name: "다시 시도" });
      retryButton.focus();

      fireEvent.click(retryButton);
      expect(retryAvailability).toHaveBeenCalledTimes(1);

      view.rerender(
        <AccommodationBookingCard
          {...props}
          bookingActions={{ ...props.bookingActions, retryAvailability }}
          bookingState={{
            ...props.bookingState,
            availabilityStatus: "loading",
            isStayReady: false,
          }}
        />,
      );
      expect(
        screen.getByRole("status", { name: "예약 가능 여부" }),
      ).toHaveFocus();

      view.rerender(
        <AccommodationBookingCard
          {...props}
          bookingActions={{ ...props.bookingActions, retryAvailability }}
          bookingState={{
            ...props.bookingState,
            availabilityStatus: terminalStatus,
            isStayReady: terminalStatus === "ready",
          }}
        />,
      );

      const expectedFocusTarget =
        terminalStatus === "ready"
          ? screen.getByRole("button", { name: /체크인/ })
          : screen.getByRole("alert", { name: "예약 가능 여부" });
      expect(expectedFocusTarget).toHaveFocus();
    },
  );

  it("does not reclaim focus when the user leaves the availability status", () => {
    const props = createBookingCardProps();
    const view = render(
      <AccommodationBookingCard
        {...props}
        bookingState={{ ...props.bookingState, isDatePickerOpen: true }}
      />,
    );
    screen.getByRole("button", { name: "date picker focus target" }).focus();

    view.rerender(
      <AccommodationBookingCard
        {...props}
        bookingState={{
          ...props.bookingState,
          availabilityStatus: "loading",
          isDatePickerOpen: true,
          isStayReady: false,
        }}
      />,
    );
    const guestTrigger = screen.getByRole("button", { name: /인원/ });
    guestTrigger.focus();

    view.rerender(
      <AccommodationBookingCard
        {...props}
        bookingState={{ ...props.bookingState, isDatePickerOpen: false }}
      />,
    );

    expect(guestTrigger).toHaveFocus();
    expect(screen.getByRole("button", { name: /체크인/ })).not.toHaveFocus();
  });

  it("exposes date and guest pickers through semantic disclosure buttons", () => {
    setupBookingCard({
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
    expect(screen.getByTestId("date-picker")).toBeInTheDocument();

    expect(guestButton).toHaveAttribute("type", "button");
    expect(guestButton).toHaveAttribute("aria-expanded", "true");
    expect(guestButton).toHaveAttribute(
      "aria-controls",
      "booking-guest-picker",
    );
    expect(screen.getByText("성인")).toBeInTheDocument();
  });

  it("opens date picker through controlled state and closes via DatePicker callback", () => {
    const onDatePickerOpenChange = vi.fn();
    setupBookingCard({
      bookingState: { isDatePickerOpen: true },
      bookingActions: { onDatePickerOpenChange },
    });

    expect(screen.getByTestId("date-picker")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close date picker" }));

    expect(onDatePickerOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes the guest picker before opening the date picker", () => {
    const onDatePickerOpenChange = vi.fn();
    const onGuestPickerOpenChange = vi.fn();
    setupBookingCard({
      bookingState: {
        isDatePickerOpen: false,
        isGuestPickerOpen: true,
      },
      bookingActions: {
        onDatePickerOpenChange,
        onGuestPickerOpenChange,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /체크인/ }));

    expect(onGuestPickerOpenChange).toHaveBeenCalledWith(false);
    expect(onDatePickerOpenChange).toHaveBeenCalledWith(true);
  });

  it("closes the date picker with Escape and restores focus to its trigger", () => {
    const onDatePickerOpenChange = vi.fn();
    setupBookingCard({
      bookingState: { isDatePickerOpen: true },
      bookingActions: { onDatePickerOpenChange },
    });
    const dateTrigger = screen.getByRole("button", { name: /체크인/ });
    const datePickerTarget = screen.getByRole("button", {
      name: "date picker focus target",
    });

    datePickerTarget.focus();
    fireEvent.keyDown(datePickerTarget, { key: "Escape" });

    expect(onDatePickerOpenChange).toHaveBeenCalledWith(false);
    expect(dateTrigger).toHaveFocus();
  });

  it("updates guest counts through guest picker controls", () => {
    const onAdultCountChange = vi.fn();
    setupBookingCard({
      bookingState: { isGuestPickerOpen: true },
      bookingActions: { onAdultCountChange },
    });

    expect(
      screen.getByRole("button", { name: "성인 줄이기" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "성인 늘리기" }));

    expect(onAdultCountChange).toHaveBeenCalledWith(3);
  });

  it("closes the guest picker with Escape and restores focus to its trigger", () => {
    const onGuestPickerOpenChange = vi.fn();
    setupBookingCard({
      bookingState: { isGuestPickerOpen: true },
      bookingActions: { onGuestPickerOpenChange },
    });
    const guestTrigger = screen.getByRole("button", { name: /인원/ });
    const guestControl = screen.getByRole("button", { name: "성인 늘리기" });

    guestControl.focus();
    fireEvent.keyDown(guestControl, { key: "Escape" });

    expect(onGuestPickerOpenChange).toHaveBeenCalledWith(false);
    expect(guestTrigger).toHaveFocus();
  });

  it("uses booking view guest limits to bound guest picker controls", () => {
    setupBookingCard({
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
      screen.getByRole("button", { name: "어린이 늘리기" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "유아 늘리기" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "반려동물 늘리기" }),
    ).toBeDisabled();
  });

  it("clears and applies coupons from the booking card", () => {
    const onSelectedCouponIdChange = vi.fn();
    const handleIssueCoupon = vi.fn();
    setupBookingCard({
      couponState: {
        selectedCoupon: coupon,
      },
      couponActions: {
        onSelectedCouponIdChange,
        handleIssueCoupon,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "해제" }));
    fireEvent.click(screen.getByRole("button", { name: "적용 중" }));

    expect(onSelectedCouponIdChange).toHaveBeenCalledWith(null);
    expect(handleIssueCoupon).toHaveBeenCalledWith(coupon);
  });

  it("shows the server quote as the second action and locks mutable inputs", () => {
    const onAbandonQuote = vi.fn(() => true);
    const bookingProps = setupBookingCard({
      bookingState: {
        quoteSnapshot: {
          amount: 175_000,
          canCheckout: true,
          currency: "KRW",
          discountAmount: 25_000,
          nightlyPrice: 100_000,
          nights: 2,
          phase: "quoted",
          quoteExpiresAt: "2026-09-01T10:10:00Z",
          subtotal: 200_000,
        },
        reservationStatus: "quoted",
        selectionLocked: true,
      },
      bookingActions: { onAbandonQuote },
    });

    expect(screen.getByText("서버에서 확인한 최종 요금")).toBeInTheDocument();
    expect(screen.getAllByText("₩175,000")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /체크인/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /인원/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "해제" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "예약 계속하기" }));
    expect(bookingProps.bookingActions.onReserve).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "조건 다시 선택" }));
    expect(onAbandonQuote).toHaveBeenCalledOnce();
  });

  it("disables the reserve button while a reservation is being created", () => {
    const bookingProps = setupBookingCard({
      bookingState: { isReserving: true },
    });

    const reserveButton = screen.getByRole("button", { name: "예약 중..." });

    expect(reserveButton).toBeDisabled();

    fireEvent.click(reserveButton);

    expect(bookingProps.bookingActions.onReserve).not.toHaveBeenCalled();
  });

  it("keeps an uncertain reservation terminal disabled without showing an active spinner", () => {
    const bookingProps = setupBookingCard({
      bookingState: { isReservationLocked: true },
    });

    const reserveButton = screen.getByRole("button", {
      name: "예약 내역 확인 필요",
    });
    expect(reserveButton).toBeDisabled();
    expect(reserveButton).not.toHaveAttribute("aria-busy");

    fireEvent.click(reserveButton);
    expect(bookingProps.bookingActions.onReserve).not.toHaveBeenCalled();
  });
});
