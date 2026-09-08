import { readFileSync } from "fs";
import { join } from "path";

const readStyles = (relativePath: string) =>
  readFileSync(join(process.cwd(), "src", relativePath), "utf8");

describe("wishlist responsive and accessibility styles", () => {
  it("collapses the stay library to one column on small screens", () => {
    const css = readStyles(
      "features/wishlist/components/WishlistViews.module.css",
    );

    expect(css).toContain("@media (--viewport-tablet)");
    expect(css).toMatch(
      /@media \(--viewport-tablet\)[\s\S]*\.wishlistGrid,[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toContain("@media (--viewport-phone)");
  });

  it("keeps controls touch-sized, focus-visible, and motion-safe", () => {
    const css = readStyles(
      "features/wishlist/components/WishlistViews.module.css",
    );

    expect(css).toContain("var(--control-touch-target)");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps save and create dialogs usable at phone width", () => {
    const modalCss = readStyles(
      "features/wishlist/components/WishlistModal/WishlistModal.module.css",
    );
    const createCss = readStyles(
      "features/wishlist/components/CreateWishlistModal/CreateWishlistModal.module.css",
    );

    expect(modalCss).toContain("@media (--viewport-tablet)");
    expect(modalCss).toMatch(
      /@media \(--viewport-tablet\)[\s\S]*\.wishlistGrid[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(createCss).toContain("@media (--viewport-phone)");
    expect(createCss).toContain("var(--control-touch-target)");
    expect(createCss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
