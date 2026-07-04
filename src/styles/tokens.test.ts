import * as fs from "fs";
import * as path from "path";

const srcDir = path.join(process.cwd(), "src");
const tokensCssPath = path.join(srcDir, "styles", "tokens.css");
const indexCssPath = path.join(srcDir, "index.css");
const indexTsxPath = path.join(srcDir, "index.tsx");
const appTsxPath = path.join(srcDir, "App.tsx");
const staleAppCssFileName = "App.css";
const escapedStaleAppCssFileName = staleAppCssFileName.replace(".", "\\.");
const staleAppCssPath = path.join(srcDir, staleAppCssFileName);

const requiredTokenDeclarations = [
  "--color-text-primary: #222222;",
  "--color-text-secondary: #717171;",
  "--color-text-inverse: #ffffff;",
  "--color-background-page: #ffffff;",
  "--color-background-muted: #f7f7f7;",
  "--color-border-default: #dddddd;",
  "--color-border-subtle: #ebebeb;",
  "--color-border-strong: #b0b0b0;",
  "--color-brand-coral: #ff385c;",
  "--color-brand-coral-hover: #e61e4d;",
  "--color-success: #00a699;",
  "--color-danger: #c13515;",
  "--space-1: 4px;",
  "--space-2: 8px;",
  "--space-3: 12px;",
  "--space-4: 16px;",
  "--space-5: 20px;",
  "--space-6: 24px;",
  "--space-7: 28px;",
  "--space-8: 32px;",
  "--space-10: 40px;",
  "--space-12: 48px;",
  "--space-16: 64px;",
  "--control-height-sm: 32px;",
  "--control-height-md: 40px;",
  "--control-height-lg: 48px;",
  "--control-touch-target: 44px;",
  "--color-status-success-bg: #e6f7f5;",
  "--color-status-danger-bg: #ffe5e5;",
  "--color-status-warning-bg: #fff3cd;",
  "--color-status-warning-text: #856404;",
  "--motion-duration-fast: 150ms;",
  "--motion-duration-base: 200ms;",
  "--motion-duration-slow: 300ms;",
  "--motion-ease-standard: ease;",
  '--font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;',
  "--font-size-xs: 12px;",
  "--font-size-sm: 14px;",
  "--font-size-md: 16px;",
  "--font-size-lg: 18px;",
  "--font-size-xl: 22px;",
  "--font-size-2xl: 32px;",
  "--radius-sm: 4px;",
  "--radius-md: 8px;",
  "--radius-lg: 12px;",
  "--radius-pill: 999px;",
  "--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);",
  "--shadow-md: 0 2px 16px rgba(0, 0, 0, 0.18);",
  "--shadow-lg: 0 4px 24px rgba(0, 0, 0, 0.15);",
  "--focus-ring: 0 0 0 2px rgba(34, 34, 34, 0.24);",
  "--z-header: 1000;",
  "--z-sticky: 1100;",
  "--z-dropdown: 2000;",
  "--z-popover: 3000;",
  "--z-bottom-sheet: 4000;",
  "--z-modal: 5000;",
  "--z-toast: 6000;",
  "--overlay-backdrop: rgba(0, 0, 0, 0.45);",
  "--layout-mobile-safe-bottom: env(safe-area-inset-bottom, 0px);",
  "--breakpoint-tablet: 768px;",
  "--breakpoint-desktop: 1024px;",
  "--breakpoint-wide: 1400px;",
];

const forbiddenAppOverlayZIndexValues =
  "100000|99999|10001|10000|6000|5000|4000|3000|2000|1100|1000";

const legacyAppOverlayZIndexPatterns = [
  {
    name: "css-z-index",
    regex: new RegExp(
      `z-index\\s*:\\s*(?:${forbiddenAppOverlayZIndexValues})\\b(?:\\s*!important)?`,
    ),
  },
  {
    name: "react-zIndex",
    regex: new RegExp(
      `zIndex\\s*[:=]\\s*["']?(?:${forbiddenAppOverlayZIndexValues})\\b`,
    ),
  },
];

const findLegacyAppOverlayZIndexMatch = (line: string) => {
  for (const pattern of legacyAppOverlayZIndexPatterns) {
    const match = line.match(pattern.regex);

    if (match) {
      return {
        pattern: pattern.name,
        text: match[0],
      };
    }
  }

  return null;
};

const productionContractExtensions = [".css", ".ts", ".tsx"];

