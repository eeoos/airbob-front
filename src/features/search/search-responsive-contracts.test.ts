import { readFileSync } from "fs";
import { join } from "path";
import postcss from "postcss";
import { RESPONSIVE_MEDIA_QUERIES } from "../../shared/styles/responsive";

const readSearchSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), "src/features/search", relativePath), "utf8");

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

    expect(hookSource).toMatch(
      /window\.matchMedia\(\s*RESPONSIVE_MEDIA_QUERIES\.mobileOrTablet/s,
    );
    expect(hookSource).not.toMatch(/window\.innerWidth\s*[<>=]/);
  });

  it("switches CSS layout branches with the shared continuous partition", () => {
    const css = readSearchSource("SearchRoute.module.css");
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
