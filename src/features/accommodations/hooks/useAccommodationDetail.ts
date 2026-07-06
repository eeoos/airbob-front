import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { accommodationApi, recentlyViewedApi } from "../../../api";
import { AccommodationDetail } from "../../../types/accommodation";
import { clientLogger } from "../../../utils/clientLogger";
import { clearAccommodationWishlistMembership } from "../lib/accommodationDetailMembership";
import { accommodationQueryKeys } from "../queryKeys";

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
  const parsedAccommodationId = parseAccommodationId(accommodationId);
  const [authRefreshIndex, setAuthRefreshIndex] = useState(0);
  const latestAuthRef = useRef(isAuthenticated);
  const previousAuthRef = useRef(isAuthenticated);
  const handledErrorUpdatedAtRef = useRef(0);

  latestAuthRef.current = isAuthenticated;

  const detailQuery = useQuery<
    AccommodationDetail,
    unknown,
    AccommodationDetail,
    ReturnType<typeof accommodationQueryKeys.detail>
  >({
    queryKey: accommodationQueryKeys.detail(
      parsedAccommodationId,
      authRefreshIndex,
    ),
    queryFn: () => {
      if (!parsedAccommodationId) {
        throw new Error("accommodationId is required");
      }

      clearError();
      return accommodationApi.getDetail(parsedAccommodationId);
    },
    enabled: parsedAccommodationId !== null,
    retry: false,
    throwOnError: false,
  });
  const { refetch } = detailQuery;

  useEffect(() => {
    const wasAuthenticated = previousAuthRef.current;
    previousAuthRef.current = isAuthenticated;

    if (!parsedAccommodationId) {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    if (!wasAuthenticated) {
      setAuthRefreshIndex((currentIndex) => currentIndex + 1);
    }
  }, [isAuthenticated, parsedAccommodationId]);

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

  const routeMatchedDetail =
    detailQuery.data?.id === parsedAccommodationId ? detailQuery.data : null;
  const accommodation = detailQuery.isError
    ? null
    : latestAuthRef.current
      ? routeMatchedDetail
      : clearAccommodationWishlistMembership(routeMatchedDetail);

  useEffect(() => {
    if (
      !parsedAccommodationId ||
      !isAuthenticated ||
      !accommodation ||
      accommodation.id !== parsedAccommodationId
    ) {
      return;
    }

    recentlyViewedApi.add(parsedAccommodationId).catch((error) => {
      clientLogger.error({
        message: "최근 조회 추가 실패:",
        error,
      });
    });
  }, [accommodation, isAuthenticated, parsedAccommodationId]);

  const reloadAccommodation = useCallback(async () => {
    if (!parsedAccommodationId) {
      return null;
    }

    const result = await refetch();
    if (result.isError) {
      return null;
    }

    const routeMatchedResult =
      result.data?.id === parsedAccommodationId ? result.data : null;

    return latestAuthRef.current
      ? routeMatchedResult
      : clearAccommodationWishlistMembership(routeMatchedResult);
  }, [parsedAccommodationId, refetch]);

  return {
    accommodation,
    isLoading: detailQuery.isLoading,
    reloadAccommodation,
  };
};
