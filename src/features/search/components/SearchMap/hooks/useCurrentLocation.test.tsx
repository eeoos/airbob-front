import { act, renderHook } from "@testing-library/react";
import { useCurrentLocation } from "./useCurrentLocation";

const position = {
  coords: { latitude: 35.17, longitude: 129.07 },
} as GeolocationPosition;

describe("useCurrentLocation", () => {
  let succeed: PositionCallback;
  let fail: PositionErrorCallback | null | undefined;
  let getCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    getCurrentPosition = vi.fn(
      (success: PositionCallback, error?: PositionErrorCallback | null) => {
        succeed = success;
        fail = error;
      },
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("requests a single position only on demand and ignores duplicate clicks and callbacks", () => {
    const onLocation = vi.fn();
    const { result } = renderHook(() => useCurrentLocation({ onLocation }));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    act(() => {
      result.current.requestLocation();
      result.current.requestLocation();
    });
    expect(getCurrentPosition).toHaveBeenCalledExactlyOnceWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
    expect(result.current.isLocating).toBe(true);
    act(() => {
      succeed(position);
      succeed(position);
    });
    expect(onLocation).toHaveBeenCalledExactlyOnceWith({
      lat: 35.17,
      lng: 129.07,
    });
    expect(result.current.isLocating).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([1, 2, 3])(
    "keeps the map unchanged on location error %s and allows retry",
    (code) => {
      const onLocation = vi.fn();
      const { result } = renderHook(() => useCurrentLocation({ onLocation }));
      act(() => result.current.requestLocation());
      act(() => fail?.({ code } as GeolocationPositionError));
      expect(onLocation).not.toHaveBeenCalled();
      expect(result.current.isLocating).toBe(false);
      expect(result.current.error).toContain(
        code === 1 ? "위치 권한" : "위치를 확인하지 못했습니다",
      );
      act(() => result.current.requestLocation());
      expect(getCurrentPosition).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBeNull();
    },
  );

  it("expires an unanswered permission request and ignores its late answer", () => {
    const onLocation = vi.fn();
    const { result } = renderHook(() => useCurrentLocation({ onLocation }));
    act(() => result.current.requestLocation());
    act(() => vi.advanceTimersByTime(15000));
    expect(result.current.isLocating).toBe(false);
    expect(result.current.error).not.toBeNull();
    act(() => succeed(position));
    expect(onLocation).not.toHaveBeenCalled();
  });

  it("discards a response after the destination, dates, guests, or page changes", () => {
    const onLocation = vi.fn();
    const { result, rerender } = renderHook(
      ({ requestKey }) => useCurrentLocation({ requestKey, onLocation }),
      { initialProps: { requestKey: "seoul-page-1" } },
    );
    act(() => result.current.requestLocation());
    const staleSuccess = succeed;
    rerender({ requestKey: "busan-page-0" });
    act(() => result.current.requestLocation());
    act(() => staleSuccess(position));
    expect(onLocation).not.toHaveBeenCalled();
    expect(result.current.isLocating).toBe(true);
    act(() => succeed(position));
    expect(onLocation).toHaveBeenCalledOnce();
  });

  it("discards a response after map interaction or unmount", () => {
    const onLocation = vi.fn();
    const { result, unmount } = renderHook(() =>
      useCurrentLocation({ onLocation }),
    );
    act(() => result.current.requestLocation());
    act(() => result.current.cancel());
    act(() => succeed(position));
    expect(onLocation).not.toHaveBeenCalled();
    act(() => result.current.requestLocation());
    unmount();
    act(() => succeed(position));
    expect(onLocation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles unsupported browsers and invalid coordinates without moving the map", () => {
    const onLocation = vi.fn();
    vi.stubGlobal("navigator", {});
    const { result } = renderHook(() => useCurrentLocation({ onLocation }));
    act(() => result.current.requestLocation());
    expect(result.current.error).toContain("이 브라우저");
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    act(() => result.current.requestLocation());
    act(() =>
      succeed({
        coords: { latitude: NaN, longitude: 129 },
      } as GeolocationPosition),
    );
    expect(result.current.error).toContain("위치를 확인하지 못했습니다");
    expect(onLocation).not.toHaveBeenCalled();
  });
});
