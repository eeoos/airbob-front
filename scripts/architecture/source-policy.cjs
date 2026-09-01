const fs = require("node:fs");
const path = require("node:path");

const sourceExtensions = Object.freeze([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const sourceExtensionSet = new Set(sourceExtensions);
const testModulePattern =
  "^src/test(?:/|$)|" +
  "(?:^|/)(?:__tests__|__mocks__)(?:/|$)|" +
  "[.](?:spec|test)[.](?:mjs|[jt]sx?)$|" +
  "[.]d[.]ts$";
const testModuleRegex = new RegExp(testModulePattern);
const runtimeDesignTokenOwnerPath = "src/shared/styles/runtimeDesignTokens.ts";
const runtimeDesignLiteralIntegrationPaths = Object.freeze([
  "src/features/search/components/SearchMap/lib/infoWindowContent.ts",
  "src/features/search/components/SearchMap/lib/infoWindowDom.ts",
]);

const runtimeDesignLiteralPatterns = Object.freeze([
  Object.freeze({
    kind: "raw-color",
    pattern: /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/giu,
  }),
  Object.freeze({
    kind: "raw-radius",
    pattern:
      /\bborderRadius\b\s*(?::|=)\s*["'`](?!var\()[^"'`]*\d+(?:\.\d+)?px/gu,
  }),
  Object.freeze({
    kind: "raw-shadow",
    pattern:
      /\bboxShadow\b\s*(?::|=)\s*["'`](?!var\(|none["'`])[^"'`]*(?:\d+(?:\.\d+)?px|(?:rgb|rgba|hsl|hsla)\s*\()/giu,
  }),
]);

const normalizeSourcePath = (relativePath) =>
  relativePath.replaceAll("\\", "/");

const assertRealSourceTree = (directory, label = "source tree") => {
  const rootStat = fs.lstatSync(directory);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new TypeError(
      `${label} must be a real directory, not a symbolic link.`,
    );
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      throw new TypeError(
        `Symbolic links are forbidden under ${label}: ${entryPath}`,
      );
    }

    if (entry.isDirectory()) {
      assertRealSourceTree(entryPath, label);
    }
  }
};

const isProductionSourcePath = (relativePath) => {
  const normalizedPath = normalizeSourcePath(relativePath);

  return (
    sourceExtensionSet.has(path.posix.extname(normalizedPath)) &&
    !testModuleRegex.test(normalizedPath)
  );
};

const collectProductionSourcePaths = ({ projectRoot, sourceRoot }) => {
  assertRealSourceTree(sourceRoot, "src");

  const collect = (directory) =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collect(entryPath);
      }

      const relativePath = path
        .relative(projectRoot, entryPath)
        .replaceAll("\\", "/");

      return entry.isFile() && isProductionSourcePath(relativePath)
        ? [relativePath]
        : [];
    });

  return collect(sourceRoot).sort();
};

const findRuntimeDesignLiteralViolations = (relativePath, source) => {
  const normalizedPath = normalizeSourcePath(relativePath);
  if (
    normalizedPath === runtimeDesignTokenOwnerPath ||
    runtimeDesignLiteralIntegrationPaths.includes(normalizedPath)
  ) {
    return [];
  }

  return runtimeDesignLiteralPatterns.flatMap(({ kind, pattern }) =>
    Array.from(
      source.matchAll(new RegExp(pattern.source, pattern.flags)),
      (match) => ({
        kind,
        match: match[0],
      }),
    ),
  );
};

const findForbiddenRuntimeTokenAccess = (relativePath, source) => {
  const normalizedPath = normalizeSourcePath(relativePath);
  if (
    !normalizedPath.startsWith("src/shared/") &&
    !normalizedPath.startsWith("src/screens/")
  ) {
    return [];
  }

  const violations = [];
  const patterns = [
    {
      kind: "cssom-token-read",
      pattern:
        /\bgetComputedStyle\b|\bdocument\.documentElement\b|\.getPropertyValue\(\s*["'`]--/u,
    },
    {
      kind: "platform-runtime-token-reader-import",
      pattern:
        /from\s+["'][^"']*platform\/browser\/[^"']*runtime[^"']*token[^"']*["']/iu,
    },
  ];

  patterns.forEach(({ kind, pattern }) => {
    const match = source.match(pattern)?.[0];
    if (match) violations.push({ kind, match });
  });

  return violations;
};

module.exports = {
  assertRealSourceTree,
  collectProductionSourcePaths,
  findForbiddenRuntimeTokenAccess,
  findRuntimeDesignLiteralViolations,
  isProductionSourcePath,
  runtimeDesignLiteralIntegrationPaths,
  runtimeDesignTokenOwnerPath,
  testModulePattern,
};
