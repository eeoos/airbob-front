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

const legacyAppOverlayZIndexPattern =
  /z-index\s*:\s*(?:100000|99999|10001|10000|1000)\b(?:\s*!important)?/;

const collectCssFiles = (dir: string): string[] => {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectCssFiles(entryPath);
    }

    if (entry.isFile() && entry.name.endsWith(".css")) {
      return [entryPath];
    }

    return [];
  });
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

  it("keeps legacy app-level overlay z-index literals out of production CSS", () => {
    const offenders = collectCssFiles(srcDir)
      .filter((filePath) => filePath !== tokensCssPath)
      .flatMap((filePath) => {
        const css = fs.readFileSync(filePath, "utf8");

        return css.split(/\r?\n/).flatMap((line, index) => {
          const match = line.match(legacyAppOverlayZIndexPattern);

          if (!match) {
            return [];
          }

          return `${path.relative(process.cwd(), filePath)}:${index + 1}: ${match[0]}`;
        });
      });

    expect(offenders).toEqual([]);
  });
});
