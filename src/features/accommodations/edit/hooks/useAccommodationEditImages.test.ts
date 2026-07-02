import { act, renderHook } from "@testing-library/react";
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

  it("removes local previews and deletes server images through injected boundary", () => {
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
  });
});
