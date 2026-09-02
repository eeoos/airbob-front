import { renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { requireDefined } from "../../../../../test/assertions";
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

const installMinimalMarkerRuntime = () => {
  class FakeMarker {
    addListener = vi.fn(() => ({ remove: vi.fn() }));
    setIcon = vi.fn();
    setMap = vi.fn();
    unbindAll = vi.fn();
  }

  class FakeSize {
    readonly width: number;
    readonly height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  }

  class FakePoint {
    readonly x: number;
    readonly y: number;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  }

  class FakeLatLngBounds {
    readonly points: Array<{ lat: number; lng: number }> = [];

    extend(point: { lat: number; lng: number }) {
      this.points.push(point);
    }
  }

  (window as any).google = {
    maps: {
      Map: function Map() {},
      Marker: FakeMarker,
      Size: FakeSize,
      Point: FakePoint,
      LatLngBounds: FakeLatLngBounds,
      event: {},
    },
  };
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:amenity-marker"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
};

const accommodationAt = (
  id: number,
  latitude: number,
  longitude: number,
): SearchMapAccommodation => ({
  ...accommodation,
  id,
  coordinate: { latitude, longitude },
});

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
    const listenerHandles = [
      { remove: vi.fn() },
      undefined,
      { remove: vi.fn() },
    ];
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
      readonly width: number;
      readonly height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
    }

    class FakePoint {
      readonly x: number;
      readonly y: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
      }
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
    const isInitialIdleRef = ref(true);
    const mapInstanceRef = ref(map);
    const onAccommodationSelectRef = ref(vi.fn());
    const prevViewportRef = ref<SearchMapViewport | null>(null);
    const viewportJustChangedRef = ref(false);
    const { rerender, unmount } = renderHook(
      ({ viewport }: { viewport: SearchMapViewport | null }) =>
        useAccommodationMarkers({
          accommodations: [accommodation],
          isInitialIdleRef,
          isMapDragMode: false,
          isMapLoaded: true,
          mapInstanceRef,
          markersRef,
          onAccommodationSelectRef,
          prevViewportRef,
          shouldUpdateMapBounds: false,
          viewport,
          viewportJustChangedRef,
        }),
      {
        initialProps: { viewport: null as SearchMapViewport | null },
      },
    );

    expect(markersRef.current).toHaveLength(1);
    rerender({
      viewport: { north: 38, south: 37, east: 128, west: 126 },
    });
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(3);

    requireDefined(handlers.mouseover, "mouseover handler")();
    expect(requestAnimationFrame).toHaveBeenCalled();

    const marker = requireDefined(markersRef.current[0], "map marker");
    marker.isSelected = true;
    requireDefined(handlers.mouseout, "mouseout handler")();

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(marker.setIcon).toHaveBeenLastCalledWith(marker.icons?.selected);

    marker.dispose?.();
    marker.dispose?.();
    unmount();

    listenerHandles
      .filter((listener) => listener !== undefined)
      .forEach((listener) => {
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

  it("consumes an explicit refit request when no result has a coordinate", () => {
    (window as any).google = {
      maps: { Map: function Map() {} },
    };
    const onMapBoundsUpdated = vi.fn();

    renderHook(() =>
      useAccommodationMarkers({
        accommodations: [],
        isInitialIdleRef: ref(true),
        isMapDragMode: false,
        isMapLoaded: true,
        mapInstanceRef: ref({} as google.maps.Map),
        markersRef: ref<SearchMapMarker[]>([]),
        onAccommodationSelectRef: ref(vi.fn()),
        onMapBoundsUpdated,
        prevViewportRef: ref<SearchMapViewport | null>(null),
        shouldUpdateMapBounds: true,
        viewport: null,
        viewportJustChangedRef: ref(false),
      }),
    );

    expect(onMapBoundsUpdated).toHaveBeenCalledTimes(1);
  });

  it("uses a city-level center for duplicate coordinates", () => {
    installMinimalMarkerRuntime();
    const fitBounds = vi.fn();
    const setCenter = vi.fn();
    const setZoom = vi.fn();
    const map = {
      fitBounds,
      setCenter,
      setZoom,
    } as unknown as google.maps.Map;

    renderHook(() =>
      useAccommodationMarkers({
        accommodations: [
          accommodationAt(10, 35.1796, 129.0756),
          accommodationAt(11, 35.1796, 129.0756),
        ],
        isInitialIdleRef: ref(true),
        isMapDragMode: false,
        isMapLoaded: true,
        mapInstanceRef: ref(map),
        markersRef: ref<SearchMapMarker[]>([]),
        onAccommodationSelectRef: ref(vi.fn()),
        prevViewportRef: ref<SearchMapViewport | null>(null),
        shouldUpdateMapBounds: false,
        viewport: null,
        viewportJustChangedRef: ref(false),
      }),
    );

    expect(fitBounds).not.toHaveBeenCalled();
    expect(setCenter).toHaveBeenCalledWith({
      lat: 35.1796,
      lng: 129.0756,
    });
    expect(setZoom).toHaveBeenCalledWith(12);
  });

  it("fits every distinct result coordinate with map padding", () => {
    installMinimalMarkerRuntime();
    const fitBounds = vi.fn();
    const setCenter = vi.fn();
    const setZoom = vi.fn();
    const map = {
      fitBounds,
      setCenter,
      setZoom,
    } as unknown as google.maps.Map;

    renderHook(() =>
      useAccommodationMarkers({
        accommodations: [
          accommodationAt(10, 35.1796, 129.0756),
          accommodationAt(11, 35.1587, 129.1604),
        ],
        isInitialIdleRef: ref(true),
        isMapDragMode: false,
        isMapLoaded: true,
        mapInstanceRef: ref(map),
        markersRef: ref<SearchMapMarker[]>([]),
        onAccommodationSelectRef: ref(vi.fn()),
        prevViewportRef: ref<SearchMapViewport | null>(null),
        shouldUpdateMapBounds: false,
        viewport: null,
        viewportJustChangedRef: ref(false),
      }),
    );

    expect(fitBounds).toHaveBeenCalledTimes(1);
    const fittedBounds = fitBounds.mock.calls[0]?.[0] as unknown as {
      points: Array<{ lat: number; lng: number }>;
    };
    expect(fittedBounds.points).toEqual([
      { lat: 35.1796, lng: 129.0756 },
      { lat: 35.1587, lng: 129.1604 },
    ]);
    expect(fitBounds).toHaveBeenCalledWith(fittedBounds, 50);
    expect(setCenter).not.toHaveBeenCalled();
    expect(setZoom).not.toHaveBeenCalled();
  });
});
