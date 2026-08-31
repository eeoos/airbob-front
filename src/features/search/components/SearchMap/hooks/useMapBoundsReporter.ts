import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { hasBoundsChanged } from "../lib/mapBounds";
import type { SearchMapBounds } from "../types";

interface UseMapBoundsReporterOptions {
  isInitialIdleRef: MutableRefObject<boolean>;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  onBoundsChange?: ((bounds: SearchMapBounds) => void) | undefined;
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
  mapInstanceRef,
  onBoundsChange,
}: UseMapBoundsReporterOptions) => {
  const [isLoadingBounds, setIsLoadingBounds] = useState(false);
  const boundsChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const previousBoundsRef = useRef<SearchMapBounds | null>(null);

  useEffect(() => {
    if (!mapInstanceRef.current || !onBoundsChange) return;

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
      if (isInitialIdleRef.current) {
        isInitialIdleRef.current = false;
        previousBoundsRef.current = readMapBounds(mapInstance);
        return;
      }

      if (boundsChangeTimerRef.current) {
        clearTimeout(boundsChangeTimerRef.current);
        boundsChangeTimerRef.current = null;
      }

      setIsLoadingBounds(true);

      boundsChangeTimerRef.current = setTimeout(() => {
        setIsLoadingBounds(false);
        const newBounds = readMapBounds(mapInstance);

        if (
          newBounds === null ||
          !hasBoundsChanged(previousBoundsRef.current, newBounds)
        ) {
          return;
        }

        previousBoundsRef.current = newBounds;
        onBoundsChange(newBounds);
      }, 3000);
    };

    idleListenerRef.current = mapInstance.addListener("idle", handleIdle);

    return () => {
      if (boundsChangeTimerRef.current) {
        clearTimeout(boundsChangeTimerRef.current);
        boundsChangeTimerRef.current = null;
      }
      if (idleListenerRef.current) {
        idleListenerRef.current.remove();
        idleListenerRef.current = null;
      }
    };
  }, [isInitialIdleRef, mapInstanceRef, onBoundsChange]);

  return isLoadingBounds;
};
