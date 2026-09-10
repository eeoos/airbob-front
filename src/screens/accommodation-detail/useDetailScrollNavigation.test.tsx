import { act, renderHook } from "@testing-library/react";
import { useDetailScrollNavigation } from "./useDetailScrollNavigation";

describe("detail scroll navigation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reveals navigation after the photos, and the summary only after the reservation action passes the bar", () => {
    let frame: FrameRequestCallback | undefined;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    let heroBottom = 500;
    let actionBottom = 1000;
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useDetailScrollNavigation(enabled),
      { initialProps: { enabled: false } },
    );
    result.current.heroRef.current = {
      getBoundingClientRect: () => ({ bottom: heroBottom }),
    } as HTMLDivElement;
    result.current.reserveActionRef.current = {
      getBoundingClientRect: () => ({ bottom: actionBottom }),
    } as HTMLButtonElement;
    result.current.navigationRef.current = {
      offsetHeight: 80,
    } as HTMLDivElement;
    rerender({ enabled: true });
    expect(result.current.visible).toBe(false);
    expect(result.current.showReservation).toBe(false);
    const scroll = () =>
      act(() => {
        window.dispatchEvent(new Event("scroll"));
        frame?.(0);
      });

    heroBottom = -1;
    scroll();
    expect(result.current.visible).toBe(true);
    expect(result.current.showReservation).toBe(false);
    actionBottom = 79;
    scroll();
    expect(result.current.showReservation).toBe(true);
    actionBottom = 250;
    scroll();
    expect(result.current.showReservation).toBe(false);
    heroBottom = 10;
    scroll();
    expect(result.current.visible).toBe(false);

    window.dispatchEvent(new Event("scroll"));
    unmount();
    expect(cancelFrame).toHaveBeenCalledWith(1);
    requestFrame.mockClear();
    window.dispatchEvent(new Event("scroll"));
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
