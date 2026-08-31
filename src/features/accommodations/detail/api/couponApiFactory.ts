import type { AccommodationCouponApiPort } from "../ports/couponApiPort";
import type { CouponCollectionWire } from "./contracts";
import { toCouponCollection } from "./mappers";
import type { AccommodationApiTransport } from "./transport";

export type CouponApiTransport = AccommodationApiTransport;

export const createCouponApi = (
  transport: CouponApiTransport,
): AccommodationCouponApiPort => ({
  async getValidCoupons(options) {
    const wire = await transport.request<CouponCollectionWire>({
      method: "GET",
      path: "/coupons",
      signal: options?.signal,
    });

    return toCouponCollection(wire);
  },

  async issue(couponId, options) {
    await transport.requestNullable<never>({
      method: "POST",
      path: `/coupons/${couponId}/issue`,
      signal: options?.signal,
    });
  },
});
