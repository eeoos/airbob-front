import { keepPreviousData, useQuery } from "@tanstack/react-query";
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

const accommodationDetailQueryKey = (
  accommodationId: number | null,
  authRefreshIndex: number,
) =>
  [
    "accommodation",
    "detail",
    accommodationId ?? "missing",
    authRefreshIndex,
  ] as const;

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
    ReturnType<typeof accommodationDetailQueryKey>
  >({
    queryKey: accommodationDetailQueryKey(parsedAccommodationId, authRefreshIndex),
    queryFn: () => {
      if (!parsedAccommodationId) {
        throw new Error("accommodationId is required");
      }

      clearError();
      return accommodationApi.getDetail(parsedAccommodationId);
    },
    enabled: parsedAccommodationId !== null,
    placeholderData: keepPreviousData,
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

  const accommodation = detailQuery.isError
    ? null
    : latestAuthRef.current
      ? detailQuery.data ?? null
      : clearAccommodationWishlistMembership(detailQuery.data ?? null);

  useEffect(() => {
    if (!parsedAccommodationId || !isAuthenticated || !accommodation) {
      return;
    }

    recentlyViewedApi.add(parsedAccommodationId).catch((error) => {
      console.error("최근 조회 추가 실패:", error);
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

    return latestAuthRef.current
      ? result.data ?? null
      : clearAccommodationWishlistMembership(result.data ?? null);
  }, [parsedAccommodationId, refetch]);

  return {
    accommodation,
    isLoading: detailQuery.isLoading,
    reloadAccommodation,
  };
};
