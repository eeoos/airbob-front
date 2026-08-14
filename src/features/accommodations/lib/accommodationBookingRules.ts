import type { CouponInfo } from "../../../types/coupon";

export const clampBookingNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const parseBookingCount = (
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number,
) => {
  const value = searchParams.get(key);
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return fallback;
  }

  return clampBookingNumber(parsed, min, max);
};

export const parseBookingDate = (dateString: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const formatBookingDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toBookingDateKey = (date: Date | string) => {
  const parsedDate = typeof date === "string" ? parseBookingDate(date) : date;
  return parsedDate ? formatBookingDate(parsedDate) : null;
};

export const hasUnavailableDateInRange = (
  checkIn: Date,
  checkOut: Date,
  unavailableDates: Array<string | Date>,
) => {
  const unavailableDateKeys = new Set(
    unavailableDates
      .map(toBookingDateKey)
      .filter((dateKey): dateKey is string => dateKey !== null),
  );
  const cursor = new Date(checkIn);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    if (unavailableDateKeys.has(formatBookingDate(cursor))) {
      return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return false;
};

export const validateBookingDateRange = ({
  checkIn,
  checkOut,
  unavailableDates,
}: {
  checkIn: Date | null;
  checkOut: Date | null;
  unavailableDates: Array<string | Date>;
}): Error | null => {
  if (!checkIn || !checkOut) {
    return new Error("체크인/체크아웃 날짜를 선택해주세요.");
  }

  if (checkOut <= checkIn) {
    return new Error("체크아웃 날짜는 체크인 날짜 이후여야 합니다.");
  }

  if (hasUnavailableDateInRange(checkIn, checkOut, unavailableDates)) {
    return new Error("선택한 날짜에 예약할 수 없는 날짜가 포함되어 있습니다.");
  }

  return null;
};

export const validateBookingGuestCount = ({
  adultCount,
  childCount,
  maxOccupancy,
}: {
  adultCount: number;
  childCount: number;
  maxOccupancy: number;
}): Error | null => {
  const guestCount = adultCount + childCount;

  if (guestCount < 1 || guestCount > maxOccupancy) {
    return new Error("예약 가능한 인원 수를 확인해주세요.");
  }

  return null;
};

export const selectBookingCoupon = ({
  reserveCouponState,
  selectedCoupon,
  selectedCouponId,
  couponDiscount,
}: {
  reserveCouponState?: {
    selectedCoupon?: CouponInfo | null;
    selectedCouponId?: number | null;
    couponDiscount?: number;
  };
  selectedCoupon: CouponInfo | null;
  selectedCouponId: number | null;
  couponDiscount: number;
}) => ({
  discount: reserveCouponState?.couponDiscount ?? couponDiscount,
  coupon: reserveCouponState?.selectedCoupon ?? selectedCoupon,
  couponId: reserveCouponState?.selectedCouponId ?? selectedCouponId,
});
