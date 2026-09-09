import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  animate,
  useDragControls,
  useMotionValue,
  type PanInfo,
} from "framer-motion";
import { useResponsiveLayout } from "../../../shared/styles/useResponsiveLayout";
import { useSearchBottomSheetContentGestures } from "./useSearchBottomSheetContentGestures";
import {
  createSearchInteractionState,
  getNextSearchBottomSheetState,
  searchInteractionReducer,
  type SearchBottomSheetState,
} from "../model/searchInteractionReducer";

export type BottomSheetState = SearchBottomSheetState;

const getViewportHeight = () =>
  typeof window === "undefined" ? 0 : window.innerHeight;

const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
const SEARCH_HEADER_HEIGHT_TOKEN = "--layout-search-header-mobile-height";
const SEARCH_HEADER_DIVIDER_TOKEN = "--layout-search-header-divider-height";
const BOTTOM_SHEET_PEEK_HEIGHT_TOKEN =
  "--layout-search-bottom-sheet-peek-height";

interface BottomSheetGeometry {
  readonly peekHeight: number;
  readonly surfaceHeight: number;
}

interface SnapAnimationControls {
  stop(): void;
  then(onResolve: () => void): Promise<void>;
}

const readRootPixelToken = (tokenName: string): number => {
  if (typeof window === "undefined") return 0;

  const value = Number.parseFloat(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(tokenName),
  );
  return Number.isFinite(value) ? value : 0;
};

const getFallbackBottomSheetGeometry = (
  viewportHeight: number,
): BottomSheetGeometry => ({
  peekHeight: readRootPixelToken(BOTTOM_SHEET_PEEK_HEIGHT_TOKEN),
  surfaceHeight: Math.max(
    0,
    viewportHeight -
      readRootPixelToken(SEARCH_HEADER_HEIGHT_TOKEN) -
      readRootPixelToken(SEARCH_HEADER_DIVIDER_TOKEN),
  ),
});

const canMatchReducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

const subscribeToReducedMotion = (onChange: () => void) => {
  if (!canMatchReducedMotion()) {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);
  const handleChange = () => onChange();

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
};

const getReducedMotionSnapshot = () =>
  canMatchReducedMotion() &&
  window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;

