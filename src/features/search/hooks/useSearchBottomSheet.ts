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
  PanInfo,
  animate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useResponsiveLayout } from "../../../shared/styles/useResponsiveLayout";
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
    createSearchInteractionState,
  );
  const bottomSheetState = interactionState.bottomSheet;
  const isMobileOrTablet = useResponsiveLayout() === "mobile-tablet";
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);
  const bottomSheetRef = useRef<HTMLElement | null>(null);
  const bottomSheetHandleRef = useRef<HTMLButtonElement | null>(null);
  const snapPositions = useMemo(() => {
    if (!isMobileOrTablet) {
      return { collapsed: 0, half: 0, expanded: 0 };
    }

    const collapsed = 0;
    const half = Math.round(viewportHeight * 0.32);
    const expanded = Math.round(viewportHeight * 0.68);

    return {
      collapsed,
      half,
      expanded,
    };
  }, [isMobileOrTablet, viewportHeight]);
  const y = useMotionValue(
    isMobileOrTablet ? snapPositions[bottomSheetState] : 0
  );
  const immediateTranslateY = useMotionValue(
    isMobileOrTablet ? -snapPositions[bottomSheetState] : 0,
  );
  const springY = useSpring(y, {
    stiffness: 60,
    damping: 30,
    mass: 1.2,
  });
  const animatedTranslateY = useTransform(springY, (value) => -value);
  const translateY = prefersReducedMotion
    ? immediateTranslateY
    : animatedTranslateY;
  const dragStartStateRef = useRef<BottomSheetState>(bottomSheetState);
  const dragStartYRef = useRef(0);
  const draggedFromHandleRef = useRef(false);
  const suppressHandleClickRef = useRef(false);
  const handleClickSuppressionTimeoutRef = useRef<number | null>(null);
  const pendingHandleFocusRef = useRef(false);

  const setYPosition = useCallback(
    (position: number) => {
      y.set(position);
      immediateTranslateY.set(-position);
    },
    [immediateTranslateY, y],
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

      dispatch({ type: "bottomSheetSet", state });
    },
    [bottomSheetState, rememberFocusedContent],
  );

  const clearHandleClickSuppression = useCallback(() => {
    suppressHandleClickRef.current = false;

    if (handleClickSuppressionTimeoutRef.current !== null) {
      window.clearTimeout(handleClickSuppressionTimeoutRef.current);
      handleClickSuppressionTimeoutRef.current = null;
    }
  }, []);

  const suppressClickAfterHandleDrag = useCallback(() => {
    if (!draggedFromHandleRef.current) return;

    clearHandleClickSuppression();
    suppressHandleClickRef.current = true;
    handleClickSuppressionTimeoutRef.current = window.setTimeout(
      clearHandleClickSuppression,
      0,
    );
  }, [clearHandleClickSuppression]);

  const handleDragEnd = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (!isMobileOrTablet) {
      return;
    }

    const dragThreshold = 50;
    const velocityThreshold = 0.5;
    const dragDistance = Math.abs(info.offset.y);
    const isDraggingUp = info.offset.y < 0;
    const velocity = Math.abs(info.velocity.y);
    const shouldSnap =
      dragDistance > dragThreshold || velocity > velocityThreshold;

    suppressClickAfterHandleDrag();
    draggedFromHandleRef.current = false;

    if (shouldSnap) {
      setBottomSheetState(
        getNextSearchBottomSheetState(
          dragStartStateRef.current,
          isDraggingUp ? "up" : "down",
        ),
      );
    } else {
      setYPosition(snapPositions[dragStartStateRef.current]);
    }
  }, [
    isMobileOrTablet,
    setBottomSheetState,
    setYPosition,
    snapPositions,
    suppressClickAfterHandleDrag,
  ]);

  const handleDragStart = useCallback((
    event?: MouseEvent | TouchEvent | PointerEvent,
  ) => {
    if (!isMobileOrTablet) {
      return;
    }

    const handle = bottomSheetHandleRef.current;
    draggedFromHandleRef.current = Boolean(
      handle && event?.target instanceof Node && handle.contains(event.target),
    );
    dragStartStateRef.current = bottomSheetState;
    dragStartYRef.current = y.get();
  }, [bottomSheetState, isMobileOrTablet, y]);

  const handleDrag = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (!isMobileOrTablet) {
      return;
    }

    let nextY = dragStartYRef.current - info.offset.y;
    nextY = Math.max(
      snapPositions.collapsed,
      Math.min(snapPositions.expanded, nextY)
    );
    setYPosition(nextY);
  }, [isMobileOrTablet, setYPosition, snapPositions]);

  const handleMapInteraction = useCallback(() => {
    setBottomSheetState("collapsed");
  }, [setBottomSheetState]);

  const handleBottomSheetScroll = useCallback((
    event: React.UIEvent<HTMLDivElement>
  ) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (scrollTop > 20 && bottomSheetState !== "expanded") {
      setBottomSheetState("expanded");
    }
  }, [bottomSheetState, setBottomSheetState]);

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
    if (suppressHandleClickRef.current) {
      clearHandleClickSuppression();
      return;
    }

    if (bottomSheetState === "expanded") {
      setBottomSheetState("collapsed");
      return;
    }

    setBottomSheetState(
      getNextSearchBottomSheetState(bottomSheetState, "up"),
    );
  }, [
    bottomSheetState,
    clearHandleClickSuppression,
    setBottomSheetState,
  ]);

  useLayoutEffect(() => {
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

  useEffect(
    () => () => {
      clearHandleClickSuppression();
    },
    [clearHandleClickSuppression],
  );

  useEffect(() => {
    if (!isMobileOrTablet) {
      setYPosition(0);
      return;
    }

    const targetPosition = snapPositions[bottomSheetState];
    if (prefersReducedMotion) {
      setYPosition(targetPosition);
      return;
    }

    const animation = animate(y, targetPosition, {
      type: "spring",
      stiffness: 60,
      damping: 30,
      mass: 1.2,
    });

    return () => animation.stop();
  }, [
    bottomSheetState,
    isMobileOrTablet,
    prefersReducedMotion,
    setYPosition,
    snapPositions,
    y,
  ]);

  return {
    bottomSheetState,
    setBottomSheetState,
    isMobileOrTablet,
    bottomSheetRef,
    bottomSheetHandleRef,
    snapPositions,
    translateY,
    handleBottomSheetKeyDown,
    handleBottomSheetToggle,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    handleMapInteraction,
    handleBottomSheetScroll,
  };
};
