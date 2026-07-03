import { readFileSync } from "fs";
import { join } from "path";

const readComponentCss = (relativePath: string) =>
  readFileSync(join(process.cwd(), "src/components", relativePath), "utf8");

describe("Wishlist modal styles", () => {
  it("does not keep legacy modal shell selectors after Dialog migration", () => {
    const migratedModalStyles = [
      "WishlistModal/WishlistModal.module.css",
      "CreateWishlistModal/CreateWishlistModal.module.css",
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
