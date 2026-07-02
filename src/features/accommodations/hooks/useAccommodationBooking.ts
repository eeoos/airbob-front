import { useCallback, useEffect, useMemo, useState } from "react";
import { reservationApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";
import { CouponInfo } from "../../../types/coupon";

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
  navigate: (to: string) => void;
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

const parseCountParam = (
  searchParams: URLSearchParams,
  key: string,
  fallback: number
) => {
  const value = searchParams.get(key);
  return value ? parseInt(value, 10) : fallback;
};

const parseDateFromUrl = (dateString: string): Date => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDateForUrl = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [adultCount, setAdultCount] = useState(() =>
    parseCountParam(searchParams, "adultOccupancy", 1)
  );
  const [childCount, setChildCount] = useState(() =>
    parseCountParam(searchParams, "childOccupancy", 0)
  );
  const [infantCount, setInfantCount] = useState(() =>
    parseCountParam(searchParams, "infantOccupancy", 0)
  );
  const [petCount, setPetCount] = useState(() =>
    parseCountParam(searchParams, "petOccupancy", 0)
  );

  const { checkIn, checkOut, nights, totalPrice } = useMemo(() => {
    const urlCheckIn = searchParams.get("checkIn");
    const urlCheckOut = searchParams.get("checkOut");

    if (urlCheckIn && urlCheckOut && accommodation) {
      const checkInDate = parseDateFromUrl(urlCheckIn);
      const checkOutDate = parseDateFromUrl(urlCheckOut);
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

    if (urlCheckIn && accommodation) {
      return {
        checkIn: parseDateFromUrl(urlCheckIn),
        checkOut: null,
        nights: 0,
        totalPrice: 0,
      };
    }

    if (accommodation) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const unavailableDates = accommodation.unavailable_dates.map((date) => {
        const unavailableDate = new Date(date);
        unavailableDate.setHours(0, 0, 0, 0);
        return unavailableDate;
      });

      const checkInDate = new Date(today);
      while (
        unavailableDates.some(
          (unavailableDate) =>
            unavailableDate.getTime() === checkInDate.getTime()
        )
      ) {
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

    setAdultCount(parseCountParam(searchParams, "adultOccupancy", 1));
    setChildCount(parseCountParam(searchParams, "childOccupancy", 0));
    setInfantCount(parseCountParam(searchParams, "infantOccupancy", 0));
    setPetCount(parseCountParam(searchParams, "petOccupancy", 0));
  }, [accommodation, searchParams]);

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

    clearError();

    try {
      const checkInStr = formatDateForUrl(checkIn);
      const checkOutStr = formatDateForUrl(checkOut);
      const guestCount = adultCount + childCount;
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

      const params = new URLSearchParams();
      params.set("reservationUid", reservation_uid);
      params.set("orderName", order_name);
      params.set("amount", amount.toString());
      params.set("customerEmail", customer_email);
      params.set("customerName", customer_name);
      params.set("checkIn", checkInStr);
      params.set("checkOut", checkOutStr);
      params.set("adultOccupancy", adultCount.toString());
      params.set("childOccupancy", childCount.toString());
      params.set("infantOccupancy", infantCount.toString());
      params.set("petOccupancy", petCount.toString());
      if (reserveCouponDiscount > 0 && reserveSelectedCoupon) {
        params.set("couponName", reserveSelectedCoupon.name);
        params.set("couponDiscount", reserveCouponDiscount.toString());
      }

      navigate(`/accommodations/${accommodationId}/confirm?${params.toString()}`);
    } catch (error) {
      handleError(error);
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
