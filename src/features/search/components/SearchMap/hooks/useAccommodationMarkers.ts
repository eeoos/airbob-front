import { useEffect, useRef, type MutableRefObject } from "react";
import { getGoogleMapsApi } from "../../../../../platform/integrations/googleMaps";
import {
  haveAccommodationIdsChanged,
  hasViewportChanged,
  shouldFitAccommodationBounds,
} from "../lib/mapBounds";
import { buildMarkerPriceSvg, getMarkerIconModel } from "../lib/markerIcon";
import {
  type SearchMapAccommodation,
  type SearchMapMarker,
  type SearchMapViewport,
} from "../types";

interface UseAccommodationMarkersOptions {
  accommodations: SearchMapAccommodation[];
  isInitialIdleRef: MutableRefObject<boolean>;
  isMapDragMode: boolean;
  isMapLoaded: boolean;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  markersRef: MutableRefObject<SearchMapMarker[]>;
  onAccommodationSelectRef: MutableRefObject<
    (accommodation: SearchMapAccommodation | null) => void
  >;
  onMapBoundsUpdated?: (() => void) | undefined;
  prevViewportRef: MutableRefObject<SearchMapViewport | null>;
  shouldUpdateMapBounds: boolean;
  viewport?: SearchMapViewport | null | undefined;
  viewportJustChangedRef: MutableRefObject<boolean>;
}

type SearchMapAccommodationWithCoordinate = SearchMapAccommodation & {
  coordinate: {
    latitude: number;
    longitude: number;
  };
};

const hasCoordinate = (
  accommodation: SearchMapAccommodation,
): accommodation is SearchMapAccommodationWithCoordinate =>
  accommodation.coordinate.latitude !== null &&
  accommodation.coordinate.longitude !== null;

const createIconUrl = (svgIcon: string) => {
  const svgBlob = new Blob([svgIcon], { type: "image/svg+xml" });

  return URL.createObjectURL(svgBlob);
};

export const disposeSearchMapMarkers = (markers: SearchMapMarker[]) => {
  markers.forEach((marker) => {
    if (marker.dispose) {
      marker.dispose();
      return;
    }

    marker.setMap(null);
  });
};

