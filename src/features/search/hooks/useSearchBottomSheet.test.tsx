import { act, renderHook } from "@testing-library/react";
import { PanInfo } from "framer-motion";
import { useSearchBottomSheet } from "./useSearchBottomSheet";

type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

const mediaQueryLists = new Set<{
  readonly media: string;
  matches: boolean;
  readonly listeners: Set<MediaQueryChangeListener>;
}>();

const matchesMediaQuery = (query: string, width: number) => {
  const maxWidth = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (maxWidth) return width <= Number(maxWidth[1]);

  const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (minWidth) return width >= Number(minWidth[1]);

  return false;
};

const installMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn((query: string): MediaQueryList => {
      const record = {
        media: query,
        matches: matchesMediaQuery(query, window.innerWidth),
        listeners: new Set<MediaQueryChangeListener>(),
      };
      mediaQueryLists.add(record);

      return {
        get matches() {
          return record.matches;
        },
        media: query,
        onchange: null,
        addEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          record.listeners.add(listener as MediaQueryChangeListener);
        },
        removeEventListener: (
          _type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          record.listeners.delete(listener as MediaQueryChangeListener);
        },
        addListener: (listener: MediaQueryChangeListener | null) => {
          if (listener) record.listeners.add(listener);
        },
        removeListener: (listener: MediaQueryChangeListener | null) => {
          if (listener) record.listeners.delete(listener);
        },
        dispatchEvent: () => true,
      } as MediaQueryList;
    }),
  });
};

const resizeWindow = (width: number, height = 844) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });

  mediaQueryLists.forEach((record) => {
    const matches = matchesMediaQuery(record.media, width);
    if (matches === record.matches) return;

    record.matches = matches;
    record.listeners.forEach((listener) =>
      listener({ matches, media: record.media } as MediaQueryListEvent),
    );
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
    mediaQueryLists.clear();
    installMatchMedia();
    resizeWindow(390);
  });

  it("detects mobile/tablet viewport and starts in half state", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(result.current.isMobileOrTablet).toBe(true);
    expect(result.current.bottomSheetState).toBe("half");
  });

  it.each([
    [1023, true],
    [1024, true],
    [1024.5, false],
    [1025, false],
  ])(
    "matches the CSS mobile/tablet boundary at %spx",
    (width, expectedIsMobileOrTablet) => {
      resizeWindow(width);

      const { result } = renderHook(() => useSearchBottomSheet());

      expect(result.current.isMobileOrTablet).toBe(
        expectedIsMobileOrTablet,
      );
      expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 1024px)");
    },
  );

  it("updates the layout when the media query crosses the boundary", () => {
    resizeWindow(1025);
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(result.current.isMobileOrTablet).toBe(false);

    act(() => resizeWindow(1024));
    expect(result.current.isMobileOrTablet).toBe(true);

    act(() => resizeWindow(1025));
    expect(result.current.isMobileOrTablet).toBe(false);
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

  it("computes distinct mobile snap positions from the viewport", () => {
    resizeWindow(390, 844);
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(result.current.snapPositions.collapsed).toBe(0);
    expect(result.current.snapPositions.half).toBeGreaterThan(
      result.current.snapPositions.collapsed
    );
    expect(result.current.snapPositions.expanded).toBeGreaterThan(
      result.current.snapPositions.half
    );
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
