import type { AccommodationCoupon } from "../model/coupon";
import {
  toAccommodationBookingCouponViewModel,
  toAccommodationBookingCouponViewModels,
} from "./accommodationBookingSectionsViewModel";

const couponFixture = (
  overrides: Partial<AccommodationCoupon> = {},
): AccommodationCoupon => ({
  id: 3,
  name: "만원 쿠폰",
  description: null,
  discountType: "FIXED_AMOUNT",
  discountValue: 10000,
  minPaymentPrice: null,
  maxDiscountAmount: null,
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  totalQuantity: 10,
  issuedQuantity: 2,
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
            discountType: "PERCENTAGE",
            discountValue: 15,
            id: 4,
            minPaymentPrice: 300000,
            name: "15% 쿠폰",
            totalQuantity: null,
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
