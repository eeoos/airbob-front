import { readFileSync } from "fs";
import { join } from "path";
import postcss from "postcss";
import { RESPONSIVE_MEDIA_QUERIES } from "../../shared/styles/responsive";

const readSearchSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), "src/features/search", relativePath), "utf8");
const readSharedStylesSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), "src/shared/styles", relativePath), "utf8");

const getMediaBlocks = (source: string, query: string) => {
  const blocks: string[] = [];
  const root = postcss.parse(source);

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== "media" || atRule.params !== query) return;
    blocks.push(atRule.nodes?.map((node) => node.toString()).join("\n") ?? "");
  });

  return blocks;
};

describe("Search responsive contracts", () => {
  it("uses the shared runtime query instead of a local width comparison", () => {
    const hookSource = readSearchSource("hooks/useSearchBottomSheet.ts");
    const runtimeSource = readSharedStylesSource("useResponsiveLayout.ts");

    expect(hookSource).toMatch(
      /useResponsiveLayout\(\)\s*===\s*"mobile-tablet"/s,
    );
    expect(hookSource).not.toMatch(/window\.innerWidth\s*[<>=]/);
    expect(runtimeSource).toMatch(
      /window\.matchMedia\(RESPONSIVE_MEDIA_QUERIES\.mobileOrTablet\)\.matches/s,
    );
    expect(runtimeSource).toContain("useSyncExternalStore");
  });

  it("switches CSS layout branches with the shared continuous partition", () => {
    const css = readFileSync(
      join(process.cwd(), "src/screens/search/SearchScreen.module.css"),
      "utf8",
    );
    const mobileOrTabletBlocks = getMediaBlocks(
      css,
      RESPONSIVE_MEDIA_QUERIES.mobileOrTablet,
    );
    const desktopBlocks = getMediaBlocks(css, RESPONSIVE_MEDIA_QUERIES.desktop);

    expect(mobileOrTabletBlocks).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\.main\s*{[^}]*display:\s*none;/s),
      ]),
    );
    expect(desktopBlocks).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /\.mapLayer,\s*\.bottomSheet\s*{[^}]*display:\s*none(?:\s*!important)?;/s,
        ),
      ]),
    );
  });
});
