import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanInfo,
  animate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

export type BottomSheetState = "collapsed" | "half" | "expanded";

const getViewportHeight = () =>
  typeof window === "undefined" ? 0 : window.innerHeight;

export const useSearchBottomSheet = () => {
  const [bottomSheetState, setBottomSheetState] =
    useState<BottomSheetState>("half");
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);
  const bottomSheetRef = useRef<HTMLDivElement | null>(null);
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
  const springY = useSpring(y, {
    stiffness: 60,
    damping: 30,
    mass: 1.2,
  });
  const translateY = useTransform(springY, (value) => -value);
  const dragStartStateRef = useRef<BottomSheetState>(bottomSheetState);
  const dragStartYRef = useRef(0);

  const getNextState = useCallback((
    currentState: BottomSheetState,
    dragUp: boolean
  ): BottomSheetState => {
    if (dragUp) {
      if (currentState === "collapsed") {
        return "half";
      }
      if (currentState === "half") {
        return "expanded";
      }
      return currentState;
    }

    if (currentState === "expanded") {
      return "half";
    }
    if (currentState === "half") {
      return "collapsed";
    }
    return currentState;
  }, []);

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

    if (shouldSnap) {
      const nextState = getNextState(dragStartStateRef.current, isDraggingUp);
      setBottomSheetState(nextState);
    } else {
      y.set(snapPositions[dragStartStateRef.current]);
    }
  }, [getNextState, isMobileOrTablet, snapPositions, y]);

  const handleDragStart = useCallback(() => {
    if (!isMobileOrTablet) {
      return;
    }
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
    y.set(nextY);
  }, [isMobileOrTablet, snapPositions, y]);

  const handleMapInteraction = useCallback(() => {
    setBottomSheetState("collapsed");
  }, []);

  const handleBottomSheetScroll = useCallback((
    event: React.UIEvent<HTMLDivElement>
  ) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (scrollTop > 20 && bottomSheetState !== "expanded") {
      setBottomSheetState("expanded");
    }
  }, [bottomSheetState]);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobileOrTablet(window.innerWidth < 1024);
      setViewportHeight(getViewportHeight());
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);

    return () => {
      window.removeEventListener("resize", checkViewport);
    };
  }, []);

  useEffect(() => {
    if (isMobileOrTablet) {
      animate(y, snapPositions[bottomSheetState], {
        type: "spring",
        stiffness: 60,
        damping: 30,
        mass: 1.2,
      });
    } else {
      y.set(0);
    }
  }, [bottomSheetState, isMobileOrTablet, snapPositions, y]);

  return {
    bottomSheetState,
    setBottomSheetState,
    isMobileOrTablet,
    bottomSheetRef,
    snapPositions,
    translateY,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    handleMapInteraction,
    handleBottomSheetScroll,
  };
};
