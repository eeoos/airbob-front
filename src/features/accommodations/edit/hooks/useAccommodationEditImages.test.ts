import { act, renderHook, waitFor } from "@testing-library/react";
import { useAccommodationEditImages } from "./useAccommodationEditImages";

jest.mock("../../../../api", () => ({
  accommodationApi: {
    deleteImage: jest.fn(),
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

  it("restores a server image when deletion fails", async () => {
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
});
