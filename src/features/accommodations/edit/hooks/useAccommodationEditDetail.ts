import { useEffect } from "react";
import { accommodationApi } from "../../../../api";
import {
  HostAccommodationDetail,
  ImageInfo,
} from "../../../../types/accommodation";

interface UseAccommodationEditDetailOptions {
  accommodationId?: string;
  isNewDraft: boolean;
  loadAccommodation: (data: HostAccommodationDetail) => unknown;
  loadImages: (images: ImageInfo[]) => unknown;
  handleError: (error: unknown) => unknown;
}

export function useAccommodationEditDetail({
  accommodationId,
  isNewDraft,
  loadAccommodation,
  loadImages,
  handleError,
}: UseAccommodationEditDetailOptions) {
  useEffect(() => {
    if (!accommodationId || isNewDraft) {
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
      }
    };

    fetchAccommodation();

    return () => {
      isCancelled = true;
    };
  }, [
    accommodationId,
    handleError,
    isNewDraft,
    loadAccommodation,
    loadImages,
  ]);
}
