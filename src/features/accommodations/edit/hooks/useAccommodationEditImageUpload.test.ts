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
    expect(handleError).not.toHaveBeenCalled();
  });

  it("ignores an upload result and progress after the accommodation changes", async () => {
    const file = new File(["image"], "room.png", { type: "image/png" });
    const applyUploadedImages = jest.fn();
    const clearError = jest.fn();
    const handleError = jest.fn();
    const setUploadProgress = jest.fn();
    let reportProgress: ((progress: number) => void) | undefined;
    let resolveUpload:
      | ((value: {
          uploaded_images: Array<{ id: number; image_url: string }>;
        }) => void)
      | undefined;
    jest.mocked(accommodationApi.uploadImages).mockImplementation(
      (_id, _files, onProgress) => {
        reportProgress = onProgress;
        return new Promise((resolve) => {
          resolveUpload = resolve;
        });
      }
    );

    const { result, rerender } = renderHook(
      ({ accommodationId }: { accommodationId: string }) =>
        useAccommodationEditImageUpload({
          accommodationId,
          applyUploadedImages,
          clearError,
          getPendingFiles: () => [file],
          handleError,
          resetProgressDelayMs: 500,
          setUploadProgress,
        }),
      { initialProps: { accommodationId: "3" } }
    );

    let uploadPromise: Promise<boolean> | undefined;
    act(() => {
      uploadPromise = result.current.uploadPendingImages();
    });

    rerender({ accommodationId: "4" });
    setUploadProgress.mockClear();

    await act(async () => {
      reportProgress?.(75);
      resolveUpload?.({
        uploaded_images: [{ id: 9, image_url: "/old-upload.jpg" }],
      });
      await uploadPromise;
    });

    expect(await uploadPromise).toBe(false);
    expect(applyUploadedImages).not.toHaveBeenCalled();
    expect(setUploadProgress).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });

  it("does not update state after unmounting during an upload", async () => {
    const file = new File(["image"], "room.png", { type: "image/png" });
    const applyUploadedImages = jest.fn();
    const clearError = jest.fn();
    const handleError = jest.fn();
    const setUploadProgress = jest.fn();
    let resolveUpload:
      | ((value: {
          uploaded_images: Array<{ id: number; image_url: string }>;
        }) => void)
      | undefined;
    jest.mocked(accommodationApi.uploadImages).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    const { result, unmount } = renderHook(() =>
      useAccommodationEditImageUpload({
        accommodationId: "3",
        applyUploadedImages,
        clearError,
        getPendingFiles: () => [file],
        handleError,
        resetProgressDelayMs: 500,
        setUploadProgress,
      })
    );

    let uploadPromise: Promise<boolean> | undefined;
    act(() => {
      uploadPromise = result.current.uploadPendingImages();
    });
    unmount();
    setUploadProgress.mockClear();

    await act(async () => {
      resolveUpload?.({
        uploaded_images: [{ id: 9, image_url: "/late-upload.jpg" }],
      });
      await uploadPromise;
    });

    expect(await uploadPromise).toBe(false);
    expect(applyUploadedImages).not.toHaveBeenCalled();
    expect(setUploadProgress).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });
});
