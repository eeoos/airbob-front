import { MutableRefObject, RefObject, useEffect, useRef } from "react";
import { routeTo } from "../../../../../routes/paths";
import { toAccommodationBookingRouteQuery } from "../../../lib/accommodationDetailParams";
import { bindInfoWindowEvents } from "../lib/infoWindowEvents";
import { buildInfoWindowContent } from "../lib/infoWindowContent";
import {
  adjustInfoWindowIntoMapView,
  applyInfoWindowChromeStyles,
} from "../lib/infoWindowDom";
import { SearchMapAccommodation, SearchMapMarker } from "../types";

interface UseMapSelectionInfoWindowOptions {
  accommodations: SearchMapAccommodation[];
  checkIn?: string | null;
  checkOut?: string | null;
  detailSearchParams?: URLSearchParams;
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

  const isHovered = hoveredAccommodationId === accommodationId;
  marker.setIcon(isHovered ? marker.icons.hovered : marker.icons.default);
};

export const useMapSelectionInfoWindow = ({
  accommodations,
  checkIn,
  checkOut,
  detailSearchParams,
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

  useEffect(() => {
    if (!mapInstanceRef.current) return;

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
          hoveredAccommodationId ?? null,
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

      if (targetMarker?.icons) {
        targetMarker.setIcon(targetMarker.icons.selected);
      }

      setTimeout(() => {
        if (selectedAccommodationId !== selectedAccommodation.id) {
          return;
        }

        const marker = findMarkerByAccommodationId(
          markersRef.current,
          selectedAccommodation.id,
        );
        if (marker?.icons) {
          marker.setIcon(marker.icons.selected);
        }
      }, 0);

      if (infoWindowRef.current) {
        closeCurrentInfoWindowForReplacement();
      }

      const selectedMarker = findMarkerByAccommodationId(
        markersRef.current,
        selectedAccommodation.id,
      );

      if (selectedMarker) {
        const detailParams = detailSearchParams
          ? toAccommodationBookingRouteQuery(detailSearchParams)
          : undefined;

        const infoWindow = new window.google.maps.InfoWindow({
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
          unbindInfoWindowEvents?.();
          unbindInfoWindowEvents = null;

          [
            domReadyListener,
            closeClickListener,
            closeListener,
            resizeListener,
          ].forEach((listener) => {
            if (listener) {
              google.maps.event.removeListener(listener);
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
        };

        closeSelectedInfoWindow = (options = {}) => {
          pendingCloseOptions = options;
          infoWindow.close();
          handleInfoWindowClose(options);
        };

        closeInfoWindowRef.current = closeSelectedInfoWindow;

        domReadyListener = infoWindow.addListener("domready", () => {
          const mapElement = mapRef.current;

          if (!mapElement) {
            return;
          }

          setTimeout(() => {
            adjustInfoWindowIntoMapView({ mapElement });
          }, 50);

          const infoWindowElement = document.getElementById(
            `info-window-${selectedAccommodation.id}`,
          );
          if (infoWindowElement) {
            unbindInfoWindowEvents?.();
            unbindInfoWindowEvents = bindInfoWindowEvents({
              root: infoWindowElement,
              onCardClick: () => {
                window.open(
                  routeTo.accommodationDetail(
                    selectedAccommodation.id,
                    detailParams,
                  ),
                  "_blank",
                );
              },
              onClose: closeSelectedInfoWindow,
              onWishlistToggle: (accommodationId, isInWishlist) => {
                if (onWishlistToggle) {
                  onWishlistToggle(accommodationId, isInWishlist);
                  closeSelectedInfoWindow();
                }
              },
            });
          }

          applyInfoWindowChromeStyles();
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

          setTimeout(() => {
            adjustInfoWindowIntoMapView({ mapElement });
          }, 100);
        };

        resizeListener = google.maps.event.addListener(
          mapInstanceRef.current,
          "resize",
          () => {
            adjustInfoWindowPosition();
          },
        );
      }
    }

    prevSelectedIdRef.current = currentSelectedId;
  }, [
    accommodations,
    checkIn,
    checkOut,
    detailSearchParams,
    hoveredAccommodationId,
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
    if (!mapInstanceRef.current || selectedAccommodationId !== null) return;

    const prevSelectedId = prevSelectedIdRef.current;
    if (prevSelectedId !== null) {
      const prevMarker = findMarkerByAccommodationId(
        markersRef.current,
        prevSelectedId,
      );

      if (prevMarker) {
        restoreMarkerForHoverState(
          prevMarker,
          prevSelectedId,
          hoveredAccommodationId ?? null,
        );
      }
    }
  }, [
    hoveredAccommodationId,
    mapInstanceRef,
    markersRef,
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

  useEffect(() => {
    if (!mapInstanceRef.current || selectedAccommodationId === null) return;

    const currentSelectedId = selectedAccommodationId;
    const selectedMarker = findMarkerByAccommodationId(
      markersRef.current,
      currentSelectedId,
    );

    if (selectedMarker?.icons) {
      selectedMarker.setIcon(selectedMarker.icons.selected);

      let frameId: number | null = null;
      let isActive = true;

      const checkAndRestore = () => {
        if (!isActive) return;

        const marker = findMarkerByAccommodationId(
          markersRef.current,
          currentSelectedId,
        );

        if (marker?.icons) {
          const currentIcon = marker.getIcon();
          if (currentIcon !== marker.icons.selected) {
            marker.setIcon(marker.icons.selected);
          }
          frameId = requestAnimationFrame(checkAndRestore);
        }
      };

      frameId = requestAnimationFrame(checkAndRestore);

      return () => {
        isActive = false;
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
        }
      };
    }
  }, [mapInstanceRef, markersRef, selectedAccommodationId]);
};
