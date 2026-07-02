import { useEffect, useState } from "react";
import { accommodationApi } from "../../../api";
import { routeTo } from "../../../routes/paths";
import { AccommodationDetail } from "../../../types/accommodation";

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
  const [accommodation, setAccommodation] =
    useState<AccommodationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const parsedAccommodationId = parseRouteAccommodationId(accommodationId);

    if (parsedAccommodationId === null) {
      navigate(routeTo.home());
      setIsLoading(false);
      return;
    }

    if (!reservationUid) {
      handleError(new Error("예약 정보가 없습니다."));
      navigate(routeTo.accommodationDetail(parsedAccommodationId));
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchAccommodation = async () => {
      setIsLoading(true);
      clearError();

      try {
        const data = await accommodationApi.getDetail(parsedAccommodationId);

        if (!isCancelled) {
          setAccommodation(data);
        }
      } catch (error) {
        if (!isCancelled) {
          handleError(error);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAccommodation();

    return () => {
      isCancelled = true;
    };
  }, [accommodationId, clearError, handleError, navigate, reservationUid]);

  return {
    accommodation,
    isLoading,
  };
}
