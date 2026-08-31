import { renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type {
  SearchMapAccommodation,
  SearchMapMarker,
  SearchMapViewport,
} from "../types";
import { useAccommodationMarkers } from "./useAccommodationMarkers";

const ref = <T,>(current: T): MutableRefObject<T> => ({ current });

const accommodation: SearchMapAccommodation = {
  id: 10,
  name: "Cleanup stay",
  thumbnailUrl: null,
  locationLabel: "Seoul",
  showReview: false,
  reviewRatingLabel: "0.0",
  reviewCountLabel: "(0)",
  basePrice: 100000,
  currency: "KRW",
  isInWishlist: false,
  coordinate: { latitude: 37.5, longitude: 127 },
};

describe("useAccommodationMarkers", () => {
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalGoogle = window.google;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    (window as any).google = originalGoogle;
  });

  it("disposes marker listeners, animation frame, object URLs, and owned bindings", () => {
    const listenerHandles = Array.from({ length: 3 }, () => ({
      remove: vi.fn(),
    }));
    const handlers: Record<string, (...args: any[]) => void> = {};
    const setMap = vi.fn();
    const unbindAll = vi.fn();
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:default")
      .mockReturnValueOnce("blob:selected")
      .mockReturnValueOnce("blob:hovered");
    const cancelAnimationFrame = vi.fn();
    const requestAnimationFrame = vi.fn(() => 41);
    let nextListenerIndex = 0;

    class FakeMarker {
      addListener = vi.fn(
        (eventName: string, handler: (...args: any[]) => void) => {
          handlers[eventName] = handler;
          return listenerHandles[nextListenerIndex++];
        },
      );
      setIcon = vi.fn();
      setMap = setMap;
      unbindAll = unbindAll;
    }

    class FakeSize {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
    }

    class FakePoint {
      constructor(
        readonly x: number,
        readonly y: number,
      ) {}
    }

    (window as any).google = {
      maps: {
        Map: function Map() {},
        Marker: FakeMarker,
        Size: FakeSize,
        Point: FakePoint,
        LatLngBounds: class LatLngBounds {
          extend = vi.fn();
        },
        event: {},
      },
    };
    window.cancelAnimationFrame = cancelAnimationFrame;
    window.requestAnimationFrame = requestAnimationFrame;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    const map = {
      fitBounds: vi.fn(),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
    } as unknown as google.maps.Map;
    const markersRef = ref<SearchMapMarker[]>([]);
    const { unmount } = renderHook(() =>
      useAccommodationMarkers({
        accommodations: [accommodation],
        isInitialIdleRef: ref(true),
        isMapDragMode: false,
        isMapLoaded: true,
        mapInstanceRef: ref(map),
        markersRef,
        onAccommodationSelectRef: ref(vi.fn()),
        prevViewportRef: ref<SearchMapViewport | null>(null),
        shouldUpdateMapBounds: false,
        viewportJustChangedRef: ref(false),
      }),
    );

    expect(markersRef.current).toHaveLength(1);
    handlers.mouseover();
    expect(requestAnimationFrame).toHaveBeenCalled();

    const marker = markersRef.current[0];
    marker.isSelected = true;
    handlers.mouseout();

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(marker.setIcon).toHaveBeenLastCalledWith(marker.icons?.selected);

    unmount();

    listenerHandles.forEach((listener) => {
      expect(listener.remove).toHaveBeenCalledTimes(1);
    });
    expect(cancelAnimationFrame).toHaveBeenCalledWith(41);
    expect(setMap).toHaveBeenCalledWith(null);
    expect(unbindAll).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual([
      "blob:default",
      "blob:selected",
      "blob:hovered",
    ]);
    expect(markersRef.current).toEqual([]);
  });
});
