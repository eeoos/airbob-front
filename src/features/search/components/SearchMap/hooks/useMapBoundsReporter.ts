import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { hasBoundsChanged } from "../lib/mapBounds";
import type { SearchMapBounds } from "../types";

interface UseMapBoundsReporterOptions {
  isInitialIdleRef: MutableRefObject<boolean>;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  onBoundsChange?: ((bounds: SearchMapBounds) => void) | undefined;
}

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
        const bounds = mapInstance.getBounds();

        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          previousBoundsRef.current = {
            north: ne.lat(),
            south: sw.lat(),
            east: ne.lng(),
            west: sw.lng(),
          };
        }
        return;
      }

      if (boundsChangeTimerRef.current) {
        clearTimeout(boundsChangeTimerRef.current);
        boundsChangeTimerRef.current = null;
      }

      setIsLoadingBounds(true);

      boundsChangeTimerRef.current = setTimeout(() => {
        setIsLoadingBounds(false);
        const bounds = mapInstance.getBounds();

        if (!bounds) {
          return;
        }

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const newBounds = {
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        };

        if (!hasBoundsChanged(previousBoundsRef.current, newBounds)) {
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
