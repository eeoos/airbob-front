import { act, renderHook } from "@testing-library/react";
import { useListingEditorImages } from "./useListingEditorImages";

const imageFile = () => new File(["room"], "room.png", { type: "image/png" });

describe("useListingEditorImages", () => {
  it("hydrates, optimistically removes, and restores a server image", () => {
    const { result } = renderHook(() =>
      useListingEditorImages({ onError: jest.fn() }),
    );

    act(() =>
      result.current.hydrate([
        { id: 1, imageUrl: "/1.png" },
        { id: 2, imageUrl: "/2.png" },
      ]),
    );
    let tombstone: ReturnType<typeof result.current.removeAt> = null;
    act(() => {
      tombstone = result.current.removeAt(0);
    });
    expect(result.current.imageItems.map((item) => item.id)).toEqual([2]);

    act(() => result.current.restore(tombstone!));
    expect(result.current.imageItems.map((item) => item.id)).toEqual([1, 2]);
  });

  it("binds pending files to uploaded images and revokes previews", () => {
    const revokeObjectUrl = jest.fn();
    const file = imageFile();
    const { result } = renderHook(() =>
      useListingEditorImages({
        onError: jest.fn(),
        createClientId: () => "local:1",
        createObjectUrl: () => "blob:1",
        revokeObjectUrl,
      }),
    );

    act(() => result.current.addFiles([file]));
    expect(result.current.getPendingFiles()).toEqual([file]);

    act(() => {
      expect(
        result.current.applyUploaded([{ id: 7, imageUrl: "/7.png" }]),
      ).toBe(true);
    });
    expect(result.current.imageItems).toEqual([
      { clientId: "local:1", id: 7, url: "/7.png" },
    ]);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:1");
  });

  it("revokes retained local previews on unmount", () => {
    const revokeObjectUrl = jest.fn();
    const { result, unmount } = renderHook(() =>
      useListingEditorImages({
        onError: jest.fn(),
        createClientId: () => "local:1",
        createObjectUrl: () => "blob:1",
        revokeObjectUrl,
      }),
    );
    act(() => result.current.addFiles([imageFile()]));

    unmount();

    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:1");
  });
});
