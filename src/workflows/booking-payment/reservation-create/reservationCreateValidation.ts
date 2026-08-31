import type {
  AppliedReservationCoupon,
  ReservationCreateCommandInput,
  ReservationCreateValidationCode,
  ReservationStartIntent,
  ValidatedReservationCreateCommand,
} from "./reservationCreateTypes";

const validationMessages: Readonly<
  Record<ReservationCreateValidationCode, string>
> = {
  INVALID_ACCOMMODATION: "숙소 정보를 불러올 수 없습니다.",
  INVALID_DATE: "체크인/체크아웃 날짜를 선택해주세요.",
  INVALID_DATE_RANGE: "체크아웃 날짜는 체크인 날짜 이후여야 합니다.",
  UNAVAILABLE_DATE: "선택한 날짜에 예약할 수 없는 날짜가 포함되어 있습니다.",
  INVALID_OCCUPANCY: "예약 가능한 인원 수를 확인해주세요.",
  INVALID_COUPON: "적용할 수 없는 쿠폰입니다.",
};

export class ReservationCreateValidationError extends Error {
  readonly code: ReservationCreateValidationCode;

  constructor(code: ReservationCreateValidationCode) {
    super(validationMessages[code]);
    this.name = "ReservationCreateValidationError";
    this.code = code;
    Object.setPrototypeOf(this, ReservationCreateValidationError.prototype);
  }
}

const fail = (code: ReservationCreateValidationCode): never => {
  throw new ReservationCreateValidationError(code);
};

const isPositiveSafeInteger = (value: number) =>
  Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: number) =>
  Number.isSafeInteger(value) && value >= 0;

const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayMilliseconds = 24 * 60 * 60 * 1000;

const parseLocalDateOrdinal = (value: string): number | null => {
  const match = localDatePattern.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) return null;

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp / dayMilliseconds;
};

const requireLocalDateOrdinal = (value: string): number => {
  const ordinal = parseLocalDateOrdinal(value);
  if (ordinal === null) {
    throw new ReservationCreateValidationError("INVALID_DATE");
  }

  return ordinal;
};

const freezeIntent = (intent: ReservationStartIntent): ReservationStartIntent =>
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

const freezeCoupon = (
  coupon: AppliedReservationCoupon | null,
): AppliedReservationCoupon | null =>
  coupon
    ? Object.freeze({
        id: coupon.id,
        name: coupon.name,
        discount: coupon.discount,
      })
    : null;

export const validateReservationCreateCommand = (
  input: ReservationCreateCommandInput,
): ValidatedReservationCreateCommand => {
  const { accommodation, intent } = input;
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

  const checkInOrdinal = requireLocalDateOrdinal(intent.checkIn);
  const checkOutOrdinal = requireLocalDateOrdinal(intent.checkOut);
  if (checkOutOrdinal <= checkInOrdinal) {
    fail("INVALID_DATE_RANGE");
  }

  const unavailableOrdinals = accommodation.unavailableDates
    .map(parseLocalDateOrdinal)
    .filter((value): value is number => value !== null);
  for (const unavailableDay of unavailableOrdinals) {
    if (unavailableDay >= checkInOrdinal && unavailableDay < checkOutOrdinal) {
      fail("UNAVAILABLE_DATE");
    }
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

  const coupon = input.appliedCoupon;
  if (intent.couponId === null) {
    if (coupon !== null) fail("INVALID_COUPON");
  } else if (
    !isPositiveSafeInteger(intent.couponId) ||
    coupon === null ||
    coupon.id !== intent.couponId ||
    !isPositiveSafeInteger(coupon.id) ||
    !coupon.name.trim() ||
    !Number.isFinite(coupon.discount) ||
    coupon.discount <= 0
  ) {
    fail("INVALID_COUPON");
  }

  return Object.freeze({
    intent: freezeIntent(intent),
    appliedCoupon: freezeCoupon(coupon),
    routeLease: input.routeLease,
  });
};