const isProductionContractFile = (filePath: string) => {
  const fileName = path.basename(filePath);

  return (
    productionContractExtensions.some((extension) => filePath.endsWith(extension)) &&
    !fileName.includes(".test.") &&
    fileName !== "setupTests.ts" &&
    filePath !== tokensCssPath
  );
};

const collectProductionContractFiles = (dir: string): string[] => {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectProductionContractFiles(entryPath);
    }

    if (entry.isFile() && isProductionContractFile(entryPath)) {
      return [entryPath];
    }

    return [];
  });
};

const cssPath = (relativePath: string) => path.join(srcDir, relativePath);

const readCss = (relativePath: string) => fs.readFileSync(cssPath(relativePath), "utf8");

const tokenMigrationAllowlist = new Set([
  "src/features/search/components/SearchBar/SearchBar.module.css",
]);

const newlyTokenOwnedCssFiles = [
  "layouts/AppHeader/Header.module.css",
  "layouts/AppHeader/UserMenu.module.css",
  "features/wishlist/components/WishlistViews.module.css",
  "features/auth/components/AuthModal/AuthModal.module.css",
  "features/reservations/components/ReservationModal/ReservationModal.module.css",
];

const designTokenOwnedCssFiles = [
  "features/wishlist/components/CreateWishlistModal/CreateWishlistModal.module.css",
  "features/wishlist/components/WishlistModal/WishlistModal.module.css",
  "features/reviews/components/ReviewModal/ReviewModal.module.css",
  "features/accommodations/components/AccommodationActionModal/AccommodationActionModal.module.css",
  "features/search/components/SearchAccommodationCard.module.css",
  "features/search/SearchRoute.module.css",
  "pages/Wishlist/Wishlist.module.css",
  "pages/Profile/Profile.module.css",
  "features/accommodations/AccommodationDetailRoute.module.css",
  "features/accommodations/components/AccommodationBookingCard.module.css",
  "features/accommodations/components/AccommodationHero.module.css",
  "features/accommodations/components/AccommodationReviewsSection.module.css",
  "features/accommodations/components/AccommodationDescriptionModal.module.css",
  "features/accommodations/components/AccommodationImageGalleryModal.module.css",
  ...newlyTokenOwnedCssFiles,
];

const highRiskPreRedesignCssFiles = [
  "src/pages/Reservations/ReservationDetail.module.css",
  "src/pages/Reservations/ReservationConfirm.module.css",
  "src/pages/Reservations/ReviewCreate.module.css",
  "src/pages/Profile/Profile.module.css",
  "src/features/profile/HostListingsPanel.module.css",
  "src/features/reservations/HostReservationsPanel.module.css",
  "src/features/reservations/GuestTripsPanel.module.css",
  "src/features/accommodations/edit/components/EditForm.module.css",
  "src/features/accommodations/edit/components/EditModal.module.css",
  "src/features/accommodations/edit/components/EditWizardLayout.module.css",
  "src/features/accommodations/edit/components/PhotosStep.module.css",
];

const allowedBreakpointValues = new Set([
  "480px",
  "768px",
  "769px",
  "1024px",
  "1025px",
  "1200px",
  "1400px",
]);

const forbiddenDesignLiteralPatterns = [
  {
    name: "core-color-hex",
    regex:
      /#(?:000000|222222|717171|f7f7f7|dddddd|b0b0b0|ff385c|e61e4d|ffffff)\b/i,
  },
  {
    name: "core-color-name",
    regex: /\b(?:background|background-color|color)\s*:\s*(?:white|black)\b/i,
  },
  {
    name: "core-radius",
    regex: /border-radius\s*:\s*(?:4px|8px|12px|50%)\b/i,
  },
  {
    name: "core-shadow",
    regex: /box-shadow\s*:\s*0\s+(?:1px\s+2px|4px\s+12px)\s+rgba\(0,\s*0,\s*0,\s*(?:0\.08|0\.15)\)/i,
  },
  {
    name: "card-media-ratio",
    regex: /aspect-ratio\s*:\s*1\s*\/\s*1\b/i,
  },
];

const findForbiddenDesignLiteral = (line: string) => {
  for (const pattern of forbiddenDesignLiteralPatterns) {
    if (pattern.regex.test(line)) {
      return pattern.name;
    }
  }

  return null;
};

