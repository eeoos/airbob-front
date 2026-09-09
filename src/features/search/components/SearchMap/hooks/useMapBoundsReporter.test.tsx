import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { SearchMapBounds } from "../types";
import { useMapBoundsReporter } from "./useMapBoundsReporter";

const ref = <T,>(current: T): MutableRefObject<T> => ({ current });

const createGoogleBounds = (bounds: SearchMapBounds) => ({
  getNorthEast: () => ({ lat: () => bounds.north, lng: () => bounds.east }),
  getSouthWest: () => ({ lat: () => bounds.south, lng: () => bounds.west }),
});

const createMapHarness = (initialBounds: SearchMapBounds) => {
  let currentBounds = initialBounds;
  let currentCenter = { lat: 37.5665, lng: 126.978 };
  let currentZoom = 7;
  const handlers: Record<string, () => void> = {};
  const listenerRemovals: Record<string, ReturnType<typeof vi.fn>> = {};
  const map = {
    addListener: vi.fn((eventName: string, listener: () => void) => {
      handlers[eventName] = listener;
      const remove = vi.fn();
      listenerRemovals[eventName] = remove;
      return { remove };
    }),
    getBounds: vi.fn(() => createGoogleBounds(currentBounds)),
    getCenter: vi.fn(() => ({
      lat: () => currentCenter.lat,
      lng: () => currentCenter.lng,
    })),
    getZoom: vi.fn(() => currentZoom),
    moveCamera: vi.fn(
      ({
        center,
        zoom,
      }: {
        center: google.maps.LatLngLiteral;
        zoom: number;
      }) => {
        currentCenter = center;
        currentZoom = zoom;
      },
    ),
  } as unknown as google.maps.Map;

  return {
    handlers,
    listenerRemovals,
    map,
    setBounds: (bounds: SearchMapBounds) => {
      currentBounds = bounds;
    },
  };
};

const initialBounds: SearchMapBounds = {
  north: 38,
  south: 37,
  east: 128,
  west: 126,
};

