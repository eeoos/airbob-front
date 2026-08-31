import * as fs from "fs";
import { createRequire } from "module";
import * as path from "path";
import { createRequireDefined } from "../../test/assertions";

// Resolve contracts from the repository root, independent of test placement.
const projectRoot = process.cwd();
const loadCommonJsModule = createRequire(import.meta.url);
const {
  canonicalTokenStylePaths,
  derivedTokenStylePaths,
  highRiskPreRedesignStylePaths,
  isStrictStylePath,
  legacyDesignProtectedStylePaths,
  primitiveTokenStylePaths,
  tokenLayerPolicies,
} = loadCommonJsModule(path.join(
  projectRoot,
  "scripts/architecture/style-policy.cjs",
)).createStylePolicy({ projectRoot }) as {
  canonicalTokenStylePaths: readonly string[];
  derivedTokenStylePaths: readonly string[];
  highRiskPreRedesignStylePaths: readonly string[];
  isStrictStylePath: (filePath: string) => boolean;
  legacyDesignProtectedStylePaths: readonly string[];
  primitiveTokenStylePaths: readonly string[];
  tokenLayerPolicies: readonly {
    readonly name: TokenLayerName;
    readonly path: string;
    readonly tokenNames: readonly string[];
  }[];
};
const srcDir = path.join(projectRoot, "src");
const requireDesignTokenFixtureValue = createRequireDefined(
  (description) =>
    `Missing required design-token fixture value: ${description}`,
);
const tokenCssPaths = canonicalTokenStylePaths
  .filter((stylePath) => stylePath.includes("/styles/tokens/"))
  .map((stylePath) => path.join(projectRoot, stylePath));
const canonicalTokenCssPaths = new Set(
  canonicalTokenStylePaths.map((stylePath) => path.join(projectRoot, stylePath)),
);
const tokenIndexCssPath = path.join(
  srcDir,
  "shared",
  "styles",
  "tokens",
  "index.css",
);
const globalsCssPath = path.join(srcDir, "shared", "styles", "globals.css");
const staleTokensCssPath = path.join(srcDir, "styles", "tokens.css");
const indexCssPath = path.join(srcDir, "index.css");
const indexTsxPath = path.join(srcDir, "index.tsx");
const appTsxPath = path.join(srcDir, "App.tsx");
const staleAppCssFileName = "App.css";
const escapedStaleAppCssFileName = staleAppCssFileName.replace(".", "\\.");
const staleAppCssPath = path.join(srcDir, staleAppCssFileName);

