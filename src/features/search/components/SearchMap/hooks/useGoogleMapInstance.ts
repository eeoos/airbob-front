import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { IntegrationError } from "../../../../../platform/integrations/errors";
import {
  createGoogleMapsIntegrationError,
  getGoogleMapsApi,
} from "../../../../../platform/integrations/googleMaps";
import type { SearchMapAccommodation, SearchMapViewport } from "../types";
import {
  DEFAULT_SEARCH_VIEWPORT,
  SEARCH_MAP_CAMERA,
} from "../../../lib/searchMapConfig";

interface UseGoogleMapInstanceOptions {
  infoWindowRef: MutableRefObject<google.maps.InfoWindow | null>;
  isInitialIdleRef: MutableRefObject<boolean>;
  isMapLoaded: boolean;
  mapInstanceRef: MutableRefObject<google.maps.Map | null>;
  mapRef: RefObject<HTMLDivElement | null>;
  onAccommodationSelectRef: MutableRefObject<
    (accommodation: SearchMapAccommodation | null) => void
  >;
  onMapInteraction?: (() => void) | undefined;
  prevViewportRef: MutableRefObject<SearchMapViewport | null>;
  viewport?: SearchMapViewport | null | undefined;
  viewportJustChangedRef: MutableRefObject<boolean>;
}

export const useGoogleMapInstance = ({
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
}: UseGoogleMapInstanceOptions) => {
  const [error, setError] = useState<IntegrationError | null>(null);
  const onMapInteractionRef = useRef(onMapInteraction);

  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction;
  }, [onMapInteraction]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;

    const maps = getGoogleMapsApi();
    if (!maps) {
      setError(createGoogleMapsIntegrationError("INTEGRATION_INVALID_RUNTIME"));
      return;
    }

    if (mapInstanceRef.current) {
      return;
    }

    const mapElement = mapRef.current;
    const mapListeners: google.maps.MapsEventListener[] = [];
    const elementListeners: Array<{
      event: keyof HTMLElementEventMap;
      listener: EventListener;
    }> = [];
    let createdMap: google.maps.Map | null = null;

    const initialViewport = viewport ?? DEFAULT_SEARCH_VIEWPORT;
    const initialCenter = {
      lat: (initialViewport.north + initialViewport.south) / 2,
      lng: (initialViewport.east + initialViewport.west) / 2,
    };

    const mapOptions: google.maps.MapOptions = {
      center: initialCenter,
      isFractionalZoomEnabled: true,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: true,
    };

    if (maps.ControlPosition) {
      mapOptions.zoomControlOptions = {
        position: maps.ControlPosition.RIGHT_CENTER,
      };
    }

    try {
      const map = new maps.Map(mapElement, mapOptions);
      createdMap = map;
      mapInstanceRef.current = map;
      setError(null);

      const initialBounds = new maps.LatLngBounds(
        { lat: initialViewport.south, lng: initialViewport.west },
        { lat: initialViewport.north, lng: initialViewport.east },
      );
      map.fitBounds(initialBounds, SEARCH_MAP_CAMERA.viewportPadding);
      prevViewportRef.current = initialViewport;
      viewportJustChangedRef.current = true;
      isInitialIdleRef.current = true;

      mapListeners.push(
        map.addListener("click", () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
          }
          onAccommodationSelectRef.current(null);

          onMapInteractionRef.current?.();
        }),
      );

      mapListeners.push(
        map.addListener("dragstart", () => {
          onMapInteractionRef.current?.();
        }),
      );
      const userMapInteractionListener = () => {
        onMapInteractionRef.current?.();
      };

      mapElement.addEventListener("touchstart", userMapInteractionListener, {
        passive: true,
      });
      mapElement.addEventListener("mousedown", userMapInteractionListener);
      mapElement.addEventListener("wheel", userMapInteractionListener, {
        passive: true,
      });
      mapElement.addEventListener("keydown", userMapInteractionListener);
      elementListeners.push(
        { event: "touchstart", listener: userMapInteractionListener },
        { event: "mousedown", listener: userMapInteractionListener },
        { event: "wheel", listener: userMapInteractionListener },
        { event: "keydown", listener: userMapInteractionListener },
      );
    } catch {
      mapInstanceRef.current = null;
      mapElement.replaceChildren();
      setError(createGoogleMapsIntegrationError("INTEGRATION_INVALID_RUNTIME"));
    }

    return () => {
      mapListeners.forEach((listener) => {
        listener?.remove?.();
      });
      elementListeners.forEach(({ event, listener }) => {
        mapElement.removeEventListener(event, listener);
      });

      if (createdMap) {
        createdMap.unbindAll();
      }

      if (mapInstanceRef.current === createdMap) {
        mapInstanceRef.current = null;
      }
    };
    // The map instance is intentionally created once. Live callbacks are read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapLoaded]);

  return error;
};
