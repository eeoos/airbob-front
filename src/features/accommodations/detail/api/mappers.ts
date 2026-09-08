import {
  isCanonicalCalendarLocalDate,
  parseCalendarLocalDateOrdinal,
} from "../../../../shared/lib/calendarLocalDate";
import type { AccommodationAvailability } from "../model/accommodationAvailability";
import type { AccommodationDetail } from "../model/accommodationDetail";
import type {
  AccommodationCouponCampaign,
  AccommodationCouponCollection,
  AccommodationMemberCoupon,
  AccommodationMemberCouponCollection,
} from "../model/coupon";
import type {
  AccommodationAvailabilityWire,
  AccommodationDetailWire,
  CouponCollectionWire,
  CouponWire,
  MemberCouponWire,
  MemberCouponCollectionWire,
} from "./contracts";

export const toAccommodationDetail = (
  wire: AccommodationDetailWire,
): AccommodationDetail => {
  if (typeof wire.time_zone_id !== "string" || !wire.time_zone_id.trim()) {
    throw new TypeError("Accommodation detail timeZoneId is invalid.");
  }

  return {
    id: wire.id,
    name: wire.name,
    description: wire.description,
    type: wire.type,
    basePrice: wire.base_price,
    currency: wire.currency,
    checkInTime: wire.check_in_time,
    checkOutTime: wire.check_out_time,
    timeZoneId: wire.time_zone_id,
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
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalidAvailability = (): never => {
  throw new TypeError("Accommodation availability response is invalid.");
};

export const toAccommodationAvailability = (
  value: unknown,
  accommodationId: number,
): AccommodationAvailability => {
  if (!Number.isSafeInteger(accommodationId) || accommodationId <= 0) {
    return invalidAvailability();
  }
  if (!isRecord(value)) return invalidAvailability();

  const wire = value as Partial<AccommodationAvailabilityWire>;
  const start = wire.booking_window_start_inclusive;
  const end = wire.booking_window_end_exclusive;
  if (
    !isCanonicalCalendarLocalDate(start) ||
    !isCanonicalCalendarLocalDate(end) ||
    !Array.isArray(wire.unavailable_ranges)
  ) {
    return invalidAvailability();
  }

  const startOrdinal = parseCalendarLocalDateOrdinal(start);
  const endOrdinal = parseCalendarLocalDateOrdinal(end);
  if (
    startOrdinal === null ||
    endOrdinal === null ||
    startOrdinal >= endOrdinal
  ) {
    return invalidAvailability();
  }

  let previousEndOrdinal = startOrdinal;
  const unavailableRanges = wire.unavailable_ranges.map((candidate) => {
    if (!isRecord(candidate)) return invalidAvailability();

    const rangeStart = candidate.start_date;
    const rangeEnd = candidate.end_date_exclusive;
    if (
      !isCanonicalCalendarLocalDate(rangeStart) ||
      !isCanonicalCalendarLocalDate(rangeEnd)
    ) {
      return invalidAvailability();
    }

    const rangeStartOrdinal = parseCalendarLocalDateOrdinal(rangeStart);
    const rangeEndOrdinal = parseCalendarLocalDateOrdinal(rangeEnd);
    if (
      rangeStartOrdinal === null ||
      rangeEndOrdinal === null ||
      rangeStartOrdinal >= rangeEndOrdinal ||
      rangeStartOrdinal < startOrdinal ||
      rangeEndOrdinal > endOrdinal ||
      rangeStartOrdinal < previousEndOrdinal
    ) {
      return invalidAvailability();
    }
    previousEndOrdinal = rangeEndOrdinal;

    return Object.freeze({
      startDate: rangeStart,
      endDateExclusive: rangeEnd,
    });
  });

  return Object.freeze({
    accommodationId,
    bookingWindowStartInclusive: start,
    bookingWindowEndExclusive: end,
    unavailableRanges: Object.freeze(unavailableRanges),
  });
};

const couponLocalDateTime = (value: string): string => {
  if (
    typeof value !== "string" ||
    !isCanonicalCalendarLocalDate(value.slice(0, 10)) ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/.test(
      value,
    )
  )
    throw new TypeError("Coupon period is invalid.");
  return value;
};

const toAccommodationCoupon = (
  wire: CouponWire,
): AccommodationCouponCampaign => {
  if (!["UPCOMING", "OPEN", "SOLD_OUT"].includes(wire.issuance_status)) {
    throw new TypeError("Coupon issuance status is invalid.");
  }
  return {
    kind: "campaign",
    id: wire.id,
    name: wire.name,
    description: wire.description,
    discountType: wire.discount_type,
    discountValue: wire.discount_value,
    minPaymentPrice: wire.min_payment_price,
    maxDiscountAmount: wire.max_discount_amount,
    issueStartAt: couponLocalDateTime(wire.issue_start_at),
    issueEndAt: couponLocalDateTime(wire.issue_end_at),
    usableFrom: couponLocalDateTime(wire.usable_from),
    usableUntil: couponLocalDateTime(wire.usable_until),
    issuanceStatus: wire.issuance_status,
    totalQuantity: wire.total_quantity,
    issuedQuantity: wire.issued_quantity,
  };
};

export const toCouponCollection = (
  wire: CouponCollectionWire,
): AccommodationCouponCollection => ({
  coupons: wire.infos.map(toAccommodationCoupon),
});

const toMemberCoupon = (wire: MemberCouponWire): AccommodationMemberCoupon => {
  if (
    !["UPCOMING", "AVAILABLE", "UNAVAILABLE", "USED", "EXPIRED"].includes(
      wire.status,
    )
  ) {
    throw new TypeError("Member coupon status is invalid.");
  }
  return {
    kind: "owned",
    id: wire.coupon_id,
    name: wire.name,
    description: wire.description,
    discountType: wire.discount_type,
    discountValue: wire.discount_value,
    minPaymentPrice: wire.min_payment_price,
    maxDiscountAmount: wire.max_discount_amount,
    usableFrom: couponLocalDateTime(wire.usable_from),
    usableUntil: couponLocalDateTime(wire.usable_until),
    status: wire.status,
  };
};

export const toMemberCouponCollection = (
  wire: MemberCouponCollectionWire,
): AccommodationMemberCouponCollection => ({
  coupons: wire.infos.map(toMemberCoupon),
});
