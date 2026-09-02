import * as fs from "fs";
import { createRequire } from "module";
import * as path from "path";

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, "src");
const loadCommonJsModule = createRequire(import.meta.url);
const { canonicalTokenStylePaths, protectedDesignLiteralStylePaths } =
  loadCommonJsModule(
    "../../../scripts/architecture/style-policy.cjs",
  ).createStylePolicy({ projectRoot }) as {
    canonicalTokenStylePaths: readonly string[];
    protectedDesignLiteralStylePaths: readonly string[];
  };

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(srcDir, relativePath), "utf8");
const readTokenLayers = () =>
  canonicalTokenStylePaths
    .filter((stylePath) => stylePath.includes("/styles/tokens/"))
    .map((stylePath) =>
      fs.readFileSync(path.join(projectRoot, stylePath), "utf8"),
    )
    .join("\n");

const requiredLayoutTokenDeclarations = [
  "--layout-viewport-width: var(--size-vw-100);",
  "--layout-viewport-height: var(--size-vh-100);",
  "--layout-page-max-width: var(--size-px-1120);",
  "--layout-page-full-max-width: var(--size-px-1760);",
  "--layout-page-wide-max-width: var(--size-px-1400);",
  "--layout-page-content-max-width: var(--size-px-1200);",
  "--layout-page-narrow-max-width: var(--size-px-800);",
  "--layout-page-padding-x: var(--space-6);",
  "--layout-header-desktop-height: var(--size-px-80);",
  "--layout-header-mobile-height: var(--size-px-130);",
  "--layout-search-header-mobile-height: var(--size-px-80);",
  "--layout-search-header-divider-height: var(--size-px-1);",
  "--layout-search-bottom-sheet-peek-height: var(--size-px-72);",
  "--layout-edit-header-height: var(--size-px-89);",
  "--layout-modal-max-height: var(--size-vh-90);",
  "--layout-search-mobile-popover-top: var(--size-px-130);",
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

const requiredAirbobFoundationDeclarations = [
  "--color-brand-identity: var(--palette-sky-400);",
  "--color-brand-ink: var(--palette-ink-900);",
  "--color-action-primary: var(--palette-sky-700);",
  "--color-action-primary-hover: var(--palette-sky-800);",
  "--color-action-accent: var(--palette-clay-600);",
  "--color-surface-brand-subtle: var(--palette-sky-50);",
  "--color-focus-visible: var(--palette-sky-700);",
  "--focus-ring-visible: var(--elevation-focus-visible);",
  "--radius-action: var(--radius-lg);",
  "--radius-content-card: var(--radius-xl);",
  "--radius-dialog: var(--radius-2xl);",
  "--shadow-surface: var(--elevation-1);",
  "--shadow-floating: var(--elevation-3);",
  "--shadow-sticky: var(--elevation-6);",
  "--listing-card-media-ratio: var(--ratio-landscape);",
];

describe("design system entry contracts", () => {
  it("imports the runtime font through the tracked application entry", () => {
    const indexTsx = readSource("index.tsx");

    expect(indexTsx).toContain(
      'import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";',
    );
  });

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

  it("exposes the additive Airbob identity and component-role tokens", () => {
    const tokensCss = readTokenLayers();

    requiredAirbobFoundationDeclarations.forEach((declaration) => {
      expect(tokensCss).toContain(declaration);
    });

    // Staged adoption keeps the existing routes stable until their redesign.
    expect(tokensCss).toContain(
      "--color-brand-coral: var(--palette-coral-500);",
    );
  });

  it("keeps Phase 1 primitive adoption opt-in", () => {
    const buttonCss = readSource("shared/ui/Button/Button.module.css");
    const dialogCss = readSource("shared/ui/Dialog/Dialog.module.css");
    const detailDialogCss = readSource(
      "features/accommodations/detail/components/AccommodationDescriptionModal.module.css",
    );
    const searchResultsCss = readSource(
      "features/search/components/SearchResultsList.module.css",
    );

    expect(buttonCss).toContain("background: var(--color-brand-coral);");
    expect(dialogCss).toContain("border-radius: var(--radius-lg);");
    expect(detailDialogCss).toContain("border-radius: var(--radius-dialog);");
    expect(searchResultsCss).toContain(
      "border-color: var(--color-action-primary);",
    );
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
    expect(searchPageCss).toMatch(
      /\.main\s*{[^}]*box-sizing:\s*border-box;[^}]*height:\s*calc\(100vh - var\(--layout-header-desktop-height\) - 1px\);/s,
    );
    expect(searchPageCss).toContain(
      "var(--layout-search-header-mobile-height)",
    );
    expect(searchPageCss).toContain(
      "var(--layout-search-bottom-sheet-peek-height)",
    );
    expect(searchPageCss).not.toContain(
      "100vh - var(--layout-header-mobile-height) - 60px",
    );
  });

  it("slides the expanded search map across the full-width search shell", () => {
    const searchPageCss = readSource("screens/search/SearchScreen.module.css");
    const mapRule = searchPageCss.match(/\.mapSection\s*{([^}]*)\}/)?.[1];
    const expandedLayoutRule = Array.from(
      searchPageCss.matchAll(/\.main\.mapExpanded\s*\{([^}]*)\}/g),
    ).at(-1)?.[1];
    const expandedResultsRule = Array.from(
      searchPageCss.matchAll(/\.main\.mapExpanded \.results\s*\{([^}]*)\}/g),
    ).at(-1)?.[1];
    const expandedMapRule = Array.from(
      searchPageCss.matchAll(/\.main\.mapExpanded \.mapSection\s*\{([^}]*)\}/g),
    ).at(-1)?.[1];

    expect(expandedLayoutRule).toBeDefined();
    expect(expandedLayoutRule).toContain(
      "grid-template-columns: minmax(0, 0fr) minmax(0, 1fr);",
    );
    expect(expandedLayoutRule).toContain("gap: 0;");
    expect(expandedLayoutRule).not.toContain("position: fixed;");

    expect(expandedResultsRule).toBeDefined();
    expect(expandedResultsRule).toContain("opacity: 0;");
    expect(expandedResultsRule).toContain("visibility: hidden;");
    expect(expandedResultsRule).toContain("pointer-events: none;");

    expect(expandedMapRule).toBeDefined();
    expect(expandedMapRule).toContain("width: 100%;");
    expect(mapRule).toContain("box-sizing: border-box;");
    expect(searchPageCss).toContain(
      "grid-template-columns var(--motion-duration-slow)",
    );
    expect(searchPageCss).toContain(
      ".main.mapExpanded .mapSection > *,\n.main.mapExpanded .mapSection > * > * {\n  min-height: 0;\n}",
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
