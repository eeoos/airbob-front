import { useCallback, useEffect, useState } from "react";
import { accommodationApi } from "../../../../api";
import {
  HostAccommodationDetail,
  ImageInfo,
} from "../../../../types/accommodation";

interface UseAccommodationEditDetailOptions {
  accommodationId?: string;
  loadAccommodation: (
    accommodationId: string,
    data: HostAccommodationDetail
  ) => unknown;
  loadImages: (images: ImageInfo[]) => unknown;
  handleError: (error: unknown) => unknown;
}

export type AccommodationEditDetailState =
  | { status: "loading"; accommodationId: string }
  | { status: "ready"; accommodationId: string }
  | { status: "error"; accommodationId: string };

const getInitialDetailState = (
  accommodationId?: string
): AccommodationEditDetailState => ({
  status: accommodationId ? "loading" : "error",
  accommodationId: accommodationId || "",
});

export function useAccommodationEditDetail({
  accommodationId,
  loadAccommodation,
  loadImages,
  handleError,
}: UseAccommodationEditDetailOptions) {
  const [detailState, setDetailState] = useState<AccommodationEditDetailState>(
    () => getInitialDetailState(accommodationId)
  );
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    if (!accommodationId) {
      setDetailState({ status: "error", accommodationId: "" });
      return;
    }

    const parsedAccommodationId = Number(accommodationId);
    if (!Number.isFinite(parsedAccommodationId) || parsedAccommodationId <= 0) {
      setDetailState({ status: "error", accommodationId });
      return;
    }

    let isCancelled = false;
    setDetailState({ status: "loading", accommodationId });

    const fetchAccommodation = async () => {
      try {
        const data = await accommodationApi.getHostAccommodationDetail(
          parsedAccommodationId
        );

        if (isCancelled) {
          return;
        }

        if (data.id !== parsedAccommodationId) {
          throw new Error("요청한 숙소와 다른 숙소 정보가 반환되었습니다.");
        }

        loadAccommodation(accommodationId, data);
        loadImages(data.images || []);
        setDetailState({ status: "ready", accommodationId });
      } catch (error) {
        if (!isCancelled) {
          handleError(error);
          setDetailState({ status: "error", accommodationId });
        }
      }
    };

    fetchAccommodation();

    return () => {
      isCancelled = true;
    };
  }, [
    accommodationId,
    handleError,
    loadAccommodation,
    loadImages,
    retryAttempt,
  ]);

  const retry = useCallback(() => {
    if (!accommodationId) return;
    setDetailState({ status: "loading", accommodationId });
    setRetryAttempt((attempt) => attempt + 1);
  }, [accommodationId]);

  const currentDetailState =
    detailState.accommodationId === (accommodationId || "")
      ? detailState
      : getInitialDetailState(accommodationId);

  return { detailState: currentDetailState, retry };
}
