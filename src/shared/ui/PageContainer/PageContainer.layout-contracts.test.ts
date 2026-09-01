import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss, { type AtRule, type Container, type Rule } from "postcss";
import { RESPONSIVE_MEDIA_QUERIES } from "../../styles/responsive";

type PageContainerVariant = "edge" | "full" | "wide" | "content" | "narrow";

const source = readFileSync(
  join(process.cwd(), "src/shared/ui/PageContainer/PageContainer.module.css"),
  "utf8",
);
const root = postcss.parse(source);

const queryByAlias = new Map([
  ["(--viewport-mobile-tablet)", RESPONSIVE_MEDIA_QUERIES.mobileOrTablet],
  ["(--viewport-tablet)", RESPONSIVE_MEDIA_QUERIES.tablet],
]);

const evaluateWidthQuery = (query: string, width: number): boolean => {
  const complement = /^not all and\s+(.+)$/.exec(query);
  if (complement?.[1]) return !evaluateWidthQuery(complement[1], width);

  const maxWidth = /\(max-width:\s*(\d+)px\)/.exec(query)?.[1];
  if (maxWidth) return width <= Number(maxWidth);

  const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query)?.[1];
  if (minWidth) return width >= Number(minWidth);

  throw new Error(`Unsupported PageContainer query: ${query}`);
};

const appliesToVariant = (rule: Rule, variant: PageContainerVariant) =>
  rule.selectors.some((selector) => selector.trim() === `.${variant}`);

const collectDeclarations = (
  container: Container,
  variant: PageContainerVariant,
  width: number,
  declarations: Map<string, string>,
) => {
  container.each((node) => {
    if (node.type === "rule" && appliesToVariant(node, variant)) {
      node.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value);
      });
      return;
    }

    if (node.type !== "atrule" || node.name !== "media") return;

    const query = queryByAlias.get(node.params);
    if (!query) throw new Error(`Unowned PageContainer alias: ${node.params}`);
    if (evaluateWidthQuery(query, width)) {
      collectDeclarations(node as AtRule, variant, width, declarations);
    }
  });
};

const recipeAt = (variant: PageContainerVariant, width: number) => {
  const declarations = new Map<string, string>();
  collectDeclarations(root, variant, width, declarations);

  return {
    gutter: declarations.get("padding-inline"),
    maxWidth: declarations.get("max-width"),
  };
};

const protectedViewports = [320, 375, 768, 1023, 1024, 1025, 1440] as const;

describe("PageContainer layout contracts", () => {
  it("owns the shared page-width frame before applying a recipe", () => {
    const declarations = new Map<string, string>();
    root.nodes
      .filter(
        (node): node is Rule =>
          node.type === "rule" && node.selector === ".container",
      )
      .forEach((rule) =>
        rule.walkDecls((declaration) => {
          declarations.set(declaration.prop, declaration.value);
        }),
      );

    expect(Object.fromEntries(declarations)).toEqual({
      "box-sizing": "border-box",
      width: "100%",
      "margin-inline": "auto",
    });
  });

  it.each(protectedViewports)(
    "keeps edge and full recipes stable at %spx",
    (width) => {
      expect(recipeAt("edge", width)).toEqual({
        gutter: "0",
        maxWidth: "none",
      });
      expect(recipeAt("full", width)).toEqual({
        gutter: "0",
        maxWidth: "var(--layout-page-full-max-width)",
      });
    },
  );

  it.each([
    [320, "var(--space-6)"],
    [375, "var(--space-6)"],
    [768, "var(--space-6)"],
    [1023, "var(--space-12)"],
    [1024, "var(--space-12)"],
    [1025, "var(--space-16)"],
    [1440, "var(--space-16)"],
  ] as const)("keeps the wide gutter at %spx", (width, gutter) => {
    expect(recipeAt("wide", width)).toEqual({
      gutter,
      maxWidth:
        "calc(\n    var(--layout-page-wide-max-width) + var(--space-16) + var(--space-16)\n  )",
    });
  });

  it("keeps the content recipe on the protected viewport matrix", () => {
    expect(
      protectedViewports.map((width) => recipeAt("content", width)),
    ).toEqual(
      protectedViewports.map((width) => ({
        gutter: width <= 768 ? "var(--space-4)" : "var(--space-6)",
        maxWidth:
          "calc(\n    var(--layout-page-content-max-width) + var(--space-6) + var(--space-6)\n  )",
      })),
    );
  });

  it.each(protectedViewports)(
    "keeps the narrow recipe stable at %spx",
    (width) => {
      expect(recipeAt("narrow", width)).toEqual({
        gutter: "var(--space-6)",
        maxWidth:
          "calc(\n    var(--layout-page-narrow-max-width) + var(--space-6) + var(--space-6)\n  )",
      });
    },
  );
});
