import { readFileSync } from "fs";
import { join } from "path";

const readProfileCss = () =>
  readFileSync(
    join(
      process.cwd(),
      "src/features/profile/components/ProfileShell.module.css",
    ),
    "utf8",
  );

const getMediaBlock = (css: string, query: string) => {
  const start = css.indexOf(`@media ${query}`);
  expect(start).toBeGreaterThanOrEqual(0);

  const openBrace = css.indexOf("{", start);
  let depth = 0;

  for (let index = openBrace; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return css.slice(openBrace + 1, index);
    }
  }

  throw new Error(`Unclosed media block: ${query}`);
};

describe("Profile responsive layout contracts", () => {
  it("turns the desktop sidebar into a contained horizontal rail", () => {
    const css = readProfileCss();
    const tabletBlock = getMediaBlock(css, "(--viewport-mobile-tablet)");

    expect(tabletBlock).toMatch(
      /\.content\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
    expect(tabletBlock).toMatch(/\.content\s*{[^}]*align-content:\s*start;/s);
    expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*position:\s*static;/s);
    expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*width:\s*100%;/s);
    expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*min-width:\s*0;/s);
    expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*box-shadow:\s*none;/s);
    expect(tabletBlock).toMatch(/\.nav\s*{[^}]*flex-direction:\s*row;/s);
    expect(tabletBlock).toMatch(/\.nav\s*{[^}]*overflow-x:\s*auto;/s);
    expect(tabletBlock).toMatch(/\.main\s*{[^}]*width:\s*100%;/s);
  });
});
