import { resolveImageUrl } from "../platform/assets/imageUrl";
import { getImageUrl } from "./image";

describe("getImageUrl compatibility facade", () => {
  it("re-exports the platform asset boundary without a second implementation", () => {
    expect(getImageUrl).toBe(resolveImageUrl);
  });
});
