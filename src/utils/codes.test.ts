import {
  calculateCouponDiscount,
  formatCouponDiscount,
  getAccommodationTypeLabel,
  getAmenityLabel,
} from "./codes";

describe("code label helpers", () => {
  it("uses the backend common-code catalog labels including newly added codes", () => {
    expect(getAccommodationTypeLabel("HOTEL_ROOM")).toBe("호텔 객실");
    expect(getAccommodationTypeLabel("CASTLE")).toBe("성 같은 특이한 숙소");
    expect(getAmenityLabel("AIR_CONDITIONER")).toBe("에어컨");
    expect(getAmenityLabel("BALCONY")).toBe("발코니");
  });

  it("falls back to the raw code when the backend sends an unknown code", () => {
    expect(getAccommodationTypeLabel("FUTURE_TYPE")).toBe("FUTURE_TYPE");
    expect(getAmenityLabel("FUTURE_AMENITY")).toBe("FUTURE_AMENITY");
  });
});

describe("coupon helpers", () => {
  it("formats percentage and fixed amount coupon labels", () => {
    expect(formatCouponDiscount({ discount_type: "PERCENTAGE", discount_value: 15 })).toBe("15% 할인");
    expect(formatCouponDiscount({ discount_type: "FIXED_AMOUNT", discount_value: 10000 })).toBe("10,000원 할인");
  });

  it("calculates the backend-compatible coupon discount with minimum payment and max cap", () => {
    expect(
      calculateCouponDiscount(
        {
          discount_type: "PERCENTAGE",
          discount_value: 50,
          min_payment_price: 50000,
          max_discount_amount: 30000,
        },
        100000
      )
    ).toBe(30000);

    expect(
      calculateCouponDiscount(
        {
          discount_type: "FIXED_AMOUNT",
          discount_value: 20000,
          min_payment_price: 120000,
          max_discount_amount: null,
        },
        100000
      )
    ).toBe(0);
  });
});
