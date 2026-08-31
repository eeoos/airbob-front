import { act, renderHook } from "@testing-library/react";
import { useResponsiveLayout } from "./useResponsiveLayout";

type Listener = (event: MediaQueryListEvent) => void;

describe("useResponsiveLayout", () => {
  let width = 1025;
  const listeners = new Set<Listener>();

  beforeEach(() => {
    width = 1025;
    listeners.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string): MediaQueryList => ({
        matches: width <= 1024,
        media: query,
        onchange: null,
        addEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ) =>
          listeners.add(listener as Listener),
        removeEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ) =>
          listeners.delete(listener as Listener),
        addListener: (listener) => listener && listeners.add(listener),
        removeListener: (listener) => listener && listeners.delete(listener),
        dispatchEvent: () => true,
      })),
    });
  });

  it.each([
    [1023, "mobile-tablet"],
    [1024, "mobile-tablet"],
    [1025, "desktop"],
  ] as const)("returns the %s initial layout synchronously", (nextWidth, layout) => {
    width = nextWidth;

    const { result } = renderHook(() => useResponsiveLayout());

    expect(result.current).toBe(layout);
  });

  it("updates from the same media-query subscription on resize", () => {
    const { result } = renderHook(() => useResponsiveLayout());

    expect(result.current).toBe("desktop");

    act(() => {
      width = 1024;
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent),
      );
    });

    expect(result.current).toBe("mobile-tablet");
  });
});
