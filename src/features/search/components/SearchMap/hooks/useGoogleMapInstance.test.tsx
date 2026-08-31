import { renderHook } from "@testing-library/react";
import type { MutableRefObject, RefObject } from "react";
import type { SearchMapAccommodation, SearchMapViewport } from "../types";
import { useGoogleMapInstance } from "./useGoogleMapInstance";

type HookOptions = Parameters<typeof useGoogleMapInstance>[0];

const ref = <T,>(current: T): MutableRefObject<T> => ({ current });

const createOptions = (
  mapElement: HTMLDivElement,
  overrides: Partial<HookOptions> = {},
): HookOptions => ({
  infoWindowRef: ref<google.maps.InfoWindow | null>(null),
  isInitialIdleRef: ref(true),
  isMapLoaded: true,
  mapInstanceRef: ref<google.maps.Map | null>(null),
  mapRef: { current: mapElement } as RefObject<HTMLDivElement | null>,
  onAccommodationSelectRef: ref(
    vi.fn() as (accommodation: SearchMapAccommodation | null) => void,
  ),
  prevViewportRef: ref<SearchMapViewport | null>(null),
  viewportJustChangedRef: ref(false),
  ...overrides,
});

describe("useGoogleMapInstance", () => {
  const originalGoogle = window.google;

  afterEach(() => {
    (window as any).google = originalGoogle;
  });

  it("returns a terminal typed error when the Map constructor fails", () => {
    (window as any).google = {
      maps: {
        Map: function Map() {
          throw new Error("provider payload must not escape");
        },
      },
    };
    const mapElement = document.createElement("div");
    mapElement.appendChild(document.createElement("span"));

    const { result } = renderHook(() =>
      useGoogleMapInstance(createOptions(mapElement)),
    );

    expect(result.current).toMatchObject({
      code: "INTEGRATION_INVALID_RUNTIME",
      integration: "google-maps",
      message: "Google Maps runtime is unavailable.",
    });
    // The map root is itself the SDK integration boundary under test.
    // eslint-disable-next-line testing-library/no-node-access
    expect(mapElement.childElementCount).toBe(0);
  });

  it("removes every owned listener and SDK instance resource on unmount", () => {
    const listenerHandles = Array.from({ length: 3 }, () => ({
      remove: vi.fn(),
    }));
    const unbindAll = vi.fn();
    let nextListenerIndex = 0;
    const addListener = vi.fn(() => listenerHandles[nextListenerIndex++]);
    const map = { addListener, unbindAll };
    const mapElement = document.createElement("div");
    const removeEventListener = vi.spyOn(mapElement, "removeEventListener");
    const mapInstanceRef = ref<google.maps.Map | null>(null);

    (window as any).google = {
      maps: {
        Map: function Map() {
          return map;
        },
        event: {},
      },
    };

    const { unmount } = renderHook(() =>
      useGoogleMapInstance(createOptions(mapElement, { mapInstanceRef })),
    );

    expect(mapInstanceRef.current).toBe(map);
    unmount();

    listenerHandles.forEach((listener) => {
      expect(listener.remove).toHaveBeenCalledTimes(1);
    });
    expect(removeEventListener).toHaveBeenCalledWith(
      "touchstart",
      expect.any(Function),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      "mousedown",
      expect.any(Function),
    );
    expect(unbindAll).toHaveBeenCalledTimes(1);
    expect(mapInstanceRef.current).toBeNull();
  });
});
