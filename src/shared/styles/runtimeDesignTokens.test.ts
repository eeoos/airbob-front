import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RUNTIME_DESIGN_TOKENS } from "./runtimeDesignTokens";

const tokenSources = ["primitive.css", "semantic.css", "components.css"]
  .map((fileName) =>
    readFileSync(
      join(process.cwd(), "src/shared/styles/tokens", fileName),
      "utf8",
    ),
  )
  .join("\n");

const declarations = new Map(
  Array.from(
    tokenSources.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm),
    (match) => [match[1], match[2]?.trim()] as const,
  ),
);

const resolveToken = (
  name: string,
  ancestry: readonly string[] = [],
): string => {
  if (ancestry.includes(name)) {
    throw new Error(
      `Circular token fixture: ${[...ancestry, name].join(" -> ")}`,
    );
  }

  const value = declarations.get(name);
  if (!value) throw new Error(`Missing token fixture: ${name}`);

  return value.replace(/var\((--[a-z0-9-]+)\)/g, (_match, reference: string) =>
    resolveToken(reference, [...ancestry, name]),
  );
};

describe("runtime design token policy", () => {
  it.each([
    ["brand", RUNTIME_DESIGN_TOKENS.color.brand],
    ["border", RUNTIME_DESIGN_TOKENS.color.border],
    ["surface", RUNTIME_DESIGN_TOKENS.color.surface],
    ["text", RUNTIME_DESIGN_TOKENS.color.text],
    ["textInverse", RUNTIME_DESIGN_TOKENS.color.textInverse],
  ] as const)(
    "keeps the resolved %s color aligned with canonical CSS",
    (_name, token) => {
      expect(token.resolved).toBe(resolveToken(token.name));
      expect(token.reference).toBe(`var(${token.name})`);
    },
  );

  it("publishes immutable typed geometry for vendor-rendered map markers", () => {
    expect(RUNTIME_DESIGN_TOKENS.marker).toEqual({
      activeStrokeWidth: 2,
      baselineOffsetPx: 4,
      bubbleHeightPx: 28,
      bubbleRadiusPx: 14,
      characterWidthPx: 8,
      defaultStrokeWidth: 1,
      fontWeight: 600,
      horizontalPaddingPx: 12,
      minimumBubbleWidthPx: 60,
      textExtraWidthPx: 20,
      textFontSizePx: 14,
    });
    expect(Object.isFrozen(RUNTIME_DESIGN_TOKENS.marker)).toBe(true);
    expect(Object.isFrozen(RUNTIME_DESIGN_TOKENS.icon)).toBe(true);
    expect(Object.isFrozen(RUNTIME_DESIGN_TOKENS)).toBe(true);
  });
});
