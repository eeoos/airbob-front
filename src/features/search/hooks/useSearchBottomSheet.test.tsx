import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { animate, type PanInfo } from "framer-motion";
import { useSearchBottomSheet } from "./useSearchBottomSheet";

const dragControlsStart = vi.hoisted(() => vi.fn());

vi.mock("framer-motion", async () => {
  const actual =
    await vi.importActual<typeof import("framer-motion")>("framer-motion");

  return {
    ...actual,
    animate: vi.fn(() => ({ stop: vi.fn() })),
    useDragControls: () => ({ start: dragControlsStart }),
  };
});

const mockAnimate = vi.mocked(animate);

type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

const mediaQueryLists = new Set<{
  readonly media: string;
  matches: boolean;
  readonly listeners: Set<MediaQueryChangeListener>;
}>();
let prefersReducedMotion = false;

const matchesMediaQuery = (query: string, width: number) => {
  if (query === "(prefers-reduced-motion: reduce)") {
    return prefersReducedMotion;
  }

  const maxWidth = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (maxWidth) return width <= Number(maxWidth[1]);

  const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (minWidth) return width >= Number(minWidth[1]);

  return false;
};

const installMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string): MediaQueryList => {
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
  }) as PanInfo;

const rectWithHeight = (height: number): DOMRect =>
  ({
    bottom: height,
    height,
    left: 0,
    right: 390,
    top: 0,
    width: 390,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect;

const BottomSheetFocusHarness = () => {
  const bottomSheet = useSearchBottomSheet();

  return (
    <>
      <button
        type="button"
        onClick={() => bottomSheet.setBottomSheetState("half")}
      >
        패널 열기
      </button>
      <section ref={bottomSheet.bottomSheetRef}>
        <button ref={bottomSheet.bottomSheetHandleRef} type="button">
          패널 조절
        </button>
        <div hidden={bottomSheet.bottomSheetState === "collapsed"}>
          <button
            type="button"
            onClick={(event) => {
              bottomSheet.handleMapInteraction();
              event.currentTarget.blur();
            }}
          >
            패널 접기
          </button>
        </div>
      </section>
    </>
  );
};

describe("useSearchBottomSheet", () => {
  beforeEach(() => {
    mediaQueryLists.clear();
    prefersReducedMotion = false;
    dragControlsStart.mockClear();
    mockAnimate.mockClear();
    mockAnimate.mockReturnValue({
      stop: vi.fn(),
      then: vi.fn((onResolve: () => void) => {
        onResolve();
        return Promise.resolve();
      }),
    } as unknown as ReturnType<typeof animate>);
    installMatchMedia();
    document.documentElement.style.setProperty(
      "--layout-search-header-mobile-height",
      "80px",
    );
    document.documentElement.style.setProperty(
      "--layout-search-header-divider-height",
      "1px",
    );
    document.documentElement.style.setProperty(
      "--layout-search-bottom-sheet-peek-height",
      "72px",
    );
    resizeWindow(390);
  });

  it("detects mobile/tablet viewport and starts in collapsed state", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(result.current.isMobileOrTablet).toBe(true);
    expect(result.current.bottomSheetState).toBe("collapsed");
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

      expect(result.current.isMobileOrTablet).toBe(expectedIsMobileOrTablet);
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

  it("collapses on map interaction without coupling list scroll to sheet state", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    act(() => result.current.setBottomSheetState("expanded"));

    act(() => {
      result.current.handleMapInteraction();
    });

    expect(result.current.bottomSheetState).toBe("collapsed");
  });

  it("moves one snap state per drag direction", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    act(() => {
      result.current.handleDragStart();
      result.current.handleDragEnd({} as PointerEvent, panInfo(-80));
    });

    expect(result.current.bottomSheetState).toBe("half");

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

  it("uses velocity direction for a flick that stays below the distance threshold", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    act(() => {
      result.current.handleDragStart();
      result.current.handleDragEnd({} as PointerEvent, panInfo(0, -700));
    });

    expect(result.current.bottomSheetState).toBe("half");

    act(() => {
      result.current.handleDragStart();
      result.current.handleDragEnd({} as PointerEvent, panInfo(0, 700));
    });

    expect(result.current.bottomSheetState).toBe("collapsed");
  });

  it("moves with the pointer while clamping drag translation to the snap range", () => {
    prefersReducedMotion = true;
    const { result } = renderHook(() => useSearchBottomSheet());

    act(() => {
      result.current.handleDragStart();
      result.current.handleDrag({} as PointerEvent, panInfo(-10_000));
    });
    expect(result.current.translateY.get()).toBe(
      result.current.snapPositions.expanded,
    );

    act(() => {
      result.current.handleDrag({} as PointerEvent, panInfo(10_000));
    });
    expect(result.current.translateY.get()).toBe(
      result.current.snapPositions.collapsed,
    );
  });

  it("captures the current snap synchronously before the first drag frame", () => {
    prefersReducedMotion = true;
    const { result } = renderHook(() => useSearchBottomSheet());
    const handle = document.createElement("button");

    act(() => {
      result.current.bottomSheetHandleRef.current = handle;
      result.current.handleBottomSheetPointerDown({
        button: 0,
        nativeEvent: { target: handle },
      } as unknown as React.PointerEvent<HTMLDivElement>);
      result.current.handleDrag({} as PointerEvent, panInfo(-40));
      result.current.handleDragStart({
        target: handle,
      } as unknown as PointerEvent);
    });

    expect(dragControlsStart).toHaveBeenCalledTimes(1);
    expect(result.current.translateY.get()).toBe(
      result.current.snapPositions.collapsed - 40,
    );
  });

  it("anchors a new drag to the visible position of an interrupted snap", () => {
    const { result } = renderHook(() => useSearchBottomSheet());
    const handle = document.createElement("button");

    act(() => result.current.setBottomSheetState("half"));
    const interruptedPosition = Math.round(
      (result.current.snapPositions.collapsed +
        result.current.snapPositions.half) /
        2,
    );

    act(() => {
      result.current.translateY.set(interruptedPosition);
      result.current.bottomSheetHandleRef.current = handle;
      result.current.handleBottomSheetPointerDown({
        button: 0,
        nativeEvent: { target: handle },
      } as unknown as React.PointerEvent<HTMLDivElement>);
      result.current.handleDragStart({
        target: handle,
      } as unknown as PointerEvent);
      result.current.handleDrag({} as PointerEvent, panInfo(-24));
    });

    expect(result.current.translateY.get()).toBe(interruptedPosition - 24);
  });

  it("resumes the current snap after a header press without a drag", () => {
    const { result } = renderHook(() => useSearchBottomSheet());
    const handle = document.createElement("button");

    act(() => result.current.setBottomSheetState("half"));
    const interruptedPosition = Math.round(
      (result.current.snapPositions.collapsed +
        result.current.snapPositions.half) /
        2,
    );
    mockAnimate.mockClear();

    act(() => {
      result.current.translateY.set(interruptedPosition);
      result.current.bottomSheetHandleRef.current = handle;
      result.current.handleBottomSheetPointerDown({
        button: 0,
        nativeEvent: { target: document.createElement("span") },
      } as unknown as React.PointerEvent<HTMLDivElement>);
      result.current.handleBottomSheetPointerEnd();
    });

    expect(mockAnimate).toHaveBeenLastCalledWith(
      expect.anything(),
      result.current.snapPositions.half,
      expect.objectContaining({ type: "spring" }),
    );
  });

  it("suppresses the native click even when it arrives before drag end", () => {
    const { result } = renderHook(() => useSearchBottomSheet());
    const handle = document.createElement("button");

    act(() => {
      result.current.bottomSheetHandleRef.current = handle;
      result.current.handleBottomSheetPointerDown({
        button: 0,
        nativeEvent: { target: handle },
      } as unknown as React.PointerEvent<HTMLDivElement>);
      result.current.handleDrag({} as PointerEvent, panInfo(-20));
      result.current.handleBottomSheetToggle();
    });

    expect(result.current.bottomSheetState).toBe("collapsed");

    act(() => {
      result.current.handleDragEnd({} as PointerEvent, panInfo(-20));
    });

    expect(result.current.bottomSheetState).toBe("collapsed");
  });

  it("does not treat a completed handle drag as a button click", () => {
    const { result } = renderHook(() => useSearchBottomSheet());
    const handle = document.createElement("button");

    act(() => {
      result.current.bottomSheetHandleRef.current = handle;
      result.current.handleDragStart({
        target: handle,
      } as unknown as PointerEvent);
      result.current.handleDrag({} as PointerEvent, panInfo(-80));
      result.current.handleDragEnd({} as PointerEvent, panInfo(-80));
    });

    expect(result.current.bottomSheetState).toBe("half");

    act(() => result.current.handleBottomSheetToggle());
    expect(result.current.bottomSheetState).toBe("half");

    act(() => result.current.handleBottomSheetToggle());
    expect(result.current.bottomSheetState).toBe("expanded");
  });

  it("moves between all snap states with the keyboard contract", () => {
    const { result } = renderHook(() => useSearchBottomSheet());
    const press = (key: string) => {
      const preventDefault = vi.fn();

      act(() => {
        result.current.handleBottomSheetKeyDown({
          key,
          preventDefault,
        } as unknown as React.KeyboardEvent<HTMLButtonElement>);
      });

      expect(preventDefault).toHaveBeenCalledTimes(1);
    };

    press("ArrowUp");
    expect(result.current.bottomSheetState).toBe("half");

    press("ArrowUp");
    expect(result.current.bottomSheetState).toBe("expanded");

    press("ArrowDown");
    expect(result.current.bottomSheetState).toBe("half");

    press("Home");
    expect(result.current.bottomSheetState).toBe("collapsed");

    press("End");
    expect(result.current.bottomSheetState).toBe("expanded");
  });

  it("cycles the button action through half, expanded, and collapsed", () => {
    const { result } = renderHook(() => useSearchBottomSheet());

    act(() => result.current.handleBottomSheetToggle());
    expect(result.current.bottomSheetState).toBe("half");

    act(() => result.current.handleBottomSheetToggle());
    expect(result.current.bottomSheetState).toBe("expanded");

    act(() => result.current.handleBottomSheetToggle());
    expect(result.current.bottomSheetState).toBe("collapsed");

    act(() => result.current.handleBottomSheetToggle());
    expect(result.current.bottomSheetState).toBe("half");
  });

  it("returns focus to the handle when focused content is collapsed", async () => {
    render(<BottomSheetFocusHarness />);

    await userEvent.click(screen.getByRole("button", { name: "패널 열기" }));
    await userEvent.click(screen.getByRole("button", { name: "패널 접기" }));

    expect(screen.getByRole("button", { name: "패널 조절" })).toHaveFocus();
  });

  it("bypasses spring animation when reduced motion is requested", () => {
    prefersReducedMotion = true;
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(mockAnimate).not.toHaveBeenCalled();

    act(() => result.current.setBottomSheetState("expanded"));

    expect(mockAnimate).not.toHaveBeenCalled();
    expect(result.current.translateY.get()).toBe(
      result.current.snapPositions.expanded,
    );
  });

  it("keeps spring animation when reduced motion is not requested", () => {
    const { result } = renderHook(() => useSearchBottomSheet());
    mockAnimate.mockClear();

    act(() => result.current.setBottomSheetState("expanded"));

    expect(mockAnimate).toHaveBeenCalledWith(
      expect.anything(),
      result.current.snapPositions.expanded,
      expect.objectContaining({ type: "spring" }),
    );
  });

  it("computes distinct mobile snap positions from the viewport", () => {
    resizeWindow(390, 844);
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(result.current.snapPositions.expanded).toBe(0);
    expect(result.current.snapPositions.half).toBe(382);
    expect(result.current.snapPositions.collapsed).toBe(691);
    expect(result.current.snapPositions.half).toBeGreaterThan(
      result.current.snapPositions.expanded,
    );
    expect(result.current.snapPositions.collapsed).toBeGreaterThan(
      result.current.snapPositions.half,
    );
  });

  it("uses rendered sheet and peek geometry as the snap source of truth", () => {
    const { result } = renderHook(() => useSearchBottomSheet());
    const sheet = document.createElement("section");
    const header = document.createElement("div");
    sheet.getBoundingClientRect = () => rectWithHeight(700);
    header.getBoundingClientRect = () => rectWithHeight(80);

    act(() => {
      result.current.bottomSheetRef.current = sheet;
      result.current.bottomSheetHeaderRef.current = header;
      resizeWindow(390, 845);
    });

    expect(result.current.snapPositions).toEqual({
      collapsed: 620,
      half: 350,
      expanded: 0,
    });
    expect(result.current.visibleSheetHeight).toBe(80);
  });

  it("does not run mobile drag transitions on desktop", () => {
    resizeWindow(1280);
    const { result } = renderHook(() => useSearchBottomSheet());

    expect(result.current.isMobileOrTablet).toBe(false);

    act(() => {
      result.current.handleDragStart();
      result.current.handleDragEnd({} as PointerEvent, panInfo(-80));
    });

    expect(result.current.bottomSheetState).toBe("collapsed");
  });
});
