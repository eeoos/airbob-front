import { act, renderHook } from "@testing-library/react";
import { reservationApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";
import { CouponInfo } from "../../../types/coupon";
import { ReservationReady } from "../../../types/reservation";
import { startReservationCheckoutHandoff } from "../../reservations/appShell";
import { useAccommodationBooking } from "./useAccommodationBooking";

type MockCheckoutDateInput = Date | string;

interface MockStartReservationCheckoutHandoffOptions {
  accommodationId: number;
  checkIn: MockCheckoutDateInput;
  checkOut: MockCheckoutDateInput;
  adultCount: number;
  childCount: number;
  infantCount?: number;
  petCount?: number;
  appliedCoupon: {
    id: number;
    name: string;
    discount: number;
  } | null;
  navigate: (
    to: string,
    options?: { replace?: boolean; state?: unknown }
  ) => void;
}

const formatCheckoutDateParamForTest = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

jest.mock("../../../api", () => ({
  reservationApi: {
    create: jest.fn(),
  },
}));

jest.mock("../../reservations/appShell", () => ({
  formatCheckoutDateParam: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },
  startReservationCheckoutHandoff: jest.fn(),
}));

const mockStartReservationCheckoutHandoff = jest.mocked(
  startReservationCheckoutHandoff,
);
const mockSetSearchParams = jest.fn();
const mockNavigate = jest.fn();
const mockHandleError = jest.fn();
const mockClearError = jest.fn();
const mockRequireAuth = jest.fn();

const createAccommodation = (
  overrides: Partial<AccommodationDetail> = {}
): AccommodationDetail => ({
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "ENTIRE_PLACE",
  base_price: 100000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: [],
  is_in_wishlist: false,
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo",
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
    pet_occupancy: 1,
  },
  amenities: [],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
  ...overrides,
});

const createCoupon = (overrides: Partial<CouponInfo> = {}): CouponInfo => ({
  id: 3,
  name: "만원 쿠폰",
  description: null,
  discount_type: "FIXED_AMOUNT",
  discount_value: 10000,
  min_payment_price: null,
  max_discount_amount: null,
  start_date: "2026-07-01",
  end_date: "2026-12-31",
  total_quantity: null,
  issued_quantity: 0,
  ...overrides,
});

const renderUseAccommodationBooking = (
  searchParams: URLSearchParams,
  options: Partial<Parameters<typeof useAccommodationBooking>[0]> = {}
) =>
  renderHook(() =>
    useAccommodationBooking({
      accommodationId: "7",
      accommodation: createAccommodation(),
      searchParams,
      setSearchParams: mockSetSearchParams,
      isAuthenticated: true,
      selectedCoupon: null,
      selectedCouponId: null,
      couponDiscount: 0,
      navigate: mockNavigate,
      handleError: mockHandleError,
      clearError: mockClearError,
      onRequireAuth: mockRequireAuth,
      startTransition: (callback) => callback(),
      ...options,
    })
  );

