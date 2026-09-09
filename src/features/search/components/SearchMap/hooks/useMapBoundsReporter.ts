import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { hasBoundsChanged } from "../lib/mapBounds";
import type { SearchMapBounds } from "../types";

interface UseMapBoundsReporterOptions {
  isInitialIdleRef: MutableRefObject<boolean>;
  isMapLoaded: boolean;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  onBoundsChange?: ((bounds: SearchMapBounds) => void) | undefined;
  onUserDragCancel?: (() => void) | undefined;
  onUserDragStart?: (() => void) | undefined;
  requestKey?: string | undefined;
}

const readMapBounds = (
  mapInstance: google.maps.Map,
): SearchMapBounds | null => {
  const bounds = mapInstance.getBounds();
  if (!bounds) return null;

  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();

  return {
    north: northEast.lat(),
    south: southWest.lat(),
    east: northEast.lng(),
    west: southWest.lng(),
  };
};

const isCameraAtLocation = (
  map: google.maps.Map,
  center: google.maps.LatLngLiteral,
) => {
  const currentCenter = map.getCenter();
  const longitudeDistance =
    currentCenter === undefined
      ? Infinity
      : Math.abs(currentCenter.lng() - center.lng);
  return (
    currentCenter !== undefined &&
    Math.abs(currentCenter.lat() - center.lat) < 1e-9 &&
    Math.min(longitudeDistance, 360 - longitudeDistance) < 1e-9 &&
    map.getZoom() === 13
  );
};

