import * as fs from "fs";
import * as path from "path";

const srcDir = path.join(process.cwd(), "src");

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(srcDir, relativePath), "utf8");

const requiredLayoutTokenDeclarations = [
  "--layout-viewport-width: 100vw;",
  "--layout-viewport-height: 100vh;",
  "--layout-page-max-width: 1120px;",
  "--layout-page-padding-x: 24px;",
  "--layout-header-desktop-height: 80px;",
  "--layout-header-mobile-height: 130px;",
  "--layout-edit-header-height: 89px;",
  "--layout-modal-max-height: 90vh;",
  "--layout-search-mobile-popover-top: var(--layout-header-mobile-height);",
  "--layout-search-mobile-bottom-sheet-offset: 144px;",
  "--card-media-ratio: 1 / 1;",
];

const requiredInteractionTokenDeclarations = [
  "--space-7: 28px;",
  "--space-12: 48px;",
  "--space-16: 64px;",
  "--control-touch-target: 44px;",
  "--focus-ring: 0 0 0 2px rgba(34, 34, 34, 0.24);",
  "--shadow-control: 0 2px 8px rgba(0, 0, 0, 0.15);",
  "--shadow-card: 0 2px 16px rgba(0, 0, 0, 0.12);",
  "--shadow-modal: 0 4px 16px rgba(0, 0, 0, 0.15);",
  "--color-status-warning-bg: #fff3cd;",
  "--color-status-warning-text: #856404;",
  "--overlay-scrim-strong: rgba(0, 0, 0, 0.7);",
  "--overlay-surface-strong: rgba(255, 255, 255, 0.9);",
  "--overlay-surface-muted: rgba(255, 255, 255, 0.5);",
  "--z-local-base: 0;",
  "--z-local-raised: 1;",
  "--z-local-overlay: 2;",
  "--motion-duration-slow: 300ms;",
  "--layout-mobile-safe-bottom: env(safe-area-inset-bottom, 0px);",
];

describe("design system entry contracts", () => {
  it("exposes layout and media tokens from the global token entrypoint", () => {
    const tokensCss = readSource("styles/tokens.css");

    requiredLayoutTokenDeclarations.forEach((declaration) => {
      expect(tokensCss).toContain(declaration);
    });
  });

  it("exposes interaction, warning, and safe-area tokens from the global token entrypoint", () => {
    const tokensCss = readSource("styles/tokens.css");

    requiredInteractionTokenDeclarations.forEach((declaration) => {
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
    const searchPageCss = readSource("features/search/SearchRoute.module.css");

    expect(searchPageCss).toContain("var(--layout-header-desktop-height)");
    expect(searchPageCss).toContain("var(--layout-search-mobile-bottom-sheet-offset)");
    expect(searchPageCss).not.toContain(
      "100vh - var(--layout-header-mobile-height) - 60px",
    );
  });
});
