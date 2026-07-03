import { MutableRefObject, RefObject, useEffect } from "react";
import { renderMapExpandControl } from "../lib/mapExpandControl";

interface UseMapExpandControlOptions {
  isExpanded: boolean;
  isMapLoaded: boolean;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  onExpandToggle?: () => void;
}

export const useMapExpandControl = ({
  isExpanded,
  isMapLoaded,
  mapInstanceRef,
  mapRef,
  onExpandToggle,
}: UseMapExpandControlOptions) => {
  useEffect(() => {
    if (!mapRef.current || !onExpandToggle || !isMapLoaded) return;

    let buttonTimer: number | null = null;
    let resizeTimer: number | null = null;

    const updateOrCreateButton = () => {
      if (!mapRef.current || !onExpandToggle) return;

      renderMapExpandControl({
        container: mapRef.current,
        isExpanded,
        onToggle: onExpandToggle,
      });
    };

    buttonTimer = window.setTimeout(() => {
      updateOrCreateButton();
    }, 100);

    if (mapInstanceRef.current) {
      resizeTimer = window.setTimeout(() => {
        const map = mapInstanceRef.current;
        if (map) {
          google.maps.event.trigger(map, "resize");
        }
      }, 100);
    }

    return () => {
      if (buttonTimer !== null) {
        window.clearTimeout(buttonTimer);
      }
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
    };
  }, [isExpanded, onExpandToggle, isMapLoaded, mapInstanceRef, mapRef]);
};
