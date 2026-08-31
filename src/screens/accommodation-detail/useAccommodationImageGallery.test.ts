import { act, renderHook } from "@testing-library/react";
import type { TouchEvent } from "react";
import { useAccommodationImageGallery } from "./useAccommodationImageGallery";

const touchEvent = (clientX: number) =>
  ({ targetTouches: [{ clientX }] }) as unknown as TouchEvent<HTMLDivElement>;

describe("useAccommodationImageGallery", () => {
  it("opens and closes at a clamped image index", () => {
    const { result } = renderHook(() =>
      useAccommodationImageGallery({ imageCount: 3 }),
    );

    act(() => result.current.openGallery(9));
    expect(result.current.isImageGalleryOpen).toBe(true);
    expect(result.current.currentImageIndex).toBe(2);

    act(() => result.current.closeGallery());
    expect(result.current.isImageGalleryOpen).toBe(false);
  });

  it("moves the mobile slide in both swipe directions without crossing edges", () => {
    const { result } = renderHook(() =>
      useAccommodationImageGallery({ imageCount: 2 }),
    );

    act(() => {
      result.current.onTouchStart(touchEvent(200));
      result.current.onTouchMove(touchEvent(100));
    });
    act(() => result.current.onTouchEnd());
    expect(result.current.mobileSlideIndex).toBe(1);

    act(() => {
      result.current.onTouchStart(touchEvent(100));
      result.current.onTouchMove(touchEvent(200));
    });
    act(() => result.current.onTouchEnd());
    expect(result.current.mobileSlideIndex).toBe(0);

    act(() => {
      result.current.onTouchStart(touchEvent(100));
      result.current.onTouchMove(touchEvent(200));
    });
    act(() => result.current.onTouchEnd());
    expect(result.current.mobileSlideIndex).toBe(0);
  });

  it("clamps selected indexes when the image collection shrinks", () => {
    const { result, rerender } = renderHook(
      ({ imageCount }) => useAccommodationImageGallery({ imageCount }),
      { initialProps: { imageCount: 4 } },
    );

    act(() => {
      result.current.openGallery(3);
      result.current.setMobileSlideIndex(3);
    });
    rerender({ imageCount: 2 });

    expect(result.current.currentImageIndex).toBe(1);
    expect(result.current.mobileSlideIndex).toBe(1);
  });
});
