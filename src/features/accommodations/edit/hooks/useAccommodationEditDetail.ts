import { useEffect, useState } from "react";
import { accommodationApi } from "../../../../api";
import {
  HostAccommodationDetail,
  ImageInfo,
} from "../../../../types/accommodation";

interface UseAccommodationEditDetailOptions {
  accommodationId?: string;
  loadAccommodation: (data: HostAccommodationDetail) => unknown;
  loadImages: (images: ImageInfo[]) => unknown;
  handleError: (error: unknown) => unknown;
}

export function useAccommodationEditDetail({
  accommodationId,
  loadAccommodation,
  loadImages,
  handleError,
}: UseAccommodationEditDetailOptions) {
  const [settledAccommodationId, setSettledAccommodationId] = useState<
    string | null
  >(null);
  const hasValidAccommodationId =
    Boolean(accommodationId) && !Number.isNaN(Number(accommodationId));
  const isInitializing =
    hasValidAccommodationId && settledAccommodationId !== accommodationId;

  useEffect(() => {
    if (!accommodationId) {
      return;
    }

    const parsedAccommodationId = Number(accommodationId);
    if (Number.isNaN(parsedAccommodationId)) {
      return;
    }

    let isCancelled = false;

    const fetchAccommodation = async () => {
      try {
        const data = await accommodationApi.getHostAccommodationDetail(
          parsedAccommodationId
        );

        if (isCancelled) {
          return;
        }

        loadAccommodation(data);
        loadImages(data.images || []);
      } catch (error) {
        if (!isCancelled) {
          handleError(error);
        }
      } finally {
        if (!isCancelled) {
          setSettledAccommodationId(accommodationId);
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
  ]);

  return { isInitializing };
}
