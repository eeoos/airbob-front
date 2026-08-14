import { useCallback, useEffect, useRef, useState } from "react";
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
  const isMountedRef = useRef(true);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const startReservationPayment = useCallback(
    async (options: StartReservationPaymentOptions) => {
      if (isLoadingRef.current) {
        return;
      }

      isLoadingRef.current = true;
      if (isMountedRef.current) {
        setIsLoading(true);
      }
      clearError();

      try {
        await startReservationCheckoutHandoff({
          ...options,
          appliedCoupon: null,
          navigate,
          isActive: () => isMountedRef.current,
        });
      } catch (error) {
        if (isMountedRef.current) {
          handleError(error);
        }
      } finally {
        isLoadingRef.current = false;
        if (isMountedRef.current) {
          setIsLoading(false);
        }
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