const newlyOwnedForbiddenDesignLiteralPatterns = [
  ...forbiddenDesignLiteralPatterns,
  {
    name: "border-subtle-color-hex",
    regex: /#(?:ebebeb|e0e0e0)\b/i,
  },
  {
    name: "raw-shadow",
    regex: /box-shadow\s*:\s*(?!\s*(?:var\(|none\b))[^;]+/i,
  },
];

const findForbiddenNewlyOwnedDesignLiteral = (line: string) => {
  for (const pattern of newlyOwnedForbiddenDesignLiteralPatterns) {
    if (pattern.regex.test(line)) {
      return pattern.name;
    }
  }

  return null;
};

const findRawZIndexDeclaration = (line: string) => {
  const match = line.match(/\bz-index\s*:\s*([^;]+)/i);

  if (!match) {
    return null;
  }

  const value = match[1].trim();

  if (value.startsWith("var(")) {
    return null;
  }

  return match[0];
};

const tokenEquivalentFontSizeLiteralValues = [
  "12px",
  "14px",
  "16px",
  "18px",
  "22px",
  "32px",
];

const tokenEquivalentSpaceLiteralValues = [
  "4px",
  "8px",
  "12px",
  "16px",
  "20px",
  "24px",
  "28px",
  "32px",
  "40px",
  "48px",
  "64px",
];

const spacingDeclarationPropertyPattern =
  "padding(?:-[a-z]+)*|margin(?:-[a-z]+)*|gap|row-gap|column-gap|top|right|bottom|left|width|height";

const tokenEquivalentDeclarationRegex = new RegExp(
  `(^|[;{\\s])(${spacingDeclarationPropertyPattern}|font-size)\\s*:\\s*([^;{}]+);`,
  "gim",
);

const tokenEquivalentLengthRegex = (values: string[]) =>
  new RegExp(`\\b(?:${values.join("|")})\\b`, "i");

const findForbiddenTokenEquivalentLiteralMatches = (source: string) =>
  Array.from(source.matchAll(tokenEquivalentDeclarationRegex)).flatMap((match) => {
    const property = match[2].toLowerCase();
    const value = match[3];
    const isFontSizeDeclaration = property === "font-size";
    const tokenEquivalentValues = isFontSizeDeclaration
      ? tokenEquivalentFontSizeLiteralValues
      : tokenEquivalentSpaceLiteralValues;

    if (!tokenEquivalentLengthRegex(tokenEquivalentValues).test(value)) {
      return [];
    }

    return [
      {
        index: (match.index ?? 0) + match[1].length,
        name: isFontSizeDeclaration ? "font-size-token-literal" : "space-token-literal",
        text: `${property}: ${compactCssSnippet(value)}`,
      },
    ];
  });

const sourceLineNumberAt = (source: string, offset: number) =>
  source.slice(0, offset).split(/\r?\n/).length;

const compactCssSnippet = (snippet: string) => snippet.replace(/\s+/g, " ").trim();

const findTransitionAllMatches = (source: string) =>
  Array.from(source.matchAll(/\btransition\s*:\s*all\b/gi)).map((match) => ({
    index: match.index ?? 0,
    text: compactCssSnippet(match[0]),
  }));

const normalizeSelector = (selector: string) => selector.trim().replace(/\s+/g, " ");

const cssRuleBlocks = (source: string) =>
  Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .map((match) => {
      const selectorText = match[1].trim();

      return {
        selectorText,
        selectors: selectorText.split(",").map(normalizeSelector).filter(Boolean),
        declarations: match[2],
        lineNumber: sourceLineNumberAt(source, match.index ?? 0),
      };
    })
    .filter((block) => block.selectors.length > 0 && !block.selectorText.startsWith("@"));

const focusVisibleSelectorFor = (selector: string) =>
  selector.includes(":focus-visible") ? selector : `${selector}:focus-visible`;

const collectOutlineResetOffenders = (relativePath: string, source: string) => {
  const blocks = cssRuleBlocks(source);
  const focusVisibleSelectors = new Set(
    blocks.flatMap((block) => block.selectors.filter((selector) => selector.includes(":focus-visible"))),
  );

  return blocks.flatMap((block) => {
    if (!/\boutline\s*:\s*none\b/i.test(block.declarations)) {
      return [];
    }

    return block.selectors.flatMap((selector) => {
      if (focusVisibleSelectors.has(focusVisibleSelectorFor(selector))) {
        return [];
      }

      return `${relativePath}:${block.lineNumber}: ${selector} requires ${focusVisibleSelectorFor(selector)}`;
    });
  });
};

const collectNewlyOwnedCssLineOffenders = (
  findOffender: (line: string, index: number, lines: string[]) => string | null,
) =>
  newlyTokenOwnedCssFiles.flatMap((relativePath) => {
    const lines = readCss(relativePath).split(/\r?\n/);

    return lines.flatMap((line, index) => {
      const offender = findOffender(line, index, lines);

      if (!offender) {
        return [];
      }

      return `${relativePath}:${index + 1}: ${offender}`;
    });
  });

const collectNewlyOwnedCssSourceOffenders = (
  findOffenders: (relativePath: string, source: string) => string[],
) =>
  newlyTokenOwnedCssFiles.flatMap((relativePath) =>
    findOffenders(relativePath, readCss(relativePath)),
  );

const readProjectCss = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const collectHighRiskPreRedesignCssLineOffenders = (
  findOffender: (line: string, index: number, lines: string[]) => string | null,
) =>
  highRiskPreRedesignCssFiles.flatMap((relativePath) => {
    const lines = readProjectCss(relativePath).split(/\r?\n/);

    return lines.flatMap((line, index) => {
      const offender = findOffender(line, index, lines);

      if (!offender) {
        return [];
      }

      return `${relativePath}:${index + 1}: ${offender}`;
    });
  });

const selectorBlock = (css: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));

  if (!match) {
    throw new Error(`Missing selector block: ${selector}`);
  }

  return match[0];
};

