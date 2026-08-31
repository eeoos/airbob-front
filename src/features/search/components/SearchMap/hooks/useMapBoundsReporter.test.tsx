import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import type { SearchMapBounds } from "../types";
import { useMapBoundsReporter } from "./useMapBoundsReporter";

const ref = <T,>(current: T): MutableRefObject<T> => ({ current });

const createGoogleBounds = (bounds: SearchMapBounds) => ({
  getNorthEast: () => ({ lat: () => bounds.north, lng: () => bounds.east }),
  getSouthWest: () => ({ lat: () => bounds.south, lng: () => bounds.west }),
});

describe("useMapBoundsReporter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records the initial bounds and reports only a debounced meaningful change", () => {
    vi.useFakeTimers();
    let currentBounds: SearchMapBounds = {
      north: 38,
      south: 37,
      east: 128,
      west: 126,
    };
    let handleIdle: (() => void) | null = null;
    const remove = vi.fn();
    const map = {
      addListener: vi.fn((_eventName: string, listener: () => void) => {
        handleIdle = listener;
        return { remove };
      }),
      getBounds: vi.fn(() => createGoogleBounds(currentBounds)),
    } as unknown as google.maps.Map;
    const onBoundsChange = vi.fn();
    const isInitialIdleRef = ref(true);
    const mapInstanceRef = ref(map);

    const { result, unmount } = renderHook(() =>
      useMapBoundsReporter({
        isInitialIdleRef,
        mapInstanceRef,
        onBoundsChange,
      }),
    );

    act(() => handleIdle?.());
    expect(result.current).toBe(false);
    expect(onBoundsChange).not.toHaveBeenCalled();

    currentBounds = { ...currentBounds, north: 38.0005 };
    act(() => handleIdle?.());
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
    expect(onBoundsChange).not.toHaveBeenCalled();

    currentBounds = { ...currentBounds, north: 38.01 };
    act(() => {
      handleIdle?.();
      vi.advanceTimersByTime(3000);
    });

    expect(onBoundsChange).toHaveBeenCalledWith(currentBounds);
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
