import { act, renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../../api";
import { ApiClientError } from "../../../../api/response";
import { useAccommodationEditImages } from "./useAccommodationEditImages";

jest.mock("../../../../api", () => ({
  accommodationApi: {
    deleteImage: jest.fn(),
    getHostAccommodationDetail: jest.fn(),
  },
}));

const createFile = (name: string, type = "image/png") =>
  new File(["image"], name, { type });

describe("useAccommodationEditImages", () => {
  const onError = jest.fn();
  const createObjectURL = jest.fn();
  const revokeObjectURL = jest.fn();
  const deleteImage = jest.fn();

  beforeEach(() => {
    onError.mockReset();
    createObjectURL.mockReset();
    createObjectURL.mockImplementation((file: File) => `blob:${file.name}`);
    revokeObjectURL.mockReset();
    deleteImage.mockReset();
    deleteImage.mockResolvedValue(undefined);
    jest.mocked(accommodationApi.getHostAccommodationDetail).mockReset();
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue({
        images: [
          { id: 11, image_url: "/a.jpg" },
          { id: 12, image_url: "/b.jpg" },
          { id: 13, image_url: "/c.jpg" },
        ],
      } as never);
  });

  it("loads server images and keeps an immutable initial snapshot", () => {
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });

    expect(result.current.imageItems).toEqual([
      expect.objectContaining({ id: 11, url: "/server.jpg" }),
    ]);
    expect(result.current.initialImageItems).toEqual(result.current.imageItems);
  });

  it("adds only valid local files as pending image items", () => {
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.addFiles([
        createFile("room.png"),
        createFile("notes.txt", "text/plain"),
      ]);
    });

    expect(result.current.imageItems).toHaveLength(1);
    expect(result.current.imageItems[0]).toMatchObject({
      file: expect.any(File),
      preview: "blob:room.png",
      url: "",
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("revokes pending previews and clears image state when the accommodation changes", () => {
    const { result, rerender } = renderHook(
      ({ accommodationId }) =>
        useAccommodationEditImages({
          accommodationId,
          onError,
          createObjectURL,
          revokeObjectURL,
          deleteImage,
        }),
      { initialProps: { accommodationId: "3" } }
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
      result.current.addFiles([createFile("pending.png")]);
      result.current.handleDragStart(0);
    });

    rerender({ accommodationId: "4" });

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pending.png");
    expect(result.current.imageItems).toEqual([]);
    expect(result.current.initialImageItems).toEqual([]);
    expect(result.current.draggedIndex).toBeNull();
    expect(result.current.dragOverIndex).toBeNull();
  });

  it("removes local previews and deletes server images through injected boundary", async () => {
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
      result.current.addFiles([createFile("room.png")]);
    });

    act(() => {
      result.current.handleImageRemove(1);
    });

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:room.png");
    expect(deleteImage).not.toHaveBeenCalled();

    act(() => {
      result.current.handleImageRemove(0);
    });

    expect(deleteImage).toHaveBeenCalledWith(3, 11);
    expect(result.current.imageItems).toEqual([]);
    await waitFor(() => expect(result.current.isDeletingImage).toBe(false));
  });

  it("restores a server image when reconciliation confirms it remains", async () => {
    const deleteError = new Error("delete failed");
    deleteImage.mockRejectedValueOnce(deleteError);
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });

    act(() => {
      result.current.handleImageRemove(0);
    });

    expect(result.current.imageItems).toEqual([]);

    await waitFor(() =>
      expect(result.current.imageItems).toEqual([
        expect.objectContaining({ id: 11, url: "/server.jpg" }),
      ])
    );
    expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3);
  });

  it("keeps an image removed when an ambiguous delete failure is confirmed by server detail", async () => {
    const networkError = new Error("Network Error");
    deleteImage.mockRejectedValueOnce(networkError);
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValueOnce({ images: [] } as never);
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });

    act(() => {
      result.current.handleImageRemove(0);
    });

    const pendingDeletion = result.current.waitForPendingImageDeletes();

    await act(async () => {
      await expect(pendingDeletion).resolves.toBe(true);
    });
    expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3);
    expect(result.current.imageItems).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reconciles a server error because the delete outcome is ambiguous", async () => {
    const serverError = new ApiClientError({
      message: "internal server error",
      status: 500,
      code: "C003",
    });
    deleteImage.mockRejectedValueOnce(serverError);
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValueOnce({ images: [] } as never);
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });

    const pendingDeletion = result.current.waitForPendingImageDeletes();
    await act(async () => {
      await expect(pendingDeletion).resolves.toBe(true);
    });

    expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3);
    expect(result.current.imageItems).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("treats an image not-found rejection as a successful deletion", async () => {
    const notFoundError = new ApiClientError({
      message: "image not found",
      status: 400,
      code: "I004",
    });
    deleteImage.mockRejectedValueOnce(notFoundError);
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });

    const pendingDeletion = result.current.waitForPendingImageDeletes();
    await act(async () => {
      await expect(pendingDeletion).resolves.toBe(true);
    });

    expect(result.current.imageItems).toEqual([]);
    expect(accommodationApi.getHostAccommodationDetail).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("classifies an Axios image-not-found response as confirmed absence", async () => {
    deleteImage.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: { code: "I004" } },
      },
    });
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });

    await act(async () => {
      await expect(result.current.waitForPendingImageDeletes()).resolves.toBe(
        true
      );
    });

    expect(result.current.imageItems).toEqual([]);
    expect(accommodationApi.getHostAccommodationDetail).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("reconciles an Axios network failure with host detail", async () => {
    deleteImage.mockRejectedValueOnce({ isAxiosError: true });
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValueOnce({ images: [] } as never);
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });

    await act(async () => {
      await expect(result.current.waitForPendingImageDeletes()).resolves.toBe(
        true
      );
    });

    expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3);
    expect(result.current.imageItems).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("restores immediately when the server definitively rejects deletion", async () => {
    const permissionError = new ApiClientError({
      message: "forbidden",
      status: 403,
      code: "I005",
    });
    deleteImage.mockRejectedValueOnce(permissionError);
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });

    const pendingDeletion = result.current.waitForPendingImageDeletes();
    await act(async () => {
      await expect(pendingDeletion).resolves.toBe(false);
    });

    expect(result.current.imageItems).toEqual([
      expect.objectContaining({ id: 11, url: "/server.jpg" }),
    ]);
    expect(accommodationApi.getHostAccommodationDetail).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(permissionError);
  });

  it("retries an unresolved reconciliation before allowing persistence", async () => {
    const networkError = new Error("Network Error");
    const detailError = new Error("detail unavailable");
    deleteImage.mockRejectedValueOnce(networkError);
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockRejectedValueOnce(detailError)
      .mockResolvedValueOnce({ images: [] } as never);
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });

    const pendingDeletion = result.current.waitForPendingImageDeletes();
    await act(async () => {
      await expect(pendingDeletion).resolves.toBe(false);
    });

    expect(result.current.imageItems).toEqual([]);
    expect(result.current.isDeletingImage).toBe(false);

    let retryResult = false;
    await act(async () => {
      retryResult = await result.current.waitForPendingImageDeletes();
    });

    expect(retryResult).toBe(true);
    expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledTimes(2);
    expect(result.current.imageItems).toEqual([]);
    expect(result.current.isDeletingImage).toBe(false);
    expect(onError).toHaveBeenCalledWith(detailError);
  });

  it("serializes server deletions and reports a failed pending deletion", async () => {
    const deleteError = new Error("delete failed");
    let rejectDelete: (error: Error) => void = () => undefined;
    deleteImage.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectDelete = reject;
        })
    );
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([
        { id: 11, image_url: "/a.jpg" },
        { id: 12, image_url: "/b.jpg" },
        { id: 13, image_url: "/c.jpg" },
      ]);
    });

    act(() => {
      result.current.handleImageRemove(0);
      result.current.handleImageRemove(0);
    });

    expect(deleteImage).toHaveBeenCalledTimes(1);
    expect(result.current.isDeletingImage).toBe(true);
    const pendingDeletion = result.current.waitForPendingImageDeletes();

    await act(async () => {
      rejectDelete(deleteError);
      await pendingDeletion;
    });

    expect(await pendingDeletion).toBe(false);
    expect(result.current.imageItems.map((item) => item.id)).toEqual([
      11,
      12,
      13,
    ]);
    expect(result.current.isDeletingImage).toBe(false);
  });

  it("restores a failed middle image at its original position", async () => {
    const deleteError = new Error("delete failed");
    deleteImage.mockRejectedValueOnce(deleteError);
    const { result } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([
        { id: 11, image_url: "/a.jpg" },
        { id: 12, image_url: "/b.jpg" },
        { id: 13, image_url: "/c.jpg" },
      ]);
    });

    act(() => {
      result.current.handleImageRemove(1);
    });

    await waitFor(() => expect(onError).toHaveBeenCalledWith(deleteError));
    expect(result.current.isDeletingImage).toBe(false);
    expect(result.current.imageItems.map((item) => item.id)).toEqual([
      11,
      12,
      13,
    ]);
  });

  it("does not restore a failed deletion into a different accommodation", async () => {
    let rejectDelete: (error: Error) => void = () => undefined;
    deleteImage.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectDelete = reject;
        })
    );
    const { result, rerender } = renderHook(
      ({ accommodationId }) =>
        useAccommodationEditImages({
          accommodationId,
          onError,
          createObjectURL,
          revokeObjectURL,
          deleteImage,
        }),
      { initialProps: { accommodationId: "3" } }
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/a.jpg" }]);
      result.current.handleImageRemove(0);
    });

    rerender({ accommodationId: "4" });
    act(() => {
      result.current.loadImages([{ id: 21, image_url: "/b.jpg" }]);
    });

    await act(async () => {
      rejectDelete(new Error("delete failed"));
    });

    expect(result.current.imageItems.map((item) => item.id)).toEqual([21]);
    expect(result.current.isDeletingImage).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores reconciliation that finishes after accommodation navigation", async () => {
    let resolveDetail: (detail: { images: Array<{ id: number; image_url: string }> }) => void =
      () => undefined;
    deleteImage.mockRejectedValueOnce(new Error("Network Error"));
    jest.mocked(accommodationApi.getHostAccommodationDetail).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve as typeof resolveDetail;
        }) as never
    );
    const { result, rerender } = renderHook(
      ({ accommodationId }) =>
        useAccommodationEditImages({
          accommodationId,
          onError,
          createObjectURL,
          revokeObjectURL,
          deleteImage,
        }),
      { initialProps: { accommodationId: "3" } }
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/a.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });
    await waitFor(() =>
      expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3)
    );
    const pendingDeletion = result.current.waitForPendingImageDeletes();

    rerender({ accommodationId: "4" });
    act(() => {
      result.current.loadImages([{ id: 21, image_url: "/b.jpg" }]);
      resolveDetail({ images: [{ id: 11, image_url: "/a.jpg" }] });
    });
    await act(async () => {
      await pendingDeletion;
    });

    expect(result.current.imageItems.map((item) => item.id)).toEqual([21]);
    expect(result.current.isDeletingImage).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores old reconciliation after leaving and re-entering the same accommodation", async () => {
    let resolveDetail: (detail: {
      images: Array<{ id: number; image_url: string }>;
    }) => void = () => undefined;
    deleteImage.mockRejectedValueOnce(new Error("Network Error"));
    jest.mocked(accommodationApi.getHostAccommodationDetail).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve as typeof resolveDetail;
        }) as never
    );
    const { result, rerender } = renderHook(
      ({ accommodationId }) =>
        useAccommodationEditImages({
          accommodationId,
          onError,
          createObjectURL,
          revokeObjectURL,
          deleteImage,
        }),
      { initialProps: { accommodationId: "3" } }
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/old-a.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });
    await waitFor(() =>
      expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3)
    );
    const oldReconciliation = result.current.waitForPendingImageDeletes();

    rerender({ accommodationId: "4" });
    rerender({ accommodationId: "3" });
    act(() => {
      result.current.loadImages([{ id: 31, image_url: "/new-a.jpg" }]);
    });

    await act(async () => {
      resolveDetail({ images: [{ id: 11, image_url: "/old-a.jpg" }] });
      await oldReconciliation;
    });

    expect(result.current.imageItems).toEqual([
      expect.objectContaining({ id: 31, url: "/new-a.jpg" }),
    ]);
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.isDeletingImage).toBe(false);
  });

  it("does not report or restore reconciliation after unmount", async () => {
    let resolveDetail: (detail: {
      images: Array<{ id: number; image_url: string }>;
    }) => void = () => undefined;
    deleteImage.mockRejectedValueOnce(new Error("Network Error"));
    jest.mocked(accommodationApi.getHostAccommodationDetail).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve as typeof resolveDetail;
        }) as never
    );
    const { result, unmount } = renderHook(() =>
      useAccommodationEditImages({
        accommodationId: "3",
        onError,
        createObjectURL,
        revokeObjectURL,
        deleteImage,
      })
    );

    act(() => {
      result.current.loadImages([{ id: 11, image_url: "/server.jpg" }]);
    });
    act(() => {
      result.current.handleImageRemove(0);
    });
    await waitFor(() =>
      expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3)
    );
    const reconciliation = result.current.waitForPendingImageDeletes();

    unmount();
    await act(async () => {
      resolveDetail({ images: [{ id: 11, image_url: "/server.jpg" }] });
      await reconciliation;
    });

    expect(onError).not.toHaveBeenCalled();
  });
});
