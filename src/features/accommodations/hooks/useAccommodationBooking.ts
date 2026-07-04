import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reservationApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";
import { CouponInfo } from "../../../types/coupon";
import { routeTo } from "../../../routes/paths";
import type { ReservationCheckoutState } from "../../reservations/lib/reservationCheckoutState";
import {
  saveReservationCheckoutState,
} from "../../reservations/lib/reservationCheckoutState";

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

const formatDateForUrl = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
    if (!options.skipAuthCheck && !isAuthenticated) {
      onRequireAuth(() => reserve(reserveCouponState, { skipAuthCheck: true }));
      return;
    }

    if (!accommodationId || !accommodation) {
      handleError(new Error("숙소 정보를 불러올 수 없습니다."));
      return;
    }

    if (!checkIn || !checkOut) {
      handleError(new Error("체크인/체크아웃 날짜를 선택해주세요."));
      return;
    }

    if (checkOut <= checkIn) {
      handleError(new Error("체크아웃 날짜는 체크인 날짜 이후여야 합니다."));
      return;
    }

    if (hasUnavailableDateInRange(checkIn, checkOut, accommodation.unavailable_dates)) {
      handleError(new Error("선택한 날짜에 예약할 수 없는 날짜가 포함되어 있습니다."));
      return;
    }

    const guestCount = adultCount + childCount;
    if (guestCount < 1 || guestCount > accommodation.policy.max_occupancy) {
      handleError(new Error("예약 가능한 인원 수를 확인해주세요."));
      return;
    }

    if (isReservingRef.current) {
      return;
    }

    isReservingRef.current = true;
    setIsReserving(true);
    clearError();

    try {
      const checkInStr = formatDateForUrl(checkIn);
      const checkOutStr = formatDateForUrl(checkOut);
      const reserveCouponDiscount =
        reserveCouponState?.couponDiscount ?? couponDiscount;
      const reserveSelectedCouponId =
        reserveCouponState?.selectedCouponId ?? selectedCouponId;
      const reserveSelectedCoupon =
        reserveCouponState?.selectedCoupon ?? selectedCoupon;

      const reservationResponse = await reservationApi.create({
        accommodation_id: accommodation.id,
        check_in_date: checkInStr,
        check_out_date: checkOutStr,
        guest_count: guestCount,
        coupon_id: reserveCouponDiscount > 0 ? reserveSelectedCouponId : null,
      });

      const {
        reservation_uid,
        order_name,
        amount,
        customer_email,
        customer_name,
      } = reservationResponse;

      const checkoutState: ReservationCheckoutState = {
        reservationUid: reservation_uid,
        orderName: order_name,
        amount,
        customerEmail: customer_email,
        customerName: customer_name,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        adultOccupancy: adultCount,
        childOccupancy: childCount,
        infantOccupancy: infantCount,
        petOccupancy: petCount,
        couponName:
          reserveCouponDiscount > 0 && reserveSelectedCoupon
            ? reserveSelectedCoupon.name
            : null,
        couponDiscount: reserveCouponDiscount > 0 ? reserveCouponDiscount : null,
      };

      saveReservationCheckoutState(accommodationId, checkoutState);
      navigate(routeTo.accommodationConfirm(accommodationId), {
        state: checkoutState,
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