const expectedPublicTokenValues: Readonly<Record<string, string>> = {
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "20px",
  "--space-6": "24px",
  "--space-7": "28px",
  "--space-8": "32px",
  "--space-10": "40px",
  "--space-12": "48px",
  "--space-16": "64px",
  "--motion-duration-fast": "150ms",
  "--motion-duration-base": "200ms",
  "--motion-duration-slow": "300ms",
  "--motion-ease-standard": "ease",
  "--font-family-base":
    '-apple-system, blinkmacsystemfont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  "--font-size-xs": "12px",
  "--font-size-sm": "14px",
  "--font-size-md": "16px",
  "--font-size-lg": "18px",
  "--font-size-xl": "22px",
  "--font-size-2xl": "32px",
  "--radius-xs": "2px",
  "--radius-sm": "4px",
  "--radius-control": "6px",
  "--radius-md": "8px",
  "--radius-lg": "12px",
  "--radius-xl": "16px",
  "--radius-2xl": "24px",
  "--radius-pill": "999px",
  "--shadow-sm": "0 1px 2px rgb(0 0 0 / 8%)",
  "--shadow-md": "0 2px 16px rgb(0 0 0 / 18%)",
  "--shadow-lg": "0 4px 24px rgb(0 0 0 / 15%)",
  "--breakpoint-tablet": "768px",
  "--breakpoint-desktop": "1024px",
  "--breakpoint-wide": "1400px",
  "--color-text-primary": "#222",
  "--color-text-secondary": "#717171",
  "--color-text-inverse": "#fff",
  "--color-text-strong": "#000",
  "--color-background-page": "#fff",
  "--color-background-muted": "#f7f7f7",
  "--color-background-hover": "#f0f0f0",
  "--color-border-default": "#ddd",
  "--color-border-subtle": "#ebebeb",
  "--color-border-strong": "#b0b0b0",
  "--color-brand-coral": "#ff385c",
  "--color-brand-coral-gradient-end": "#ff5a7f",
  "--color-brand-coral-hover": "#e61e4d",
  "--color-success": "#00a699",
  "--color-success-hover": "#008489",
  "--color-danger": "#c13515",
  "--color-status-success-bg": "#e6f7f5",
  "--color-status-danger-bg": "#ffe5e5",
  "--color-status-warning-bg": "#fff3cd",
  "--color-status-warning-text": "#856404",
  "--color-scrollbar-track": "#f1f1f1",
  "--color-scrollbar-thumb": "#888",
  "--color-scrollbar-thumb-hover": "#555",
  "--focus-ring": "0 0 0 2px rgb(34 34 34 / 24%)",
  "--z-header": "1000",
  "--z-sticky": "1100",
  "--z-dropdown": "2000",
  "--z-dropdown-raised": "2001",
  "--z-popover": "3000",
  "--z-bottom-sheet": "4000",
  "--z-modal": "5000",
  "--z-toast": "6000",
  "--z-local-base": "0",
  "--z-local-raised": "1",
  "--z-local-overlay": "2",
  "--overlay-backdrop": "rgb(0 0 0 / 45%)",
  "--overlay-scrim-strong": "rgb(0 0 0 / 70%)",
  "--overlay-surface-strong": "rgb(255 255 255 / 90%)",
  "--overlay-surface-muted": "rgb(255 255 255 / 50%)",
  "--control-height-sm": "32px",
  "--control-height-md": "40px",
  "--control-height-lg": "48px",
  "--control-touch-target": "44px",
  "--shadow-control": "0 2px 8px rgb(0 0 0 / 15%)",
  "--shadow-card": "0 2px 16px rgb(0 0 0 / 12%)",
  "--shadow-modal": "0 4px 16px rgb(0 0 0 / 15%)",
  "--shadow-bottom-sheet": "0 -4px 24px rgb(0 0 0 / 15%)",
  "--layout-viewport-width": "100vw",
  "--layout-viewport-height": "100vh",
  "--layout-page-max-width": "1120px",
  "--layout-page-padding-x": "24px",
  "--layout-header-desktop-height": "80px",
  "--layout-header-mobile-height": "130px",
  "--layout-edit-header-height": "89px",
  "--layout-modal-max-height": "90vh",
  "--layout-search-mobile-popover-top": "130px",
  "--layout-search-mobile-bottom-sheet-offset": "144px",
  "--layout-mobile-safe-bottom": "env(safe-area-inset-bottom, 0px)",
  "--card-media-ratio": "1 / 1",
};

type TokenLayerName = "primitive" | "semantic" | "components";
type TokenDeclaration = {
  readonly name: string;
  readonly order: number;
  readonly value: string;
};
type TokenLayer = {
  readonly declarations: readonly TokenDeclaration[];
  readonly name: TokenLayerName;
  readonly path: string;
  readonly rank: number;
};

const parseTokenDeclarations = (source: string): readonly TokenDeclaration[] =>
  Array.from(
    source.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm),
    (match, order) => {
      const name = requireDesignTokenFixtureValue(
        match[1],
        "token declaration name",
      );
      const value = requireDesignTokenFixtureValue(
        match[2],
        `${name} declaration value`,
      );

      return { name, order, value: value.trim() };
    },
  );

const primitiveTokenStylePath = requireDesignTokenFixtureValue(
  primitiveTokenStylePaths[0],
  "primitive token stylesheet path",
);

const tokenLayers: readonly TokenLayer[] = [
  {
    declarations: parseTokenDeclarations(
      fs.readFileSync(path.join(projectRoot, primitiveTokenStylePath), "utf8"),
    ),
    name: "primitive",
    path: primitiveTokenStylePath,
    rank: 0,
  },
  ...derivedTokenStylePaths.map((stylePath, index) => ({
    declarations: parseTokenDeclarations(
      fs.readFileSync(path.join(projectRoot, stylePath), "utf8"),
    ),
    name: (index === 0 ? "semantic" : "components") as TokenLayerName,
    path: stylePath,
    rank: index + 1,
  })),
];
const tokenOwnerByName = new Map(
  tokenLayers.flatMap((layer) =>
    layer.declarations.map((declaration) => [
      declaration.name,
      { declaration, layer },
    ] as const),
  ),
);
const tokenReferencePattern = /var\(\s*(--[a-z0-9-]+)\s*\)/g;
const tokenReferences = (value: string) =>
  Array.from(value.matchAll(tokenReferencePattern), (match) =>
    requireDesignTokenFixtureValue(match[1], "token reference"),
  );
