import { useEffect, useRef, type RefObject } from "react";
import type { MotionValue } from "framer-motion";
import {
  getNextSearchBottomSheetState,
  type SearchBottomSheetState,
} from "../model/searchInteractionReducer";

interface ContentGestureOptions {
  readonly contentRef: RefObject<HTMLDivElement | null>;
  readonly enabled: boolean;
  readonly state: SearchBottomSheetState;
  readonly positions: Readonly<Record<SearchBottomSheetState, number>>;
  readonly y: MotionValue<number>;
  readonly stopAnimation: () => void;
  readonly animateToPosition: (position: number) => void;
  readonly setState: (state: SearchBottomSheetState) => void;
  readonly setDragging: (dragging: boolean) => void;
}

interface ContentDrag {
  startX: number;
  startY: number;
  sheetY: number;
  offset: number;
  claimed: boolean;
  scrollsList: boolean;
}

const isControlTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      "button, input, textarea, select, [role='slider'], [data-search-sheet-header]",
    ),
  );

// Let the browser scroll the expanded list. Only take over a vertical gesture
// when it should move the sheet: at a partial snap, or pulling down at list top.
export function useSearchBottomSheetContentGestures({
  contentRef,
  enabled,
  state,
  positions,
  y,
  stopAnimation,
  animateToPosition,
  setState,
  setDragging,
}: ContentGestureOptions) {
  const suppressClickUntil = useRef(0);
  const wheelBurst = useRef({ lastAt: 0, total: 0, handled: false });

  useEffect(() => {
    const content = contentRef.current;
    if (!enabled || !content) return;

    let drag: ContentDrag | null = null;
    let mousePointerId: number | null = null;

    const start = (x: number, pointerY: number, target: EventTarget | null) => {
      if (isControlTarget(target)) return;
      drag = {
        startX: x,
        startY: pointerY,
        sheetY: y.get(),
        offset: 0,
        claimed: false,
        scrollsList: state === "expanded" && content.scrollTop > 0,
      };
    };

    const move = (x: number, pointerY: number, event: Event) => {
      if (!drag || drag.scrollsList) return;
      const dx = x - drag.startX;
      const dy = pointerY - drag.startY;
      if (!drag.claimed) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        if (Math.abs(dx) > Math.abs(dy) || (state === "expanded" && dy < 0)) {
          drag.scrollsList = true;
          return;
        }
        if (!event.cancelable) return;
        drag.claimed = true;
        stopAnimation();
        setDragging(true);
      }
      event.preventDefault();
      drag.offset = dy;
      const nextY = drag.sheetY + dy;
      const lowestPosition =
        state === "collapsed"
          ? positions.collapsed
          : Math.max(positions.half, drag.sheetY);
      y.set(Math.max(positions.expanded, Math.min(lowestPosition, nextY)));
      // Once the sheet reaches the header, spend the rest of this same swipe
      // scrolling its contents, including the handle and result count.
      content.scrollTop = Math.max(0, positions.expanded - nextY);
    };

    const finish = (cancelled = false) => {
      if (!drag) return;
      if (drag.claimed) {
        suppressClickUntil.current = performance.now() + 400;
        setDragging(false);
        const nextState =
          !cancelled && Math.abs(drag.offset) > 50
            ? getNextSearchBottomSheetState(
                state,
                drag.offset < 0 ? "up" : "down",
              )
            : state;
        if (nextState !== "expanded" || cancelled) content.scrollTop = 0;
        if (nextState === state) animateToPosition(positions[state]);
        else setState(nextState);
      }
      drag = null;
      mousePointerId = null;
    };

    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        finish(true);
        return;
      }
      const touch = event.touches[0];
      if (touch) start(touch.clientX, touch.clientY, event.target);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        finish(true);
        return;
      }
      const touch = event.touches[0];
      if (touch) move(touch.clientX, touch.clientY, event);
    };
    const touchEnd = () => finish();
    const touchCancel = () => finish(true);
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      start(event.clientX, event.clientY, event.target);
      if (drag) mousePointerId = event.pointerId;
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerId !== mousePointerId) return;
      move(event.clientX, event.clientY, event);
    };
    const pointerEnd = (event: PointerEvent) => {
      if (event.pointerId === mousePointerId)
        finish(event.type === "pointercancel");
    };
    const preventImageDrag = (event: DragEvent) => {
      if (drag && !drag.scrollsList) event.preventDefault();
    };
    const preventClickAfterDrag = (event: MouseEvent) => {
      if (isControlTarget(event.target)) return;
      if (performance.now() >= suppressClickUntil.current) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))
        return;
      const now = performance.now();
      const burst = wheelBurst.current;
      if (now - burst.lastAt > 180) {
        burst.total = 0;
        burst.handled = false;
      }
      burst.lastAt = now;
      if (burst.handled) {
        event.preventDefault();
        return;
      }
      if (state === "expanded" && (content.scrollTop > 0 || event.deltaY >= 0))
        return;
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? content.clientHeight
            : 1);
      if (Math.sign(delta) !== Math.sign(burst.total)) burst.total = 0;
      burst.total += delta;
      if (Math.abs(burst.total) < 30) return;
      burst.handled = true;
      content.scrollTop = 0;
      setState(
        getNextSearchBottomSheetState(state, burst.total > 0 ? "up" : "down"),
      );
    };

    content.addEventListener("touchstart", touchStart, { passive: true });
    content.addEventListener("touchmove", touchMove, { passive: false });
    content.addEventListener("touchend", touchEnd);
    content.addEventListener("touchcancel", touchCancel);
    content.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerEnd);
    window.addEventListener("pointercancel", pointerEnd);
    content.addEventListener("dragstart", preventImageDrag);
    content.addEventListener("click", preventClickAfterDrag, true);
    content.addEventListener("wheel", wheel, { passive: false });
    return () => {
      content.removeEventListener("touchstart", touchStart);
      content.removeEventListener("touchmove", touchMove);
      content.removeEventListener("touchend", touchEnd);
      content.removeEventListener("touchcancel", touchCancel);
      content.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerEnd);
      window.removeEventListener("pointercancel", pointerEnd);
      content.removeEventListener("dragstart", preventImageDrag);
      content.removeEventListener("click", preventClickAfterDrag, true);
      content.removeEventListener("wheel", wheel);
    };
  }, [
    animateToPosition,
    contentRef,
    enabled,
    positions,
    setDragging,
    setState,
    state,
    stopAnimation,
    y,
  ]);
}
