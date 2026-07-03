import { MutableRefObject, RefObject, useEffect } from "react";
import { AccommodationSearchInfo } from "../../../../../types/accommodation";
import { getImageUrl } from "../../../../../utils/image";
import { routeTo } from "../../../../../routes/paths";
import { buildInfoWindowContent } from "../lib/infoWindowContent";
import {
  adjustInfoWindowIntoMapView,
  applyInfoWindowChromeStyles,
} from "../lib/infoWindowDom";
import { SearchMapMarker } from "../types";

interface UseMapSelectionInfoWindowOptions {
  accommodations: AccommodationSearchInfo[];
  checkIn?: string | null;
  checkOut?: string | null;
  hoveredAccommodationId?: number | null;
  hoveredAccommodationIdRef: MutableRefObject<number | null>;
  infoWindowRef: MutableRefObject<google.maps.InfoWindow | null>;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  markersRef: MutableRefObject<SearchMapMarker[]>;
  onAccommodationSelect: (accommodation: AccommodationSearchInfo | null) => void;
  onWishlistToggle?: (accommodationId: number, isInWishlist: boolean) => void;
  prevHoveredIdRef: MutableRefObject<number | null>;
  prevSelectedIdRef: MutableRefObject<number | null>;
  selectedAccommodationId: number | null;
}

const findMarkerByAccommodationId = (
  markers: SearchMapMarker[],
  accommodationId: number
) =>
  markers.find((marker) => marker.accommodationId === accommodationId) ?? null;

const restoreMarkerForHoverState = (
  marker: SearchMapMarker,
  accommodationId: number,
  hoveredAccommodationId: number | null
) => {
  if (!marker.icons) return;

  const isHovered = hoveredAccommodationId === accommodationId;
  marker.setIcon(isHovered ? marker.icons.hovered : marker.icons.default);
};

export const useMapSelectionInfoWindow = ({
  accommodations,
  checkIn,
  checkOut,
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
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentSelectedId = selectedAccommodationId;
    const prevSelectedId = prevSelectedIdRef.current;

    if (prevSelectedId !== null && prevSelectedId !== currentSelectedId) {
      const prevMarker = findMarkerByAccommodationId(
        markersRef.current,
        prevSelectedId
      );

      if (prevMarker) {
        restoreMarkerForHoverState(
          prevMarker,
          prevSelectedId,
          hoveredAccommodationId ?? null
        );
      }
    }

    if (currentSelectedId) {
      const selectedAccommodation = accommodations.find(
        (accommodation) => accommodation.id === selectedAccommodationId
      );

      if (
        !selectedAccommodation ||
        selectedAccommodation.coordinate.latitude === null ||
        selectedAccommodation.coordinate.longitude === null
      ) {
        return;
      }

      const targetMarker = findMarkerByAccommodationId(
        markersRef.current,
        selectedAccommodation.id
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
          selectedAccommodation.id
        );
        if (marker?.icons) {
          marker.setIcon(marker.icons.selected);
        }
      }, 0);

      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }

      const selectedMarker = findMarkerByAccommodationId(
        markersRef.current,
        selectedAccommodation.id
      );

      if (selectedMarker) {
        const thumbnailUrl = selectedAccommodation.accommodation_thumbnail_url
          ? getImageUrl(selectedAccommodation.accommodation_thumbnail_url)
          : null;

        const infoWindow = new window.google.maps.InfoWindow({
          disableAutoPan: true,
          content: buildInfoWindowContent({
            accommodation: selectedAccommodation,
            thumbnailUrl,
            checkIn,
            checkOut,
            canToggleWishlist: !!onWishlistToggle,
          }),
        });

        infoWindow.addListener("domready", () => {
          const mapElement = mapRef.current;

          if (!mapElement) {
            return;
          }

          setTimeout(() => {
            adjustInfoWindowIntoMapView({ mapElement });
          }, 50);

          const infoWindowElement = document.getElementById(
            `info-window-${selectedAccommodation.id}`
          );
          if (infoWindowElement) {
            infoWindowElement.addEventListener("click", (event) => {
              const target = event.target as HTMLElement;
              if (!target.closest("button")) {
                window.open(
                  routeTo.accommodationDetail(selectedAccommodation.id),
                  "_blank"
                );
              }
            });
          }

          applyInfoWindowChromeStyles();
        });

        if (onWishlistToggle) {
          window.toggleWishlist = (
            accommodationId: number,
            isInWishlist: boolean
          ) => {
            onWishlistToggle(accommodationId, isInWishlist);
            if (infoWindowRef.current) {
              infoWindowRef.current.close();
            }
          };
        }

        window.closeInfoWindow = () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
            onAccommodationSelect(null);
          }
        };

        infoWindow.addListener("closeclick", () => {
          restoreMarkerForHoverState(
            selectedMarker,
            selectedAccommodation.id,
            hoveredAccommodationIdRef.current
          );
          onAccommodationSelect(null);
        });

        infoWindow.addListener("close", () => {
          restoreMarkerForHoverState(
            selectedMarker,
            selectedAccommodation.id,
            hoveredAccommodationIdRef.current
          );
          onAccommodationSelect(null);

          const resizeListener = (
            infoWindow as google.maps.InfoWindow & {
              _resizeListener?: google.maps.MapsEventListener | null;
            }
          )._resizeListener;

          if (resizeListener) {
            google.maps.event.removeListener(resizeListener);
            (
              infoWindow as google.maps.InfoWindow & {
                _resizeListener?: google.maps.MapsEventListener | null;
              }
            )._resizeListener = null;
          }
        });

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

        const resizeListener = google.maps.event.addListener(
          mapInstanceRef.current,
          "resize",
          () => {
            adjustInfoWindowPosition();
          }
        );

        (
          infoWindow as google.maps.InfoWindow & {
            _resizeListener?: google.maps.MapsEventListener | null;
          }
        )._resizeListener = resizeListener;
      }
    }

    prevSelectedIdRef.current = currentSelectedId;
  }, [
    accommodations,
    checkIn,
    checkOut,
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
        prevSelectedId
      );

      if (prevMarker) {
        restoreMarkerForHoverState(
          prevMarker,
          prevSelectedId,
          hoveredAccommodationId ?? null
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
          prevHoveredId
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
        currentHoveredId
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
      currentSelectedId
    );

    if (selectedMarker?.icons) {
      selectedMarker.setIcon(selectedMarker.icons.selected);

      let frameId: number | null = null;
      let isActive = true;

      const checkAndRestore = () => {
        if (!isActive) return;

        const marker = findMarkerByAccommodationId(
          markersRef.current,
          currentSelectedId
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
