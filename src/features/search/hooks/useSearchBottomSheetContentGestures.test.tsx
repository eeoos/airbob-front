import { fireEvent, renderHook } from "@testing-library/react";
import { motionValue } from "framer-motion";
import type { SearchBottomSheetState } from "../model/searchInteractionReducer";
import { useSearchBottomSheetContentGestures } from "./useSearchBottomSheetContentGestures";

const setup = (state: SearchBottomSheetState = "half", scrollTop = 0) => {
  const content = document.createElement("div");
  content.scrollTop = scrollTop;
  const options = {
    contentRef: { current: content },
    enabled: true,
    state,
    positions: { collapsed: 700, half: 230, expanded: 0 },
    y: motionValue(state === "half" ? 230 : 0),
    stopAnimation: vi.fn(),
    animateToPosition: vi.fn(),
    setState: vi.fn(),
    setDragging: vi.fn(),
  };
  const view = renderHook(
    (props) => useSearchBottomSheetContentGestures(props),
    { initialProps: options },
  );
  return { ...options, content, view };
};

const swipe = (content: HTMLElement, fromY: number, toY: number, toX = 100) => {
  fireEvent.touchStart(content, {
    touches: [{ clientX: 100, clientY: fromY }],
  });
  const allowed = fireEvent.touchMove(content, {
    cancelable: true,
    touches: [{ clientX: toX, clientY: toY }],
  });
  fireEvent.touchEnd(content, { touches: [] });
  return allowed;
};

describe("mobile result content gestures", () => {
  it("moves the partial sheet with a swipe, then expands without scrolling cards", () => {
    const sheet = setup();
    expect(swipe(sheet.content, 500, 300)).toBe(false);
    expect(sheet.y.get()).toBe(30);
    expect(sheet.content.scrollTop).toBe(0);
    expect(sheet.setState).toHaveBeenCalledWith("expanded");
    expect(sheet.setDragging).toHaveBeenLastCalledWith(false);
    expect(fireEvent.click(sheet.content)).toBe(false);
  });

  it("returns to the partial sheet when pulling down from the top of the expanded list", () => {
    const sheet = setup("expanded");
    expect(swipe(sheet.content, 200, 350)).toBe(false);
    expect(sheet.setState).toHaveBeenCalledWith("half");
  });

  it("uses the remaining swipe distance to scroll after reaching the expanded position", () => {
    const sheet = setup();
    expect(swipe(sheet.content, 600, 200)).toBe(false);
    expect(sheet.y.get()).toBe(0);
    expect(sheet.content.scrollTop).toBe(170);
    expect(sheet.setState).toHaveBeenCalledWith("expanded");
  });

  it.each([
    [300, 200, 0],
    [200, 350, 100],
  ])(
    "preserves native list scrolling for a swipe %s to %s at scroll offset %s",
    (from, to, scrollTop) => {
      const sheet = setup("expanded", scrollTop);
      expect(swipe(sheet.content, from, to)).toBe(true);
      expect(sheet.setState).not.toHaveBeenCalled();
      expect(sheet.stopAnimation).not.toHaveBeenCalled();
    },
  );

  it("ignores horizontal swipes and leaves card controls clickable", () => {
    const sheet = setup();
    expect(swipe(sheet.content, 300, 310, 240)).toBe(true);
    const button = document.createElement("button");
    sheet.content.append(button);
    expect(swipe(button, 400, 200)).toBe(true);
    expect(fireEvent.click(button)).toBe(true);
    expect(sheet.setState).not.toHaveBeenCalled();
  });

  it("returns a short or cancelled swipe to its original snap", () => {
    const sheet = setup();
    swipe(sheet.content, 300, 275);
    expect(sheet.animateToPosition).toHaveBeenCalledWith(230);
    fireEvent.touchStart(sheet.content, {
      touches: [{ clientX: 100, clientY: 400 }],
    });
    fireEvent.touchMove(sheet.content, {
      touches: [{ clientX: 100, clientY: 200 }],
    });
    fireEvent.touchCancel(sheet.content);
    expect(sheet.setState).not.toHaveBeenCalled();
    expect(sheet.setDragging).toHaveBeenLastCalledWith(false);
  });

  it("consumes the wheel burst that expands the sheet before allowing list scrolling", () => {
    const sheet = setup();
    expect(fireEvent.wheel(sheet.content, { deltaY: 80 })).toBe(false);
    expect(sheet.setState).toHaveBeenCalledWith("expanded");
    sheet.view.rerender({ ...sheet, state: "expanded" });
    expect(fireEvent.wheel(sheet.content, { deltaY: 40 })).toBe(false);
    expect(sheet.setState).toHaveBeenCalledTimes(1);
  });

  it("cleans up listeners when leaving the mobile layout", () => {
    const sheet = setup();
    sheet.view.rerender({ ...sheet, enabled: false });
    expect(fireEvent.wheel(sheet.content, { deltaY: 80 })).toBe(true);
    expect(sheet.setState).not.toHaveBeenCalled();
  });
});
