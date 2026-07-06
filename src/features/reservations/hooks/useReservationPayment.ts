import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reservationApi } from "../../../api";
import { routeTo } from "../../../routes/paths";
import { formatCheckoutDateParam } from "../lib/paymentRouteState";
import type { ReservationCheckoutState } from "../lib/reservationCheckoutState";
import { saveReservationCheckoutState } from "../lib/reservationCheckoutState";

interface UseReservationPaymentOptions {
  clearError: () => void;
  handleError: (error: unknown) => void;
}

interface StartReservationPaymentOptions {
  accommodationId: number;
  checkIn: Date;
  checkOut: Date;
  adultCount: number;
  childCount: number;
  infantCount?: number;
  petCount?: number;
}

const buildReservationCheckoutState = ({
  adultCount,
  childCount,
  checkIn,
  checkOut,
  infantCount = 0,
  petCount = 0,
  reservationResponse,
}: StartReservationPaymentOptions & {
  reservationResponse: Awaited<ReturnType<typeof reservationApi.create>>;
}): ReservationCheckoutState => ({
  reservationUid: reservationResponse.reservation_uid,
  orderName: reservationResponse.order_name,
  amount: reservationResponse.amount,
  customerEmail: reservationResponse.customer_email,
  customerName: reservationResponse.customer_name,
  checkIn: formatCheckoutDateParam(checkIn),
  checkOut: formatCheckoutDateParam(checkOut),
  adultOccupancy: adultCount,
  childOccupancy: childCount,
  infantOccupancy: infantCount,
  petOccupancy: petCount,
  couponName: null,
  couponDiscount: null,
});

export function useReservationPayment({
  clearError,
  handleError,
}: UseReservationPaymentOptions) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);

  const startReservationPayment = useCallback(
    async (options: StartReservationPaymentOptions) => {
      if (isLoadingRef.current) {
        return;
      }

      isLoadingRef.current = true;
      setIsLoading(true);
      clearError();

      try {
        const reservationResponse = await reservationApi.create({
          accommodation_id: options.accommodationId,
          check_in_date: formatCheckoutDateParam(options.checkIn),
          check_out_date: formatCheckoutDateParam(options.checkOut),
          guest_count: options.adultCount + options.childCount,
        });

        const checkoutState = buildReservationCheckoutState({
          ...options,
          reservationResponse,
        });
        const accommodationId = String(options.accommodationId);

        saveReservationCheckoutState(accommodationId, checkoutState);
        navigate(routeTo.accommodationConfirm(accommodationId), {
          state: checkoutState,
        });
      } catch (error) {
        handleError(error);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [clearError, handleError, navigate],
  );

  return {
    isLoading,
    isProcessingPayment: false,
    startReservationPayment,
  };
}
