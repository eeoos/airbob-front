import React, { useCallback, useEffect, useRef } from "react";
import { useGoogleMapsScript } from "../../../../platform/integrations/useGoogleMapsScript";
import {
  Skeleton,
  stateViewRecipes,
  TerminalErrorState,
} from "../../../../shared/ui";
import { useAccommodationMarkers } from "./hooks/useAccommodationMarkers";
import { useCurrentLocation } from "./hooks/useCurrentLocation";
import { useGoogleMapInstance } from "./hooks/useGoogleMapInstance";
import { useMapBoundsReporter } from "./hooks/useMapBoundsReporter";
import { useMapExpandControl } from "./hooks/useMapExpandControl";
import { useMapSelectionInfoWindow } from "./hooks/useMapSelectionInfoWindow";
import type { SearchMapMarker, SearchMapProps } from "./types";
import styles from "./Map.module.css";

export const Map: React.FC<SearchMapProps> = ({
  selectionPresentation = "anchored",
  autoFitAccommodations = true,
  isWaitingForResults = false,
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

  const locationSearchRef = useRef<
    ((center: google.maps.LatLngLiteral) => void) | null
  >(null);
  const cancelLocationSearchRef = useRef<(() => void) | null>(null);
  const currentLocation = useCurrentLocation({
    requestKey: boundsRequestKey,
    onLocation: (center) => locationSearchRef.current?.(center),
  });
  const cancelLocation = currentLocation.cancel;
  const handleMapInteraction = useCallback(() => {
    cancelLocation();
    cancelLocationSearchRef.current?.();
    onMapInteraction?.();
  }, [cancelLocation, onMapInteraction]);

  useEffect(() => {
    onAccommodationSelectRef.current = (accommodation) => {
      if (accommodation) handleMapInteraction();
      onAccommodationSelect(accommodation);
    };
  }, [handleMapInteraction, onAccommodationSelect]);

  const mapRuntimeError = useGoogleMapInstance({
    infoWindowRef,
    isInitialIdleRef,
    isMapLoaded,
    mapInstanceRef,
    mapRef,
    onAccommodationSelectRef,
    onMapInteraction: handleMapInteraction,
    prevViewportRef,
    viewport,
    viewportJustChangedRef,
  });

  const {
    isLoadingBounds,
    isLocationSearchPending,
    searchAround,
    cancelPendingBounds,
    cancelLocationSearch,
  } = useMapBoundsReporter({
    isInitialIdleRef,
    isMapLoaded,
    mapInstanceRef,
    onBoundsChange,
    onUserDragCancel: onBoundsDragCancel,
    onUserDragStart: onBoundsDragStart,
    requestKey: boundsRequestKey,
  });
  locationSearchRef.current = searchAround;
  cancelLocationSearchRef.current = cancelLocationSearch;

  useAccommodationMarkers({
    autoFitAccommodations,
    isWaitingForResults,
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
  });

  useMapSelectionInfoWindow({
    showInfoWindow: selectionPresentation === "anchored",
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
      {onBoundsChange && (
        <div className={styles.locationControl}>
          <button
            type="button"
            className={styles.locationButton}
            aria-label="현재 위치에서 검색"
            aria-busy={currentLocation.isLocating || isLocationSearchPending}
            disabled={currentLocation.isLocating || isLocationSearchPending}
            onClick={() => {
              cancelPendingBounds();
              onMapInteraction?.();
              currentLocation.requestLocation();
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
            <span>
              {currentLocation.isLocating
                ? "위치 확인 중…"
                : isLocationSearchPending
                  ? "주변 검색 중…"
                  : "현재 위치"}
            </span>
          </button>
          <div
            role="status"
            className={
              currentLocation.error ? styles.locationError : styles.statusText
            }
          >
            {currentLocation.error ??
              (currentLocation.isLocating
                ? "현재 위치를 확인하고 있습니다."
                : "")}
          </div>
        </div>
      )}
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
