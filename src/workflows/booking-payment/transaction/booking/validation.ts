import { parseCalendarLocalDateOrdinal } from "../../../../shared/lib/calendarLocalDate";
import type {
  BookingTransactionAppliedCoupon,
  BookingTransactionQuoteInput,
  BookingTransactionStartIntent,
  BookingTransactionValidationCode,
} from "./types";

const validationMessages: Readonly<
  Record<BookingTransactionValidationCode, string>
> = {
  INVALID_ACCOMMODATION: "숙소 정보를 불러올 수 없습니다.",
  INVALID_DATE: "체크인/체크아웃 날짜를 선택해주세요.",
  INVALID_DATE_RANGE: "체크아웃 날짜는 체크인 날짜 이후여야 합니다.",
  INVALID_AVAILABILITY: "예약 가능한 날짜를 다시 불러와주세요.",
  OUTSIDE_BOOKING_WINDOW: "선택한 날짜는 현재 예약 가능한 기간이 아닙니다.",
  UNAVAILABLE_DATE: "선택한 날짜에 예약할 수 없는 날짜가 포함되어 있습니다.",
  INVALID_OCCUPANCY: "예약 가능한 인원 수를 확인해주세요.",
  INVALID_COUPON: "적용할 수 없는 쿠폰입니다.",
};

export class BookingTransactionValidationError extends Error {
  readonly code: BookingTransactionValidationCode;

  constructor(code: BookingTransactionValidationCode) {
    super(validationMessages[code]);
    this.name = "BookingTransactionValidationError";
    this.code = code;
    Object.setPrototypeOf(this, BookingTransactionValidationError.prototype);
  }
}

const fail = (code: BookingTransactionValidationCode): never => {
  throw new BookingTransactionValidationError(code);
};

const isPositiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

const requireIntentDate = (value: string): number => {
  const ordinal = parseCalendarLocalDateOrdinal(value);
  if (ordinal === null) {
    throw new BookingTransactionValidationError("INVALID_DATE");
  }
  return ordinal;
};

const requireAvailabilityDate = (value: unknown): number => {
  const ordinal = parseCalendarLocalDateOrdinal(value);
  if (ordinal === null) {
    throw new BookingTransactionValidationError("INVALID_AVAILABILITY");
  }
  return ordinal;
};

const freezeIntent = (
  intent: BookingTransactionStartIntent,
): BookingTransactionStartIntent =>
  Object.freeze({
    type: "reservation.start" as const,
    accommodationId: intent.accommodationId,
    checkIn: intent.checkIn,
    checkOut: intent.checkOut,
    adultCount: intent.adultCount,
    childCount: intent.childCount,
    infantCount: intent.infantCount,
    petCount: intent.petCount,
    couponId: intent.couponId,
  });

const validateCoupon = (
  couponId: number | null,
  coupon: BookingTransactionAppliedCoupon | null,
): void => {
  if (couponId === null) {
    if (coupon !== null) fail("INVALID_COUPON");
    return;
  }

  if (
    !isPositiveSafeInteger(couponId) ||
    coupon === null ||
    coupon.id !== couponId ||
    !isPositiveSafeInteger(coupon.id) ||
    coupon.name.trim().length === 0 ||
    coupon.name.trim() !== coupon.name ||
    !Number.isFinite(coupon.discount) ||
    coupon.discount <= 0
  ) {
    fail("INVALID_COUPON");
  }
};

export const validateBookingTransactionQuoteInput = (
  input: BookingTransactionQuoteInput,
): BookingTransactionStartIntent => {
  const { accommodation, availability, intent } = input;
  if (
    !isPositiveSafeInteger(intent.accommodationId) ||
    !isPositiveSafeInteger(accommodation.id) ||
    accommodation.id !== intent.accommodationId ||
    !isPositiveSafeInteger(accommodation.maxOccupancy) ||
    !isNonNegativeSafeInteger(accommodation.maxInfants) ||
    !isNonNegativeSafeInteger(accommodation.maxPets)
  ) {
    fail("INVALID_ACCOMMODATION");
  }

  const checkInOrdinal = requireIntentDate(intent.checkIn);
  const checkOutOrdinal = requireIntentDate(intent.checkOut);
  if (checkOutOrdinal <= checkInOrdinal) fail("INVALID_DATE_RANGE");

  if (availability === null) {
    throw new BookingTransactionValidationError("INVALID_AVAILABILITY");
  }
  if (
    !isPositiveSafeInteger(availability.accommodationId) ||
    availability.accommodationId !== accommodation.id ||
    !Array.isArray(availability.unavailableRanges)
  ) {
    fail("INVALID_AVAILABILITY");
  }

  const windowStartOrdinal = requireAvailabilityDate(
    availability.bookingWindowStartInclusive,
  );
  const windowEndOrdinal = requireAvailabilityDate(
    availability.bookingWindowEndExclusive,
  );
  if (windowStartOrdinal >= windowEndOrdinal) fail("INVALID_AVAILABILITY");

  let previousRangeEndOrdinal = windowStartOrdinal;
  for (const range of availability.unavailableRanges) {
    const rangeStartOrdinal = requireAvailabilityDate(range?.startDate);
    const rangeEndOrdinal = requireAvailabilityDate(range?.endDateExclusive);
    if (
      rangeStartOrdinal >= rangeEndOrdinal ||
      rangeStartOrdinal < windowStartOrdinal ||
      rangeEndOrdinal > windowEndOrdinal ||
      rangeStartOrdinal < previousRangeEndOrdinal
    ) {
      fail("INVALID_AVAILABILITY");
    }
    previousRangeEndOrdinal = rangeEndOrdinal;

    if (
      rangeStartOrdinal < checkOutOrdinal &&
      rangeEndOrdinal > checkInOrdinal
    ) {
      fail("UNAVAILABLE_DATE");
    }
  }

  if (
    checkInOrdinal < windowStartOrdinal ||
    checkInOrdinal >= windowEndOrdinal ||
    checkOutOrdinal > windowEndOrdinal
  ) {
    fail("OUTSIDE_BOOKING_WINDOW");
  }

  if (
    !isNonNegativeSafeInteger(intent.adultCount) ||
    !isNonNegativeSafeInteger(intent.childCount) ||
    !isNonNegativeSafeInteger(intent.infantCount) ||
    !isNonNegativeSafeInteger(intent.petCount) ||
    intent.adultCount + intent.childCount < 1 ||
    intent.adultCount + intent.childCount > accommodation.maxOccupancy ||
    intent.infantCount > accommodation.maxInfants ||
    intent.petCount > accommodation.maxPets
  ) {
    fail("INVALID_OCCUPANCY");
  }

  validateCoupon(intent.couponId, input.appliedCoupon);
  return freezeIntent(intent);
};
