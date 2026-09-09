import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { requireDefined } from "../../../../../test/assertions";
import type {
  SearchMapAccommodation,
  SearchMapMarker,
  SearchMapViewport,
} from "../types";
import { useAccommodationMarkers } from "./useAccommodationMarkers";
import { DEFAULT_SEARCH_VIEWPORT } from "../../../lib/searchMapConfig";
import * as markerIcons from "../lib/markerIcon";

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

    constructor(
      southWest: { lat: number; lng: number },
      northEast: { lat: number; lng: number },
    ) {
      this.points.push(southWest, northEast);
    }

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it("refreshes all price icons for the same results when dates or nightly rates change", () => {
    installMinimalMarkerRuntime();
    const buildSvg = vi.spyOn(markerIcons, "buildMarkerPriceSvg");
    const map = {
      fitBounds: vi.fn(),
      getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }),
    };
    const markersRef = ref<SearchMapMarker[]>([]);
    const options = {
      isInitialIdleRef: ref(false),
      isMapDragMode: true,
      isMapLoaded: true,
      mapInstanceRef: ref(map as unknown as google.maps.Map),
      markersRef,
      onAccommodationSelectRef: ref(vi.fn()),
      prevViewportRef: ref<SearchMapViewport | null>(null),
      shouldUpdateMapBounds: false,
      viewportJustChangedRef: ref(false),
    };
    const initialProps = {
      accommodations: [accommodation],
      checkIn: null as string | null,
      checkOut: null as string | null,
    };
    const { rerender } = renderHook(
      (props) => useAccommodationMarkers({ ...options, ...props }),
      { initialProps },
    );
    const initialMarker = requireDefined(
      markersRef.current[0],
      "initial marker",
    );
    expect(buildSvg).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceText: "₩100,000" }),
      "hovered",
    );
    buildSvg.mockClear();

    rerender({
      ...initialProps,
      checkIn: "2026-09-20",
      checkOut: "2026-09-21",
    });
    expect(markersRef.current[0]).toBe(initialMarker);
    expect(buildSvg).not.toHaveBeenCalled();

    rerender({
      ...initialProps,
      checkIn: "2026-09-20",
      checkOut: "2026-09-23",
    });
    expect(markersRef.current[0]).not.toBe(initialMarker);
    expect(initialMarker.setMap).toHaveBeenCalledWith(null);
    for (const state of ["default", "selected", "hovered"] as const) {
      expect(buildSvg).toHaveBeenCalledWith(
        expect.objectContaining({ priceText: "₩300,000" }),
        state,
      );
    }
    buildSvg.mockClear();

    rerender({
      ...initialProps,
      checkIn: "2026-10-01",
      checkOut: "2026-10-04",
    });
    expect(buildSvg).not.toHaveBeenCalled();

    rerender(initialProps);
    expect(buildSvg).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceText: "₩100,000" }),
      "hovered",
    );
    rerender({
      ...initialProps,
      accommodations: [{ ...accommodation, basePrice: 120000 }],
    });
    expect(buildSvg).toHaveBeenLastCalledWith(
      expect.objectContaining({ priceText: "₩120,000" }),
      "hovered",
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
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
      getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }),
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

  it("fits duplicate coordinates in one transition without zooming past neighborhood level", () => {
    installMinimalMarkerRuntime();
    const fitBounds = vi.fn();
    const setCenter = vi.fn();
    const setZoom = vi.fn();
    const map = {
      getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }),
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

    expect(fitBounds).toHaveBeenCalledOnce();
    const bounds = fitBounds.mock.calls[0]?.[0] as {
      points: Array<{ lat: number; lng: number }>;
    };
    const southWest = requireDefined(bounds.points[0], "south west bound");
    const northEast = requireDefined(bounds.points[1], "north east bound");
    const zoom = Math.log2(
      1000 / (((northEast.lng - southWest.lng) / 360) * 256),
    );
    expect(zoom).toBeCloseTo(16);
    expect(southWest.lat).toBeLessThan(35.1796);
    expect(northEast.lat).toBeGreaterThan(35.1796);
    expect(setCenter).not.toHaveBeenCalled();
    expect(setZoom).not.toHaveBeenCalled();
  });

  it("keeps the default regional viewport even if results contain a distant accommodation", () => {
    installMinimalMarkerRuntime();
    const map = { fitBounds: vi.fn(), setCenter: vi.fn(), setZoom: vi.fn() };
    renderHook(() =>
      useAccommodationMarkers({
        accommodations: [accommodationAt(90, 35.17, 129.07)],
        autoFitAccommodations: false,
        isInitialIdleRef: ref(true),
        isMapDragMode: false,
        isMapLoaded: true,
        mapInstanceRef: ref(map as unknown as google.maps.Map),
        markersRef: ref<SearchMapMarker[]>([]),
        onAccommodationSelectRef: ref(vi.fn()),
        prevViewportRef: ref(DEFAULT_SEARCH_VIEWPORT),
        shouldUpdateMapBounds: true,
        viewport: DEFAULT_SEARCH_VIEWPORT,
        viewportJustChangedRef: ref(true),
      }),
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it.each([
    {
      viewport: { north: 35.3, south: 35, east: 129.3, west: 128.8 },
      isMapDragMode: true,
    },
    { viewport: null, isMapDragMode: false },
  ])(
    "returns from a previous search to the default region even with empty results: $isMapDragMode",
    (initialProps) => {
      installMinimalMarkerRuntime();
      const map = { fitBounds: vi.fn() };
      const prevViewportRef = ref<SearchMapViewport | null>(
        DEFAULT_SEARCH_VIEWPORT,
      );
      const mapInstanceRef = ref(map as unknown as google.maps.Map);
      const markersRef = ref<SearchMapMarker[]>([]);
      const viewportJustChangedRef = ref(false);
      const isInitialIdleRef = ref(false);
      const onAccommodationSelectRef = ref(vi.fn());
      const { rerender } = renderHook(
        ({ viewport, isMapDragMode }) =>
          useAccommodationMarkers({
            accommodations: [],
            autoFitAccommodations: false,
            isInitialIdleRef,
            isMapDragMode,
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
          initialProps,
        },
      );
      expect(map.fitBounds).not.toHaveBeenCalled();
      rerender({ viewport: DEFAULT_SEARCH_VIEWPORT, isMapDragMode: false });
      expect(map.fitBounds).toHaveBeenCalledOnce();
      expect(prevViewportRef.current).toEqual(DEFAULT_SEARCH_VIEWPORT);
    },
  );

  it("fits all result coordinates and their price labels in one transition", () => {
    installMinimalMarkerRuntime();
    const fitBounds = vi.fn();
    const setCenter = vi.fn();
    const setZoom = vi.fn();
    const map = {
      getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }),
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
    const southWest = requireDefined(
      fittedBounds.points[0],
      "south west bound",
    );
    const northEast = requireDefined(
      fittedBounds.points[1],
      "north east bound",
    );
    expect(southWest.lat).toBeLessThan(35.1587);
    expect(southWest.lng).toBeLessThan(129.0756);
    expect(northEast.lat).toBeGreaterThan(35.1796);
    expect(northEast.lng).toBeGreaterThan(129.1604);
    expect(fitBounds).toHaveBeenCalledWith(fittedBounds, 0);
    expect(setCenter).not.toHaveBeenCalled();
    expect(setZoom).not.toHaveBeenCalled();
  });

  it("waits for fresh page results and consumes a repeated refit without moving twice", () => {
    installMinimalMarkerRuntime();
    const map = {
      fitBounds: vi.fn(),
      getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }),
    };
    const options = {
      accommodations: [accommodation],
      isInitialIdleRef: ref(true),
      isMapDragMode: false,
      isMapLoaded: true,
      mapInstanceRef: ref(map as unknown as google.maps.Map),
      markersRef: ref<SearchMapMarker[]>([]),
      onAccommodationSelectRef: ref(vi.fn()),
      onMapBoundsUpdated: vi.fn(),
      prevViewportRef: ref<SearchMapViewport | null>(null),
      viewport: null,
      viewportJustChangedRef: ref(false),
    };
    const initialProps = {
      accommodations: [accommodation],
      isWaitingForResults: false,
      shouldUpdateMapBounds: false,
    };
    const { rerender } = renderHook(
      (props) => useAccommodationMarkers({ ...options, ...props }),
      { initialProps },
    );
    expect(map.fitBounds).toHaveBeenCalledOnce();
    map.fitBounds.mockClear();
    options.onMapBoundsUpdated.mockClear();

    const nextPage = [accommodationAt(11, 37.6, 127.1)];
    rerender({
      accommodations: nextPage,
      isWaitingForResults: true,
      shouldUpdateMapBounds: true,
    });
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(options.onMapBoundsUpdated).not.toHaveBeenCalled();
    rerender({
      accommodations: nextPage,
      isWaitingForResults: false,
      shouldUpdateMapBounds: true,
    });
    expect(map.fitBounds).toHaveBeenCalledOnce();
    rerender({
      accommodations: nextPage,
      isWaitingForResults: false,
      shouldUpdateMapBounds: false,
    });
    rerender({
      accommodations: nextPage,
      isWaitingForResults: false,
      shouldUpdateMapBounds: true,
    });
    expect(map.fitBounds).toHaveBeenCalledOnce();
    expect(options.onMapBoundsUpdated).toHaveBeenCalledTimes(2);
  });

  it("preserves manual map position until an explicit page refit is requested", () => {
    installMinimalMarkerRuntime();
    const map = {
      fitBounds: vi.fn(),
      getDiv: () => ({ clientWidth: 1000, clientHeight: 800 }),
    };
    const options = {
      accommodations: [accommodation],
      isInitialIdleRef: ref(false),
      isMapDragMode: true,
      isMapLoaded: true,
      mapInstanceRef: ref(map as unknown as google.maps.Map),
      markersRef: ref<SearchMapMarker[]>([]),
      onAccommodationSelectRef: ref(vi.fn()),
      prevViewportRef: ref<SearchMapViewport | null>(null),
      viewportJustChangedRef: ref(false),
    };
    const { rerender } = renderHook(
      ({ shouldUpdateMapBounds }) =>
        useAccommodationMarkers({ ...options, shouldUpdateMapBounds }),
      { initialProps: { shouldUpdateMapBounds: false } },
    );
    expect(map.fitBounds).not.toHaveBeenCalled();
    rerender({ shouldUpdateMapBounds: true });
    expect(map.fitBounds).toHaveBeenCalledOnce();
  });

  it("fits after the mobile map acquires its size and leaves later sheet resizing alone", () => {
    installMinimalMarkerRuntime();
    let onResize: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          onResize = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const element = { clientWidth: 425, clientHeight: 0 };
    const map = { fitBounds: vi.fn(), getDiv: () => element };
    const options = {
      accommodations: [accommodation],
      isInitialIdleRef: ref(false),
      isMapDragMode: false,
      isMapLoaded: true,
      mapInstanceRef: ref(map as unknown as google.maps.Map),
      markersRef: ref<SearchMapMarker[]>([]),
      onAccommodationSelectRef: ref(vi.fn()),
      prevViewportRef: ref<SearchMapViewport | null>(null),
      shouldUpdateMapBounds: false,
      viewportJustChangedRef: ref(false),
    };
    const { unmount } = renderHook(() => useAccommodationMarkers(options));
    expect(map.fitBounds).not.toHaveBeenCalled();
    element.clientHeight = 280;
    act(() => requireDefined(onResize, "map resize observer")());
    expect(map.fitBounds).toHaveBeenCalledOnce();
    element.clientHeight = 800;
    act(() => requireDefined(onResize, "map resize observer")());
    expect(map.fitBounds).toHaveBeenCalledOnce();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
