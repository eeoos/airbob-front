import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "fs";
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
      selectionEndpoint,
      onClose,
      onEscape,
    }: {
      selectionEndpoint?: "checkIn" | "checkOut";
      onClose: () => void;
      onEscape?: () => void;
    }) => (
      <div
        data-testid="date-picker"
        data-selection-endpoint={selectionEndpoint}
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
  isActionEnabled: true,
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
    retryCoupons: vi.fn(),
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

    expect(screen.getByText("총액")).toBeInTheDocument();
    expect(screen.getByLabelText("할인 전 총액 ₩200,000")).toBeInTheDocument();
    expect(screen.getByText("₩190,000")).toBeInTheDocument();
    expect(screen.getByText("2026. 07. 10.")).toBeInTheDocument();
    expect(screen.getByText("2026. 07. 12.")).toBeInTheDocument();
    expect(screen.getByText("게스트 3명")).toBeInTheDocument();
    expect(screen.getAllByText("만원 쿠폰")).toHaveLength(2);
    expect(screen.getByText("2박 x ₩100,000")).toBeInTheDocument();
    expect(screen.getByText("-₩10,000")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "예약하기" }));

    expect(bookingProps.bookingActions.onReserve).toHaveBeenCalledTimes(1);
  });

  it("starts with empty date fields and opens the calendar from the availability action", () => {
    const onDatePickerOpenChange = vi.fn();
    const onGuestPickerOpenChange = vi.fn();
    setupBookingCard({
      isAuthenticated: false,
      bookingState: {
        checkIn: null,
        checkOut: null,
        isStayReady: false,
        nights: 0,
        payablePrice: 0,
        selectionState: "incomplete",
        totalPrice: 0,
      },
      bookingActions: {
        onDatePickerOpenChange,
        onGuestPickerOpenChange,
      },
      couponState: {
        coupons: [],
        selectedCoupon: null,
        couponDiscount: 0,
      },
    });

    expect(
      screen.getByRole("heading", {
        name: "날짜를 선택해 요금 확인",
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "체크인 날짜 추가" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "체크아웃 날짜 추가" }),
    ).toBeEnabled();
    expect(screen.queryByText("₩0")).not.toBeInTheDocument();
    expect(
      screen.queryByText("예약 확정 전에는 요금이 청구되지 않습니다."),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "예약 가능 여부 보기" }),
    );

    expect(onGuestPickerOpenChange).toHaveBeenCalledWith(false);
    expect(onDatePickerOpenChange).toHaveBeenCalledWith(true);
  });

  it("keeps the price prompt and checkout fallback after only check-in is selected", () => {
    setupBookingCard({
      isAuthenticated: false,
      bookingState: {
        checkOut: null,
        isStayReady: false,
        nights: 0,
        payablePrice: 0,
        selectionState: "incomplete",
        totalPrice: 0,
      },
      couponState: {
        coupons: [],
        selectedCoupon: null,
        couponDiscount: 0,
      },
    });

    expect(
      screen.getByRole("heading", { name: "날짜를 선택해 요금 확인" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "체크인 2026. 07. 10." }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "체크아웃 날짜 추가" }),
    ).toBeEnabled();
    expect(screen.queryByText("₩0")).not.toBeInTheDocument();
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
    expect(screen.getByRole("alert")).toHaveTextContent(
      "예약 가능한 날짜를 불러오지 못했습니다.",
    );
    const retryGuidance = screen.getByText(
      "날짜 정보를 불러오지 못했어요. ‘날짜 다시 불러오기’를 눌러 확인해주세요.",
    );
    expect(
      screen.getByRole("button", { name: "날짜 다시 불러오기" }),
    ).toHaveAttribute("aria-describedby", retryGuidance.id);

    fireEvent.click(screen.getByRole("button", { name: "날짜 다시 불러오기" }));
    expect(retryAvailability).toHaveBeenCalledTimes(1);
  });

  it("explains availability loading at the reserve entry point", () => {
    setupBookingCard({
      bookingState: {
        availabilityStatus: "loading",
        isStayReady: false,
        selectionState: "availability-unavailable",
      },
    });

    expect(
      screen.getByText(
        "예약 가능한 날짜를 확인하고 있어요. 확인이 끝나면 날짜를 선택할 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "예약 가능 날짜 확인 중" }),
    ).toBeDisabled();
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
    expect(
      screen.getByText(
        "현재 예약 가능한 날짜가 없어요. 다른 숙소를 확인해주세요.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "invalid",
      "예약 날짜 다시 선택",
      "체크아웃은 체크인 다음 날짜부터 선택할 수 있어요.",
    ],
    [
      "outside-window",
      "예약 날짜 다시 선택",
      "숙소의 예약 가능 기간 안에서 날짜를 다시 선택해주세요.",
    ],
    [
      "unavailable",
      "예약 날짜 다시 선택",
      "선택한 숙박 기간에 예약할 수 없는 날짜가 포함되어 있어요.",
    ],
  ] as const)(
    "reopens date selection for a %s stay with corrective guidance",
    (selectionState, label, guidance) => {
      setupBookingCard({
        bookingState: {
          checkOut: new Date(2026, 6, 12),
          isStayReady: false,
          selectionState,
        },
      });

      const guidanceElement = screen.getByText(guidance);
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "aria-describedby",
        guidanceElement.id,
      );
    },
  );

  it("opens date selection when a ready label lacks complete positive-night endpoints", () => {
    const onDatePickerOpenChange = vi.fn();
    setupBookingCard({
      bookingState: {
        checkOut: null,
        isStayReady: true,
        nights: 0,
        selectionState: "ready",
      },
      bookingActions: { onDatePickerOpenChange },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "예약 가능 여부 보기" }),
    );

    expect(onDatePickerOpenChange).toHaveBeenCalledWith(true);
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
    "keeps availability retry focus owned through loading and a %s result",
    (terminalStatus) => {
      const retryAvailability = vi.fn(() => {
        expect(
          screen.getByText(
            "날짜 정보를 불러오지 못했어요. ‘날짜 다시 불러오기’를 눌러 확인해주세요.",
          ),
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
      const retryButton = screen.getByRole("button", {
        name: "날짜 다시 불러오기",
      });
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
        screen.getByText(
          "예약 가능한 날짜를 확인하고 있어요. 확인이 끝나면 날짜를 선택할 수 있습니다.",
        ),
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
          ? screen.getByRole("button", { name: "예약하기" })
          : screen.getByText(
              "날짜 정보를 불러오지 못했어요. ‘날짜 다시 불러오기’를 눌러 확인해주세요.",
            );
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

  it("does not reclaim retry focus after the user moves to another control", () => {
    const props = createBookingCardProps();
    const view = render(
      <AccommodationBookingCard
        {...props}
        bookingState={{
          ...props.bookingState,
          availabilityStatus: "error",
          isStayReady: false,
        }}
      />,
    );
    const retryButton = screen.getByRole("button", {
      name: "날짜 다시 불러오기",
    });
    retryButton.focus();
    fireEvent.click(retryButton);

    view.rerender(
      <AccommodationBookingCard
        {...props}
        bookingState={{
          ...props.bookingState,
          availabilityStatus: "loading",
          isStayReady: false,
        }}
      />,
    );
    const guestTrigger = screen.getByRole("button", { name: /인원/ });
    guestTrigger.focus();

    view.rerender(<AccommodationBookingCard {...props} />);

    expect(guestTrigger).toHaveFocus();
    expect(screen.getByRole("button", { name: "예약하기" })).not.toHaveFocus();
  });

  it.each(["loading", "error"] as const)(
    "returns availability-owned focus to the active checkout trigger after %s",
    (transitionStatus) => {
      const props = createBookingCardProps();
      const view = render(
        <AccommodationBookingCard
          {...props}
          bookingState={{ ...props.bookingState, isDatePickerOpen: true }}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /체크아웃/ }));
      screen.getByRole("button", { name: "date picker focus target" }).focus();

      view.rerender(
        <AccommodationBookingCard
          {...props}
          bookingState={{
            ...props.bookingState,
            availabilityStatus: transitionStatus,
            isDatePickerOpen: true,
            isStayReady: false,
          }}
        />,
      );
      expect(
        screen.getByRole(transitionStatus === "error" ? "alert" : "status", {
          name: "예약 가능 여부",
        }),
      ).toHaveFocus();

      view.rerender(
        <AccommodationBookingCard
          {...props}
          bookingState={{ ...props.bookingState, isDatePickerOpen: false }}
        />,
      );

      expect(screen.getByRole("button", { name: /체크아웃/ })).toHaveFocus();
      expect(screen.getByRole("button", { name: /체크인/ })).not.toHaveFocus();
    },
  );

  it("exposes date and guest pickers through semantic disclosure buttons", () => {
    setupBookingCard({
      bookingState: {
        isDatePickerOpen: true,
        isGuestPickerOpen: true,
      },
    });

    const checkInButton = screen.getByRole("button", { name: /체크인/ });
    const checkOutButton = screen.getByRole("button", { name: /체크아웃/ });
    const guestButton = screen.getByRole("button", { name: /인원/ });

    for (const dateButton of [checkInButton, checkOutButton]) {
      expect(dateButton).toHaveAttribute("type", "button");
      expect(dateButton).toHaveAttribute("aria-haspopup", "dialog");
      expect(dateButton).toHaveAttribute("aria-expanded", "true");
      expect(dateButton).toHaveAttribute(
        "aria-controls",
        "booking-date-picker",
      );
    }
    expect(screen.getByTestId("date-picker")).toBeInTheDocument();

    expect(guestButton).toHaveAttribute("type", "button");
    expect(guestButton).toHaveAttribute("aria-expanded", "true");
    expect(guestButton).toHaveAttribute(
      "aria-controls",
      "booking-guest-picker",
    );
    expect(screen.getByText("성인")).toBeInTheDocument();
  });

  it("keeps the guest field and card content mounted while the date overlay is open", () => {
    setupBookingCard({
      bookingState: { isDatePickerOpen: true },
    });

    expect(screen.getByRole("button", { name: /인원/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "예약하기" })).toBeVisible();
    expect(screen.getByText("2박")).toBeInTheDocument();
    expect(screen.getByTestId("date-picker")).toBeInTheDocument();
  });

  it("opens the same calendar from either date endpoint", () => {
    const onDatePickerOpenChange = vi.fn();
    setupBookingCard({
      bookingState: { isDatePickerOpen: false },
      bookingActions: { onDatePickerOpenChange },
    });

    fireEvent.click(screen.getByRole("button", { name: /체크아웃/ }));

    expect(onDatePickerOpenChange).toHaveBeenCalledWith(true);
  });

  it("preserves an explicit check-in selection intent when reopening a partial stay", () => {
    setupBookingCard({
      bookingState: {
        checkOut: null,
        isDatePickerOpen: true,
        isStayReady: false,
        nights: 0,
        payablePrice: 0,
        selectionState: "incomplete",
        totalPrice: 0,
      },
    });

    expect(screen.getByTestId("date-picker")).toHaveAttribute(
      "data-selection-endpoint",
      "checkOut",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "체크인 2026. 07. 10." }),
    );

    expect(screen.getByTestId("date-picker")).toHaveAttribute(
      "data-selection-endpoint",
      "checkIn",
    );
    expect(screen.getByText("체크인 날짜를 선택하세요")).toBeInTheDocument();
    expect(
      screen.getByText("새 체크인 날짜를 선택하세요."),
    ).toBeInTheDocument();
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
    const anotherCoupon = {
      ...coupon,
      id: 4,
      name: "다른 쿠폰",
      isSelected: false,
      actionLabel: "적용하기",
    };
    setupBookingCard({
      couponState: {
        selectedCoupon: coupon,
        coupons: [coupon, anotherCoupon],
      },
      couponActions: {
        onSelectedCouponIdChange,
        handleIssueCoupon,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "해제" }));
    expect(screen.getByRole("button", { name: "적용 중" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));

    expect(onSelectedCouponIdChange).toHaveBeenCalledWith(null);
    expect(handleIssueCoupon).toHaveBeenCalledWith(anotherCoupon);
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

    const quoteSummary = screen.getByRole("region", {
      name: "확정된 예약 견적",
    });
    expect(within(quoteSummary).getByText("서버 견적")).toBeInTheDocument();
    expect(
      within(quoteSummary).getByText("서버에서 확인한 최종 요금"),
    ).toBeInTheDocument();
    expect(
      within(quoteSummary).getByText(
        "아래 금액을 확인한 뒤 예약을 계속해주세요.",
      ),
    ).toBeInTheDocument();
    expect(within(quoteSummary).getByText("견적 유효 시각")).toBeVisible();
    expect(within(quoteSummary).getByText(/까지$/)).toHaveAttribute(
      "datetime",
      "2026-09-01T10:10:00Z",
    );
    expect(quoteSummary).toHaveAccessibleDescription(/견적 유효 시각.*까지/);
    expect(within(quoteSummary).getByText("₩175,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /체크인/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /인원/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "해제" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "예약 계속하기" }));
    expect(bookingProps.bookingActions.onReserve).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "조건 다시 선택" }));
    expect(onAbandonQuote).toHaveBeenCalledOnce();
  });

  it("keeps the quote-expiry fallback without an invalid time semantic", () => {
    setupBookingCard({
      bookingState: {
        quoteSnapshot: {
          amount: 175_000,
          canCheckout: true,
          currency: "KRW",
          discountAmount: 25_000,
          nightlyPrice: 100_000,
          nights: 2,
          phase: "quoted",
          quoteExpiresAt: "invalid-expiry",
          subtotal: 200_000,
        },
        reservationStatus: "quoted",
        selectionLocked: true,
      },
    });

    const quoteSummary = screen.getByRole("region", {
      name: "확정된 예약 견적",
    });
    expect(within(quoteSummary).getByText("유효 시간 내")).toBeVisible();
    expect(
      within(quoteSummary).queryByText("유효 시간 내", { selector: "time" }),
    ).not.toBeInTheDocument();
    expect(quoteSummary).toHaveAccessibleDescription(/유효 시간 내/);
  });

  it.each([
    [
      "quoted",
      "loading",
      "예약 계속하기",
      "예약 가능한 날짜를 확인하고 있어요. 확인이 끝나면 날짜를 선택할 수 있습니다.",
    ],
    [
      "quoted",
      "error",
      "예약 계속하기",
      "날짜 정보를 불러오지 못했어요. ‘날짜 다시 불러오기’를 눌러 확인해주세요.",
    ],
    [
      "terminal-ready",
      "loading",
      "예약 내역 확인",
      "예약 가능한 날짜를 확인하고 있어요. 확인이 끝나면 날짜를 선택할 수 있습니다.",
    ],
    [
      "terminal-ready",
      "error",
      "예약 내역 확인",
      "날짜 정보를 불러오지 못했어요. ‘날짜 다시 불러오기’를 눌러 확인해주세요.",
    ],
  ] as const)(
    "keeps the %s continuation action clear during availability %s",
    (reservationStatus, availabilityStatus, actionLabel, guidance) => {
      setupBookingCard({
        bookingState: {
          availabilityStatus,
          isStayReady: false,
          reservationStatus,
          selectionState: "availability-unavailable",
        },
      });

      const action = screen.getByRole("button", { name: actionLabel });
      expect(action).toBeEnabled();
      expect(action).not.toHaveAttribute("aria-describedby");
      expect(screen.queryByText(guidance)).not.toBeInTheDocument();
    },
  );

  it.each([
    [
      "quoting",
      "최종 요금 확인 중...",
      "서버에서 최종 요금을 확인하고 있습니다.",
    ],
    [
      "checking-out",
      "예약 처리 중...",
      "예약을 처리하고 있습니다. 잠시만 기다려주세요.",
    ],
  ] as const)(
    "announces the %s reservation transition without changing its action label",
    (reservationStatus, actionLabel, announcement) => {
      setupBookingCard({
        bookingState: {
          isReserving: true,
          reservationStatus,
        },
      });

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(announcement);
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveAttribute("aria-atomic", "true");
      expect(screen.getByRole("button", { name: actionLabel })).toHaveAttribute(
        "aria-busy",
        "true",
      );
    },
  );

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

  it("keeps narrow booking content, touch targets, focus rings, and motion preferences in local styles", () => {
    const css = readFileSync(
      `${__dirname}/AccommodationBookingCard.module.css`,
      "utf8",
    );

    expect(css).toMatch(
      /\.bookingCard\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/,
    );
    expect(css).toMatch(/\.quoteSummary\s*\{[\s\S]*?max-width:\s*100%;/);
    expect(css).toContain("@media (--viewport-phone)");
    expect(css).toMatch(
      /\.guestPickerClose\s*\{[\s\S]*?min-height:\s*var\(--control-touch-target\);/,
    );
    expect(css).toMatch(
      /\.reserveButton\s*\{[\s\S]*?min-height:\s*var\(--control-touch-target\);/,
    );
    expect(css).toMatch(
      /\.reserveButton:focus-visible\s*\{[\s\S]*?box-shadow:\s*var\(--focus-ring-visible\);/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.reserveButton\s*\{[\s\S]*?transition:\s*none;/,
    );
  });
});