const resolveTokenValue = (name: string, ancestry: readonly string[] = []): string => {
  if (ancestry.includes(name)) {
    throw new Error(`Circular design token reference: ${[...ancestry, name].join(" -> ")}`);
  }

  const owner = tokenOwnerByName.get(name);

  if (!owner) {
    throw new Error(`Unknown design token reference: ${name}`);
  }

  return owner.declaration.value.replace(
    tokenReferencePattern,
    (_match, reference: string) =>
      resolveTokenValue(reference, [...ancestry, name]),
  );
};

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
        text: requireDesignTokenFixtureValue(
          match[0],
          `${pattern.name} match`,
        ),
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
    !canonicalTokenCssPaths.has(filePath)
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

const productionContractFiles = collectProductionContractFiles(srcDir);
const productionCssFiles = productionContractFiles.filter((filePath) =>
  filePath.endsWith(".css")
);
const strictTokenOwnedCssFiles = productionCssFiles
  .filter((filePath) => isStrictStylePath(filePath))
  .map((filePath) => path.relative(srcDir, filePath));

const cssPath = (relativePath: string) => path.join(srcDir, relativePath);

const readCss = (relativePath: string) => fs.readFileSync(cssPath(relativePath), "utf8");

const findRawZIndexDeclaration = (line: string) => {
  const match = line.match(/\bz-index\s*:\s*([^;]+)/i);

  if (!match) {
    return null;
  }

  const value = requireDesignTokenFixtureValue(
    match[1],
    "z-index value",
  ).trim();

  if (value.startsWith("var(")) {
    return null;
  }

  return requireDesignTokenFixtureValue(match[0], "z-index declaration");
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
    const prefix = requireDesignTokenFixtureValue(
      match[1],
      "token literal prefix",
    );
    const property = requireDesignTokenFixtureValue(
      match[2],
      "token literal property",
    ).toLowerCase();
    const value = requireDesignTokenFixtureValue(
      match[3],
      `${property} literal value`,
    );
    const isFontSizeDeclaration = property === "font-size";
    const tokenEquivalentValues = isFontSizeDeclaration
      ? tokenEquivalentFontSizeLiteralValues
      : tokenEquivalentSpaceLiteralValues;

    if (!tokenEquivalentLengthRegex(tokenEquivalentValues).test(value)) {
      return [];
    }

    return [
      {
        index: (match.index ?? 0) + prefix.length,
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
    text: compactCssSnippet(
      requireDesignTokenFixtureValue(match[0], "transition declaration"),
    ),
  }));

const normalizeSelector = (selector: string) => selector.trim().replace(/\s+/g, " ");

const cssRuleBlocks = (source: string) =>
  Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .map((match) => {
      const selectorText = requireDesignTokenFixtureValue(
        match[1],
        "CSS rule selector",
      ).trim();
      const declarations = requireDesignTokenFixtureValue(
        match[2],
        `${selectorText} declarations`,
      );

      return {
        selectorText,
        selectors: selectorText.split(",").map(normalizeSelector).filter(Boolean),
        declarations,
        lineNumber: sourceLineNumberAt(source, match.index ?? 0),
      };
    })
    .filter((block) => block.selectors.length > 0 && !block.selectorText.startsWith("@"));

const focusVisibleSelectorFor = (selector: string) => {
  if (selector.includes(":focus-visible")) {
    return selector;
  }

  if (/:focus(?![-\w])/.test(selector)) {
    return selector.replace(/:focus(?![-\w])/g, ":focus-visible");
  }

  return `${selector}:focus-visible`;
};

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

const collectStrictTokenOwnedCssLineOffenders = (
  findOffender: (line: string, index: number, lines: string[]) => string | null,
) =>
  strictTokenOwnedCssFiles.flatMap((relativePath) => {
    const lines = readCss(relativePath).split(/\r?\n/);

    return lines.flatMap((line, index) => {
      const offender = findOffender(line, index, lines);

      if (!offender) {
        return [];
      }

      return `${relativePath}:${index + 1}: ${offender}`;
    });
  });

