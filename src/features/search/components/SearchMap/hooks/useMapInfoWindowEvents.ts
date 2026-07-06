import { useCallback } from "react";
import { routeTo } from "../../../../../routes/paths";
import { toAccommodationBookingRouteQuery } from "../../../lib/accommodationDetailParams";
import { bindInfoWindowEvents } from "../lib/infoWindowEvents";

interface UseMapInfoWindowEventsOptions {
  detailSearchParams?: URLSearchParams;
  onWishlistToggle?: (accommodationId: number, isInWishlist: boolean) => void;
}

interface BindMapInfoWindowEventsOptions {
  root: HTMLElement;
  accommodationId: number;
  onClose: () => void;
}

export const useMapInfoWindowEvents = ({
  detailSearchParams,
  onWishlistToggle,
}: UseMapInfoWindowEventsOptions) =>
  useCallback(
    ({ root, accommodationId, onClose }: BindMapInfoWindowEventsOptions) => {
      const detailParams = detailSearchParams
        ? toAccommodationBookingRouteQuery(detailSearchParams)
        : undefined;

      return bindInfoWindowEvents({
        root,
        onCardClick: () => {
          window.open(
            routeTo.accommodationDetail(accommodationId, detailParams),
            "_blank",
          );
        },
        onClose,
        onWishlistToggle: (targetAccommodationId, isInWishlist) => {
          if (!onWishlistToggle) {
            return;
          }

          onWishlistToggle(targetAccommodationId, isInWishlist);
          onClose();
        },
      });
    },
    [detailSearchParams, onWishlistToggle],
  );
