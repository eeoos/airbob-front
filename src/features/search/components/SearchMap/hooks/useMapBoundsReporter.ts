import { useEffect, useRef, useState, type MutableRefObject } from "react";
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
      userDragIntentRef.current = false;

      const dragRequestKey = userDragRequestKeyRef.current;
      userDragRequestKeyRef.current = undefined;

      if (dragRequestKey !== requestKeyRef.current) return;

      if (
        nextBounds === null ||
        !hasBoundsChanged(previousBoundsRef.current, nextBounds)
      ) {
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
      !boundsChangeTimerRef.current ||
      pendingRequestKeyRef.current === requestKey
    ) {
      return;
    }

    clearTimeout(boundsChangeTimerRef.current);
    boundsChangeTimerRef.current = null;
    pendingRequestKeyRef.current = undefined;
    setIsLoadingBounds(false);
  }, [requestKey]);

  useEffect(() => {
    if (canReportBounds) return;

    if (boundsChangeTimerRef.current) {
      clearTimeout(boundsChangeTimerRef.current);
      boundsChangeTimerRef.current = null;
      pendingRequestKeyRef.current = undefined;
    }
    setIsLoadingBounds(false);
  }, [canReportBounds]);

  return isLoadingBounds;
};