describe("useAccommodationBooking", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-10T12:00:00"));
    sessionStorage.clear();
    mockSetSearchParams.mockReset();
    mockNavigate.mockReset();
    mockHandleError.mockReset();
    mockClearError.mockReset();
    mockRequireAuth.mockReset();
    mockStartReservationCheckoutHandoff.mockReset();
    mockStartReservationCheckoutHandoff.mockImplementation(
      async (options: MockStartReservationCheckoutHandoffOptions) => {
        const checkIn =
          typeof options.checkIn === "string"
            ? options.checkIn
            : formatCheckoutDateParamForTest(options.checkIn);
        const checkOut =
          typeof options.checkOut === "string"
            ? options.checkOut
            : formatCheckoutDateParamForTest(options.checkOut);
        const reservationResponse = await reservationApi.create({
          accommodation_id: options.accommodationId,
          check_in_date: checkIn,
          check_out_date: checkOut,
          guest_count: options.adultCount + options.childCount,
          ...(options.appliedCoupon ? { coupon_id: options.appliedCoupon.id } : {}),
        });
        const checkoutState = {
          reservationUid: reservationResponse.reservation_uid,
          orderName: reservationResponse.order_name,
          amount: reservationResponse.amount,
          customerEmail: reservationResponse.customer_email,
          customerName: reservationResponse.customer_name,
          checkIn,
          checkOut,
          adultOccupancy: options.adultCount,
          childOccupancy: options.childCount,
          infantOccupancy: options.infantCount ?? 0,
          petOccupancy: options.petCount ?? 0,
          couponName: options.appliedCoupon?.name ?? null,
          couponDiscount: options.appliedCoupon?.discount ?? null,
        };

        try {
          sessionStorage.setItem(
            `airbob:reservation-checkout:${options.accommodationId}`,
            JSON.stringify(checkoutState),
          );
        } catch {
          // The production handoff still navigates when fallback storage is unavailable.
        }

        options.navigate(`/accommodations/${options.accommodationId}/confirm`, {
          state: checkoutState,
        });

        return {
          reservationResponse,
          checkoutState,
        };
      },
    );
    jest.mocked(reservationApi.create).mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calculates stay dates, nights, and total price from URL params", () => {
    const { result } = renderUseAccommodationBooking(
      new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-23")
    );

    expect(result.current.checkIn?.getFullYear()).toBe(2026);
    expect(result.current.checkIn?.getMonth()).toBe(6);
    expect(result.current.checkIn?.getDate()).toBe(20);
    expect(result.current.nights).toBe(3);
    expect(result.current.totalPrice).toBe(300000);
    expect(result.current.payablePrice).toBe(300000);
  });

  it("chooses the first available default one-night stay when dates are absent", () => {
    const { result } = renderUseAccommodationBooking(new URLSearchParams(), {
      accommodation: createAccommodation({
        unavailable_dates: ["2026-07-10", "2026-07-11"],
      }),
    });

    expect(result.current.formatDate(result.current.checkIn)).toBe("2026. 07. 12.");
    expect(result.current.formatDate(result.current.checkOut)).toBe("2026. 07. 13.");
    expect(result.current.nights).toBe(1);
    expect(result.current.totalPrice).toBe(100000);
  });

  it("updates date query params and closes the picker after checkout is selected", () => {
    const { result } = renderUseAccommodationBooking(
      new URLSearchParams("adultOccupancy=2")
    );

    act(() => {
      result.current.handleDateSelect(
        new Date(2026, 6, 20),
        new Date(2026, 6, 21)
      );
    });

    const nextParams = mockSetSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(nextParams.toString()).toBe(
      "adultOccupancy=2&checkIn=2026-07-20&checkOut=2026-07-21"
    );
    expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });
    expect(result.current.isDatePickerOpen).toBe(false);
  });

  it("creates a reservation and navigates to confirmation with checkout state outside the URL", async () => {
    jest.mocked(reservationApi.create).mockResolvedValue({
      reservation_uid: "res-1",
      order_name: "주문명",
      amount: 190000,
      customer_email: "guest@example.com",
      customer_name: "게스트",
    });

    const { result } = renderUseAccommodationBooking(
      new URLSearchParams(
        "checkIn=2026-07-20&checkOut=2026-07-22&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1"
      ),
      {
        selectedCoupon: createCoupon(),
        selectedCouponId: 3,
        couponDiscount: 10000,
      }
    );

    await act(async () => {
      await result.current.handleReserve();
    });

    expect(reservationApi.create).toHaveBeenCalledWith({
      accommodation_id: 7,
      check_in_date: "2026-07-20",
      check_out_date: "2026-07-22",
      guest_count: 3,
      coupon_id: 3,
    });
    expect(mockNavigate).toHaveBeenCalledWith("/accommodations/7/confirm", {
      state: expect.objectContaining({
        reservationUid: "res-1",
        orderName: "주문명",
        amount: 190000,
        customerEmail: "guest@example.com",
        customerName: "게스트",
      }),
    });
    expect(mockNavigate.mock.calls[0][0]).not.toContain("customerEmail");
    expect(mockNavigate.mock.calls[0][0]).not.toContain("orderName");
    expect(mockNavigate.mock.calls[0][0]).not.toContain("couponName");

    const storedState = JSON.parse(
      sessionStorage.getItem("airbob:reservation-checkout:7") ?? "{}"
    );
    expect(storedState).toEqual(
      expect.objectContaining({
        reservationUid: "res-1",
        orderName: "주문명",
        amount: 190000,
        customerEmail: "guest@example.com",
        customerName: "게스트",
        checkIn: "2026-07-20",
        checkOut: "2026-07-22",
        adultOccupancy: 2,
        childOccupancy: 1,
        infantOccupancy: 1,
        petOccupancy: 1,
        couponName: "만원 쿠폰",
        couponDiscount: 10000,
      })
    );
  });

  it("treats discounted checkout without a complete coupon as no coupon", async () => {
    jest.mocked(reservationApi.create).mockResolvedValue({
      reservation_uid: "res-1",
      order_name: "주문명",
      amount: 200000,
      customer_email: "guest@example.com",
      customer_name: "게스트",
    });

    const { result } = renderUseAccommodationBooking(
      new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-22"),
      {
        selectedCoupon: createCoupon(),
        selectedCouponId: null,
        couponDiscount: 10000,
      }
    );

    await act(async () => {
      await result.current.handleReserve();
    });

    expect(reservationApi.create).toHaveBeenCalledWith({
      accommodation_id: 7,
      check_in_date: "2026-07-20",
      check_out_date: "2026-07-22",
      guest_count: 1,
    });
    expect(
      JSON.parse(sessionStorage.getItem("airbob:reservation-checkout:7") ?? "{}")
    ).toEqual(
      expect.objectContaining({
        reservationUid: "res-1",
        couponName: null,
        couponDiscount: null,
      })
    );
  });

  it("navigates with router state even when saving checkout fallback fails", async () => {
    jest.mocked(reservationApi.create).mockResolvedValue({
      reservation_uid: "res-1",
      order_name: "주문명",
      amount: 200000,
      customer_email: "guest@example.com",
      customer_name: "게스트",
    });
    const setItemSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage unavailable");
      });

    try {
      const { result } = renderUseAccommodationBooking(
        new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-22")
      );

      await act(async () => {
        await result.current.handleReserve();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/accommodations/7/confirm", {
        state: expect.objectContaining({
          reservationUid: "res-1",
          orderName: "주문명",
          amount: 200000,
          customerEmail: "guest@example.com",
          customerName: "게스트",
        }),
      });
      expect(mockHandleError).not.toHaveBeenCalled();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("defers reservation behind auth when logged out", async () => {
    const { result } = renderUseAccommodationBooking(
      new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-22"),
      { isAuthenticated: false }
    );

    await act(async () => {
      await result.current.handleReserve();
    });

    expect(mockRequireAuth).toHaveBeenCalledTimes(1);
    expect(reservationApi.create).not.toHaveBeenCalled();
  });

  it("replays a deferred reservation after auth success without reopening auth", async () => {
    jest.mocked(reservationApi.create).mockResolvedValue({
      reservation_uid: "res-1",
      order_name: "주문명",
      amount: 200000,
      customer_email: "guest@example.com",
      customer_name: "게스트",
    });
    let pendingAction: (() => void | Promise<void>) | undefined;
    mockRequireAuth.mockImplementation((action) => {
      pendingAction = action;
    });

    const { result } = renderUseAccommodationBooking(
      new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-22"),
      { isAuthenticated: false }
    );

    await act(async () => {
      await result.current.handleReserve();
    });

    mockRequireAuth.mockClear();

    await act(async () => {
      await pendingAction?.();
    });

    expect(mockRequireAuth).not.toHaveBeenCalled();
    expect(reservationApi.create).toHaveBeenCalledWith({
      accommodation_id: 7,
      check_in_date: "2026-07-20",
      check_out_date: "2026-07-22",
      guest_count: 1,
    });
  });

  it("ignores duplicate reserve calls while reservation creation is in flight", async () => {
    let resolveReservation!: (value: ReservationReady) => void;
    jest.mocked(reservationApi.create).mockReturnValue(
      new Promise((resolve) => {
        resolveReservation = resolve;
      })
    );

    const { result } = renderUseAccommodationBooking(
      new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-22")
    );

    await act(async () => {
      void result.current.handleReserve();
      void result.current.handleReserve();
    });

    expect(reservationApi.create).toHaveBeenCalledTimes(1);
    expect(result.current.isReserving).toBe(true);

    await act(async () => {
      resolveReservation({
        reservation_uid: "res-1",
        order_name: "주문명",
        amount: 200000,
        customer_email: "guest@example.com",
        customer_name: "게스트",
      });
    });

    expect(result.current.isReserving).toBe(false);
  });

  it("falls back from malformed URL dates and clamps malformed occupancy params", async () => {
    const { result } = renderUseAccommodationBooking(
      new URLSearchParams(
        "checkIn=2026-02-31&checkOut=not-a-date&adultOccupancy=-5&childOccupancy=abc&infantOccupancy=3&petOccupancy=2"
      ),
      {
        accommodation: createAccommodation({
          policy: {
            max_occupancy: 4,
            infant_occupancy: 1,
            pet_occupancy: 1,
          },
        }),
      }
    );

    expect(result.current.formatDate(result.current.checkIn)).toBe("2026. 07. 10.");
    expect(result.current.formatDate(result.current.checkOut)).toBe("2026. 07. 11.");
    expect(result.current.adultCount).toBe(1);
    expect(result.current.childCount).toBe(0);
    expect(result.current.infantCount).toBe(1);
    expect(result.current.petCount).toBe(1);
  });

  it("blocks reservations whose selected range contains an unavailable date", async () => {
    const { result } = renderUseAccommodationBooking(
      new URLSearchParams("checkIn=2026-07-20&checkOut=2026-07-23"),
      {
        accommodation: createAccommodation({
          unavailable_dates: ["2026-07-21"],
        }),
      }
    );

    await act(async () => {
      await result.current.handleReserve();
    });

    expect(reservationApi.create).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("선택한 날짜에 예약할 수 없는 날짜가 포함되어 있습니다.")
    );
  });
});
