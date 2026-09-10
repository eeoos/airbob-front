import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { getGoogleMapsApi } from "../../../../../platform/integrations/googleMaps";
import { SEARCH_MAP_CAMERA } from "../../../lib/searchMapConfig";
import {
  haveAccommodationIdsChanged,
  hasViewportChanged,
  shouldFitAccommodationBounds,
} from "../lib/mapBounds";
import { getResultViewport } from "../lib/resultViewport";
import { buildMarkerPriceSvg, getMarkerIconModel } from "../lib/markerIcon";
import {
  type SearchMapAccommodation,
  type SearchMapMarker,
  type SearchMapViewport,
} from "../types";

interface UseAccommodationMarkersOptions {
  autoFitAccommodations?: boolean;
  isWaitingForResults?: boolean;
  accommodations: SearchMapAccommodation[];
  checkIn?: string | null | undefined;
  checkOut?: string | null | undefined;
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
  accommodation.coordinate.longitude !== null &&
  Number.isFinite(accommodation.coordinate.latitude) &&
  Number.isFinite(accommodation.coordinate.longitude) &&
  Math.abs(accommodation.coordinate.latitude) <= 90 &&
  Math.abs(accommodation.coordinate.longitude) <= 180;

const createIconUrl = (svgIcon: string) => {
  const svgBlob = new Blob([svgIcon], { type: "image/svg+xml" });

  return URL.createObjectURL(svgBlob);
};

const disposeSearchMapMarkers = (markers: SearchMapMarker[]) => {
  markers.forEach((marker) => {
    if (marker.dispose) {
      marker.dispose();
      return;
    }

    marker.setMap(null);
  });
};

export const useAccommodationMarkers = ({
  autoFitAccommodations = true,
  isWaitingForResults = false,
  accommodations,
  checkIn,
  checkOut,
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
  const lastResultViewportRef = useRef<string | null>(null);
  const prevAccommodationsRef = useRef<SearchMapAccommodation[]>([]);
  const [mapSize, setMapSize] = useState("");

  useEffect(() => {
    if (
      !isMapLoaded ||
      !mapInstanceRef.current ||
      typeof ResizeObserver === "undefined"
    )
      return;
    const element = mapInstanceRef.current.getDiv();
    const observer = new ResizeObserver(() => {
      setMapSize(`${element.clientWidth}:${element.clientHeight}`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isMapLoaded, mapInstanceRef]);

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
    const markerIconModels = validAccommodations.map((accommodation) =>
      getMarkerIconModel(accommodation, checkIn, checkOut),
    );
    if (!isWaitingForResults && viewport) {
      if (
        !isMapDragMode &&
        (!autoFitAccommodations || validAccommodations.length === 0) &&
        hasViewportChanged(prevViewportRef.current, viewport)
      ) {
        isInitialIdleRef.current = true;
        const viewportBounds = new maps.LatLngBounds(
          { lat: viewport.south, lng: viewport.west },
          { lat: viewport.north, lng: viewport.east },
        );
        map.fitBounds(viewportBounds, SEARCH_MAP_CAMERA.viewportPadding);
        viewportJustChangedRef.current = true;
        lastResultViewportRef.current = null;
      }
      // Track manual searches too, so returning to the default region can reset the map.
      prevViewportRef.current = viewport;
    } else if (!isWaitingForResults && !viewport) {
      prevViewportRef.current = null;
    }
    const markerAccommodations = markersRef.current.flatMap((marker) =>
      marker.accommodationId === undefined
        ? []
        : [{ id: marker.accommodationId }],
    );
    const markersChanged = haveAccommodationIdsChanged(
      markerAccommodations,
      validAccommodations,
    );
    // Dates or refreshed rates can change prices even when the result IDs stay the same.
    const pricesChanged = markersRef.current.some(
      (marker, index) =>
        marker.priceText !== markerIconModels[index]?.priceText,
    );
    const shouldRebuildMarkers =
      markersChanged || pricesChanged || markersRef.current.length === 0;

    if (shouldRebuildMarkers) {
      disposeSearchMapMarkers(markersRef.current);
      markersRef.current = [];
    }

    if (validAccommodations.length === 0) {
      boundsInitializedRef.current = false;
      prevAccommodationsRef.current = [];
      if (!isWaitingForResults && shouldUpdateMapBounds) {
        onMapBoundsUpdated?.();
      }
      return;
    }

    validAccommodations.forEach((accommodation, index) => {
      const lat = accommodation.coordinate.latitude;
      const lng = accommodation.coordinate.longitude;

      if (!shouldRebuildMarkers) return;

      const markerIconModel = markerIconModels[index]!;
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
        markerListeners.forEach((listener) => listener?.remove?.());
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
        marker.priceText = markerIconModel.priceText;
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

    const accommodationsChanged = haveAccommodationIdsChanged(
      prevAccommodationsRef.current,
      validAccommodations,
    );

    if (
      !isWaitingForResults &&
      autoFitAccommodations &&
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

      const element = map.getDiv();
      const target = getResultViewport(
        validAccommodations.map((accommodation, index) => {
          const icon = markerIconModels[index]!;
          return {
            ...accommodation.coordinate,
            markerWidth: icon.totalWidth,
            markerHeight: icon.bubbleHeight,
          };
        }),
        element.clientWidth,
        element.clientHeight,
      );
      if (!target) return;
      const targetKey = JSON.stringify(target);
      if (isMapDragMode || lastResultViewportRef.current !== targetKey) {
        lastResultViewportRef.current = targetKey;
        // A single SDK camera transition, rather than separate center/zoom changes.
        map.fitBounds(
          new maps.LatLngBounds(
            { lat: target.south, lng: target.west },
            { lat: target.north, lng: target.east },
          ),
          0,
        );
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
    if (!isWaitingForResults && !autoFitAccommodations && shouldUpdateMapBounds)
      onMapBoundsUpdated?.();
    // onAccommodationSelect is read from a ref to avoid rebuilding markers for callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoFitAccommodations,
    isWaitingForResults,
    accommodations,
    checkIn,
    checkOut,
    isMapDragMode,
    shouldUpdateMapBounds,
    onMapBoundsUpdated,
    viewport,
    isMapLoaded,
    // Retry a pending fit when the mobile sheet's map acquires its initial size.
    mapSize,
  ]);
};
