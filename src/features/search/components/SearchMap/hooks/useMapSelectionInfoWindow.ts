import {
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import { getGoogleMapsApi } from "../../../../../platform/integrations/googleMaps";
import { getMarkerIconModel } from "../lib/markerIcon";
import { MAP_CARD_LAYOUT } from "../lib/infoWindowPlacement";
import { buildInfoWindowContent } from "../lib/infoWindowContent";
import {
  adjustInfoWindowIntoMapView,
  applyInfoWindowChromeStyles,
} from "../lib/infoWindowDom";
import type { SearchMapAccommodation, SearchMapMarker } from "../types";
import { useMapInfoWindowEvents } from "./useMapInfoWindowEvents";

interface UseMapSelectionInfoWindowOptions {
  accommodations: SearchMapAccommodation[];
  checkIn?: string | null | undefined;
  checkOut?: string | null | undefined;
  getAccommodationHref: (accommodationId: number) => string;
  onAccommodationOpen?: ((accommodationId: number) => void) | undefined;
  hoveredAccommodationId?: number | null | undefined;
  hoveredAccommodationIdRef: MutableRefObject<number | null>;
  infoWindowRef: MutableRefObject<google.maps.InfoWindow | null>;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  markersRef: MutableRefObject<SearchMapMarker[]>;
  onAccommodationSelect: (accommodation: SearchMapAccommodation | null) => void;
  onWishlistToggle?:
    ((accommodationId: number, isInWishlist: boolean) => void) | undefined;
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
  onAccommodationOpen,
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
    onAccommodationOpen,
    onWishlistToggle,
  });

  useEffect(() => {
    const maps = getGoogleMapsApi();
    if (!mapInstanceRef.current || !maps) return;

    let disposeOwnedInfoWindow: (() => void) | null = null;

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

      const selectedMarker = findMarkerByAccommodationId(
        markersRef.current,
        selectedAccommodation.id,
      );

      selectMarker(selectedMarker);

      if (infoWindowRef.current) {
        closeCurrentInfoWindowForReplacement();
      }

      if (selectedMarker) {
        const map = mapInstanceRef.current;
        const position = {
          lat: selectedAccommodation.coordinate.latitude,
          lng: selectedAccommodation.coordinate.longitude,
        };
        const markerHeight = getMarkerIconModel(
          selectedAccommodation,
        ).bubbleHeight;
        const infoWindow = new maps.InfoWindow({
          disableAutoPan: true,
          headerDisabled: true,
          maxWidth: MAP_CARD_LAYOUT.width,
          position,
          content: buildInfoWindowContent({
            accommodation: selectedAccommodation,
            canToggleWishlist: !!onWishlistToggle,
            ...(checkIn === undefined ? {} : { checkIn }),
            ...(checkOut === undefined ? {} : { checkOut }),
          }),
        });

        let unbindInfoWindowEvents: (() => void) | null = null;
        let domReadyListener: google.maps.MapsEventListener | null = null;
        let closeClickListener: google.maps.MapsEventListener | null = null;
        let closeListener: google.maps.MapsEventListener | null = null;
        let resizeListener: google.maps.MapsEventListener | null = null;
        let idleListener: google.maps.MapsEventListener | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let pixelOffset = { x: 0, y: 0 };
        let didHandleInfoWindowClose = false;
        let pendingCloseOptions: CloseInfoWindowOptions | null = null;
        const cleanupInfoWindowListeners = () => {
          resizeObserver?.disconnect();
          resizeObserver = null;
          unbindInfoWindowEvents?.();
          unbindInfoWindowEvents = null;

          [
            domReadyListener,
            closeClickListener,
            closeListener,
            resizeListener,
            idleListener,
          ].forEach((listener) => {
            if (listener) {
              maps.event.removeListener(listener);
            }
          });

          domReadyListener = null;
          closeClickListener = null;
          closeListener = null;
          resizeListener = null;
          idleListener = null;
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

        const closeSelectedInfoWindow: CloseInfoWindow = (options = {}) => {
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

        const adjustInfoWindowPosition = () => {
          if (didHandleInfoWindowClose || !mapRef.current) return;
          adjustInfoWindowIntoMapView({
            mapElement: mapRef.current,
            map,
            position,
            markerHeight,
            offset: pixelOffset,
            setOffset: (x, y) => {
              pixelOffset = { x, y };
              infoWindow.setOptions({ pixelOffset: new maps.Size(x, y) });
            },
          });
        };

        domReadyListener = infoWindow.addListener("domready", () => {
          const mapElement = mapRef.current;
          if (!mapElement) return;
          applyInfoWindowChromeStyles(mapElement);
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
            if (typeof ResizeObserver !== "undefined") {
              resizeObserver?.disconnect();
              resizeObserver = new ResizeObserver(adjustInfoWindowPosition);
              resizeObserver.observe(mapElement);
              resizeObserver.observe(infoWindowElement);
            }
          }
          adjustInfoWindowPosition();
        });

        closeClickListener = infoWindow.addListener("closeclick", () => {
          handleInfoWindowClose();
        });
        closeListener = infoWindow.addListener("close", () => {
          handleInfoWindowClose();
        });

        infoWindowRef.current = infoWindow;
        infoWindow.open({ map, shouldFocus: false });
        resizeListener = maps.event.addListener(
          map,
          "resize",
          adjustInfoWindowPosition,
        );
        idleListener = maps.event.addListener(
          map,
          "idle",
          adjustInfoWindowPosition,
        );
      }
    }

    prevSelectedIdRef.current = currentSelectedId;

    return () => {
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