describe("useMapBoundsReporter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches the settled current-location viewport once, replacing a pending drag", () => {
    vi.useFakeTimers();
    const { handlers, map, setBounds } = createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const onUserDragStart = vi.fn();
    const mapInstanceRef = ref(map);
    const isInitialIdleRef = ref(true);
    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
        onUserDragStart,
        requestKey: "seoul-page-2",
      }),
    );
    act(() => handlers.idle?.());
    setBounds({ ...initialBounds, north: 39 });
    act(() => {
      handlers.dragstart?.();
      handlers.idle?.();
    });
    expect(vi.getTimerCount()).toBe(1);
    act(() => result.current.searchAround({ lat: 35.17, lng: 129.07 }));
    expect(map.moveCamera).toHaveBeenCalledExactlyOnceWith({
      center: { lat: 35.17, lng: 129.07 },
      zoom: 13,
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(onUserDragStart).toHaveBeenCalledTimes(2);
    const nearbyBounds = { north: 35.2, south: 35.1, east: 129.2, west: 129 };
    setBounds(nearbyBounds);
    act(() => {
      handlers.idle?.();
      handlers.idle?.();
      vi.runAllTimers();
    });
    expect(onBoundsChange).toHaveBeenCalledExactlyOnceWith(nearbyBounds);
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("does not overwrite a new search with a pending location camera move", () => {
    const { handlers, map } = createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const mapInstanceRef = ref(map);
    const isInitialIdleRef = ref(true);
    const { result, rerender } = renderHook(
      ({ requestKey }) =>
        useMapBoundsReporter({
          isInitialIdleRef,
          isMapLoaded: true,
          mapInstanceRef,
          onBoundsChange,
          requestKey,
        }),
      { initialProps: { requestKey: "seoul" } },
    );
    act(() => result.current.searchAround({ lat: 35.17, lng: 129.07 }));
    rerender({ requestKey: "jeju" });
    act(() => handlers.idle?.());
    expect(onBoundsChange).not.toHaveBeenCalled();
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("waits for the location camera when an earlier automatic fit finishes late", () => {
    const { handlers, map, setBounds } = createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const mapInstanceRef = ref(map);
    const isInitialIdleRef = ref(true);
    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
      }),
    );
    act(() => result.current.searchAround({ lat: 35.17, lng: 129.07 }));
    // Simulate a previously scheduled SDK fitBounds settling back over Seoul.
    map.moveCamera({ center: { lat: 37.5665, lng: 126.978 }, zoom: 11 });
    act(() => handlers.idle?.());
    expect(onBoundsChange).not.toHaveBeenCalled();
    expect(map.moveCamera).toHaveBeenLastCalledWith({
      center: { lat: 35.17, lng: 129.07 },
      zoom: 13,
    });
    const nearbyBounds = { north: 35.2, south: 35.1, east: 129.2, west: 129 };
    setBounds(nearbyBounds);
    act(() => handlers.idle?.());
    expect(onBoundsChange).toHaveBeenCalledExactlyOnceWith(nearbyBounds);
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("allows map interaction to cancel a location camera move before it settles", () => {
    const { handlers, map } = createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const onUserDragCancel = vi.fn();
    const mapInstanceRef = ref(map);
    const isInitialIdleRef = ref(true);
    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
        onUserDragCancel,
      }),
    );
    act(() => result.current.searchAround({ lat: 35.17, lng: 129.07 }));
    act(() => result.current.cancelLocationSearch());
    act(() => handlers.idle?.());
    expect(onBoundsChange).not.toHaveBeenCalled();
    expect(onUserDragCancel).toHaveBeenCalledOnce();
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("can search again when the map is already centered on the current location", () => {
    const { map } = createMapHarness(initialBounds);
    vi.mocked(map.getZoom).mockReturnValue(13);
    const onBoundsChange = vi.fn();
    const mapInstanceRef = ref(map);
    const isInitialIdleRef = ref(true);
    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
      }),
    );
    act(() =>
      result.current.searchAround({
        lat: 37.5665 + 1e-12,
        lng: 126.978 - 1e-12,
      }),
    );
    expect(onBoundsChange).toHaveBeenCalledExactlyOnceWith(initialBounds);
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("attaches listeners when the asynchronous map runtime becomes ready", () => {
    const { handlers, map } = createMapHarness(initialBounds);
    const mapInstanceRef = ref<google.maps.Map | null>(null);
    const isInitialIdleRef = ref(true);
    const onBoundsChange = vi.fn();

    const { rerender } = renderHook(
      ({ isMapLoaded }) =>
        useMapBoundsReporter({
          isInitialIdleRef,
          isMapLoaded,
          mapInstanceRef,
          onBoundsChange,
        }),
      { initialProps: { isMapLoaded: false } },
    );

    expect(map.addListener).not.toHaveBeenCalled();

    mapInstanceRef.current = map;
    rerender({ isMapLoaded: true });

    expect(map.addListener).toHaveBeenCalledTimes(2);
    expect(handlers.idle).toEqual(expect.any(Function));
    expect(handlers.dragstart).toEqual(expect.any(Function));
  });

  it("recognizes the same camera across longitude normalization at the date line", () => {
    const bounds = { north: 36, south: 34, east: -179, west: 179 };
    const { map } = createMapHarness(bounds);
    vi.mocked(map.getCenter).mockReturnValue({
      lat: () => 35,
      lng: () => -180,
    } as google.maps.LatLng);
    vi.mocked(map.getZoom).mockReturnValue(13);
    const onBoundsChange = vi.fn();
    const mapInstanceRef = ref(map);
    const isInitialIdleRef = ref(true);
    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
      }),
    );
    act(() => result.current.searchAround({ lat: 35, lng: 180 }));
    expect(onBoundsChange).toHaveBeenCalledExactlyOnceWith(bounds);
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("signals drag start immediately and cancels a drag whose bounds did not change", () => {
    vi.useFakeTimers();
    const { handlers, map } = createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const onUserDragCancel = vi.fn();
    const onUserDragStart = vi.fn();
    const isInitialIdleRef = ref(true);
    const mapInstanceRef = ref(map);

    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
        onUserDragCancel,
        onUserDragStart,
      }),
    );

    act(() => handlers.idle?.());
    act(() => handlers.dragstart?.());

    expect(onUserDragStart).toHaveBeenCalledTimes(1);
    expect(onUserDragCancel).not.toHaveBeenCalled();
    expect(result.current.isLoadingBounds).toBe(false);

    act(() => handlers.idle?.());

    expect(onUserDragCancel).toHaveBeenCalledTimes(1);
    expect(onBoundsChange).not.toHaveBeenCalled();
    expect(result.current.isLoadingBounds).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a settled drag pending across a callback identity change", () => {
    vi.useFakeTimers();
    const { handlers, listenerRemovals, map, setBounds } =
      createMapHarness(initialBounds);
    const firstOnBoundsChange = vi.fn();
    const nextOnBoundsChange = vi.fn();
    const requestKey = "seoul-page-2";
    const isInitialIdleRef = ref(true);
    const mapInstanceRef = ref(map);
    const draggedBounds: SearchMapBounds = {
      north: 35.25,
      south: 34.95,
      east: 129.25,
      west: 128.85,
    };

    const { result, rerender } = renderHook(
      ({ onBoundsChange }) =>
        useMapBoundsReporter({
          isInitialIdleRef,
          isMapLoaded: true,
          mapInstanceRef,
          onBoundsChange,
          requestKey,
        }),
      { initialProps: { onBoundsChange: firstOnBoundsChange } },
    );

    act(() => handlers.idle?.());
    setBounds(draggedBounds);
    act(() => {
      handlers.dragstart?.();
      handlers.idle?.();
    });

    expect(result.current.isLoadingBounds).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    rerender({ onBoundsChange: nextOnBoundsChange });

    expect(map.addListener).toHaveBeenCalledTimes(2);
    expect(listenerRemovals.idle).not.toHaveBeenCalled();
    expect(listenerRemovals.dragstart).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(3000));

    expect(firstOnBoundsChange).not.toHaveBeenCalled();
    expect(nextOnBoundsChange).toHaveBeenCalledExactlyOnceWith(draggedBounds);
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("discards a pending drag when a different search request starts", () => {
    vi.useFakeTimers();
    const { handlers, listenerRemovals, map, setBounds } =
      createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const isInitialIdleRef = ref(true);
    const mapInstanceRef = ref(map);
    const draggedBounds = { ...initialBounds, north: 38.5 };

    const { result, rerender } = renderHook(
      ({ requestKey }) =>
        useMapBoundsReporter({
          isInitialIdleRef,
          isMapLoaded: true,
          mapInstanceRef,
          onBoundsChange,
          requestKey,
        }),
      { initialProps: { requestKey: "seoul-page-2" } },
    );

    act(() => handlers.idle?.());
    setBounds(draggedBounds);
    act(() => {
      handlers.dragstart?.();
      handlers.idle?.();
    });
    expect(result.current.isLoadingBounds).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    rerender({ requestKey: "busan-page-0" });

    expect(result.current.isLoadingBounds).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(listenerRemovals.idle).not.toHaveBeenCalled();
    expect(listenerRemovals.dragstart).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(3000));
    expect(onBoundsChange).not.toHaveBeenCalled();
  });

  it("replaces a pending bounds report when a second drag starts", () => {
    vi.useFakeTimers();
    const { handlers, map, setBounds } = createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const onUserDragStart = vi.fn();
    const isInitialIdleRef = ref(true);
    const mapInstanceRef = ref(map);
    const firstDraggedBounds = { ...initialBounds, north: 38.5 };
    const secondDraggedBounds = {
      north: 35.35,
      south: 35.05,
      east: 129.25,
      west: 128.85,
    };

    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
        onUserDragStart,
        requestKey: "busan-page-0",
      }),
    );

    act(() => handlers.idle?.());
    setBounds(firstDraggedBounds);
    act(() => {
      handlers.dragstart?.();
      handlers.idle?.();
    });
    expect(result.current.isLoadingBounds).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(1500));
    act(() => handlers.dragstart?.());
    expect(result.current.isLoadingBounds).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    setBounds(secondDraggedBounds);
    act(() => handlers.idle?.());
    expect(result.current.isLoadingBounds).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(3000));

    expect(onUserDragStart).toHaveBeenCalledTimes(2);
    expect(onBoundsChange).toHaveBeenCalledExactlyOnceWith(secondDraggedBounds);
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("preserves pending bounds when the replacing drag does not move farther", () => {
    vi.useFakeTimers();
    const { handlers, map, setBounds } = createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const isInitialIdleRef = ref(true);
    const mapInstanceRef = ref(map);
    const draggedBounds = { ...initialBounds, north: 38.5 };

    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
        requestKey: "seoul-page-0",
      }),
    );

    act(() => handlers.idle?.());
    setBounds(draggedBounds);
    act(() => {
      handlers.dragstart?.();
      handlers.idle?.();
    });
    expect(result.current.isLoadingBounds).toBe(true);

    act(() => vi.advanceTimersByTime(1500));
    act(() => {
      handlers.dragstart?.();
      handlers.idle?.();
    });

    expect(result.current.isLoadingBounds).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(3000));

    expect(onBoundsChange).toHaveBeenCalledExactlyOnceWith(draggedBounds);
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("does not report programmatic idle events", () => {
    vi.useFakeTimers();
    const { handlers, map, setBounds } = createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const onUserDragCancel = vi.fn();
    const isInitialIdleRef = ref(true);
    const mapInstanceRef = ref(map);

    const { result } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
        onUserDragCancel,
      }),
    );

    act(() => handlers.idle?.());
    setBounds({ ...initialBounds, north: 42 });
    act(() => handlers.idle?.());
    act(() => vi.advanceTimersByTime(3000));

    expect(onBoundsChange).not.toHaveBeenCalled();
    expect(onUserDragCancel).not.toHaveBeenCalled();
    expect(result.current.isLoadingBounds).toBe(false);
  });

  it("removes map listeners and cancels pending work on unmount", () => {
    vi.useFakeTimers();
    const { handlers, listenerRemovals, map, setBounds } =
      createMapHarness(initialBounds);
    const onBoundsChange = vi.fn();
    const onUserDragCancel = vi.fn();
    const draggedBounds = { ...initialBounds, north: 38.5 };
    const isInitialIdleRef = ref(false);
    const mapInstanceRef = ref(map);

    const { unmount } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        isMapLoaded: true,
        mapInstanceRef,
        onBoundsChange,
        onUserDragCancel,
      }),
    );

    setBounds(draggedBounds);
    act(() => {
      handlers.dragstart?.();
      handlers.idle?.();
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(listenerRemovals.idle).toHaveBeenCalledOnce();
    expect(listenerRemovals.dragstart).toHaveBeenCalledOnce();
    expect(onUserDragCancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.runAllTimers());
    expect(onBoundsChange).not.toHaveBeenCalled();
  });
});
