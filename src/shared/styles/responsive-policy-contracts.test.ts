import { readFileSync, readdirSync } from "fs";
import { createRequire } from "module";
import { join, relative } from "path";
import postcss from "postcss";

const customMediaCssPath = join(
  process.cwd(),
  "src/shared/styles/custom-media.css",
);
const primitiveTokensCssPath = join(
  process.cwd(),
  "src/shared/styles/tokens/primitive.css",
);

const requireCapture = (
  match: RegExpMatchArray,
  index: number,
  description: string,
): string => {
  const value = match[index];

  if (value === undefined) {
    throw new Error(`Missing ${description} regex capture at index ${index}.`);
  }

  return value;
};

const loadCommonJsModule = createRequire(import.meta.url);
const { allowedBreakpointValues, isStrictStylePath } = loadCommonJsModule(
  "../../../scripts/architecture/style-policy.cjs",
) as {
  allowedBreakpointValues: readonly string[];
  isStrictStylePath: (filePath: string) => boolean;
};

const collectCssFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) return collectCssFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".css") ? [entryPath] : [];
  });

const collectMediaBreakpointValues = (source: string) => {
  const values: string[] = [];
  const root = postcss.parse(source);

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== "media") return;
    values.push(
      ...Array.from(
        atRule.params.matchAll(
          /(?<![A-Za-z0-9_.-])(?:\d*\.)?\d+(?:px|em|rem)(?![A-Za-z0-9_-])/gi,
        ),
        (match) => match[0],
      ),
    );
  });

  return values;
};

const collectCustomMediaDeclarations = (source: string) => {
  const declarations: string[] = [];
  const root = postcss.parse(source);

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() === "custom-media") {
      declarations.push(atRule.params);
    }
  });

  return declarations;
};

const collectUnresolvedCustomMediaConsumers = (
  source: string,
  from = "responsive-policy-fixture.css",
) => {
  const consumers: string[] = [];
  const root = postcss.parse(source, { from });

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== "media") return;
    if (!atRule.params.includes("--")) return;
    consumers.push(atRule.params);
  });

  return consumers;
};

describe("responsive architecture policy", () => {
  it.each([
    "@media screen and (--viewport-mobile-tablet) { .fixture { display: block; } }",
    "@media (hover: hover) and (--viewport-mobile-tablet) { .fixture { display: block; } }",
    "@media print, (--viewport-mobile-tablet) { .fixture { display: block; } }",
    "@media screen and /* retained comment */ (--viewport-mobile-tablet) { .fixture { display: block; } }",
  ])("detects unresolved custom media in compound queries", (source) => {
    expect(collectUnresolvedCustomMediaConsumers(source)).not.toEqual([]);
  });

  it("allows the canonical declaration without a runtime consumer", () => {
    const declaration =
      "@custom-media --viewport-mobile-tablet (max-width: 1024px);";

    expect(collectCustomMediaDeclarations(declaration)).toHaveLength(1);
    expect(collectUnresolvedCustomMediaConsumers(declaration)).toEqual([]);
  });

  it("enforces the canonical owner and migration breakpoint scale repository-wide", () => {
    const cssFiles = collectCssFiles(join(process.cwd(), "src"));
    const canonicalSource = readFileSync(customMediaCssPath, "utf8");
    const canonicalBreakpointValues = new Set(
      Array.from(
        canonicalSource.matchAll(/(?:\d*\.)?\d+(?:px|em|rem)/g),
        (match) => match[0],
      ),
    );
    const allowedMigrationValues = new Set(allowedBreakpointValues);
    const tokenBreakpointValues = Array.from(
      readFileSync(primitiveTokensCssPath, "utf8").matchAll(
        /--breakpoint-[a-z-]+:\s*([^;]+);/g,
      ),
      (match) => requireCapture(match, 1, "breakpoint token value"),
    );
    const sources = cssFiles.map((filePath) => ({
      filePath,
      projectPath: relative(process.cwd(), filePath).replaceAll("\\", "/"),
      source: readFileSync(filePath, "utf8"),
    }));
    const localCustomMediaOwners = sources
      .filter(
        ({ filePath, source }) =>
          filePath !== customMediaCssPath &&
          collectCustomMediaDeclarations(source).length > 0,
      )
      .map(({ projectPath }) => projectPath);
    const unresolvedCustomMediaConsumers = sources
      .filter(
        ({ projectPath, source }) =>
          collectUnresolvedCustomMediaConsumers(source, projectPath).length > 0,
      )
      .map(({ projectPath }) => projectPath);
    const offScaleStrictConsumers = sources.flatMap(
      ({ projectPath, source }) =>
        isStrictStylePath(projectPath)
          ? collectMediaBreakpointValues(source)
              .filter((value) => !allowedMigrationValues.has(value))
              .map((value) => `${projectPath}:${value}`)
          : [],
    );

    expect(
      Array.from(canonicalBreakpointValues).filter(
        (value) => !allowedMigrationValues.has(value),
      ),
    ).toEqual([]);
    expect(
      tokenBreakpointValues.filter(
        (value) => !canonicalBreakpointValues.has(value),
      ),
    ).toEqual([]);
    expect(localCustomMediaOwners).toEqual([]);
    expect(unresolvedCustomMediaConsumers).toEqual([]);
    expect(offScaleStrictConsumers).toEqual([]);
  });
});
