import { useCallback } from "react";
import { browserWindowNavigation } from "../../../../../platform/browser/windowNavigation";
import { bindInfoWindowEvents } from "../lib/infoWindowEvents";

interface UseMapInfoWindowEventsOptions {
  getAccommodationHref: (accommodationId: number) => string;
  onWishlistToggle?:
    | ((accommodationId: number, isInWishlist: boolean) => void)
    | undefined;
}

interface BindMapInfoWindowEventsOptions {
  root: HTMLElement;
  accommodationId: number;
  onClose: () => void;
}

export const useMapInfoWindowEvents = ({
  getAccommodationHref,
  onWishlistToggle,
}: UseMapInfoWindowEventsOptions) =>
  useCallback(
    ({ root, accommodationId, onClose }: BindMapInfoWindowEventsOptions) => {
      return bindInfoWindowEvents({
        root,
        onCardClick: () => {
          browserWindowNavigation.openInNewTab(
            getAccommodationHref(accommodationId),
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
    [getAccommodationHref, onWishlistToggle],
  );
