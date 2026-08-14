import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccommodationDetail } from "../../../types/accommodation";
import { CouponInfo } from "../../../types/coupon";
import { startReservationCheckoutHandoff } from "../../reservations/appShell";
import {
  formatBookingDate,
  parseBookingCount,
  parseBookingDate,
  selectBookingCoupon,
  toBookingDateKey,
  validateBookingDateRange,
  validateBookingGuestCount,
} from "../lib/accommodationBookingRules";

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
  const isMountedRef = useRef(true);
  const maxOccupancy =
    accommodation?.policy.max_occupancy ?? Number.MAX_SAFE_INTEGER;
  const maxInfants =
    accommodation?.policy.infant_occupancy ?? Number.MAX_SAFE_INTEGER;
  const maxPets = accommodation?.policy.pet_occupancy ?? Number.MAX_SAFE_INTEGER;
  const [adultCount, setAdultCount] = useState(() =>
    parseBookingCount(searchParams, "adultOccupancy", 1, 1, maxOccupancy)
  );
  const [childCount, setChildCount] = useState(() =>
    parseBookingCount(searchParams, "childOccupancy", 0, 0, maxOccupancy)
  );
  const [infantCount, setInfantCount] = useState(() =>
    parseBookingCount(searchParams, "infantOccupancy", 0, 0, maxInfants)
  );
  const [petCount, setPetCount] = useState(() =>
    parseBookingCount(searchParams, "petOccupancy", 0, 0, maxPets)
  );

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const { checkIn, checkOut, nights, totalPrice } = useMemo(() => {
    const urlCheckIn = searchParams.get("checkIn");
    const urlCheckOut = searchParams.get("checkOut");

    if (urlCheckIn && urlCheckOut && accommodation) {
      const checkInDate = parseBookingDate(urlCheckIn);
      const checkOutDate = parseBookingDate(urlCheckOut);

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
      const checkInDate = parseBookingDate(urlCheckIn);

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
          .map(toBookingDateKey)
          .filter((dateKey): dateKey is string => dateKey !== null)
      );

      const checkInDate = new Date(today);
      while (unavailableDateKeys.has(formatBookingDate(checkInDate))) {
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
      parseBookingCount(searchParams, "adultOccupancy", 1, 1, maxOccupancy)
    );
    setChildCount(
      parseBookingCount(searchParams, "childOccupancy", 0, 0, maxOccupancy)
    );
    setInfantCount(
      parseBookingCount(searchParams, "infantOccupancy", 0, 0, maxInfants)
    );
    setPetCount(parseBookingCount(searchParams, "petOccupancy", 0, 0, maxPets));
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
        params.set("checkIn", formatBookingDate(newCheckIn));
      } else {
        params.delete("checkIn");
      }

      if (newCheckOut) {
        params.set("checkOut", formatBookingDate(newCheckOut));
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

    const dateRangeError = validateBookingDateRange({
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

    const guestCountError = validateBookingGuestCount({
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
    if (isMountedRef.current) {
      setIsReserving(true);
    }
    clearError();

    try {
      const reservationCoupon = selectBookingCoupon({
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
        isActive: () => isMountedRef.current,
      });
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error);
      }
    } finally {
      isReservingRef.current = false;
      if (isMountedRef.current) {
        setIsReserving(false);
      }
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
    formatDateForUrl: formatBookingDate,
    handleDateSelect,
    handleReserve,
  };
};