export const useSearchBottomSheet = () => {
  const [interactionState, dispatch] = useReducer(
    searchInteractionReducer,
    undefined,
    () => ({ ...createSearchInteractionState(), bottomSheet: "half" as const }),
  );
  const bottomSheetState = interactionState.bottomSheet;
  const isMobileOrTablet = useResponsiveLayout() === "mobile-tablet";
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);
  const [geometry, setGeometry] = useState<BottomSheetGeometry>(() =>
    getFallbackBottomSheetGeometry(getViewportHeight()),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const bottomSheetRef = useRef<HTMLElement | null>(null);
  const bottomSheetHeaderRef = useRef<HTMLDivElement | null>(null);
  const bottomSheetHandleRef = useRef<HTMLButtonElement | null>(null);
  const bottomSheetContentRef = useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();
  const snapPositions = useMemo(() => {
    if (!isMobileOrTablet) {
      return { collapsed: 0, half: 0, expanded: 0 };
    }

    const { peekHeight, surfaceHeight } = geometry;
    const expanded = 0;
    const collapsed = Math.max(0, surfaceHeight - peekHeight);
    const half = Math.min(collapsed, Math.round(surfaceHeight * 0.3));

    return {
      collapsed,
      half,
      expanded,
    };
  }, [geometry, isMobileOrTablet]);
  const y = useMotionValue(
    isMobileOrTablet ? snapPositions[bottomSheetState] : 0,
  );
  const activeSnapAnimationRef = useRef<SnapAnimationControls | null>(null);
  const translateY = y;
  const dragStartStateRef = useRef<BottomSheetState>(bottomSheetState);
  const dragStartYRef = useRef(0);
  const dragPreparedOnPointerDownRef = useRef(false);
  const dragSessionStartedRef = useRef(false);
  const draggedFromHandleRef = useRef(false);
  const suppressHandleClickRef = useRef(false);
  const handleClickSuppressionTimeoutRef = useRef<number | null>(null);
  const pendingHandleFocusRef = useRef(false);

  const setYPosition = useCallback((position: number) => y.set(position), [y]);

  const stopActiveSnapAnimation = useCallback(() => {
    activeSnapAnimationRef.current?.stop();
    activeSnapAnimationRef.current = null;
  }, []);

  const animateToPosition = useCallback(
    (targetPosition: number) => {
      stopActiveSnapAnimation();

      if (prefersReducedMotion) {
        setIsAnimating(false);
        setYPosition(targetPosition);
        return;
      }

      setIsAnimating(true);
      const animation = animate(y, targetPosition, {
        type: "spring",
        stiffness: 280,
        damping: 32,
        mass: 0.9,
      });
      activeSnapAnimationRef.current = animation;
      void animation.then(() => {
        if (activeSnapAnimationRef.current !== animation) return;

        activeSnapAnimationRef.current = null;
        setIsAnimating(false);
      });
    },
    [prefersReducedMotion, setYPosition, stopActiveSnapAnimation, y],
  );

  const rememberFocusedContent = useCallback(() => {
    if (typeof document === "undefined") return;

    const sheet = bottomSheetRef.current;
    const handle = bottomSheetHandleRef.current;
    const activeElement = document.activeElement;

    pendingHandleFocusRef.current = Boolean(
      sheet &&
      handle &&
      activeElement instanceof HTMLElement &&
      activeElement !== handle &&
      sheet.contains(activeElement),
    );
  }, []);

  const setBottomSheetState = useCallback(
    (state: BottomSheetState) => {
      if (state === bottomSheetState) return;
      if (state === "collapsed") rememberFocusedContent();
      if (!prefersReducedMotion) setIsAnimating(true);

      dispatch({ type: "bottomSheetSet", state });
    },
    [bottomSheetState, prefersReducedMotion, rememberFocusedContent],
  );

  const clearHandleClickSuppression = useCallback(() => {
    suppressHandleClickRef.current = false;

    if (handleClickSuppressionTimeoutRef.current !== null) {
      window.clearTimeout(handleClickSuppressionTimeoutRef.current);
      handleClickSuppressionTimeoutRef.current = null;
    }
  }, []);

  const scheduleHandleClickSuppressionClear = useCallback(() => {
    if (!suppressHandleClickRef.current) return;

    if (handleClickSuppressionTimeoutRef.current !== null) {
      window.clearTimeout(handleClickSuppressionTimeoutRef.current);
    }
    handleClickSuppressionTimeoutRef.current = window.setTimeout(
      clearHandleClickSuppression,
      0,
    );
  }, [clearHandleClickSuppression]);

  const captureDragStart = useCallback(
    (event?: MouseEvent | TouchEvent | PointerEvent) => {
      const handle = bottomSheetHandleRef.current;
      draggedFromHandleRef.current = Boolean(
        handle &&
        event?.target instanceof Node &&
        handle.contains(event.target),
      );
      dragStartStateRef.current = bottomSheetState;
      dragStartYRef.current = y.get();
    },
    [bottomSheetState, y],
  );

  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!isMobileOrTablet) {
        return;
      }

      const dragThreshold = 50;
      const velocityThreshold = 500;
      const dragDistance = Math.abs(info.offset.y);
      const velocity = Math.abs(info.velocity.y);
      const shouldSnap =
        dragDistance > dragThreshold || velocity > velocityThreshold;
      const dragDirection =
        dragDistance > dragThreshold ? info.offset.y : info.velocity.y;
      const isDraggingUp = dragDirection < 0;

      scheduleHandleClickSuppressionClear();
      dragPreparedOnPointerDownRef.current = false;
      dragSessionStartedRef.current = false;
      draggedFromHandleRef.current = false;
      setIsDragging(false);

      if (shouldSnap) {
        const nextState = getNextSearchBottomSheetState(
          dragStartStateRef.current,
          isDraggingUp ? "up" : "down",
        );
        if (nextState === dragStartStateRef.current) {
          animateToPosition(snapPositions[nextState]);
        } else {
          setBottomSheetState(nextState);
        }
      } else {
        animateToPosition(snapPositions[dragStartStateRef.current]);
      }
    },
    [
      isMobileOrTablet,
      animateToPosition,
      setBottomSheetState,
      snapPositions,
      scheduleHandleClickSuppressionClear,
    ],
  );

  const handleDragStart = useCallback(
    (event?: MouseEvent | TouchEvent | PointerEvent) => {
      if (!isMobileOrTablet) {
        return;
      }

      stopActiveSnapAnimation();
      setIsAnimating(false);
      setIsDragging(true);
      dragSessionStartedRef.current = true;

      if (dragPreparedOnPointerDownRef.current) return;

      captureDragStart(event);
    },
    [captureDragStart, isMobileOrTablet, stopActiveSnapAnimation],
  );

  const handleDrag = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!isMobileOrTablet) {
        return;
      }

      if (draggedFromHandleRef.current && Math.abs(info.offset.y) > 4) {
        suppressHandleClickRef.current = true;
      }

      let nextY = dragStartYRef.current + info.offset.y;
      const lowestPosition =
        dragStartStateRef.current === "collapsed"
          ? snapPositions.collapsed
          : Math.max(snapPositions.half, dragStartYRef.current);
      nextY = Math.max(snapPositions.expanded, Math.min(lowestPosition, nextY));
      setYPosition(nextY);
    },
    [isMobileOrTablet, setYPosition, snapPositions],
  );

  const handleMapInteraction = useCallback(() => {
    setBottomSheetState("collapsed");
  }, [setBottomSheetState]);

  const handleMapReturn = useCallback(() => {
    if (bottomSheetContentRef.current)
      bottomSheetContentRef.current.scrollTop = 0;
    setBottomSheetState("collapsed");
  }, [setBottomSheetState]);

  useSearchBottomSheetContentGestures({
    contentRef: bottomSheetContentRef,
    enabled: isMobileOrTablet,
    state: bottomSheetState,
    positions: snapPositions,
    y,
    stopAnimation: stopActiveSnapAnimation,
    animateToPosition,
    setState: setBottomSheetState,
    setDragging: setIsDragging,
  });

  const handleBottomSheetPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isMobileOrTablet || event.button !== 0) return;

      stopActiveSnapAnimation();
      setIsAnimating(false);
      setIsDragging(true);
      clearHandleClickSuppression();
      captureDragStart(event.nativeEvent);
      dragPreparedOnPointerDownRef.current = true;
      dragSessionStartedRef.current = false;
      dragControls.start(event);
    },
    [
      captureDragStart,
      clearHandleClickSuppression,
      dragControls,
      isMobileOrTablet,
      stopActiveSnapAnimation,
    ],
  );

  const handleBottomSheetPointerEnd = useCallback(() => {
    if (
      !dragPreparedOnPointerDownRef.current ||
      dragSessionStartedRef.current
    ) {
      return;
    }

    dragPreparedOnPointerDownRef.current = false;
    setIsDragging(false);
    animateToPosition(snapPositions[bottomSheetState]);
  }, [animateToPosition, bottomSheetState, snapPositions]);

  const handleBottomSheetKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          setBottomSheetState(
            getNextSearchBottomSheetState(bottomSheetState, "up"),
          );
          break;
        case "ArrowDown":
          event.preventDefault();
          setBottomSheetState(
            getNextSearchBottomSheetState(bottomSheetState, "down"),
          );
          break;
        case "Home":
          event.preventDefault();
          setBottomSheetState("collapsed");
          break;
        case "End":
          event.preventDefault();
          setBottomSheetState("expanded");
          break;
        default:
          break;
      }
    },
    [bottomSheetState, setBottomSheetState],
  );

  const handleBottomSheetToggle = useCallback(() => {
    setIsDragging(false);

    if (suppressHandleClickRef.current) {
      clearHandleClickSuppression();
      return;
    }

    if (bottomSheetState === "expanded") {
      setBottomSheetState("collapsed");
      return;
    }

    setBottomSheetState(getNextSearchBottomSheetState(bottomSheetState, "up"));
  }, [bottomSheetState, clearHandleClickSuppression, setBottomSheetState]);

  useLayoutEffect(() => {
    if (bottomSheetState !== "expanded" && bottomSheetContentRef.current) {
      bottomSheetContentRef.current.scrollTop = 0;
    }
    if (bottomSheetState !== "collapsed") return;

    const sheet = bottomSheetRef.current;
    const handle = bottomSheetHandleRef.current;
    const activeElement = document.activeElement;
    const hasFocusedContent =
      sheet &&
      activeElement instanceof HTMLElement &&
      activeElement !== handle &&
      sheet.contains(activeElement);

    if (handle && (pendingHandleFocusRef.current || hasFocusedContent)) {
      handle.focus();
    }

    pendingHandleFocusRef.current = false;
  }, [bottomSheetState]);

  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(getViewportHeight());
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  const measureBottomSheetGeometry = useCallback(() => {
    const fallback = getFallbackBottomSheetGeometry(viewportHeight);
    const measuredSurfaceHeight =
      bottomSheetRef.current?.getBoundingClientRect().height ?? 0;
    const measuredPeekHeight =
      bottomSheetHeaderRef.current?.getBoundingClientRect().height ?? 0;
    const nextGeometry = {
      surfaceHeight:
        measuredSurfaceHeight > 0
          ? measuredSurfaceHeight
          : fallback.surfaceHeight,
      peekHeight:
        measuredPeekHeight > 0 ? measuredPeekHeight : fallback.peekHeight,
    };

    setGeometry((currentGeometry) =>
      currentGeometry.surfaceHeight === nextGeometry.surfaceHeight &&
      currentGeometry.peekHeight === nextGeometry.peekHeight
        ? currentGeometry
        : nextGeometry,
    );
  }, [viewportHeight]);

  useLayoutEffect(() => {
    if (!isMobileOrTablet) return;

    measureBottomSheetGeometry();

    if (typeof ResizeObserver !== "function") return;

    const observer = new ResizeObserver(measureBottomSheetGeometry);
    if (bottomSheetRef.current) observer.observe(bottomSheetRef.current);
    if (bottomSheetHeaderRef.current) {
      observer.observe(bottomSheetHeaderRef.current);
    }

    return () => observer.disconnect();
  }, [isMobileOrTablet, measureBottomSheetGeometry]);

  useEffect(
    () => () => {
      clearHandleClickSuppression();
    },
    [clearHandleClickSuppression],
  );

  useEffect(() => {
    if (!isMobileOrTablet) {
      stopActiveSnapAnimation();
      setIsDragging(false);
      setIsAnimating(false);
      setYPosition(0);
      return;
    }

    animateToPosition(snapPositions[bottomSheetState]);

    return stopActiveSnapAnimation;
  }, [
    animateToPosition,
    bottomSheetState,
    isMobileOrTablet,
    setYPosition,
    snapPositions,
    stopActiveSnapAnimation,
  ]);

  return {
    bottomSheetState,
    isDragging: isDragging || isAnimating,
    setBottomSheetState,
    isMobileOrTablet,
    bottomSheetRef,
    bottomSheetHeaderRef,
    bottomSheetHandleRef,
    bottomSheetContentRef,
    dragControls,
    snapPositions,
    visibleSheetHeight: Math.max(
      0,
      geometry.surfaceHeight - snapPositions[bottomSheetState],
    ),
    translateY,
    handleBottomSheetKeyDown,
    handleBottomSheetToggle,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    handleMapInteraction,
    handleMapReturn,
    handleBottomSheetPointerDown,
    handleBottomSheetPointerEnd,
  };
};
