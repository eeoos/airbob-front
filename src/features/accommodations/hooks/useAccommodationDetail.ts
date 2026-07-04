import { useCallback, useEffect, useRef, useState } from "react";
import { accommodationApi, recentlyViewedApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";
import { clearAccommodationWishlistMembership } from "../lib/accommodationDetailMembership";

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
  const isLoadingRef = useRef(isLoading);
  const latestAuthRef = useRef(isAuthenticated);
  const previousAuthRef = useRef(isAuthenticated);
  const requestIdRef = useRef(0);

  isLoadingRef.current = isLoading;
  latestAuthRef.current = isAuthenticated;

  const loadAccommodation = useCallback(async (showLoading: boolean) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const shouldCompleteLoading = showLoading || isLoadingRef.current;

    if (!parsedAccommodationId) {
      isLoadingRef.current = false;
      setIsLoading(false);
      return null;
    }

    if (showLoading) {
      isLoadingRef.current = true;
      setIsLoading(true);
    }
    clearError();

    try {
      const data = await accommodationApi.getDetail(parsedAccommodationId);
      if (requestId !== requestIdRef.current) {
        return null;
      }

      const accommodationToStore = latestAuthRef.current
        ? data
        : clearAccommodationWishlistMembership(data);

      setAccommodation(accommodationToStore);
      return accommodationToStore;
    } catch (error) {
      if (requestId === requestIdRef.current) {
        handleError(error);
      }
      return null;
    } finally {
      if (shouldCompleteLoading && requestId === requestIdRef.current) {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [clearError, handleError, parsedAccommodationId]);

  useEffect(() => {
    loadAccommodation(true);
  }, [loadAccommodation]);

  useEffect(() => {
    const wasAuthenticated = previousAuthRef.current;
    previousAuthRef.current = isAuthenticated;

    if (!parsedAccommodationId) {
      return;
    }

    if (!isAuthenticated) {
      setAccommodation((current) =>
        clearAccommodationWishlistMembership(current)
      );
      return;
    }

    if (!wasAuthenticated) {
      void loadAccommodation(false);
    }
  }, [isAuthenticated, loadAccommodation, parsedAccommodationId]);

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