const expectDeclaration = (block: string, declaration: string) => {
  expect(block.replace(/\s+/g, " ")).toContain(declaration);
};

const overlaySelector = ".overlay";

describe("pre-design token stylesheet contract", () => {
  it("exposes global tokens and imports them before other global styles", () => {
    expect(fs.existsSync(tokensCssPath)).toBe(true);

    const tokensCss = fs.readFileSync(tokensCssPath, "utf8");
    const indexCss = fs.readFileSync(indexCssPath, "utf8");

    expect(indexCss.startsWith('@import "./styles/tokens.css";')).toBe(true);

    expect(tokensCss.trim().startsWith(":root {")).toBe(true);
    expect(tokensCss.trim().endsWith("}")).toBe(true);

    requiredTokenDeclarations.forEach((declaration) => {
      expect(tokensCss).toContain(declaration);
    });

    expect(indexCss).toMatch(/body\s*\{[\s\S]*font-family:\s*var\(--font-family-base\);/);
  });

  it("keeps global styles sourced from index.css and tokens.css", () => {
    const appSource = fs.readFileSync(appTsxPath, "utf8");
    const indexSource = fs.readFileSync(indexTsxPath, "utf8");
    const indexCss = fs.readFileSync(indexCssPath, "utf8");

    expect(fs.existsSync(staleAppCssPath)).toBe(false);
    expect(appSource).not.toMatch(new RegExp(escapedStaleAppCssFileName));
    expect(appSource).not.toMatch(
      new RegExp(`import\\s+["']\\.\\/${escapedStaleAppCssFileName}["'];?`),
    );
    expect(indexSource).toMatch(/import\s+["']\.\/index\.css["'];/);
    expect(indexCss.startsWith('@import "./styles/tokens.css";')).toBe(true);
  });

  it("keeps legacy app-level overlay z-index literals out of production source files", () => {
    const offenders = collectProductionContractFiles(srcDir)
      .flatMap((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");

        return source.split(/\r?\n/).flatMap((line, index) => {
          const match = findLegacyAppOverlayZIndexMatch(line);

          if (!match) {
            return [];
          }

          return `${path.relative(process.cwd(), filePath)}:${index + 1}: [${match.pattern}] ${match.text}`;
        });
      });

    expect(offenders).toEqual([]);
  });

  it("matches legacy overlay z-index literals in CSS and React style forms", () => {
    expect(findLegacyAppOverlayZIndexMatch("z-index: 1000;")).toMatchObject({
      pattern: "css-z-index",
      text: "z-index: 1000",
    });
    expect(findLegacyAppOverlayZIndexMatch("z-index: 100000 !important;")).toMatchObject({
      pattern: "css-z-index",
      text: "z-index: 100000 !important",
    });
    expect(findLegacyAppOverlayZIndexMatch("style={{ zIndex: 1000 }}")).toMatchObject({
      pattern: "react-zIndex",
      text: "zIndex: 1000",
    });
    expect(findLegacyAppOverlayZIndexMatch("{ zIndex: '99999' }")).toMatchObject({
      pattern: "react-zIndex",
      text: "zIndex: '99999",
    });
    expect(findLegacyAppOverlayZIndexMatch("zIndex = \"10000\"")).toMatchObject({
      pattern: "react-zIndex",
      text: 'zIndex = "10000',
    });
    expect(findLegacyAppOverlayZIndexMatch("z-index: 5000;")).toMatchObject({
      pattern: "css-z-index",
      text: "z-index: 5000",
    });
    expect(findLegacyAppOverlayZIndexMatch('zIndex: "var(--z-popover)"')).toBeNull();
  });

  it("keeps app toast containers on the toast z-index token", () => {
    const toastContainerFiles = collectProductionContractFiles(srcDir).filter(
      (filePath) =>
        filePath.endsWith(".css") &&
        fs.readFileSync(filePath, "utf8").includes(".toastContainer")
    );

    expect(toastContainerFiles.length).toBeGreaterThan(0);

    toastContainerFiles.forEach((filePath) => {
      const block = selectorBlock(
        fs.readFileSync(filePath, "utf8"),
        ".toastContainer"
      );
      expectDeclaration(block, "z-index: var(--z-toast);");
    });
  });

  it("keeps real modal backdrops and foreground controls on overlay tokens", () => {
    const dialogCss = readCss("shared/ui/Dialog/Dialog.module.css");
    const galleryCss = readCss(
      "features/accommodations/components/AccommodationImageGalleryModal.module.css",
    );
    const dialogOverlay = selectorBlock(dialogCss, overlaySelector);
    const galleryClose = selectorBlock(galleryCss, ".galleryClose");

    expectDeclaration(dialogOverlay, "background: var(--overlay-backdrop);");
    expectDeclaration(dialogOverlay, "z-index: var(--z-modal);");
    expectDeclaration(galleryClose, "z-index: 1;");
  });

  it("keeps date picker overlays on the dropdown z-index token", () => {
    const accommodationBookingCardCss = readCss(
      "features/accommodations/components/AccommodationBookingCard.module.css",
    );

    expect(accommodationBookingCardCss).toMatch(
      /\.datePickerContainer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*var\(--layout-search-mobile-popover-top\);[\s\S]*?z-index:\s*var\(--z-dropdown\);/,
    );
  });

  it("keeps design-owned component CSS on color, radius, and shadow tokens", () => {
    const offenders = designTokenOwnedCssFiles.flatMap((relativePath) => {
      const source = readCss(relativePath);

      return source.split(/\r?\n/).flatMap((line, index) => {
        const patternName = findForbiddenDesignLiteral(line);

        if (!patternName) {
          return [];
        }

        return `${relativePath}:${index + 1}: [${patternName}] ${line.trim()}`;
      });
    });

    expect(offenders).toEqual([]);
  });

  it("keeps newly token-owned CSS files enrolled in design token ownership", () => {
    newlyTokenOwnedCssFiles.forEach((relativePath) => {
      expect(designTokenOwnedCssFiles).toContain(relativePath);
    });
  });

  it("keeps newly token-owned CSS off transition-all declarations", () => {
    const offenders = collectNewlyOwnedCssSourceOffenders((relativePath, source) =>
      findTransitionAllMatches(source).map(
        (match) =>
          `${relativePath}:${sourceLineNumberAt(source, match.index)}: ${match.text}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("matches multiline transition-all declarations", () => {
    expect(findTransitionAllMatches("transition:\n  all 200ms ease;")).toEqual([
      {
        index: 0,
        text: "transition: all",
      },
    ]);
  });

  it("keeps newly token-owned CSS z-index declarations on tokens", () => {
    const offenders = collectNewlyOwnedCssLineOffenders((line) =>
      findRawZIndexDeclaration(line),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps high-risk pre-redesign CSS off core design literals and raw z-index declarations", () => {
    const offenders = collectHighRiskPreRedesignCssLineOffenders((line) => {
      const patternName = findForbiddenDesignLiteral(line);
      const rawZIndex = findRawZIndexDeclaration(line);

      if (patternName) {
        return `[${patternName}] ${line.trim()}`;
      }

      return rawZIndex;
    });

    expect(offenders).toEqual([]);
  });

  it("keeps newly token-owned CSS outline resets paired with focus-visible styles", () => {
    const offenders = collectNewlyOwnedCssSourceOffenders((relativePath, source) =>
      collectOutlineResetOffenders(relativePath, source),
    );

    expect(offenders).toEqual([]);
  });

  it("matches outline resets only to the same focus-visible selector", () => {
    expect(
      collectOutlineResetOffenders(
        "test.css",
        ".field { outline: none; }\n.other:focus-visible { box-shadow: var(--focus-ring); }",
      ),
    ).toEqual(["test.css:1: .field requires .field:focus-visible"]);

    expect(
      collectOutlineResetOffenders(
        "test.css",
        ".field { outline: none; }\n.field:focus-visible { box-shadow: var(--focus-ring); }",
      ),
    ).toEqual([]);

    expect(
      collectOutlineResetOffenders(
        "test.css",
        ".field:focus-visible { outline: none; box-shadow: var(--focus-ring); }",
      ),
    ).toEqual([]);
  });

  it("keeps newly token-owned CSS free of important overrides", () => {
    const offenders = collectNewlyOwnedCssLineOffenders((line) =>
      line.includes("!important") ? line.trim() : null,
    );

    expect(offenders).toEqual([]);
  });

  it("keeps newly token-owned CSS on color, radius, and shadow tokens", () => {
    const offenders = collectNewlyOwnedCssLineOffenders((line) => {
      const patternName = findForbiddenNewlyOwnedDesignLiteral(line);

      return patternName ? `[${patternName}] ${line.trim()}` : null;
    });

    expect(offenders).toEqual([]);
  });

  it("keeps newly token-owned CSS off token-equivalent spacing and font literals", () => {
    const offenders = collectNewlyOwnedCssSourceOffenders((relativePath, source) =>
      findForbiddenTokenEquivalentLiteralMatches(source).map(
        (match) =>
          `${relativePath}:${sourceLineNumberAt(source, match.index)}: [${match.name}] ${match.text}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("matches token-equivalent lengths inside multi-value spacing declarations", () => {
    const matches = findForbiddenTokenEquivalentLiteralMatches(
      ".box { padding: 0 8px; margin: 0 0 4px; }",
    ).map(({ name, text }) => ({ name, text }));

    expect(matches).toEqual([
      {
        name: "space-token-literal",
        text: "padding: 0 8px",
      },
      {
        name: "space-token-literal",
        text: "margin: 0 0 4px",
      },
    ]);
  });

  it("keeps the token migration allowlist explicit", () => {
    const cleanedModalCssFiles = [
      "features/auth/components/AuthModal/AuthModal.module.css",
      "features/reservations/components/ReservationModal/ReservationModal.module.css",
    ];

    expect(Array.from(tokenMigrationAllowlist)).toEqual([
      "src/features/search/components/SearchBar/SearchBar.module.css",
    ]);
    expect(designTokenOwnedCssFiles).toContain(
      "features/search/components/SearchAccommodationCard.module.css",
    );

    cleanedModalCssFiles.forEach((relativePath) => {
      expect(tokenMigrationAllowlist.has(`src/${relativePath}`)).toBe(false);
      expect(newlyTokenOwnedCssFiles).toContain(relativePath);
      expect(designTokenOwnedCssFiles).toContain(relativePath);
    });

    tokenMigrationAllowlist.forEach((relativePath) => {
      const sourcePath = path.join(process.cwd(), relativePath);
      expect(fs.existsSync(sourcePath)).toBe(true);

      const source = fs.readFileSync(sourcePath, "utf8");
      const hasLegacyDesignLiteral = source
        .split(/\r?\n/)
        .some((line) => findForbiddenDesignLiteral(line));

      expect(hasLegacyDesignLiteral).toBe(true);
    });
  });

  it("keeps media query breakpoints on the agreed pre-design scale", () => {
    const offenders = collectProductionContractFiles(srcDir)
      .filter((filePath) => filePath.endsWith(".css"))
      .flatMap((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");

        return source.split(/\r?\n/).flatMap((line, index) => {
          const matches = Array.from(line.matchAll(/@media[^{]*?(\d+px)/g));

          return matches
            .filter((match) => !allowedBreakpointValues.has(match[1]))
            .map(
              (match) =>
                `${path.relative(process.cwd(), filePath)}:${index + 1}: ${match[1]}`
            );
        });
      });

    expect(offenders).toEqual([]);
  });

  it("keeps local z-index literals out of high-impact design-owned CSS", () => {
    const offenders = designTokenOwnedCssFiles.flatMap((relativePath) => {
      const source = readCss(relativePath);

      return source.split(/\r?\n/).flatMap((line, index) => {
        const match = line.match(/z-index\s*:\s*(?:10|100)\b/);

        if (!match) {
          return [];
        }

        return `${relativePath}:${index + 1}: ${match[0]}`;
      });
    });

    expect(offenders).toEqual([]);
  });
});