export const useMapBoundsReporter = ({
  isInitialIdleRef,
  isMapLoaded,
  mapInstanceRef,
  onBoundsChange,
  onUserDragCancel,
  onUserDragStart,
  requestKey,
}: UseMapBoundsReporterOptions) => {
  const [isLoadingBounds, setIsLoadingBounds] = useState(false);
  const boundsChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const previousBoundsRef = useRef<SearchMapBounds | null>(null);
  const userDragIntentRef = useRef(false);
  const locationTargetRef = useRef<google.maps.LatLngLiteral | null>(null);
  const reportIdleRef = useRef<(() => void) | null>(null);
  const userDragRequestKeyRef = useRef<string | undefined>(undefined);
  const pendingRequestKeyRef = useRef<string | undefined>(undefined);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onUserDragCancelRef = useRef(onUserDragCancel);
  const onUserDragStartRef = useRef(onUserDragStart);
  const requestKeyRef = useRef(requestKey);

  onBoundsChangeRef.current = onBoundsChange;
  onUserDragCancelRef.current = onUserDragCancel;
  onUserDragStartRef.current = onUserDragStart;
  requestKeyRef.current = requestKey;

  const canReportBounds = onBoundsChange !== undefined;

  const cancelPendingBounds = useCallback(() => {
    const hasIntent =
      userDragIntentRef.current || boundsChangeTimerRef.current !== null;
    if (boundsChangeTimerRef.current)
      clearTimeout(boundsChangeTimerRef.current);
    boundsChangeTimerRef.current = null;
    pendingRequestKeyRef.current = undefined;
    userDragIntentRef.current = false;
    locationTargetRef.current = null;
    userDragRequestKeyRef.current = undefined;
    setIsLoadingBounds(false);
    if (hasIntent) onUserDragCancelRef.current?.();
  }, []);

  const cancelLocationSearch = useCallback(() => {
    if (locationTargetRef.current !== null) cancelPendingBounds();
  }, [cancelPendingBounds]);

  const searchAround = useCallback(
    (center: google.maps.LatLngLiteral) => {
      const map = mapInstanceRef.current;
      if (!map || !reportIdleRef.current || !onBoundsChangeRef.current) return;

      cancelPendingBounds();
      userDragIntentRef.current = true;
      // Keep the target until the SDK settles; an earlier fitBounds may still finish.
      locationTargetRef.current = center;
      userDragRequestKeyRef.current = requestKeyRef.current;
      onUserDragStartRef.current?.();
      setIsLoadingBounds(true);
      const isAlreadyCentered = isCameraAtLocation(map, center);
      map.moveCamera({ center, zoom: 13 });
      // An unchanged camera does not emit another idle event.
      if (isAlreadyCentered) reportIdleRef.current();
    },
    [cancelPendingBounds, mapInstanceRef],
  );

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current || !canReportBounds) return;

    const mapInstance = mapInstanceRef.current;

    if (idleListenerRef.current) {
      idleListenerRef.current.remove();
      idleListenerRef.current = null;
    }

    if (boundsChangeTimerRef.current) {
      clearTimeout(boundsChangeTimerRef.current);
      boundsChangeTimerRef.current = null;
    }

    const handleIdle = () => {
      const nextBounds = readMapBounds(mapInstance);

      if (isInitialIdleRef.current && !userDragIntentRef.current) {
        isInitialIdleRef.current = false;
        previousBoundsRef.current = nextBounds;
        return;
      }

      isInitialIdleRef.current = false;
      if (!userDragIntentRef.current) return;
      const locationTarget = locationTargetRef.current;
      if (
        locationTarget &&
        userDragRequestKeyRef.current === requestKeyRef.current &&
        !isCameraAtLocation(mapInstance, locationTarget)
      ) {
        mapInstance.moveCamera({ center: locationTarget, zoom: 13 });
        return;
      }
      userDragIntentRef.current = false;
      const isLocationSearch = locationTarget !== null;
      locationTargetRef.current = null;

      const dragRequestKey = userDragRequestKeyRef.current;
      userDragRequestKeyRef.current = undefined;

      if (dragRequestKey !== requestKeyRef.current) {
        setIsLoadingBounds(false);
        return;
      }

      if (isLocationSearch && nextBounds !== null) {
        setIsLoadingBounds(false);
        previousBoundsRef.current = nextBounds;
        onBoundsChangeRef.current?.(nextBounds);
        return;
      }

      if (
        nextBounds === null ||
        !hasBoundsChanged(previousBoundsRef.current, nextBounds)
      ) {
        setIsLoadingBounds(false);
        onUserDragCancelRef.current?.();
        return;
      }

      if (boundsChangeTimerRef.current) {
        clearTimeout(boundsChangeTimerRef.current);
        boundsChangeTimerRef.current = null;
      }

      setIsLoadingBounds(true);
      pendingRequestKeyRef.current = dragRequestKey;

      boundsChangeTimerRef.current = setTimeout(() => {
        setIsLoadingBounds(false);
        boundsChangeTimerRef.current = null;
        const pendingRequestKey = pendingRequestKeyRef.current;
        pendingRequestKeyRef.current = undefined;

        if (pendingRequestKey === requestKeyRef.current) {
          previousBoundsRef.current = nextBounds;
          onBoundsChangeRef.current?.(nextBounds);
        }
      }, 3000);
    };

    const markUserViewportIntent = () => {
      locationTargetRef.current = null;
      if (boundsChangeTimerRef.current) {
        clearTimeout(boundsChangeTimerRef.current);
        boundsChangeTimerRef.current = null;
        pendingRequestKeyRef.current = undefined;
        setIsLoadingBounds(false);
      }

      userDragIntentRef.current = true;
      userDragRequestKeyRef.current = requestKeyRef.current;
      onUserDragStartRef.current?.();
    };

    reportIdleRef.current = handleIdle;
    idleListenerRef.current = mapInstance.addListener("idle", handleIdle);
    const dragStartListener = mapInstance.addListener(
      "dragstart",
      markUserViewportIntent,
    );

    return () => {
      const shouldCancelUserDrag =
        userDragIntentRef.current || boundsChangeTimerRef.current !== null;

      if (boundsChangeTimerRef.current) {
        clearTimeout(boundsChangeTimerRef.current);
        boundsChangeTimerRef.current = null;
        pendingRequestKeyRef.current = undefined;
      }
      userDragIntentRef.current = false;
      locationTargetRef.current = null;
      reportIdleRef.current = null;
      userDragRequestKeyRef.current = undefined;
      if (idleListenerRef.current) {
        idleListenerRef.current.remove();
        idleListenerRef.current = null;
      }
      dragStartListener?.remove?.();
      if (shouldCancelUserDrag) {
        onUserDragCancelRef.current?.();
      }
    };
  }, [canReportBounds, isInitialIdleRef, isMapLoaded, mapInstanceRef]);

  useEffect(() => {
    if (
      userDragIntentRef.current &&
      userDragRequestKeyRef.current !== requestKey
    ) {
      cancelPendingBounds();
    }
    if (
      !boundsChangeTimerRef.current ||
      pendingRequestKeyRef.current === requestKey
    ) {
      return;
    }

    clearTimeout(boundsChangeTimerRef.current);
    boundsChangeTimerRef.current = null;
    pendingRequestKeyRef.current = undefined;
    setIsLoadingBounds(false);
  }, [cancelPendingBounds, requestKey]);

  useEffect(() => {
    if (canReportBounds) return;

    if (boundsChangeTimerRef.current) {
      clearTimeout(boundsChangeTimerRef.current);
      boundsChangeTimerRef.current = null;
      pendingRequestKeyRef.current = undefined;
    }
    setIsLoadingBounds(false);
  }, [canReportBounds]);

  return {
    isLoadingBounds,
    isLocationSearchPending:
      isLoadingBounds && locationTargetRef.current !== null,
    cancelPendingBounds,
    cancelLocationSearch,
    searchAround,
  };
};
