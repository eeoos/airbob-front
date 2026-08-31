import * as fs from "fs";
import { createRequire } from "module";
import * as path from "path";

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, "src");
const loadCommonJsModule = createRequire(import.meta.url);
const { canonicalTokenStylePaths, protectedDesignLiteralStylePaths } = loadCommonJsModule(
  "../../../scripts/architecture/style-policy.cjs"
).createStylePolicy({ projectRoot }) as {
  canonicalTokenStylePaths: readonly string[];
  protectedDesignLiteralStylePaths: readonly string[];
};

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(srcDir, relativePath), "utf8");
const readTokenLayers = () =>
  canonicalTokenStylePaths
    .filter((stylePath) => stylePath.includes("/styles/tokens/"))
    .map((stylePath) => fs.readFileSync(path.join(projectRoot, stylePath), "utf8"))
    .join("\n");

const requiredLayoutTokenDeclarations = [
  "--layout-viewport-width: var(--size-vw-100);",
  "--layout-viewport-height: var(--size-vh-100);",
  "--layout-page-max-width: var(--size-px-1120);",
  "--layout-page-padding-x: var(--space-6);",
  "--layout-header-desktop-height: var(--size-px-80);",
  "--layout-header-mobile-height: var(--size-px-130);",
  "--layout-edit-header-height: var(--size-px-89);",
  "--layout-modal-max-height: var(--size-vh-90);",
  "--layout-search-mobile-popover-top: var(--size-px-130);",
  "--layout-search-mobile-bottom-sheet-offset: var(--size-px-144);",
  "--card-media-ratio: var(--ratio-square);",
];

const requiredInteractionTokenDeclarations = [
  "--space-7: 28px;",
  "--space-12: 48px;",
  "--space-16: 64px;",
  "--control-touch-target: var(--space-11);",
  "--focus-ring: var(--elevation-8);",
  "--shadow-control: var(--elevation-2);",
  "--shadow-card: var(--elevation-3);",
  "--shadow-modal: var(--elevation-5);",
  "--shadow-bottom-sheet: var(--elevation-7);",
  "--radius-xs: 2px;",
  "--radius-xl: 16px;",
  "--radius-2xl: 24px;",
  "--color-status-warning-bg: var(--palette-amber-50);",
  "--color-status-warning-text: var(--palette-amber-800);",
  "--overlay-scrim-strong: var(--palette-black-a70);",
  "--overlay-surface-strong: var(--palette-white-a90);",
  "--overlay-surface-muted: var(--palette-white-a50);",
  "--z-dropdown-raised: var(--stack-2001);",
  "--z-local-base: var(--stack-0);",
  "--z-local-raised: var(--stack-1);",
  "--z-local-overlay: var(--stack-2);",
  "--motion-duration-slow: 300ms;",
  "--layout-mobile-safe-bottom: var(--environment-safe-area-bottom);",
];

describe("design system entry contracts", () => {
  it("exposes layout and media tokens from the global token entrypoint", () => {
    const tokensCss = readTokenLayers();

    requiredLayoutTokenDeclarations.forEach((declaration) => {
      expect(tokensCss).toContain(declaration);
    });
  });

  it("exposes interaction, warning, and safe-area tokens from the global token entrypoint", () => {
    const tokensCss = readTokenLayers();

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
    const searchPageCss = readSource("screens/search/SearchScreen.module.css");

    expect(searchPageCss).toContain("var(--layout-header-desktop-height)");
    expect(searchPageCss).toContain("var(--layout-search-mobile-bottom-sheet-offset)");
    expect(searchPageCss).not.toContain(
      "100vh - var(--layout-header-mobile-height) - 60px",
    );
  });

  it("keeps search map DOM helper styling behind named token constants", () => {
    const infoWindowSource = readSource(
      "features/search/components/SearchMap/lib/infoWindowContent.ts",
    );
    const expandControlSource = readSource(
      "features/search/components/SearchMap/lib/mapExpandControl.ts",
    );

    expect(infoWindowSource).toContain("INFO_WINDOW_STYLE_TOKENS");
    expect(infoWindowSource).toContain("cardWidth");
    expect(infoWindowSource).toContain("buttonWishlistSize");
    const templatePrefix = "$";
    expect(infoWindowSource).toContain(
      `${templatePrefix}{INFO_WINDOW_STYLE_TOKENS.cardWidth}`,
    );
    expect(infoWindowSource).not.toContain("const INFO_WINDOW_TOKENS");

    expect(expandControlSource).toContain("MAP_EXPAND_CONTROL_STYLE_TOKENS");
    expect(expandControlSource).toContain("iconSize");
    expect(expandControlSource).toContain("backgroundHover");
    expect(expandControlSource).toContain(
      "MAP_EXPAND_CONTROL_STYLE_TOKENS.backgroundHover",
    );
  });

  it("keeps task 5 route and boundary CSS enrolled in token ownership", () => {
    [
      "shared/ui/DatePicker/DatePicker.module.css",
      "app/errors/ErrorBoundary.module.css",
      "screens/reservation-confirm/ReservationConfirmScreen.module.css",
      "screens/payment-result/PaymentResultScreen.module.css",
      "screens/search/SearchScreen.module.css",
      "features/search/components/SearchAccommodationCard.module.css",
    ].forEach((relativePath) => {
      expect(protectedDesignLiteralStylePaths).toContain(`src/${relativePath}`);
    });
  });
});
