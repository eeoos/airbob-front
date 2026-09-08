import { useEffect, type MutableRefObject, type RefObject } from "react";
import { getGoogleMapsApi } from "../../../../../platform/integrations/googleMaps";
import {
  removeMapExpandControl,
  renderMapExpandControl,
} from "../lib/mapExpandControl";

interface UseMapExpandControlOptions {
  isExpanded: boolean;
  isMapLoaded: boolean;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  onExpandToggle?: (() => void) | undefined;
}

const MAP_LAYOUT_TRANSITION_SETTLE_MS = 350;

export const useMapExpandControl = ({
  isExpanded,
  isMapLoaded,
  mapInstanceRef,
  mapRef,
  onExpandToggle,
}: UseMapExpandControlOptions) => {
  useEffect(() => {
    const container = mapRef.current;

    return () => {
      if (container) removeMapExpandControl(container);
    };
  }, [isMapLoaded, mapRef]);

  useEffect(() => {
    if (!mapRef.current || !onExpandToggle || !isMapLoaded) {
      if (mapRef.current) removeMapExpandControl(mapRef.current);
      return;
    }

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
        const maps = getGoogleMapsApi();
        if (map && maps) {
          maps.event.trigger(map, "resize");
        }
      }, MAP_LAYOUT_TRANSITION_SETTLE_MS);
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
