import type { CouponCollectionWire } from "./contracts";
import {
  createCouponApi,
  type CouponApiTransport,
} from "./couponApi";

const couponWire: CouponCollectionWire = {
  infos: [
    {
      id: 3,
      name: "만원 쿠폰",
      description: null,
      discount_type: "FIXED_AMOUNT",
      discount_value: 10000,
      min_payment_price: null,
      max_discount_amount: null,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      total_quantity: null,
      issued_quantity: 0,
    },
  ],
};

describe("coupon API adapter", () => {
  it("preserves the valid-coupon GET contract and forwards AbortSignal", async () => {
    const transport: CouponApiTransport = {
      request: jest.fn().mockResolvedValue(couponWire),
      requestNullable: jest.fn(),
    };
    const signal = new AbortController().signal;
    const api = createCouponApi(transport);

    await expect(api.getValidCoupons({ signal })).resolves.toEqual({
      coupons: [expect.objectContaining({ id: 3, discountValue: 10000 })],
    });

    expect(transport.request).toHaveBeenCalledWith({
      method: "GET",
      path: "/coupons",
      signal,
    });
    expect((transport.request as jest.Mock).mock.calls[0][0]).not.toHaveProperty(
      "body",
    );
    expect((transport.request as jest.Mock).mock.calls[0][0]).not.toHaveProperty(
      "params",
    );
  });

  it("preserves the coupon-issue POST contract with no body", async () => {
    const transport: CouponApiTransport = {
      request: jest.fn(),
      requestNullable: jest.fn().mockResolvedValue(null),
    };
    const signal = new AbortController().signal;
    const api = createCouponApi(transport);

    await expect(api.issue(3, { signal })).resolves.toBeUndefined();

    expect(transport.requestNullable).toHaveBeenCalledWith({
      method: "POST",
      path: "/coupons/3/issue",
      signal,
    });
    expect(
      (transport.requestNullable as jest.Mock).mock.calls[0][0],
    ).not.toHaveProperty("body");
    expect(
      (transport.requestNullable as jest.Mock).mock.calls[0][0],
    ).not.toHaveProperty("params");
  });
});
