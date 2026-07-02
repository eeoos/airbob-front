import { act, renderHook } from "@testing-library/react";
import { accommodationApi } from "../../../../api";
import { useAccommodationEditImageUpload } from "./useAccommodationEditImageUpload";

jest.mock("../../../../api", () => ({
  accommodationApi: {
    uploadImages: jest.fn(),
  },
}));

describe("useAccommodationEditImageUpload", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(accommodationApi.uploadImages).mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uploads pending images with progress and applies the uploaded server images", async () => {
    const file = new File(["image"], "room.png", { type: "image/png" });
    const applyUploadedImages = jest.fn();
    const clearError = jest.fn();
    const handleError = jest.fn();
    const setIsSaving = jest.fn();
    const setUploadProgress = jest.fn();
    jest.mocked(accommodationApi.uploadImages).mockImplementation(
      async (_id, _files, onProgress) => {
        onProgress?.(40);
        return { uploaded_images: [{ id: 9, image_url: "/uploaded.jpg" }] };
      }
    );

    const { result } = renderHook(() =>
      useAccommodationEditImageUpload({
        accommodationId: "3",
        applyUploadedImages,
        clearError,
        getPendingFiles: () => [file],
        handleError,
        resetProgressDelayMs: 500,
        setIsSaving,
        setUploadProgress,
      })
    );

    let uploaded = false;
    await act(async () => {
      uploaded = await result.current.uploadPendingImages();
    });

    expect(uploaded).toBe(true);
    expect(clearError).toHaveBeenCalled();
    expect(accommodationApi.uploadImages).toHaveBeenCalledWith(
      3,
      [file],
      expect.any(Function)
    );
    expect(setUploadProgress).toHaveBeenCalledWith(0);
    expect(setUploadProgress).toHaveBeenCalledWith(40);
    expect(setUploadProgress).toHaveBeenCalledWith(100);
    expect(applyUploadedImages).toHaveBeenCalledWith([
      { id: 9, image_url: "/uploaded.jpg" },
    ]);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(setUploadProgress).toHaveBeenLastCalledWith(0);
    expect(setIsSaving).toHaveBeenLastCalledWith(false);
    expect(handleError).not.toHaveBeenCalled();
  });
});
