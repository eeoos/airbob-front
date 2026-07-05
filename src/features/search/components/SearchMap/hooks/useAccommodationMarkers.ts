import { MutableRefObject, useEffect, useRef } from "react";
import {
  haveAccommodationIdsChanged,
  hasViewportChanged,
  shouldFitAccommodationBounds,
} from "../lib/mapBounds";
import {
  buildMarkerPriceSvg,
  getMarkerIconModel,
} from "../lib/markerIcon";
import {
  SearchMapAccommodation,
  SearchMapMarker,
  SearchMapViewport,
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
  onMapBoundsUpdated?: () => void;
  prevViewportRef: MutableRefObject<SearchMapViewport | null>;
  shouldUpdateMapBounds: boolean;
  viewport?: SearchMapViewport | null;
  viewportJustChangedRef: MutableRefObject<boolean>;
}

const createIconUrl = (svgIcon: string) => {
  const svgBlob = new Blob([svgIcon], { type: "image/svg+xml" });

  return URL.createObjectURL(svgBlob);
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

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;

    const map = mapInstanceRef.current;

    const existingIds = new Set(
      markersRef.current.flatMap((marker) =>
        marker.accommodationId === undefined ? [] : [marker.accommodationId]
      )
    );
    const newIds = new Set(accommodations.map((accommodation) => accommodation.id));

    const hasChanged =
      existingIds.size !== newIds.size ||
      !Array.from(existingIds).every((id) => newIds.has(id)) ||
      !Array.from(newIds).every((id) => existingIds.has(id));

    if (!hasChanged && markersRef.current.length > 0) {
      return;
    }

    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    markersRef.current = [];

    if (!boundsInitializedRef.current) {
      boundsInitializedRef.current = false;
    }

    const validAccommodations = accommodations.filter(
      (accommodation) =>
        accommodation.coordinate.latitude !== null &&
        accommodation.coordinate.longitude !== null
    );

    if (validAccommodations.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    validAccommodations.forEach((accommodation) => {
      const lat = accommodation.coordinate.latitude!;
      const lng = accommodation.coordinate.longitude!;

      const markerIconModel = getMarkerIconModel({
        basePrice: accommodation.basePrice,
        currency: accommodation.currency,
      });
      const { totalWidth, bubbleHeight, anchor } = markerIconModel;
      const svgIcon = buildMarkerPriceSvg(markerIconModel, "default");
      const svgUrl = createIconUrl(svgIcon);

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: accommodation.name,
        icon: {
          url: svgUrl,
          scaledSize: new window.google.maps.Size(totalWidth, bubbleHeight),
          anchor: new window.google.maps.Point(anchor.x, anchor.y),
        },
      }) as SearchMapMarker;

      marker.accommodationId = accommodation.id;
      marker.accommodation = accommodation;

      const selectedSvgIcon = buildMarkerPriceSvg(markerIconModel, "selected");
      const selectedSvgUrl = createIconUrl(selectedSvgIcon);
      const hoveredSvgIcon = buildMarkerPriceSvg(markerIconModel, "hovered");
      const hoveredSvgUrl = createIconUrl(hoveredSvgIcon);
      const iconSize = new window.google.maps.Size(totalWidth, bubbleHeight);
      const iconAnchor = new window.google.maps.Point(anchor.x, anchor.y);

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

      let animationFrameId: number | null = null;
      let currentScale = 1.0;
      const targetScale = 1.1;
      const animationDuration = 200;

      const animateScale = (
        startScale: number,
        endScale: number,
        startTime: number
      ) => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentScale = startScale + (endScale - startScale) * easeOut;

        const originalIcon = marker.originalIcon;
        if (originalIcon?.scaledSize) {
          marker.setIcon({
            url: originalIcon.url,
            scaledSize: new window.google.maps.Size(
              originalIcon.scaledSize.width * currentScale,
              originalIcon.scaledSize.height * currentScale
            ),
            anchor: new window.google.maps.Point(
              (originalIcon.scaledSize.width * currentScale) / 2,
              originalIcon.scaledSize.height * currentScale
            ),
          });
        }

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(() =>
            animateScale(startScale, endScale, startTime)
          );
        }
      };

      marker.addListener("mouseover", () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        animateScale(currentScale, targetScale, Date.now());
      });

      marker.addListener("mouseout", () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        animateScale(currentScale, 1.0, Date.now());
      });

      marker.addListener("click", (event: google.maps.MapMouseEvent) => {
        event.domEvent?.stopPropagation();
        onAccommodationSelectRef.current(accommodation);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });

    if (viewport && !isMapDragMode) {
      const viewportChanged = hasViewportChanged(
        prevViewportRef.current,
        viewport
      );

      if (viewportChanged) {
        isInitialIdleRef.current = true;
        const viewportBounds = new window.google.maps.LatLngBounds(
          { lat: viewport.south, lng: viewport.west },
          { lat: viewport.north, lng: viewport.east }
        );
        map.fitBounds(viewportBounds, 50);
        prevViewportRef.current = viewport;
        viewportJustChangedRef.current = true;
      }
    }

    const accommodationsChanged = haveAccommodationIdsChanged(
      prevAccommodationsRef.current,
      validAccommodations
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
        const firstAccommodation = validAccommodations[0];
        map.setCenter({
          lat: firstAccommodation.coordinate.latitude!,
          lng: firstAccommodation.coordinate.longitude!,
        });
        map.setZoom(12);
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
