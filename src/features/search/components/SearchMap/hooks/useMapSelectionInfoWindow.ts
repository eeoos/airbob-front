import { MutableRefObject, RefObject, useEffect, useRef } from "react";
import { getGoogleMapsApi } from "../../../../../platform/integrations/googleMaps";
import { buildInfoWindowContent } from "../lib/infoWindowContent";
import {
  adjustInfoWindowIntoMapView,
  applyInfoWindowChromeStyles,
} from "../lib/infoWindowDom";
import { SearchMapAccommodation, SearchMapMarker } from "../types";
import { useMapInfoWindowEvents } from "./useMapInfoWindowEvents";

interface UseMapSelectionInfoWindowOptions {
  accommodations: SearchMapAccommodation[];
  checkIn?: string | null;
  checkOut?: string | null;
  getAccommodationHref: (accommodationId: number) => string;
  hoveredAccommodationId?: number | null;
  hoveredAccommodationIdRef: MutableRefObject<number | null>;
  infoWindowRef: MutableRefObject<google.maps.InfoWindow | null>;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  markersRef: MutableRefObject<SearchMapMarker[]>;
  onAccommodationSelect: (
    accommodation: SearchMapAccommodation | null,
  ) => void;
  onWishlistToggle?: (accommodationId: number, isInWishlist: boolean) => void;
  prevHoveredIdRef: MutableRefObject<number | null>;
  prevSelectedIdRef: MutableRefObject<number | null>;
  selectedAccommodationId: number | null;
}

interface CloseInfoWindowOptions {
  clearSelection?: boolean;
}

type CloseInfoWindow = (options?: CloseInfoWindowOptions) => void;

const findMarkerByAccommodationId = (
  markers: SearchMapMarker[],
  accommodationId: number,
) =>
  markers.find((marker) => marker.accommodationId === accommodationId) ?? null;

const restoreMarkerForHoverState = (
  marker: SearchMapMarker,
  accommodationId: number,
  hoveredAccommodationId: number | null,
) => {
  if (!marker.icons) return;

  marker.isSelected = false;
  const isHovered = hoveredAccommodationId === accommodationId;
  marker.setIcon(isHovered ? marker.icons.hovered : marker.icons.default);
};

const selectMarker = (marker: SearchMapMarker | null) => {
  if (!marker?.icons) return;

  marker.isSelected = true;
  marker.setIcon(marker.icons.selected);
};

