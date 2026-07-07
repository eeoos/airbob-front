import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccommodationDetail } from "../../../types/accommodation";
import { CouponInfo } from "../../../types/coupon";
import {
  formatCheckoutDateParam,
  startReservationCheckoutHandoff,
} from "../../reservations/appShell";

type SetSearchParams = (
  nextParams: URLSearchParams,
  options?: { replace?: boolean }
) => void;

interface UseAccommodationBookingOptions {
  accommodationId?: string;
  accommodation: AccommodationDetail | null;
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParams;
  isAuthenticated: boolean;
  selectedCoupon: CouponInfo | null;
  selectedCouponId: number | null;
  couponDiscount: number;
  navigate: (
    to: string,
    options?: { replace?: boolean; state?: unknown }
  ) => void;
  handleError: (error: unknown) => unknown;
  clearError: () => void;
  onRequireAuth: (action: () => void | Promise<void>) => void;
  startTransition: (callback: () => void) => void;
}

interface ReserveCouponState {
  selectedCoupon?: CouponInfo | null;
  selectedCouponId?: number | null;
  couponDiscount?: number;
}

interface ReserveOptions {
  skipAuthCheck?: boolean;
}

interface BookingDateRangeValidation {
  checkIn: Date | null;
  checkOut: Date | null;
  unavailableDates: Array<string | Date>;
}

interface BookingGuestCountValidation {
  adultCount: number;
  childCount: number;
  maxOccupancy: number;
}

interface CouponSelectionInput {
  reserveCouponState?: ReserveCouponState;
  selectedCoupon: CouponInfo | null;
  selectedCouponId: number | null;
  couponDiscount: number;
}

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const parseCountParam = (
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number
) => {
  const value = searchParams.get(key);
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return fallback;
  }

  return clampNumber(parsed, min, max);
};

