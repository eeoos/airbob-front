import { act, renderHook } from "@testing-library/react";
import { PanInfo } from "framer-motion";
import { useSearchBottomSheet } from "./useSearchBottomSheet";

const resizeWindow = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

const panInfo = (offsetY: number, velocityY = 0): PanInfo =>
  ({
    offset: { x: 0, y: offsetY },
    velocity: { x: 0, y: velocityY },
  } as PanInfo);

describe("useSearchBottomSheet", () => {
  beforeEach(() => {
    resizeWindow(390);
  });

  it("detects mobile/tablet viewport and starts in half state", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(result.current.isMobileOrTablet).toBe(true);
    expect(result.current.bottomSheetState).toBe("half");
  });

  it("collapses on map interaction and expands when bottom sheet content scrolls", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    act(() => {
      result.current.handleMapInteraction();
    });

    expect(result.current.bottomSheetState).toBe("collapsed");

    act(() => {
      result.current.handleBottomSheetScroll({
        currentTarget: { scrollTop: 30 },
      } as React.UIEvent<HTMLDivElement>);
    });

    expect(result.current.bottomSheetState).toBe("expanded");
  });

  it("moves one snap state per drag direction", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    act(() => {
      result.current.handleDragStart();
      result.current.handleDragEnd({} as PointerEvent, panInfo(-80));
    });

    expect(result.current.bottomSheetState).toBe("expanded");

    act(() => {
      result.current.handleDragStart();
      result.current.handleDragEnd({} as PointerEvent, panInfo(80));
    });

    expect(result.current.bottomSheetState).toBe("half");
  });

  it("does not run mobile drag transitions on desktop", () => {
    resizeWindow(1280);
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(result.current.isMobileOrTablet).toBe(false);

    act(() => {
      result.current.handleDragStart();
      result.current.handleDragEnd({} as PointerEvent, panInfo(-80));
    });

    expect(result.current.bottomSheetState).toBe("half");
  });
});
