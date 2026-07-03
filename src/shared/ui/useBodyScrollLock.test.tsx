import { renderHook } from "@testing-library/react";
import { useBodyScrollLock } from "./useBodyScrollLock";

describe("useBodyScrollLock", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("locks body scroll while active and restores the previous overflow", () => {
    document.body.style.overflow = "auto";

    const { rerender, unmount } = renderHook(
      ({ isLocked }) => useBodyScrollLock(isLocked),
      { initialProps: { isLocked: true } }
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender({ isLocked: false });

    expect(document.body.style.overflow).toBe("auto");

    unmount();

    expect(document.body.style.overflow).toBe("auto");
  });

  it("keeps body locked until the last nested lock is released", () => {
    const first = renderHook(({ isLocked }) => useBodyScrollLock(isLocked), {
      initialProps: { isLocked: true },
    });
    const second = renderHook(({ isLocked }) => useBodyScrollLock(isLocked), {
      initialProps: { isLocked: true },
    });

    expect(document.body.style.overflow).toBe("hidden");

    first.unmount();

    expect(document.body.style.overflow).toBe("hidden");

    second.unmount();

    expect(document.body.style.overflow).toBe("");
  });
});
