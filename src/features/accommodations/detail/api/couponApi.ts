import { createCouponApi } from "./couponApiFactory";
import { platformAccommodationApiTransport } from "./transport";

export const accommodationCouponApi = createCouponApi(
  platformAccommodationApiTransport,
);
