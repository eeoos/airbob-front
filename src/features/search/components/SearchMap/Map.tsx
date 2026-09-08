import React, { useEffect, useRef } from "react";
import { useGoogleMapsScript } from "../../../../platform/integrations/useGoogleMapsScript";
import {
  Skeleton,
  stateViewRecipes,
  TerminalErrorState,
} from "../../../../shared/ui";
import { useAccommodationMarkers } from "./hooks/useAccommodationMarkers";
import { useGoogleMapInstance } from "./hooks/useGoogleMapInstance";
import { useMapBoundsReporter } from "./hooks/useMapBoundsReporter";
import { useMapExpandControl } from "./hooks/useMapExpandControl";
import { useMapSelectionInfoWindow } from "./hooks/useMapSelectionInfoWindow";
import type { SearchMapMarker, SearchMapProps } from "./types";
import styles from "./Map.module.css";

export const Map: React.FC<SearchMapProps> = ({
  accommodations,
  selectedAccommodationId,
  hoveredAccommodationId,
  onAccommodationSelect,
  onWishlistToggle,
  getAccommodationHref,
  onAccommodationOpen,
  checkIn,
  checkOut,
  isExpanded = false,
  onExpandToggle,
  onBoundsChange,
  onBoundsDragCancel,
  onBoundsDragStart,
  boundsRequestKey,
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

  const mapRuntimeError = useGoogleMapInstance({
    infoWindowRef,
    isInitialIdleRef,
    isMapLoaded,
    mapInstanceRef,
    mapRef,
    onAccommodationSelectRef,
    onMapInteraction,
    prevViewportRef,
    viewport,
    viewportJustChangedRef,
  });

  const isLoadingBounds = useMapBoundsReporter({
    isInitialIdleRef,
    isMapLoaded,
    mapInstanceRef,
    onBoundsChange,
    onUserDragCancel: onBoundsDragCancel,
    onUserDragStart: onBoundsDragStart,
    requestKey: boundsRequestKey,
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
  });

  useMapExpandControl({
    isExpanded,
    isMapLoaded,
    mapInstanceRef,
    mapRef,
    onExpandToggle,
  });

  const hasMapError =
    mapRuntimeError !== null ||
    mapScriptStatus === "missing-key" ||
    mapScriptStatus === "error";

  if (!isMapLoaded || hasMapError) {
    return (
      <div className={styles.mapContainer}>
        {hasMapError ? (
          <TerminalErrorState
            className={styles.mapState}
            title="지도 없이 결과를 둘러볼 수 있어요"
            description="지도를 불러오지 못했지만 숙소 목록과 상세 정보는 계속 이용할 수 있습니다."
          />
        ) : (
          <div className={styles.loading} {...stateViewRecipes.loading}>
            <span className={styles.statusText}>지도를 불러오는 중입니다.</span>
            <Skeleton className={styles.mapSkeleton} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.mapContainer}>
      <div
        ref={mapRef}
        aria-label="숙소 지도"
        className={styles.mapCanvas}
        role="region"
      />
      {isLoadingBounds && (
        <div
          aria-label="지도 범위 검색 중"
          className={styles.boundsLoadingOverlay}
          role="status"
        >
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
