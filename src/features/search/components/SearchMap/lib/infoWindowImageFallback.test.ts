import { bindInfoWindowImageFallback } from "./infoWindowImageFallback";

const createRoot = () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <img data-info-window-image src="/room.jpg" alt="Room" />
    <div data-info-window-image-fallback hidden>이미지 없음</div>
  `;
  const image = root.querySelector<HTMLImageElement>(
    "[data-info-window-image]",
  );
  const fallback = root.querySelector<HTMLElement>(
    "[data-info-window-image-fallback]",
  );
  if (!image || !fallback) throw new Error("fixture is incomplete");
  return { fallback, image, root };
};

describe("info-window image fallback", () => {
  it("switches only the explicitly named image and fallback", () => {
    const { fallback, image, root } = createRoot();

    bindInfoWindowImageFallback(root);
    image.dispatchEvent(new Event("error"));

    expect(image.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });

  it("handles an image that failed before the SDK domready callback", () => {
    const { fallback, image, root } = createRoot();
    Object.defineProperties(image, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 0 },
    });

    bindInfoWindowImageFallback(root);

    expect(image.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
  });

  it("removes its owned listener during cleanup", () => {
    const { fallback, image, root } = createRoot();
    const cleanup = bindInfoWindowImageFallback(root);

    cleanup();
    image.dispatchEvent(new Event("error"));

    expect(image.hidden).toBe(false);
    expect(fallback.hidden).toBe(true);
  });
});
