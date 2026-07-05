import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { reservationApi } from "../../../api";
import { useApiError } from "../../../hooks/useApiError";
import { HostDetailInfo } from "../../../types/reservation";
import { reservationQueryKeys } from "../queryKeys";

export function useHostReservationDetail(reservationUid?: string) {
  const { error, handleError, clearError } = useApiError();
  const handledErrorUpdatedAtRef = useRef(0);
  const detailQuery = useQuery<
    HostDetailInfo,
    unknown,
    HostDetailInfo,
    ReturnType<typeof reservationQueryKeys.hostReservationDetail>
  >({
    queryKey: reservationQueryKeys.hostReservationDetail(reservationUid ?? ""),
    queryFn: () => {
      if (!reservationUid) {
        throw new Error("reservationUid is required");
      }

      clearError();
      return reservationApi.getHostReservationDetail(reservationUid);
    },
    enabled: Boolean(reservationUid),
    retry: false,
    throwOnError: false,
  });
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

    await refetch();
  }, [refetch, reservationUid]);

  return {
    clearError,
    error,
    isError: detailQuery.isError,
    isLoading: detailQuery.isLoading,
    reload,
    reservation: detailQuery.isError ? null : detailQuery.data ?? null,
  };
}
