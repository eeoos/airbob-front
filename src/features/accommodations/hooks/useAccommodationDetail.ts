import { useCallback, useEffect, useState } from "react";
import { accommodationApi, recentlyViewedApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";

interface UseAccommodationDetailOptions {
  accommodationId?: string;
  isAuthenticated: boolean;
  handleError: (error: unknown) => unknown;
  clearError: () => void;
}

const parseAccommodationId = (accommodationId?: string) => {
  if (!accommodationId) {
    return null;
  }

  const parsedId = Number(accommodationId);
  return Number.isNaN(parsedId) ? null : parsedId;
};

export const useAccommodationDetail = ({
  accommodationId,
  isAuthenticated,
  handleError,
  clearError,
}: UseAccommodationDetailOptions) => {
  const [accommodation, setAccommodation] = useState<AccommodationDetail | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const parsedAccommodationId = parseAccommodationId(accommodationId);

  const loadAccommodation = useCallback(async (showLoading: boolean) => {
    if (!parsedAccommodationId) {
      setIsLoading(false);
      return null;
    }

    if (showLoading) {
      setIsLoading(true);
    }
    clearError();

    try {
      const data = await accommodationApi.getDetail(parsedAccommodationId);
      setAccommodation(data);
      return data;
    } catch (error) {
      handleError(error);
      return null;
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [clearError, handleError, parsedAccommodationId]);

  useEffect(() => {
    loadAccommodation(true);
  }, [loadAccommodation]);

  useEffect(() => {
    if (!parsedAccommodationId || !isAuthenticated || !accommodation) {
      return;
    }

    recentlyViewedApi.add(parsedAccommodationId).catch((error) => {
      console.error("최근 조회 추가 실패:", error);
    });
  }, [accommodation, isAuthenticated, parsedAccommodationId]);

  const reloadAccommodation = useCallback(
    () => loadAccommodation(false),
    [loadAccommodation]
  );

  return {
    accommodation,
    isLoading,
    reloadAccommodation,
  };
};
