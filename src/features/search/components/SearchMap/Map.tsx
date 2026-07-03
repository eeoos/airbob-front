import React, { useEffect, useRef } from "react";
import { useGoogleMapsScript } from "../../../../hooks/useGoogleMapsScript";
import { useAccommodationMarkers } from "./hooks/useAccommodationMarkers";
import { useGoogleMapInstance } from "./hooks/useGoogleMapInstance";
import { useMapBoundsReporter } from "./hooks/useMapBoundsReporter";
import { useMapExpandControl } from "./hooks/useMapExpandControl";
import { useMapSelectionInfoWindow } from "./hooks/useMapSelectionInfoWindow";
import { SearchMapMarker, SearchMapProps } from "./types";
import styles from "./Map.module.css";

export const Map: React.FC<SearchMapProps> = ({
  accommodations,
  selectedAccommodationId,
  hoveredAccommodationId,
  onAccommodationSelect,
  onWishlistToggle,
  checkIn,
  checkOut,
  isExpanded = false,
  onExpandToggle,
  onBoundsChange,
  isMapDragMode = false,
  shouldUpdateMapBounds = false,
  onMapBoundsUpdated,
  viewport,
  onMapInteraction,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<SearchMapMarker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const prevSelectedIdRef = useRef<number | null>(null);
  const prevHoveredIdRef = useRef<number | null>(null);
  const hoveredAccommodationIdRef = useRef<number | null>(null);
  const isInitialIdleRef = useRef(true);
  const onAccommodationSelectRef = useRef(onAccommodationSelect);
  const prevViewportRef = useRef<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);
  const viewportJustChangedRef = useRef(false);
  const { isLoaded: isMapLoaded, status: mapScriptStatus } =
    useGoogleMapsScript();

  useEffect(() => {
    onAccommodationSelectRef.current = onAccommodationSelect;
  }, [onAccommodationSelect]);

  useGoogleMapInstance({
    infoWindowRef,
    isExpanded,
    isInitialIdleRef,
    isMapLoaded,
    mapInstanceRef,
    mapRef,
    onAccommodationSelectRef,
    onExpandToggle,
    onMapInteraction,
    prevViewportRef,
    viewport,
    viewportJustChangedRef,
  });

  const isLoadingBounds = useMapBoundsReporter({
    isInitialIdleRef,
    mapInstanceRef,
    onBoundsChange,
  });

  useAccommodationMarkers({
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
  });

  useMapSelectionInfoWindow({
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
  });

  useMapExpandControl({
    isExpanded,
    isMapLoaded,
    mapInstanceRef,
    mapRef,
    onExpandToggle,
  });

  if (!isMapLoaded) {
    const mapFallbackText =
      mapScriptStatus === "missing-key" || mapScriptStatus === "error"
        ? "지도를 불러올 수 없습니다."
        : "지도를 불러오는 중...";

    return (
      <div className={styles.mapContainer}>
        <div className={styles.loading}>{mapFallbackText}</div>
      </div>
    );
  }

  return (
    <div className={styles.mapContainer}>
      <div ref={mapRef} className={styles.mapCanvas} />
      {isLoadingBounds && (
        <div className={styles.boundsLoadingOverlay}>
          <div className={styles.loadingDots}>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
};