const parseDateFromUrl = (dateString: string): Date | null => {
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

const formatDateForUrl = formatCheckoutDateParam;

const toDateKey = (date: Date | string) => {
  const parsedDate = typeof date === "string" ? parseDateFromUrl(date) : date;
  if (!parsedDate) {
    return null;
  }

  return formatDateForUrl(parsedDate);
};

const hasUnavailableDateInRange = (
  checkIn: Date,
  checkOut: Date,
  unavailableDates: Array<string | Date>
) => {
  const unavailableDateKeys = new Set(
    unavailableDates
      .map(toDateKey)
      .filter((dateKey): dateKey is string => dateKey !== null)
  );
  const cursor = new Date(checkIn);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    if (unavailableDateKeys.has(formatDateForUrl(cursor))) {
      return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return false;
};

const validateDateRange = ({
  checkIn,
  checkOut,
  unavailableDates,
}: BookingDateRangeValidation): Error | null => {
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

const validateGuestCount = ({
  adultCount,
  childCount,
  maxOccupancy,
}: BookingGuestCountValidation): Error | null => {
  const guestCount = adultCount + childCount;

  if (guestCount < 1 || guestCount > maxOccupancy) {
    return new Error("예약 가능한 인원 수를 확인해주세요.");
  }

  return null;
};

const selectReservationCoupon = ({
  reserveCouponState,
  selectedCoupon,
  selectedCouponId,
  couponDiscount,
}: CouponSelectionInput) => {
  const discount = reserveCouponState?.couponDiscount ?? couponDiscount;

  return {
    discount,
    coupon: reserveCouponState?.selectedCoupon ?? selectedCoupon,
    couponId: reserveCouponState?.selectedCouponId ?? selectedCouponId,
  };
};

const handoffReservationAuth = (
  isAuthenticated: boolean,
  options: ReserveOptions,
  onRequireAuth: (action: () => void | Promise<void>) => void,
  action: () => void | Promise<void>,
) => {
  if (options.skipAuthCheck || isAuthenticated) {
    return false;
  }

  onRequireAuth(action);
  return true;
};

export const useAccommodationBooking = ({
  accommodationId,
  accommodation,
  searchParams,
  setSearchParams,
  isAuthenticated,
  selectedCoupon,
  selectedCouponId,
  couponDiscount,
  navigate,
  handleError,
  clearError,
  onRequireAuth,
  startTransition,
}: UseAccommodationBookingOptions) => {
  const [isGuestPickerOpen, setIsGuestPickerOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const isReservingRef = useRef(false);
  const maxOccupancy =
    accommodation?.policy.max_occupancy ?? Number.MAX_SAFE_INTEGER;
  const maxInfants =
    accommodation?.policy.infant_occupancy ?? Number.MAX_SAFE_INTEGER;
  const maxPets = accommodation?.policy.pet_occupancy ?? Number.MAX_SAFE_INTEGER;
  const [adultCount, setAdultCount] = useState(() =>
    parseCountParam(searchParams, "adultOccupancy", 1, 1, maxOccupancy)
  );
  const [childCount, setChildCount] = useState(() =>
    parseCountParam(searchParams, "childOccupancy", 0, 0, maxOccupancy)
  );
  const [infantCount, setInfantCount] = useState(() =>
    parseCountParam(searchParams, "infantOccupancy", 0, 0, maxInfants)
  );
  const [petCount, setPetCount] = useState(() =>
    parseCountParam(searchParams, "petOccupancy", 0, 0, maxPets)
  );

  const { checkIn, checkOut, nights, totalPrice } = useMemo(() => {
    const urlCheckIn = searchParams.get("checkIn");
    const urlCheckOut = searchParams.get("checkOut");

    if (urlCheckIn && urlCheckOut && accommodation) {
      const checkInDate = parseDateFromUrl(urlCheckIn);
      const checkOutDate = parseDateFromUrl(urlCheckOut);

      if (checkInDate && checkOutDate && checkOutDate > checkInDate) {
        const nightsCount = Math.ceil(
          (checkOutDate.getTime() - checkInDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        return {
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights: nightsCount,
          totalPrice: accommodation.base_price * nightsCount,
        };
      }
    }

    if (urlCheckIn && accommodation) {
      const checkInDate = parseDateFromUrl(urlCheckIn);

      if (checkInDate) {
        return {
          checkIn: checkInDate,
          checkOut: null,
          nights: 0,
          totalPrice: 0,
        };
      }
    }

    if (accommodation) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const unavailableDateKeys = new Set(
        accommodation.unavailable_dates
          .map(toDateKey)
          .filter((dateKey): dateKey is string => dateKey !== null)
      );

      const checkInDate = new Date(today);
      while (unavailableDateKeys.has(formatDateForUrl(checkInDate))) {
        checkInDate.setDate(checkInDate.getDate() + 1);
      }

      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 1);

      return {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: 1,
        totalPrice: accommodation.base_price,
      };
    }

    return {
      checkIn: null,
      checkOut: null,
      nights: 0,
      totalPrice: 0,
    };
  }, [accommodation, searchParams]);

  const payablePrice = Math.max(totalPrice - couponDiscount, 0);

  useEffect(() => {
    if (!accommodation) {
      return;
    }

    setAdultCount(
      parseCountParam(searchParams, "adultOccupancy", 1, 1, maxOccupancy)
    );
    setChildCount(
      parseCountParam(searchParams, "childOccupancy", 0, 0, maxOccupancy)
    );
    setInfantCount(
      parseCountParam(searchParams, "infantOccupancy", 0, 0, maxInfants)
    );
    setPetCount(parseCountParam(searchParams, "petOccupancy", 0, 0, maxPets));
  }, [accommodation, maxInfants, maxOccupancy, maxPets, searchParams]);

  const formatDate = useCallback((date: Date | null): string => {
    if (!date) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}. ${month}. ${day}.`;
  }, []);

  const handleDateSelect = useCallback((
    newCheckIn: Date | null,
    newCheckOut: Date | null
  ) => {
    if (!accommodationId) {
      return;
    }

    startTransition(() => {
      const params = new URLSearchParams(searchParams);

      if (newCheckIn) {
        params.set("checkIn", formatDateForUrl(newCheckIn));
      } else {
        params.delete("checkIn");
      }

      if (newCheckOut) {
        params.set("checkOut", formatDateForUrl(newCheckOut));
        setIsDatePickerOpen(false);
      } else {
        params.delete("checkOut");
      }

      setSearchParams(params, { replace: true });
    });
  }, [accommodationId, searchParams, setSearchParams, startTransition]);

  const handleReserve = useCallback(async function reserve(
    reserveCouponState?: ReserveCouponState,
    options: ReserveOptions = {}
  ) {
    if (
      handoffReservationAuth(isAuthenticated, options, onRequireAuth, () =>
        reserve(reserveCouponState, { skipAuthCheck: true }),
      )
    ) {
      return;
    }

    if (!accommodationId || !accommodation) {
      handleError(new Error("숙소 정보를 불러올 수 없습니다."));
      return;
    }

    const dateRangeError = validateDateRange({
      checkIn,
      checkOut,
      unavailableDates: accommodation.unavailable_dates,
    });
    if (dateRangeError) {
      handleError(dateRangeError);
      return;
    }

    const validCheckIn = checkIn;
    const validCheckOut = checkOut;
    if (!validCheckIn || !validCheckOut) {
      return;
    }

    const guestCountError = validateGuestCount({
      adultCount,
      childCount,
      maxOccupancy: accommodation.policy.max_occupancy,
    });
    if (guestCountError) {
      handleError(guestCountError);
      return;
    }

    if (isReservingRef.current) {
      return;
    }

    isReservingRef.current = true;
    setIsReserving(true);
    clearError();

    try {
      const reservationCoupon = selectReservationCoupon({
        reserveCouponState,
        selectedCoupon,
        selectedCouponId,
        couponDiscount,
      });
      const appliedCoupon =
        reservationCoupon.discount > 0 &&
        reservationCoupon.couponId !== null &&
        reservationCoupon.coupon !== null
          ? {
              id: reservationCoupon.couponId,
              name: reservationCoupon.coupon.name,
              discount: reservationCoupon.discount,
            }
          : null;

      await startReservationCheckoutHandoff({
        accommodationId: accommodation.id,
        checkIn: validCheckIn,
        checkOut: validCheckOut,
        adultCount,
        childCount,
        infantCount,
        petCount,
        appliedCoupon,
        navigate,
      });
    } catch (error) {
      handleError(error);
    } finally {
      isReservingRef.current = false;
      setIsReserving(false);
    }
  }, [
    accommodation,
    accommodationId,
    adultCount,
    checkIn,
    checkOut,
    childCount,
    clearError,
    couponDiscount,
    handleError,
    infantCount,
    isAuthenticated,
    navigate,
    onRequireAuth,
    petCount,
    selectedCoupon,
    selectedCouponId,
  ]);

  return {
    adultCount,
    setAdultCount,
    childCount,
    setChildCount,
    infantCount,
    setInfantCount,
    petCount,
    setPetCount,
    isGuestPickerOpen,
    setIsGuestPickerOpen,
    isDatePickerOpen,
    setIsDatePickerOpen,
    isReserving,
    checkIn,
    checkOut,
    nights,
    totalPrice,
    payablePrice,
    formatDate,
    formatDateForUrl,
    handleDateSelect,
    handleReserve,
  };
};
