import * as fs from "fs";
import * as path from "path";

const srcDir = path.join(process.cwd(), "src");
const tokensCssPath = path.join(srcDir, "styles", "tokens.css");
const indexCssPath = path.join(srcDir, "index.css");

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
  "--z-header: 1000;",
  "--z-sticky: 1100;",
  "--z-dropdown: 2000;",
  "--z-popover: 3000;",
  "--z-bottom-sheet: 4000;",
  "--z-modal: 5000;",
  "--z-toast: 6000;",
  "--overlay-backdrop: rgba(0, 0, 0, 0.45);",
  "--breakpoint-tablet: 768px;",
  "--breakpoint-desktop: 1024px;",
  "--breakpoint-wide: 1400px;",
];

const forbiddenAppOverlayZIndexValues = "100000|99999|10001|10000|1000";

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
    expect(findLegacyAppOverlayZIndexMatch('zIndex: "var(--z-popover)"')).toBeNull();
  });

  it("keeps app toast containers on the toast z-index token", () => {
    [
      "pages/Search/Search.module.css",
      "pages/AccommodationDetail/AccommodationDetail.module.css",
      "pages/Reservations/ReservationDetail.module.css",
      "pages/Reservations/ReservationConfirm.module.css",
      "components/AccommodationActionModal/AccommodationActionModal.module.css",
      "components/AuthModal/AuthModal.module.css",
      "components/ReservationModal/ReservationModal.module.css",
    ].forEach((relativePath) => {
      const block = selectorBlock(readCss(relativePath), ".toastContainer");

      expectDeclaration(block, "z-index: var(--z-toast);");
    });
  });

  it("keeps real modal backdrops and foreground controls on overlay tokens", () => {
    const galleryCss = readCss("pages/AccommodationDetail/AccommodationDetail.module.css");
    const galleryModal = selectorBlock(galleryCss, ".galleryModal");
    const galleryClose = selectorBlock(galleryCss, ".galleryClose");

    expectDeclaration(galleryModal, "background: var(--overlay-backdrop);");
    expectDeclaration(galleryModal, "z-index: var(--z-modal);");
    expectDeclaration(galleryClose, "z-index: calc(var(--z-modal) + 1);");
  });

  it("keeps date picker overlays on the dropdown z-index token", () => {
    const accommodationDetailCss = readCss(
      "pages/AccommodationDetail/AccommodationDetail.module.css",
    );

    expect(accommodationDetailCss).toMatch(
      /\.datePickerContainer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*130px;[\s\S]*?z-index:\s*var\(--z-dropdown\);/,
    );
  });
});
