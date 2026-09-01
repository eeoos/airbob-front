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
    [320, true, false],
    [375, true, false],
    [768, true, false],
    [1023, true, false],
    [1024, true, false],
    [1024.5, false, true],
    [1025, false, true],
    [1440, false, true],
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

  it("keeps every CSS alias aligned with the pure runtime breakpoint policy", () => {
    const declarations = readCustomMediaDeclarations();
    const desktopAliases = Array.from(declarations.keys()).filter((name) =>
      name.includes("desktop"),
    );

    expect(desktopAliases).toEqual(["--viewport-desktop"]);
    expect(declarations).toEqual(
      new Map([
        ["--viewport-phone", RESPONSIVE_MEDIA_QUERIES.phone],
        ["--viewport-tablet", RESPONSIVE_MEDIA_QUERIES.tablet],
        ["--viewport-tablet-up", RESPONSIVE_MEDIA_QUERIES.tabletUp],
        ["--viewport-mobile-tablet", RESPONSIVE_MEDIA_QUERIES.mobileOrTablet],
        ["--viewport-desktop", RESPONSIVE_MEDIA_QUERIES.desktop],
        ["--viewport-compact", RESPONSIVE_MEDIA_QUERIES.compact],
        ["--viewport-wide", RESPONSIVE_MEDIA_QUERIES.wide],
      ]),
    );
    expect(declarations.get("--viewport-mobile-tablet")).toBe(
      RESPONSIVE_MEDIA_QUERIES.mobileOrTablet,
    );
    expect(declarations.get("--viewport-desktop")).toBe(
      RESPONSIVE_MEDIA_QUERIES.desktop,
    );
  });

  it("protects every named runtime query value", () => {
    expect(RESPONSIVE_MEDIA_QUERIES).toEqual({
      phone: "(max-width: 480px)",
      tablet: "(max-width: 768px)",
      tabletUp: "(min-width: 769px)",
      mobileOrTablet: "(max-width: 1024px)",
      desktop: "not all and (max-width: 1024px)",
      compact: "(max-width: 1200px)",
      wide: "(max-width: 1400px)",
    });
    expect(Object.isFrozen(RESPONSIVE_MEDIA_QUERIES)).toBe(true);
  });
});
