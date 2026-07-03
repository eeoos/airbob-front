import { readFileSync } from "fs";
import { join } from "path";

const srcRoot = join(process.cwd(), "src");
const readComponentCss = (relativePath: string) =>
  readFileSync(join(srcRoot, relativePath), "utf8");

describe("Wishlist modal styles", () => {
  it("does not keep legacy modal shell selectors after Dialog migration", () => {
    const migratedModalStyles = [
      "features/wishlist/components/WishlistModal/WishlistModal.module.css",
      "features/wishlist/components/CreateWishlistModal/CreateWishlistModal.module.css",
    ];
    const legacySelectors = [
      ".overlay",
      ".modal",
      ".closeButton",
      ".backButton",
      ".title",
    ];

    const offenders = migratedModalStyles.flatMap((relativePath) => {
      const css = readComponentCss(relativePath);

      return legacySelectors
        .filter((selector) => css.includes(`${selector} {`))
        .map((selector) => `${relativePath}: ${selector}`);
    });

    expect(offenders).toEqual([]);
  });
});
