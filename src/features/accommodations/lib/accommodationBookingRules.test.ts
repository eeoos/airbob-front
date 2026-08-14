import type { CouponInfo } from "../../../types/coupon";
import {
  formatBookingDate,
  hasUnavailableDateInRange,
  parseBookingCount,
  parseBookingDate,
  selectBookingCoupon,
  validateBookingDateRange,
  validateBookingGuestCount,
} from "./accommodationBookingRules";

const createCoupon = (): CouponInfo => ({
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
});

describe("accommodationBookingRules", () => {
  it("parses valid dates and rejects malformed calendar dates", () => {
    expect(parseBookingDate("2026-07-20")).toEqual(new Date(2026, 6, 20));
    expect(parseBookingDate("2026-02-31")).toBeNull();
    expect(parseBookingDate("not-a-date")).toBeNull();
  });

  it("parses occupancy counts with fallback and bounds", () => {
    const params = new URLSearchParams(
      "adultOccupancy=8&childOccupancy=abc&infantOccupancy=-1",
    );

    expect(parseBookingCount(params, "adultOccupancy", 1, 1, 4)).toBe(4);
    expect(parseBookingCount(params, "childOccupancy", 0, 0, 4)).toBe(0);
    expect(parseBookingCount(params, "infantOccupancy", 0, 0, 1)).toBe(0);
  });

  it("formats dates and detects unavailable nights inside a stay", () => {
    const checkIn = new Date(2026, 6, 20);
    const checkOut = new Date(2026, 6, 23);

    expect(formatBookingDate(checkIn)).toBe("2026-07-20");
    expect(
      hasUnavailableDateInRange(checkIn, checkOut, ["2026-07-21"]),
    ).toBe(true);
    expect(
      hasUnavailableDateInRange(checkIn, checkOut, ["2026-07-23"]),
    ).toBe(false);
  });

  it("validates date and guest constraints with domain errors", () => {
    expect(
      validateBookingDateRange({
        checkIn: null,
        checkOut: null,
        unavailableDates: [],
      })?.message,
    ).toBe("체크인/체크아웃 날짜를 선택해주세요.");
    expect(
      validateBookingDateRange({
        checkIn: new Date(2026, 6, 22),
        checkOut: new Date(2026, 6, 20),
        unavailableDates: [],
      })?.message,
    ).toBe("체크아웃 날짜는 체크인 날짜 이후여야 합니다.");
    expect(
      validateBookingGuestCount({
        adultCount: 3,
        childCount: 2,
        maxOccupancy: 4,
      })?.message,
    ).toBe("예약 가능한 인원 수를 확인해주세요.");
  });

  it("selects the deferred coupon state when it is present", () => {
    const coupon = createCoupon();

    expect(
      selectBookingCoupon({
        reserveCouponState: {
          selectedCoupon: coupon,
          selectedCouponId: coupon.id,
          couponDiscount: 5000,
        },
        selectedCoupon: null,
        selectedCouponId: null,
        couponDiscount: 0,
      }),
    ).toEqual({
      coupon,
      couponId: 3,
      discount: 5000,
    });
  });
});
