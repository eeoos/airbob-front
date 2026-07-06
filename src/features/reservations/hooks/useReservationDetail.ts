import { useCallback, useEffect, useRef } from "react";
import { useApiError } from "../../../hooks/useApiError";
import { useReservationDetailQuery } from "./useReservationDetailQuery";

export function useReservationDetail(reservationUid?: string) {
  const { error, handleError, clearError } = useApiError();
  const handledErrorUpdatedAtRef = useRef(0);
  const detailQuery = useReservationDetailQuery(reservationUid);
  const { refetch } = detailQuery;

  useEffect(() => {
    if (
      !detailQuery.isError ||
      !detailQuery.error ||
      handledErrorUpdatedAtRef.current === detailQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = detailQuery.errorUpdatedAt;
    handleError(detailQuery.error);
  }, [
    detailQuery.error,
    detailQuery.errorUpdatedAt,
    detailQuery.isError,
    handleError,
  ]);

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
