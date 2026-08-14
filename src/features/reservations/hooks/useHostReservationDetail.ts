import { useCallback, useEffect } from "react";
import { useApiError } from "../../../hooks/useApiError";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
import { useHostReservationDetailQuery } from "./useHostReservationDetailQuery";

export function useHostReservationDetail(reservationUid?: string) {
  const { error, handleError, clearError } = useApiError();
  const detailQuery = useHostReservationDetailQuery(reservationUid);
  const { refetch } = detailQuery;

  useEffect(() => {
    clearError();
  }, [clearError, reservationUid]);

  useEffect(() => {
    if (detailQuery.isSuccess) {
      clearError();
    }
  }, [clearError, detailQuery.isSuccess]);

  useHandledQueryError({
    error: detailQuery.error,
    errorUpdatedAt: detailQuery.errorUpdatedAt,
    isError: detailQuery.isError,
    onError: handleError,
  });

  const reload = useCallback(async () => {
    if (!reservationUid) return;

    clearError();
    await refetch();
  }, [clearError, refetch, reservationUid]);

  return {
    clearError,
    error,
    isError: detailQuery.isError,
    isLoading: detailQuery.isLoading,
    reload,
    reservation: detailQuery.isError ? null : detailQuery.data ?? null,
  };
}
