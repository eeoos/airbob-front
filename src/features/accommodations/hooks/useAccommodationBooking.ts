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
import { parsePositiveAccommodationId } from "../lib/accommodationId";

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
  onRequireAuth: (intent: ReservationStartAuthIntent) => void;
  startTransition: (callback: () => void) => void;
}

export interface AccommodationAuthIntentExecutionScope {
  readonly generation: number;
  readonly isCurrent: () => boolean;
}

export interface ReservationStartAuthIntent {
  readonly type: "reservation.start";
  readonly accommodationId: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
  readonly couponId: number | null;
}

export interface ReservationAuthIntentExecution
  extends AccommodationAuthIntentExecutionScope {
  readonly intent: ReservationStartAuthIntent;
}

interface ReserveCouponState {
  selectedCoupon?: CouponInfo | null;
  selectedCouponId?: number | null;
  couponDiscount?: number;
}

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
  const handledAuthIntentGenerationRef = useRef<number | null>(null);
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

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
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
    authIntentExecution?: ReservationAuthIntentExecution,
  ) {
    const isActionCurrent = () =>
      isMountedRef.current &&
      (!authIntentExecution || authIntentExecution.isCurrent());

    if (!isActionCurrent()) {
      return;
    }

    const parsedAccommodationId = parsePositiveAccommodationId(accommodationId);
    if (
      !parsedAccommodationId ||
      !accommodation ||
      accommodation.id !== parsedAccommodationId
    ) {
      if (!authIntentExecution) {
        handleError(new Error("숙소 정보를 불러올 수 없습니다."));
      }
      return;
    }

    const dateRangeError = validateBookingDateRange({
      checkIn,
      checkOut,
      unavailableDates: accommodation.unavailable_dates,
    });
    if (dateRangeError) {
      if (!authIntentExecution) {
        handleError(dateRangeError);
      }
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
      if (!authIntentExecution) {
        handleError(guestCountError);
      }
      return;
    }

    const reservationCoupon = selectBookingCoupon({
      reserveCouponState,
      selectedCoupon,
      selectedCouponId,
      couponDiscount,
    });
    const hasApplicableCoupon =
      reservationCoupon.discount > 0 &&
      reservationCoupon.couponId !== null &&
      reservationCoupon.coupon !== null &&
      reservationCoupon.coupon.id === reservationCoupon.couponId;
    const applicableCouponId = hasApplicableCoupon
      ? reservationCoupon.couponId
      : null;
    const normalizedCheckIn = formatBookingDate(validCheckIn);
    const normalizedCheckOut = formatBookingDate(validCheckOut);

    if (authIntentExecution) {
      const { intent } = authIntentExecution;
      if (
        !isAuthenticated ||
        intent.accommodationId !== parsedAccommodationId ||
        intent.checkIn !== normalizedCheckIn ||
        intent.checkOut !== normalizedCheckOut ||
        intent.adultCount !== adultCount ||
        intent.childCount !== childCount ||
        intent.infantCount !== infantCount ||
        intent.petCount !== petCount ||
        intent.couponId !== applicableCouponId ||
        handledAuthIntentGenerationRef.current ===
          authIntentExecution.generation
      ) {
        return;
      }
    } else if (!isAuthenticated) {
      onRequireAuth({
        type: "reservation.start",
        accommodationId: parsedAccommodationId,
        checkIn: normalizedCheckIn,
        checkOut: normalizedCheckOut,
        adultCount,
        childCount,
        infantCount,
        petCount,
        couponId: applicableCouponId,
      });
      return;
    }

    if (isReservingRef.current) {
      return;
    }

    if (authIntentExecution) {
      handledAuthIntentGenerationRef.current = authIntentExecution.generation;
    }
    isReservingRef.current = true;
    if (isActionCurrent()) {
      setIsReserving(true);
    }
    clearError();

    try {
      const appliedCoupon =
        hasApplicableCoupon &&
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
        checkIn: normalizedCheckIn,
        checkOut: normalizedCheckOut,
        adultCount,
        childCount,
        infantCount,
        petCount,
        appliedCoupon,
        navigate,
        isActive: isActionCurrent,
      });
    } catch (error) {
      if (isActionCurrent()) {
        handleError(error);
      }
    } finally {
      isReservingRef.current = false;
      if (isActionCurrent()) {
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
