import {
  applyUploadedImagesToItems,
  createImageItems,
  filterValidImageFiles,
  getPendingUploadFiles,
  mapHostImagesToImageItems,
  removeImageItem,
  reorderImageItems,
} from "./imageItems";

const file = (name: string, type: string, size: number) => {
  const testFile = new File(["x"], name, { type, lastModified: 1 });
  Object.defineProperty(testFile, "size", {
    value: size,
  });
  return testFile;
};

describe("accommodation edit image item helpers", () => {
  it("filters unsupported or oversized images with error messages", () => {
    const valid = file("valid.jpg", "image/jpeg", 1024);
    const large = file("large.jpg", "image/jpeg", 11 * 1024 * 1024);
    const text = file("memo.txt", "text/plain", 1024);

    const result = filterValidImageFiles([valid, large, text]);

    expect(result.validFiles).toEqual([valid]);
    expect(result.errors).toEqual([
      "large.jpg 파일 크기는 10MB를 초과할 수 없습니다.",
      "memo.txt은(는) 지원하지 않는 이미지 형식입니다.",
    ]);
  });

  it("creates deterministic image items for selected files", () => {
    const first = file("a.png", "image/png", 1024);
    const second = file("b.webp", "image/webp", 1024);

    expect(
      createImageItems([
        {
          file: first,
          preview: "preview:a.png",
          tempId: "temp-a",
        },
        {
          file: second,
          preview: "preview:b.webp",
          tempId: "temp-b",
        },
      ])
    ).toEqual([
      {
        file: first,
        url: "",
        preview: "preview:a.png",
        tempId: "temp-a",
      },
      {
        file: second,
        url: "",
        preview: "preview:b.webp",
        tempId: "temp-b",
      },
    ]);
  });

  it("maps host images, removes, and reorders items without mutating inputs", () => {
    const mapped = mapHostImagesToImageItems(
      [
        { id: 1, image_url: "a.jpg", tempId: "existing-a" },
        { id: 2, image_url: "b.jpg", tempId: "existing-b" },
      ]
    );

    expect(mapped).toEqual([
      { id: 1, url: "a.jpg", tempId: "existing-a" },
      { id: 2, url: "b.jpg", tempId: "existing-b" },
    ]);

    const removed = removeImageItem(mapped, 0);
    expect(removed.nextItems).toEqual([{ id: 2, url: "b.jpg", tempId: "existing-b" }]);
    expect(removed.removedItem).toEqual({ id: 1, url: "a.jpg", tempId: "existing-a" });
    expect(reorderImageItems(mapped, 0, 1)).toEqual([
      { id: 2, url: "b.jpg", tempId: "existing-b" },
      { id: 1, url: "a.jpg", tempId: "existing-a" },
    ]);
    expect(mapped[0].id).toBe(1);
  });

  it("classifies pending files and applies upload responses in order", () => {
    const first = file("a.png", "image/png", 1024);
    const second = file("b.png", "image/png", 1024);
    const items = [
      { id: 1, url: "server.jpg", tempId: "existing" },
      { file: first, url: "", preview: "blob:a", tempId: "temp-a" },
      { file: second, url: "", preview: "blob:b", tempId: "temp-b" },
    ];

    expect(getPendingUploadFiles(items)).toEqual([first, second]);
    expect(
      applyUploadedImagesToItems(items, [
        { id: 10, image_url: "uploaded-a.jpg" },
        { id: 11, image_url: "uploaded-b.jpg" },
      ])
    ).toEqual({
      items: [
        { id: 1, url: "server.jpg", tempId: "existing" },
        { id: 10, url: "uploaded-a.jpg", tempId: "temp-a" },
        { id: 11, url: "uploaded-b.jpg", tempId: "temp-b" },
      ],
      previewsToRevoke: ["blob:a", "blob:b"],
    });
  });
});
