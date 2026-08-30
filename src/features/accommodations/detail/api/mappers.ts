import type { AccommodationDetail } from "../model/accommodationDetail";
import type {
  AccommodationCoupon,
  AccommodationCouponCollection,
} from "../model/coupon";
import type {
  AccommodationDetailWire,
  CouponCollectionWire,
  CouponWire,
} from "./contracts";

export const toAccommodationDetail = (
  wire: AccommodationDetailWire,
): AccommodationDetail => ({
  id: wire.id,
  name: wire.name,
  description: wire.description,
  type: wire.type,
  basePrice: wire.base_price,
  currency: wire.currency,
  checkInTime: wire.check_in_time,
  checkOutTime: wire.check_out_time,
  unavailableDates: [...wire.unavailable_dates],
  isInWishlist: wire.is_in_wishlist,
  addressSummary: {
    country: wire.address_summary.country,
    state: wire.address_summary.state,
    city: wire.address_summary.city,
    district: wire.address_summary.district,
  },
  coordinate: {
    latitude: wire.coordinate.latitude,
    longitude: wire.coordinate.longitude,
  },
  host: {
    id: wire.host.id,
    nickname: wire.host.nickname,
    thumbnailImageUrl: wire.host.thumbnail_image_url,
  },
  policy: {
    maxOccupancy: wire.policy.max_occupancy,
    infantOccupancy: wire.policy.infant_occupancy,
    petOccupancy: wire.policy.pet_occupancy,
  },
  amenities: wire.amenities.map((amenity) => ({
    type: amenity.type,
    count: amenity.count,
  })),
  images: wire.images.map((image) => ({
    id: image.id,
    imageUrl: image.image_url,
  })),
  reviewSummary: {
    totalCount: wire.review_summary.total_count,
    averageRating: wire.review_summary.average_rating,
  },
});

export const toAccommodationCoupon = (
  wire: CouponWire,
): AccommodationCoupon => ({
  id: wire.id,
  name: wire.name,
  description: wire.description,
  discountType: wire.discount_type,
  discountValue: wire.discount_value,
  minPaymentPrice: wire.min_payment_price,
  maxDiscountAmount: wire.max_discount_amount,
  startDate: wire.start_date,
  endDate: wire.end_date,
  totalQuantity: wire.total_quantity,
  issuedQuantity: wire.issued_quantity,
});

export const toCouponCollection = (
  wire: CouponCollectionWire,
): AccommodationCouponCollection => ({
  coupons: wire.infos.map(toAccommodationCoupon),
});
