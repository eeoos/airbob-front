import type { CouponInfo } from "../../../types/coupon";
import {
  toAccommodationBookingCouponViewModel,
  toAccommodationBookingCouponViewModels,
} from "./accommodationBookingSectionsViewModel";

const couponFixture = (overrides: Partial<CouponInfo> = {}): CouponInfo => ({
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
  ...overrides,
});

describe("accommodation booking sections view model", () => {
  it("maps coupon DTO fields into display-ready booking coupon rows", () => {
    expect(
      toAccommodationBookingCouponViewModel(couponFixture(), {
        issuingCouponId: null,
        selectedCouponId: 3,
        totalPrice: 200000,
      }),
    ).toEqual({
      actionLabel: "적용 중",
      discount: 10000,
      id: 3,
      isApplicable: true,
      isIssuing: false,
      isSelected: true,
      metadataLabel: "10,000원 할인 · 남은 수량 8장",
      name: "만원 쿠폰",
    });
  });

  it("captures minimum payment conditions and issue progress in coupon rows", () => {
    expect(
      toAccommodationBookingCouponViewModels(
        [
          couponFixture({
            discount_type: "PERCENTAGE",
            discount_value: 15,
            id: 4,
            min_payment_price: 300000,
            name: "15% 쿠폰",
            total_quantity: null,
          }),
        ],
        {
          issuingCouponId: 4,
          selectedCouponId: null,
          totalPrice: 200000,
        },
      ),
    ).toEqual([
      {
        actionLabel: "발급 중",
        discount: 0,
        id: 4,
        isApplicable: false,
        isIssuing: true,
        isSelected: false,
        metadataLabel: "15% 할인 · 300,000원 이상",
        name: "15% 쿠폰",
      },
    ]);
  });
});
