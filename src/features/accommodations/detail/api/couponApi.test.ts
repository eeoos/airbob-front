import type { CouponCollectionWire } from "./contracts";
import { createCouponApi, type CouponApiTransport } from "./couponApiFactory";
import campaignsContract from "./__fixtures__/coupon-campaigns.json";
import ownedContract from "./__fixtures__/member-coupons.json";

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
      issue_start_at: "2026-01-01T00:00:00",
      issue_end_at: "2026-12-31T00:00:00",
      usable_from: "2026-01-01T00:00:00",
      usable_until: "2026-12-31T00:00:00",
      issuance_status: "OPEN",
      total_quantity: null,
      issued_quantity: 0,
    },
  ],
};

describe("coupon API adapter", () => {
  it("consumes the backend campaign JSON without confusing issuance and usage periods", async () => {
    const request = vi.fn().mockResolvedValue(campaignsContract);
    const api = createCouponApi({ request, requestNullable: vi.fn() });
    const { coupons } = await api.getCampaigns();
    expect(coupons.map((coupon) => coupon.issuanceStatus)).toEqual([
      "UPCOMING",
      "OPEN",
      "SOLD_OUT",
    ]);
    expect(coupons[0]).toMatchObject({
      kind: "campaign",
      issueStartAt: "2026-09-08T13:00:00",
      usableFrom: "2026-09-07T12:00:00",
    });
  });

  it("reads owned coupons with their server use status and coupon ID", async () => {
    const request = vi.fn().mockResolvedValue(ownedContract);
    const api = createCouponApi({ request, requestNullable: vi.fn() });
    const signal = new AbortController().signal;
    const { coupons } = await api.getMyCoupons({ signal });
    expect(coupons.map((coupon) => [coupon.id, coupon.status])).toEqual([
      [12, "AVAILABLE"],
      [13, "UPCOMING"],
      [14, "USED"],
      [15, "EXPIRED"],
      [16, "UNAVAILABLE"],
      [17, "AVAILABLE"],
    ]);
    expect(coupons.every((coupon) => coupon.kind === "owned")).toBe(true);
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/members/me/coupons",
      signal,
    });
  });

  it("rejects an unknown member status instead of allowing an invalid coupon", async () => {
    const request = vi.fn().mockResolvedValue({
      infos: [{ ...ownedContract.infos[0], status: "UNKNOWN" }],
    });
    const api = createCouponApi({ request, requestNullable: vi.fn() });
    await expect(api.getMyCoupons()).rejects.toThrow(
      "Member coupon status is invalid.",
    );
  });

  it("preserves the valid-coupon GET contract and forwards AbortSignal", async () => {
    const request = vi.fn().mockResolvedValue(couponWire);
    const transport = {
      request,
      requestNullable: vi.fn(),
    } as unknown as CouponApiTransport;
    const signal = new AbortController().signal;
    const api = createCouponApi(transport);

    await expect(api.getCampaigns({ signal })).resolves.toEqual({
      coupons: [expect.objectContaining({ id: 3, discountValue: 10000 })],
    });

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/coupons",
      signal,
    });
    expect(request.mock.calls.at(0)?.at(0)).not.toHaveProperty("body");
    expect(request.mock.calls.at(0)?.at(0)).not.toHaveProperty("params");
  });

  it("preserves the coupon-issue POST contract with no body", async () => {
    const requestNullable = vi.fn().mockResolvedValue(null);
    const transport = {
      request: vi.fn(),
      requestNullable,
    } as unknown as CouponApiTransport;
    const signal = new AbortController().signal;
    const api = createCouponApi(transport);

    await expect(api.issue(3, { signal })).resolves.toBeUndefined();

    expect(requestNullable).toHaveBeenCalledWith({
      method: "POST",
      path: "/coupons/3/issue",
      signal,
    });
    expect(requestNullable.mock.calls.at(0)?.at(0)).not.toHaveProperty("body");
    expect(requestNullable.mock.calls.at(0)?.at(0)).not.toHaveProperty(
      "params",
    );
  });
});
