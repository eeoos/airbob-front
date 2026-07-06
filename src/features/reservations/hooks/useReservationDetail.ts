import { useCallback } from "react";
import { useApiError } from "../../../hooks/useApiError";
import { useHandledQueryError } from "../../../query/useHandledQueryError";
import { useReservationDetailQuery } from "./useReservationDetailQuery";

export function useReservationDetail(reservationUid?: string) {
  const { error, handleError, clearError } = useApiError();
  const detailQuery = useReservationDetailQuery(reservationUid);
  const { refetch } = detailQuery;

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
