import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { accommodationApi } from "../../../api";
import { routeTo } from "../../../routes/paths";
import { AccommodationDetail } from "../../../types/accommodation";
import { reservationQueryKeys } from "../queryKeys";

interface UseReservationConfirmAccommodationOptions {
  accommodationId?: string;
  reservationUid: string | null;
  navigate: (path: string) => void;
  handleError: (error: unknown) => unknown;
  clearError: () => void;
}

const parseRouteAccommodationId = (accommodationId?: string): number | null => {
  if (!accommodationId || !/^\d+$/.test(accommodationId)) {
    return null;
  }

  const parsedId = Number(accommodationId);
  return Number.isSafeInteger(parsedId) ? parsedId : null;
};

export function useReservationConfirmAccommodation({
  accommodationId,
  reservationUid,
  navigate,
  handleError,
  clearError,
}: UseReservationConfirmAccommodationOptions) {
  const parsedAccommodationId = parseRouteAccommodationId(accommodationId);
  const handledErrorUpdatedAtRef = useRef(0);

  useEffect(() => {
    if (parsedAccommodationId === null) {
      navigate(routeTo.home());
      return;
    }

    if (!reservationUid) {
      handleError(new Error("예약 정보가 없습니다."));
      navigate(routeTo.accommodationDetail(parsedAccommodationId));
      return;
    }
  }, [handleError, navigate, parsedAccommodationId, reservationUid]);

  const accommodationQuery = useQuery<
    AccommodationDetail,
    unknown,
    AccommodationDetail,
    ReturnType<typeof reservationQueryKeys.confirmAccommodation>
  >({
    queryKey: reservationQueryKeys.confirmAccommodation(
      parsedAccommodationId,
      reservationUid,
    ),
    queryFn: () => {
      if (parsedAccommodationId === null) {
        throw new Error("accommodationId is required");
      }

      clearError();
      return accommodationApi.getDetail(parsedAccommodationId);
    },
    enabled: parsedAccommodationId !== null && Boolean(reservationUid),
    retry: false,
    throwOnError: false,
  });

  useEffect(() => {
    if (
      !accommodationQuery.isError ||
      !accommodationQuery.error ||
      handledErrorUpdatedAtRef.current === accommodationQuery.errorUpdatedAt
    ) {
      return;
    }

    handledErrorUpdatedAtRef.current = accommodationQuery.errorUpdatedAt;
    handleError(accommodationQuery.error);
  }, [
    accommodationQuery.error,
    accommodationQuery.errorUpdatedAt,
    accommodationQuery.isError,
    handleError,
  ]);

  return {
    accommodation: accommodationQuery.isError
      ? null
      : accommodationQuery.data ?? null,
    isLoading: accommodationQuery.isLoading,
  };
}
