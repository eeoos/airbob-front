import { MutableRefObject, useEffect, useRef, useState } from "react";
import { hasBoundsChanged } from "../lib/mapBounds";
import { SearchMapBounds } from "../types";

interface UseMapBoundsReporterOptions {
  isInitialIdleRef: MutableRefObject<boolean>;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  onBoundsChange?: (bounds: SearchMapBounds) => void;
}

export const useMapBoundsReporter = ({
  isInitialIdleRef,
  mapInstanceRef,
  onBoundsChange,
}: UseMapBoundsReporterOptions) => {
  const [isLoadingBounds, setIsLoadingBounds] = useState(false);
  const boundsChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const previousBoundsRef = useRef<SearchMapBounds | null>(null);

  useEffect(() => {
    if (!mapInstanceRef.current || !onBoundsChange) return;

    const mapInstance = mapInstanceRef.current;

    if (idleListenerRef.current) {
      google.maps.event.removeListener(idleListenerRef.current);
      idleListenerRef.current = null;
    }

    if (boundsChangeTimerRef.current) {
      clearTimeout(boundsChangeTimerRef.current);
      boundsChangeTimerRef.current = null;
    }

    const handleIdle = () => {
      if (isInitialIdleRef.current) {
        isInitialIdleRef.current = false;

        if (mapInstance.getBounds()) {
          const bounds = mapInstance.getBounds()!;
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

        if (!mapInstance.getBounds()) {
          return;
        }

        const bounds = mapInstance.getBounds()!;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const newBounds = {
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        };

        if (!hasBoundsChanged(previousBoundsRef.current, newBounds)) {
          setIsLoadingBounds(false);
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
        google.maps.event.removeListener(idleListenerRef.current);
        idleListenerRef.current = null;
      }
      setIsLoadingBounds(false);
    };
  }, [isInitialIdleRef, mapInstanceRef, onBoundsChange]);

  return isLoadingBounds;
};
