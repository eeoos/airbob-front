import { act, renderHook } from "@testing-library/react";
import { useReviewImageSelection } from "./useReviewImageSelection";

describe("useReviewImageSelection", () => {
  const file = new File(["image"], "review.png", { type: "image/png" });

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => "blob:review-image");
    URL.revokeObjectURL = jest.fn();
  });

  it("adds image files and revokes preview URLs when removed", () => {
    const { result, unmount } = renderHook(() => useReviewImageSelection());

    act(() => {
      result.current.addFiles([file]);
    });

    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0].previewUrl).toBe("blob:review-image");

    act(() => {
      result.current.removeImage(result.current.images[0].id);
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:review-image");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("revokes active preview URLs on unmount", () => {
    const { result, unmount } = renderHook(() => useReviewImageSelection());

    act(() => {
      result.current.addFiles([file]);
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:review-image");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
