import {
  applyUploadedListingEditorImages,
  createPendingListingEditorImageItems,
  getPendingListingEditorFiles,
  removeListingEditorImage,
  reorderListingEditorImages,
  restoreListingEditorImage,
  toListingEditorImageItems,
  validateListingEditorImageFiles,
} from "./listingEditorImages";

const file = (name: string, type = "image/png", size = 1) => {
  const value = new File(["x"], name, { type });
  Object.defineProperty(value, "size", { value: size });
  return value;
};

describe("listing editor image draft", () => {
  it("validates local files without mutating their order", () => {
    const valid = file("valid.png");
    const large = file("large.png", "image/png", 11 * 1024 * 1024);
    const text = file("note.txt", "text/plain");

    expect(validateListingEditorImageFiles([valid, large, text])).toEqual({
      validFiles: [valid],
      errors: [
        "large.png 파일 크기는 10MB를 초과할 수 없습니다.",
        "note.txt은(는) 지원하지 않는 이미지 형식입니다.",
      ],
    });
  });

  it("keeps a stable client identity for server and pending images", () => {
    const pendingFile = file("pending.png");
    expect(
      toListingEditorImageItems([{ id: 7, imageUrl: "/server.png" }]),
    ).toEqual([{ clientId: "server:7", id: 7, url: "/server.png" }]);
    expect(
      createPendingListingEditorImageItems([
        { clientId: "local:1", file: pendingFile, preview: "blob:1" },
      ]),
    ).toEqual([
      {
        clientId: "local:1",
        file: pendingFile,
        preview: "blob:1",
        url: "",
      },
    ]);
  });

  it("restores an optimistically removed image at its original position", () => {
    const items = toListingEditorImageItems([
      { id: 1, imageUrl: "/1.png" },
      { id: 2, imageUrl: "/2.png" },
      { id: 3, imageUrl: "/3.png" },
    ]);
    const removed = removeListingEditorImage(items, 1);

    expect(removed.tombstone?.originalIndex).toBe(1);
    expect(
      restoreListingEditorImage(removed.items, removed.tombstone!),
    ).toEqual(items);
    expect(
      reorderListingEditorImages(items, 0, 2).map((item) => item.id),
    ).toEqual([2, 3, 1]);
  });

  it("binds a batch upload in retained client order", () => {
    const first = file("a.png");
    const second = file("b.png");
    const items = createPendingListingEditorImageItems([
      { clientId: "local:a", file: first, preview: "blob:a" },
      { clientId: "local:b", file: second, preview: "blob:b" },
    ]);

    expect(getPendingListingEditorFiles(items)).toEqual([first, second]);
    expect(
      applyUploadedListingEditorImages(items, [
        { id: 10, imageUrl: "/a.png" },
        { id: 11, imageUrl: "/b.png" },
      ]),
    ).toEqual({
      matched: true,
      items: [
        { clientId: "local:a", id: 10, url: "/a.png" },
        { clientId: "local:b", id: 11, url: "/b.png" },
      ],
      previewsToRevoke: ["blob:a", "blob:b"],
    });
  });

  it("refuses to guess bindings for a partial upload response", () => {
    const items = createPendingListingEditorImageItems([
      { clientId: "local:a", file: file("a.png"), preview: "blob:a" },
      { clientId: "local:b", file: file("b.png"), preview: "blob:b" },
    ]);

    expect(
      applyUploadedListingEditorImages(items, [
        { id: 10, imageUrl: "/only-one.png" },
      ]),
    ).toEqual({ matched: false, items, previewsToRevoke: [] });
  });
});
