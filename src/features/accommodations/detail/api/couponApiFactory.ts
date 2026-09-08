import type { AccommodationCouponApiPort } from "../ports/couponApiPort";
import type {
  CouponCollectionWire,
  MemberCouponCollectionWire,
} from "./contracts";
import { toCouponCollection, toMemberCouponCollection } from "./mappers";
import type { AccommodationApiTransport } from "./transport";

export type CouponApiTransport = AccommodationApiTransport;

export const createCouponApi = (
  transport: CouponApiTransport,
): AccommodationCouponApiPort => ({
  async getCampaigns(options) {
    const wire = await transport.request<CouponCollectionWire>({
      method: "GET",
      path: "/coupons",
      signal: options?.signal,
    });

    return toCouponCollection(wire);
  },

  async getMyCoupons(options) {
    const wire = await transport.request<MemberCouponCollectionWire>({
      method: "GET",
      path: "/members/me/coupons",
      signal: options?.signal,
    });
    return toMemberCouponCollection(wire);
  },

  async issue(couponId, options) {
    await transport.requestNullable<never>({
      method: "POST",
      path: `/coupons/${couponId}/issue`,
      signal: options?.signal,
    });
  },
});
