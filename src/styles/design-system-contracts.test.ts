import * as fs from "fs";
import * as path from "path";

const srcDir = path.join(process.cwd(), "src");

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(srcDir, relativePath), "utf8");

const requiredLayoutTokenDeclarations = [
  "--layout-page-max-width: 1120px;",
  "--layout-page-padding-x: 24px;",
  "--layout-header-desktop-height: 80px;",
  "--layout-header-mobile-height: 130px;",
  "--layout-search-mobile-popover-top: var(--layout-header-mobile-height);",
  "--layout-search-mobile-bottom-sheet-offset: 144px;",
  "--card-media-ratio: 1 / 1;",
];

describe("design system entry contracts", () => {
  it("exposes layout and media tokens from the global token entrypoint", () => {
    const tokensCss = readSource("styles/tokens.css");

    requiredLayoutTokenDeclarations.forEach((declaration) => {
      expect(tokensCss).toContain(declaration);
    });
  });

  it("uses the mobile search popover offset token for search overlays", () => {
    const searchBarCss = readSource(
      "features/search/components/SearchBar/SearchBar.module.css",
    );

    expect(searchBarCss).not.toContain("top: 130px");
    expect(searchBarCss).toContain("var(--layout-search-mobile-popover-top)");
  });

  it("uses header height tokens for search page viewport math", () => {
    const searchPageCss = readSource("pages/Search/Search.module.css");

    expect(searchPageCss).toContain("var(--layout-header-desktop-height)");
    expect(searchPageCss).toContain("var(--layout-search-mobile-bottom-sheet-offset)");
    expect(searchPageCss).not.toContain(
      "100vh - var(--layout-header-mobile-height) - 60px",
    );
  });
});
