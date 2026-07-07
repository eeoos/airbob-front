import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startReservationCheckoutHandoff } from "../lib/reservationCheckoutHandoff";

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
        await startReservationCheckoutHandoff({
          ...options,
          appliedCoupon: null,
          navigate,
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