const collectStrictTokenOwnedCssSourceOffenders = (
  findOffenders: (relativePath: string, source: string) => string[],
) =>
  strictTokenOwnedCssFiles.flatMap((relativePath) =>
    findOffenders(relativePath, readCss(relativePath)),
  );

const collectPolicyCssLineOffenders = (
  stylePaths: readonly string[],
  findOffender: (line: string, index: number, lines: string[]) => string | null,
) =>
  stylePaths.flatMap((stylePath) => {
    const lines = fs
      .readFileSync(path.join(projectRoot, stylePath), "utf8")
      .split(/\r?\n/);

    return lines.flatMap((line, index) => {
      const offender = findOffender(line, index, lines);

      return offender ? `${stylePath}:${index + 1}: ${offender}` : [];
    });
  });

const selectorBlock = (css: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));

  if (!match) {
    throw new Error(`Missing selector block: ${selector}`);
  }

  return requireDesignTokenFixtureValue(match[0], `${selector} block`);
};

const expectDeclaration = (block: string, declaration: string) => {
  expect(block.replace(/\s+/g, " ")).toContain(declaration);
};

const overlaySelector = ".overlay";

describe("design token stylesheet contract", () => {
  it("exposes each token once through ordered primitive, semantic, and component layers", () => {
    expect(tokenCssPaths).toHaveLength(3);
    tokenCssPaths.forEach((tokenCssPath) => {
      expect(fs.existsSync(tokenCssPath)).toBe(true);
    });

    const tokensCss = tokenCssPaths
      .map((tokenCssPath) => fs.readFileSync(tokenCssPath, "utf8"))
      .join("\n");
    const tokenIndexCss = fs.readFileSync(tokenIndexCssPath, "utf8");
    const globalsCss = fs.readFileSync(globalsCssPath, "utf8");
    const indexCss = fs.readFileSync(indexCssPath, "utf8");
    const declaredTokenNames = Array.from(
      tokensCss.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm),
      (match) =>
        requireDesignTokenFixtureValue(match[1], "declared token name"),
    );

    expect(tokenIndexCss).toBe(
      '@import url("./primitive.css");\n' +
        '@import url("./semantic.css");\n' +
        '@import url("./components.css");\n',
    );
    expect(globalsCss.startsWith('@import url("./tokens/index.css");')).toBe(
      true,
    );
    expect(indexCss).toBe('@import url("./shared/styles/globals.css");\n');

    tokenCssPaths.forEach((tokenCssPath) => {
      const tokenLayerCss = fs.readFileSync(tokenCssPath, "utf8").trim();

      expect(tokenLayerCss.startsWith(":root {")).toBe(true);
      expect(tokenLayerCss.endsWith("}")).toBe(true);
    });

    expect(new Set(declaredTokenNames).size).toBe(declaredTokenNames.length);
    expect(globalsCss).toMatch(
      /body\s*\{[\s\S]*font-family:\s*var\(--font-family-base\);/,
    );
  });

  it("preserves every pre-hierarchy public token's rendered default value", () => {
    Object.entries(expectedPublicTokenValues).forEach(([name, expectedValue]) => {
      expect(resolveTokenValue(name)).toBe(expectedValue);
    });
  });

  it("assigns every current token to exactly one explicit layer owner", () => {
    expect(primitiveTokenStylePaths).toEqual([
      "src/shared/styles/tokens/primitive.css",
    ]);
    expect(derivedTokenStylePaths).toEqual([
      "src/shared/styles/tokens/semantic.css",
      "src/shared/styles/tokens/components.css",
    ]);
    expect(
      tokenLayers.map(({ declarations, name, path }) => ({
        name,
        path,
        tokenNames: declarations.map(({ name: tokenName }) => tokenName),
      })),
    ).toEqual(tokenLayerPolicies);

    const registeredTokenNames = tokenLayerPolicies.flatMap(
      ({ tokenNames }) => tokenNames,
    );

    expect(new Set(registeredTokenNames).size).toBe(
      registeredTokenNames.length,
    );
  });

  it("keeps raw values in primitive tokens and derived layers as direct aliases", () => {
    tokenLayers
      .filter(({ name }) => name !== "primitive")
      .forEach((layer) => {
        layer.declarations.forEach(({ name, value }) => {
          expect(`${layer.path}:${name}:${value}`).toMatch(
            /:[-a-z0-9]+:var\(--[a-z0-9-]+\)$/,
          );
        });
      });
  });

  it("rejects unresolved, backward, and forward-in-layer token references", () => {
    const offenders = tokenLayers.flatMap((consumerLayer) =>
      consumerLayer.declarations.flatMap((consumer) =>
        tokenReferences(consumer.value).flatMap((reference) => {
          const owner = tokenOwnerByName.get(reference);

          if (!owner) {
            return `${consumerLayer.path}:${consumer.name} -> unknown ${reference}`;
          }

          if (owner.layer.rank > consumerLayer.rank) {
            return `${consumerLayer.path}:${consumer.name} -> backward ${reference}`;
          }

          if (
            owner.layer.rank === consumerLayer.rank &&
            owner.declaration.order >= consumer.order
          ) {
            return `${consumerLayer.path}:${consumer.name} -> forward ${reference}`;
          }

          return [];
        }),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps global styles sourced from index.css and globals.css", () => {
    const appSource = fs.readFileSync(appTsxPath, "utf8");
    const indexSource = fs.readFileSync(indexTsxPath, "utf8");
    const indexCss = fs.readFileSync(indexCssPath, "utf8");

    expect(fs.existsSync(staleAppCssPath)).toBe(false);
    expect(fs.existsSync(staleTokensCssPath)).toBe(false);
    expect(fs.existsSync(globalsCssPath)).toBe(true);
    expect(appSource).not.toMatch(new RegExp(escapedStaleAppCssFileName));
    expect(appSource).not.toMatch(
      new RegExp(`import\\s+["']\\.\\/${escapedStaleAppCssFileName}["'];?`),
    );
    expect(indexSource).toMatch(/import\s+["']\.\/index\.css["'];/);
    expect(indexCss).toBe('@import url("./shared/styles/globals.css");\n');
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
      "features/accommodations/detail/components/AccommodationImageGalleryModal.module.css",
    );
    const dialogOverlay = selectorBlock(dialogCss, overlaySelector);
    const galleryClose = selectorBlock(galleryCss, ".galleryClose");

    expectDeclaration(dialogOverlay, "background: var(--overlay-backdrop);");
    expectDeclaration(dialogOverlay, "z-index: var(--z-modal);");
    expectDeclaration(galleryClose, "z-index: var(--z-local-raised);");
  });

  it("keeps date picker overlays on the dropdown z-index token", () => {
    const accommodationBookingCardCss = readCss(
      "features/accommodations/detail/components/AccommodationBookingCard.module.css",
    );

    expect(accommodationBookingCardCss).toMatch(
      /\.datePickerContainer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*var\(--layout-search-mobile-popover-top\);[\s\S]*?z-index:\s*var\(--z-dropdown\);/,
    );
  });

  it("keeps strict token-owned CSS off transition-all declarations", () => {
    const offenders = collectStrictTokenOwnedCssSourceOffenders((relativePath, source) =>
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

  it("keeps strict token-owned CSS z-index declarations on tokens", () => {
    const offenders = collectStrictTokenOwnedCssLineOffenders((line) =>
      findRawZIndexDeclaration(line),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps high-risk pre-redesign CSS z-index declarations on tokens", () => {
    const offenders = collectPolicyCssLineOffenders(
      highRiskPreRedesignStylePaths,
      (line) => findRawZIndexDeclaration(line),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps strict token-owned CSS outline resets paired with focus-visible styles", () => {
    const offenders = collectStrictTokenOwnedCssSourceOffenders((relativePath, source) =>
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
        ".field:focus { outline: none; box-shadow: var(--focus-ring); }\n.field:focus-visible { outline: none; box-shadow: var(--focus-ring); }",
      ),
    ).toEqual([]);

    expect(
      collectOutlineResetOffenders(
        "test.css",
        ".field:focus-visible { outline: none; box-shadow: var(--focus-ring); }",
      ),
    ).toEqual([]);
  });

  it("keeps strict token-owned CSS off token-equivalent spacing and font literals", () => {
    const offenders = collectStrictTokenOwnedCssSourceOffenders((relativePath, source) =>
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

  it("keeps local z-index literals out of protected design CSS", () => {
    const offenders = collectPolicyCssLineOffenders(
      legacyDesignProtectedStylePaths,
      (line) => {
        const match = line.match(/z-index\s*:\s*(?:10|100)\b/);

        return match?.[0] ?? null;
      },
    );

    expect(offenders).toEqual([]);
  });
});
