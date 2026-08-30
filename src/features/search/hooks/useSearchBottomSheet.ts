import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
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
  searchInteractionReducer,
  type SearchBottomSheetState,
} from "../model/searchInteractionReducer";

export type BottomSheetState = SearchBottomSheetState;

const getViewportHeight = () =>
  typeof window === "undefined" ? 0 : window.innerHeight;

export const useSearchBottomSheet = () => {
  const [interactionState, dispatch] = useReducer(
    searchInteractionReducer,
    undefined,
    createSearchInteractionState,
  );
  const bottomSheetState = interactionState.bottomSheet;
  const isMobileOrTablet = useResponsiveLayout() === "mobile-tablet";
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
      dispatch({
        type: "bottomSheetSet",
        state: dragStartStateRef.current,
      });
      dispatch({
        type: "bottomSheetStepped",
        direction: isDraggingUp ? "up" : "down",
      });
    } else {
      y.set(snapPositions[dragStartStateRef.current]);
    }
  }, [isMobileOrTablet, snapPositions, y]);

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
    dispatch({ type: "bottomSheetMapInteracted" });
  }, []);

  const handleBottomSheetScroll = useCallback((
    event: React.UIEvent<HTMLDivElement>
  ) => {
    const scrollTop = event.currentTarget.scrollTop;
    if (scrollTop > 20 && bottomSheetState !== "expanded") {
      dispatch({ type: "bottomSheetContentScrolled" });
    }
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

  const setBottomSheetState = useCallback((state: BottomSheetState) => {
    dispatch({ type: "bottomSheetSet", state });
  }, []);

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
