import { readFileSync } from "fs";
import { join } from "path";

const readProfileCss = () =>
  readFileSync(join(process.cwd(), "src/pages/Profile/Profile.module.css"), "utf8");

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
  it("removes desktop sidebar spacing and divider on tablet/mobile", () => {
    const css = readProfileCss();
    const tabletBlock = getMediaBlock(css, "(max-width: 1024px)");

    expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*padding-right:\s*0;/s);
    expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*border-right:\s*none;/s);
    expect(tabletBlock).toMatch(/\.sidebar::after\s*{[^}]*display:\s*none;/s);
    expect(tabletBlock).toMatch(/\.main\s*{[^}]*width:\s*100%;/s);
  });
});