export const useAccommodationMarkers = ({
  accommodations,
  isInitialIdleRef,
  isMapDragMode,
  isMapLoaded,
  mapInstanceRef,
  markersRef,
  onAccommodationSelectRef,
  onMapBoundsUpdated,
  prevViewportRef,
  shouldUpdateMapBounds,
  viewport,
  viewportJustChangedRef,
}: UseAccommodationMarkersOptions) => {
  const boundsInitializedRef = useRef(false);
  const prevAccommodationsRef = useRef<SearchMapAccommodation[]>([]);

  useEffect(
    () => () => {
      disposeSearchMapMarkers(markersRef.current);
      markersRef.current = [];
    },
    [markersRef],
  );

  useEffect(() => {
    const maps = getGoogleMapsApi();
    if (!mapInstanceRef.current || !maps) return;

    const map = mapInstanceRef.current;
    const validAccommodations = accommodations.filter(hasCoordinate);
    const markerAccommodations = markersRef.current.flatMap((marker) =>
      marker.accommodationId === undefined
        ? []
        : [{ id: marker.accommodationId }],
    );
    const markersChanged = haveAccommodationIdsChanged(
      markerAccommodations,
      validAccommodations,
    );
    const shouldRebuildMarkers =
      markersChanged || markersRef.current.length === 0;

    if (shouldRebuildMarkers) {
      disposeSearchMapMarkers(markersRef.current);
      markersRef.current = [];
    }

    if (validAccommodations.length === 0) {
      boundsInitializedRef.current = false;
      prevAccommodationsRef.current = [];
      return;
    }

    const bounds = new maps.LatLngBounds();

    validAccommodations.forEach((accommodation) => {
      const lat = accommodation.coordinate.latitude;
      const lng = accommodation.coordinate.longitude;
      bounds.extend({ lat, lng });

      if (!shouldRebuildMarkers) return;

      const markerIconModel = getMarkerIconModel({
        basePrice: accommodation.basePrice,
        currency: accommodation.currency,
      });
      const { totalWidth, bubbleHeight, anchor } = markerIconModel;
      const objectUrls: string[] = [];
      const markerListeners: google.maps.MapsEventListener[] = [];
      let marker: SearchMapMarker | null = null;
      let animationFrameId: number | null = null;
      let currentScale = 1.0;
      let isDisposed = false;
      const targetScale = 1.1;
      const animationDuration = 200;

      const preserveSelectedIcon = () => {
        if (!marker?.isSelected || !marker.icons) return false;

        if (animationFrameId !== null) {
          window.cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        currentScale = 1.0;
        marker.setIcon(marker.icons.selected);
        return true;
      };

      const disposeMarkerResources = () => {
        if (isDisposed) return;

        isDisposed = true;
        if (animationFrameId !== null) {
          window.cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        markerListeners.forEach((listener) => listener.remove());
        marker?.setMap(null);
        marker?.unbindAll();
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
      };

      const animateScale = (
        startScale: number,
        endScale: number,
        startTime: number,
      ) => {
        if (isDisposed || !marker) return;
        if (preserveSelectedIcon()) return;

        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentScale = startScale + (endScale - startScale) * easeOut;

        const originalIcon = marker.originalIcon;
        if (originalIcon?.scaledSize) {
          marker.setIcon({
            url: originalIcon.url,
            scaledSize: new maps.Size(
              originalIcon.scaledSize.width * currentScale,
              originalIcon.scaledSize.height * currentScale,
            ),
            anchor: new maps.Point(
              (originalIcon.scaledSize.width * currentScale) / 2,
              originalIcon.scaledSize.height * currentScale,
            ),
          });
        }

        if (progress < 1) {
          animationFrameId = window.requestAnimationFrame(() =>
            animateScale(startScale, endScale, startTime),
          );
        } else {
          animationFrameId = null;
        }
      };

      try {
        const svgUrl = createIconUrl(
          buildMarkerPriceSvg(markerIconModel, "default"),
        );
        objectUrls.push(svgUrl);
        const selectedSvgUrl = createIconUrl(
          buildMarkerPriceSvg(markerIconModel, "selected"),
        );
        objectUrls.push(selectedSvgUrl);
        const hoveredSvgUrl = createIconUrl(
          buildMarkerPriceSvg(markerIconModel, "hovered"),
        );
        objectUrls.push(hoveredSvgUrl);
        const iconSize = new maps.Size(totalWidth, bubbleHeight);
        const iconAnchor = new maps.Point(anchor.x, anchor.y);

        marker = new maps.Marker({
          position: { lat, lng },
          map,
          title: accommodation.name,
          icon: {
            url: svgUrl,
            scaledSize: iconSize,
            anchor: iconAnchor,
          },
        }) as SearchMapMarker;

        marker.accommodationId = accommodation.id;
        marker.accommodation = accommodation;
        marker.icons = {
          default: {
            url: svgUrl,
            scaledSize: iconSize,
            anchor: iconAnchor,
          },
          selected: {
            url: selectedSvgUrl,
            scaledSize: iconSize,
            anchor: iconAnchor,
          },
          hovered: {
            url: hoveredSvgUrl,
            scaledSize: iconSize,
            anchor: iconAnchor,
          },
        };
        marker.originalIcon = marker.icons.default;
        marker.isSelected = false;

        markerListeners.push(
          marker.addListener("mouseover", () => {
            if (preserveSelectedIcon()) return;

            if (animationFrameId !== null) {
              window.cancelAnimationFrame(animationFrameId);
            }
            animateScale(currentScale, targetScale, Date.now());
          }),
          marker.addListener("mouseout", () => {
            if (preserveSelectedIcon()) return;

            if (animationFrameId !== null) {
              window.cancelAnimationFrame(animationFrameId);
            }
            animateScale(currentScale, 1.0, Date.now());
          }),
          marker.addListener("click", (event: google.maps.MapMouseEvent) => {
            event.domEvent?.stopPropagation();
            onAccommodationSelectRef.current(accommodation);
          }),
        );

        marker.dispose = disposeMarkerResources;

        markersRef.current.push(marker);
      } catch {
        disposeMarkerResources();
      }
    });

    if (viewport && !isMapDragMode) {
      const viewportChanged = hasViewportChanged(
        prevViewportRef.current,
        viewport,
      );

      if (viewportChanged) {
        isInitialIdleRef.current = true;
        const viewportBounds = new maps.LatLngBounds(
          { lat: viewport.south, lng: viewport.west },
          { lat: viewport.north, lng: viewport.east },
        );
        map.fitBounds(viewportBounds, 50);
        prevViewportRef.current = viewport;
        viewportJustChangedRef.current = true;
      }
    }

    const accommodationsChanged = haveAccommodationIdsChanged(
      prevAccommodationsRef.current,
      validAccommodations,
    );

    if (
      shouldFitAccommodationBounds({
        validAccommodationCount: validAccommodations.length,
        isMapDragMode,
        viewportJustChanged: viewportJustChangedRef.current,
        shouldUpdateMapBounds,
        boundsInitialized: boundsInitializedRef.current,
        accommodationsChanged,
      })
    ) {
      isInitialIdleRef.current = true;

      if (validAccommodations.length > 1) {
        map.fitBounds(bounds, 50);
      } else if (validAccommodations.length === 1) {
        const [firstAccommodation] = validAccommodations;
        if (firstAccommodation) {
          map.setCenter({
            lat: firstAccommodation.coordinate.latitude,
            lng: firstAccommodation.coordinate.longitude,
          });
          map.setZoom(12);
        }
      }

      boundsInitializedRef.current = true;
      viewportJustChangedRef.current = false;
      prevAccommodationsRef.current = [...validAccommodations];
      onMapBoundsUpdated?.();
      return;
    }

    if (accommodationsChanged) {
      prevAccommodationsRef.current = [...validAccommodations];
    }
    // onAccommodationSelect is read from a ref to avoid rebuilding markers for callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accommodations,
    isMapDragMode,
    shouldUpdateMapBounds,
    onMapBoundsUpdated,
    viewport,
    isMapLoaded,
  ]);
};
