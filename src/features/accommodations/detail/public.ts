// Presentation exports live in ui/ so cache consumers do not load detail views.
export type { AccommodationDetail } from "./model/accommodationDetail";
export { accommodationCouponApi } from "./api/couponApi";
export {
  calculateAccommodationCouponDiscount,
  isAccommodationCouponApplicable,
  mergeAccommodationCoupons,
} from "./lib/accommodationCouponRules";
export { createAccommodationDetailQueryCacheProjection } from "./cache/accommodationDetailQueryCacheProjection";
export type {
  AccommodationCoupon,
  AccommodationMemberCoupon,
  AccommodationMemberCouponCollection,
} from "./model/coupon";
export {
  useAccommodationDetailReadQuery,
  useAccommodationAvailabilityReadQuery,
  useCouponCampaignsReadQuery,
  useMemberCouponsReadQuery,
} from "./queries/readQueries";
export type { AccommodationDetailQueryOptions } from "./queries/readQueries";
export type { AccommodationAvailability } from "./model/accommodationAvailability";
export {
  toAccommodationBookingCouponViewModel,
  toAccommodationBookingCouponViewModels,
} from "./lib/accommodationBookingSectionsViewModel";
export { toAccommodationBookingViewModel } from "./lib/accommodationBookingViewModel";
export { toAccommodationDetailViewModel } from "./lib/accommodationDetailViewModel";
