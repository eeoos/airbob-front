import { readFileSync } from "fs";
import { join } from "path";
import postcss from "postcss";
import { RESPONSIVE_MEDIA_QUERIES } from "./responsive";

const customMediaSource = () =>
  readFileSync(
    join(process.cwd(), "src/shared/styles/custom-media.css"),
    "utf8",
  );

const readCustomMediaDeclarations = () => {
  const declarations = new Map<string, string>();
  const root = postcss.parse(customMediaSource());

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== "custom-media") return;

    const separator = atRule.params.indexOf(" ");
    if (separator < 0) return;
    declarations.set(
      atRule.params.slice(0, separator),
      atRule.params.slice(separator + 1),
    );
  });

  return declarations;
};

const evaluateWidthQuery = (query: string, width: number): boolean => {
  const complement = /^not all and\s+(.+)$/.exec(query);
  const complementQuery = complement?.[1];
  if (complementQuery !== undefined) {
    return !evaluateWidthQuery(complementQuery, width);
  }

  const maxWidth = /\(max-width:\s*(\d+)px\)/.exec(query);
  const maxWidthValue = maxWidth?.[1];
  if (maxWidthValue !== undefined) return width <= Number(maxWidthValue);

  const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query);
  const minWidthValue = minWidth?.[1];
  if (minWidthValue !== undefined) return width >= Number(minWidthValue);

  throw new Error(`Unsupported responsive media query: ${query}`);
};

describe("shared responsive policy", () => {
  it.each([
    [1024, true, false],
    [1024.5, false, true],
    [1025, false, true],
  ])(
    "assigns %spx to exactly one layout partition",
    (width, expectedMobileOrTablet, expectedDesktop) => {
      expect(
        evaluateWidthQuery(RESPONSIVE_MEDIA_QUERIES.mobileOrTablet, width),
      ).toBe(expectedMobileOrTablet);
      expect(evaluateWidthQuery(RESPONSIVE_MEDIA_QUERIES.desktop, width)).toBe(
        expectedDesktop,
      );
    },
  );

  it("publishes exactly one desktop alias aligned with the runtime partition", () => {
    const declarations = readCustomMediaDeclarations();
    const desktopAliases = Array.from(declarations.keys()).filter((name) =>
      name.includes("desktop"),
    );

    expect(desktopAliases).toEqual(["--viewport-desktop"]);
    expect(declarations.get("--viewport-mobile-tablet")).toBe(
      RESPONSIVE_MEDIA_QUERIES.mobileOrTablet,
    );
    expect(declarations.get("--viewport-desktop")).toBe(
      RESPONSIVE_MEDIA_QUERIES.desktop,
    );
  });
});