export const useMapSelectionInfoWindow = ({
  accommodations,
  checkIn,
  checkOut,
  getAccommodationHref,
  hoveredAccommodationId,
  hoveredAccommodationIdRef,
  infoWindowRef,
  mapInstanceRef,
  mapRef,
  markersRef,
  onAccommodationSelect,
  onWishlistToggle,
  prevHoveredIdRef,
  prevSelectedIdRef,
  selectedAccommodationId,
}: UseMapSelectionInfoWindowOptions) => {
  const closeInfoWindowRef = useRef<CloseInfoWindow | null>(null);
  const bindMapInfoWindowEvents = useMapInfoWindowEvents({
    getAccommodationHref,
    onWishlistToggle,
  });

  useEffect(() => {
    const maps = getGoogleMapsApi();
    if (!mapInstanceRef.current || !maps) return;

    let isEffectActive = true;
    const pendingTimers = new Set<number>();
    let disposeOwnedInfoWindow: (() => void) | null = null;
    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer);
        if (isEffectActive) callback();
      }, delay);
      pendingTimers.add(timer);
      return timer;
    };
    const clearPendingTimers = () => {
      pendingTimers.forEach((timer) => window.clearTimeout(timer));
      pendingTimers.clear();
    };

    const currentSelectedId = selectedAccommodationId;
    const prevSelectedId = prevSelectedIdRef.current;
    const closeStaleInfoWindow = () => {
      const closeInfoWindow = closeInfoWindowRef.current;

      if (closeInfoWindow) {
        closeInfoWindow({ clearSelection: true });
        return;
      }

      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }

      onAccommodationSelect(null);
    };
    const closeCurrentInfoWindowForReplacement = () => {
      const closeInfoWindow = closeInfoWindowRef.current;

      if (closeInfoWindow) {
        closeInfoWindow({ clearSelection: false });
        return;
      }

      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
    };

    if (prevSelectedId !== null && prevSelectedId !== currentSelectedId) {
      const prevMarker = findMarkerByAccommodationId(
        markersRef.current,
        prevSelectedId,
      );

      if (prevMarker) {
        restoreMarkerForHoverState(
          prevMarker,
          prevSelectedId,
          hoveredAccommodationIdRef.current,
        );
      }
    }

    if (currentSelectedId !== null) {
      const selectedAccommodation = accommodations.find(
        (accommodation) => accommodation.id === currentSelectedId,
      );

      if (
        !selectedAccommodation ||
        selectedAccommodation.coordinate.latitude === null ||
        selectedAccommodation.coordinate.longitude === null
      ) {
        closeStaleInfoWindow();
        return;
      }

      const targetMarker = findMarkerByAccommodationId(
        markersRef.current,
        selectedAccommodation.id,
      );

      selectMarker(targetMarker);

      if (infoWindowRef.current) {
        closeCurrentInfoWindowForReplacement();
      }

      const selectedMarker = findMarkerByAccommodationId(
        markersRef.current,
        selectedAccommodation.id,
      );

      if (selectedMarker) {
        const infoWindow = new maps.InfoWindow({
          disableAutoPan: true,
          content: buildInfoWindowContent({
            accommodation: selectedAccommodation,
            checkIn,
            checkOut,
            canToggleWishlist: !!onWishlistToggle,
          }),
        });

        let unbindInfoWindowEvents: (() => void) | null = null;
        let domReadyListener: google.maps.MapsEventListener | null = null;
        let closeClickListener: google.maps.MapsEventListener | null = null;
        let closeListener: google.maps.MapsEventListener | null = null;
        let resizeListener: google.maps.MapsEventListener | null = null;
        let didHandleInfoWindowClose = false;
        let pendingCloseOptions: CloseInfoWindowOptions | null = null;
        let closeSelectedInfoWindow: CloseInfoWindow;

        const cleanupInfoWindowListeners = () => {
          clearPendingTimers();
          unbindInfoWindowEvents?.();
          unbindInfoWindowEvents = null;

          [
            domReadyListener,
            closeClickListener,
            closeListener,
            resizeListener,
          ].forEach((listener) => {
            if (listener) {
              maps.event.removeListener(listener);
            }
          });

          domReadyListener = null;
          closeClickListener = null;
          closeListener = null;
          resizeListener = null;
        };

        const handleInfoWindowClose = (options?: CloseInfoWindowOptions) => {
          if (didHandleInfoWindowClose) {
            pendingCloseOptions = null;
            return;
          }

          const closeOptions = options ?? pendingCloseOptions ?? {};
          pendingCloseOptions = null;
          didHandleInfoWindowClose = true;
          restoreMarkerForHoverState(
            selectedMarker,
            selectedAccommodation.id,
            hoveredAccommodationIdRef.current,
          );

          if (infoWindowRef.current === infoWindow) {
            infoWindowRef.current = null;
          }

          if (closeOptions.clearSelection !== false) {
            onAccommodationSelect(null);
          }

          cleanupInfoWindowListeners();
          if (closeInfoWindowRef.current === closeSelectedInfoWindow) {
            closeInfoWindowRef.current = null;
          }
          disposeOwnedInfoWindow = null;
        };

        closeSelectedInfoWindow = (options = {}) => {
          if (didHandleInfoWindowClose) return;

          pendingCloseOptions = options;
          try {
            infoWindow.close();
          } finally {
            handleInfoWindowClose(options);
          }
        };

        closeInfoWindowRef.current = closeSelectedInfoWindow;
        disposeOwnedInfoWindow = () => {
          closeSelectedInfoWindow({ clearSelection: false });
        };

        domReadyListener = infoWindow.addListener("domready", () => {
          const mapElement = mapRef.current;

          if (!mapElement) {
            return;
          }

          schedule(() => {
            adjustInfoWindowIntoMapView({
              mapElement,
              root: mapElement,
            });
          }, 50);

          const infoWindowElement = mapElement.querySelector<HTMLElement>(
            `#info-window-${selectedAccommodation.id}`,
          );
          if (infoWindowElement) {
            unbindInfoWindowEvents?.();
            unbindInfoWindowEvents = bindMapInfoWindowEvents({
              root: infoWindowElement,
              accommodationId: selectedAccommodation.id,
              onClose: closeSelectedInfoWindow,
            });
          }

          applyInfoWindowChromeStyles(mapElement);
        });

        closeClickListener = infoWindow.addListener(
          "closeclick",
          () => {
            handleInfoWindowClose();
          },
        );
        closeListener = infoWindow.addListener(
          "close",
          () => {
            handleInfoWindowClose();
          },
        );

        infoWindow.open(mapInstanceRef.current, selectedMarker);
        infoWindowRef.current = infoWindow;

        const adjustInfoWindowPosition = () => {
          if (!infoWindowRef.current || !mapRef.current) {
            return;
          }

          const mapElement = mapRef.current;

          schedule(() => {
            adjustInfoWindowIntoMapView({
              mapElement,
              root: mapElement,
            });
          }, 100);
        };

        resizeListener = maps.event.addListener(
          mapInstanceRef.current,
          "resize",
          () => {
            adjustInfoWindowPosition();
          },
        );
      }
    }

    prevSelectedIdRef.current = currentSelectedId;

    return () => {
      isEffectActive = false;
      clearPendingTimers();
      disposeOwnedInfoWindow?.();
    };
  }, [
    accommodations,
    bindMapInfoWindowEvents,
    checkIn,
    checkOut,
    hoveredAccommodationIdRef,
    infoWindowRef,
    mapInstanceRef,
    mapRef,
    markersRef,
    onAccommodationSelect,
    onWishlistToggle,
    prevSelectedIdRef,
    selectedAccommodationId,
  ]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentHoveredId = hoveredAccommodationId ?? null;
    const prevHoveredId = prevHoveredIdRef.current;

    if (prevHoveredId !== null && prevHoveredId !== currentHoveredId) {
      if (prevHoveredId !== selectedAccommodationId) {
        const prevMarker = findMarkerByAccommodationId(
          markersRef.current,
          prevHoveredId,
        );

        if (prevMarker?.icons) {
          prevMarker.isSelected = false;
          prevMarker.setIcon(prevMarker.icons.default);
        }
      }
    }

    if (
      currentHoveredId !== null &&
      currentHoveredId !== selectedAccommodationId
    ) {
      const hoveredMarker = findMarkerByAccommodationId(
        markersRef.current,
        currentHoveredId,
      );

      if (hoveredMarker?.icons) {
        hoveredMarker.isSelected = false;
        hoveredMarker.setIcon(hoveredMarker.icons.hovered);
      }
    }

    prevHoveredIdRef.current = currentHoveredId;
    hoveredAccommodationIdRef.current = currentHoveredId;
  }, [
    hoveredAccommodationId,
    hoveredAccommodationIdRef,
    mapInstanceRef,
    markersRef,
    prevHoveredIdRef,
    selectedAccommodationId,
  ]);
};
