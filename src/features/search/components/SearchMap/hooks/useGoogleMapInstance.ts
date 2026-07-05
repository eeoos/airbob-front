import { MutableRefObject, RefObject, useEffect, useRef } from "react";
import { renderMapExpandControl } from "../lib/mapExpandControl";
import { SearchMapAccommodation, SearchMapViewport } from "../types";

interface UseGoogleMapInstanceOptions {
  infoWindowRef: MutableRefObject<google.maps.InfoWindow | null>;
  isExpanded: boolean;
  isInitialIdleRef: MutableRefObject<boolean>;
  isMapLoaded: boolean;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  onAccommodationSelectRef: MutableRefObject<
    (accommodation: SearchMapAccommodation | null) => void
  >;
  onExpandToggle?: () => void;
  onMapInteraction?: () => void;
  prevViewportRef: MutableRefObject<SearchMapViewport | null>;
  viewport?: SearchMapViewport | null;
  viewportJustChangedRef: MutableRefObject<boolean>;
}

export const useGoogleMapInstance = ({
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
}: UseGoogleMapInstanceOptions) => {
  const onMapInteractionRef = useRef(onMapInteraction);

  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction;
  }, [onMapInteraction]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;

    if (mapInstanceRef.current) {
      return;
    }

    const mapElement = mapRef.current;
    const mapListeners: google.maps.MapsEventListener[] = [];
    const elementListeners: Array<{
      event: keyof HTMLElementEventMap;
      listener: EventListener;
    }> = [];
    let expandControlTimer: number | null = null;

    const defaultCenter = { lat: 37.5665, lng: 126.9780 };
    const initialCenter = viewport
      ? {
          lat: (viewport.north + viewport.south) / 2,
          lng: (viewport.east + viewport.west) / 2,
        }
      : defaultCenter;

    const mapOptions: google.maps.MapOptions = {
      center: initialCenter,
      zoom: 7,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: true,
    };

    if (window.google?.maps?.ControlPosition) {
      mapOptions.zoomControlOptions = {
        position: window.google.maps.ControlPosition.RIGHT_CENTER,
      };
    }

    try {
      const map = new window.google.maps.Map(mapElement, mapOptions);
      mapInstanceRef.current = map;

      if (viewport) {
        const initialBounds = new window.google.maps.LatLngBounds(
          { lat: viewport.south, lng: viewport.west },
          { lat: viewport.north, lng: viewport.east }
        );
        map.fitBounds(initialBounds, 50);
        prevViewportRef.current = viewport;
        viewportJustChangedRef.current = true;
        isInitialIdleRef.current = true;
      }

      expandControlTimer = window.setTimeout(() => {
        if (!mapRef.current || !onExpandToggle) return;

        renderMapExpandControl({
          container: mapRef.current,
          isExpanded,
          onToggle: onExpandToggle,
        });
      }, 500);

      mapListeners.push(
        map.addListener("click", () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
            onAccommodationSelectRef.current(null);
          }

          onMapInteractionRef.current?.();
        })
      );

      mapListeners.push(
        map.addListener("dragstart", () => {
          onMapInteractionRef.current?.();
        })
      );
      mapListeners.push(
        map.addListener("zoomstart", () => {
          onMapInteractionRef.current?.();
        })
      );

      const touchStartListener = () => {
        onMapInteractionRef.current?.();
      };
      const mouseDownListener = () => {
        onMapInteractionRef.current?.();
      };

      mapElement.addEventListener("touchstart", touchStartListener, {
        passive: true,
      });
      mapElement.addEventListener("mousedown", mouseDownListener);
      elementListeners.push(
        { event: "touchstart", listener: touchStartListener },
        { event: "mousedown", listener: mouseDownListener }
      );
    } catch (error) {
      console.error("지도 초기화 실패:", error);
    }

    return () => {
      if (expandControlTimer !== null) {
        window.clearTimeout(expandControlTimer);
      }

      mapListeners.forEach((listener) => {
        google.maps.event.removeListener(listener);
      });
      elementListeners.forEach(({ event, listener }) => {
        mapElement.removeEventListener(event, listener);
      });
    };
    // The map instance is intentionally created once. Live callbacks are read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapLoaded]);
};
