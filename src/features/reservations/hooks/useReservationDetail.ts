import { useCallback, useEffect, useState } from "react";
import { reservationApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { ReservationDetailInfo } from "../../../types/reservation";

export function useReservationDetail(reservationUid?: string) {
  const { error, handleError, clearError } = useApiError();
  const [reservation, setReservation] =
    useState<ReservationDetailInfo | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(reservationUid));

  const reload = useCallback(async () => {
    if (!reservationUid) {
      setReservation(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      const response = await reservationApi.getMyReservationDetail(
        reservationUid
      );
      setReservation(response);
    } catch (err) {
      setReservation(null);
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [clearError, handleError, reservationUid]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    clearError,
    error,
    isLoading,
    reload,
    reservation,
  };
}
