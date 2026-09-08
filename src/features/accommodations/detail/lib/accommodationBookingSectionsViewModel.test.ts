import type {
  AccommodationCouponCampaign,
  AccommodationMemberCoupon,
} from "../model/coupon";
import { mergeAccommodationCoupons } from "./accommodationCouponRules";
import { toAccommodationBookingCouponViewModel as toView } from "./accommodationBookingSectionsViewModel";

const campaign: AccommodationCouponCampaign = {
  kind: "campaign",
  id: 3,
  name: "만원 쿠폰",
  description: null,
  discountType: "FIXED_AMOUNT",
  discountValue: 10000,
  minPaymentPrice: 50000,
  maxDiscountAmount: null,
  issueStartAt: "2026-09-01T00:00:00",
  issueEndAt: "2026-09-10T00:00:00",
  issuanceStatus: "OPEN",
  usableFrom: "2026-09-01T00:00:00",
  usableUntil: "2026-09-30T00:00:00",
  totalQuantity: 10,
  issuedQuantity: 2,
};
const owned: AccommodationMemberCoupon = {
  ...campaign,
  kind: "owned",
  status: "AVAILABLE",
};
const options = {
  issuingCouponId: null,
  selectedCouponId: null,
  totalPrice: 200000,
};

describe("coupon display and action contracts", () => {
  it.each([
    ["OPEN", "발급받기", true],
    ["UPCOMING", "발급 예정", false],
    ["SOLD_OUT", "매진", false],
  ] as const)(
    "uses the %s campaign status instead of discount amount",
    (issuanceStatus, actionLabel, isActionEnabled) => {
      expect(
        toView(
          { ...campaign, issuanceStatus },
          { ...options, totalPrice: 0, selectedCouponId: 3 },
        ),
      ).toMatchObject({ actionLabel, isActionEnabled, isSelected: false });
    },
  );
  it.each([
    ["AVAILABLE", "적용하기", true],
    ["UPCOMING", "사용 예정", false],
    ["UNAVAILABLE", "사용 불가", false],
    ["USED", "사용 완료", false],
    ["EXPIRED", "기간 만료", false],
  ] as const)(
    "uses the %s member status",
    (status, actionLabel, isActionEnabled) => {
      expect(toView({ ...owned, status }, options)).toMatchObject({
        actionLabel,
        isActionEnabled,
      });
    },
  );
  it("preserves the discount cap and minimum amount when applying owned coupons", () => {
    const coupon = {
      ...owned,
      discountType: "PERCENTAGE" as const,
      discountValue: 15,
      maxDiscountAmount: 12000,
    };
    expect(toView(coupon, { ...options, selectedCouponId: 3 })).toMatchObject({
      actionLabel: "적용 중",
      discount: 12000,
      isSelected: true,
    });
    expect(
      toView(coupon, { ...options, totalPrice: 40000, selectedCouponId: 3 }),
    ).toMatchObject({
      actionLabel: "금액 조건 미달",
      discount: 0,
      isActionEnabled: false,
      isSelected: false,
    });
  });
  it("keeps owned coupons after a campaign sells out or disappears and removes duplicate rows", () => {
    const ended = { ...owned, id: 99 };
    const rows = mergeAccommodationCoupons(
      [{ ...campaign, issuanceStatus: "SOLD_OUT" }],
      [owned, ended],
    );
    expect(rows).toEqual([owned, ended]);
    expect(rows.map((item) => toView(item, options).isActionEnabled)).toEqual([
      true,
      true,
    ]);
  });
  it("shows issuance and usage periods in the server's Korean time without browser conversion", () => {
    const view = toView(campaign, options);
    expect(view.metadataLabel).toContain("남은 수량 8장");
    expect(view.metadataLabel).toContain(
      "발급 2026-09-01 00:00 ~ 2026-09-10 00:00",
    );
    expect(view.metadataLabel).toContain(
      "사용 2026-09-01 00:00 ~ 2026-09-30 00:00 (한국 시간)",
    );
    expect(toView(owned, options).metadataLabel).not.toContain("남은 수량");
  });
});
