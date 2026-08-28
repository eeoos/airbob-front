const fs = require("node:fs");
const path = require("node:path");

const sourceExtensions = Object.freeze([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
]);
const sourceExtensionSet = new Set(sourceExtensions);
const testModulePattern =
  "(?:^|/)(?:__tests__|__mocks__)(?:/|$)|" +
  "[.](?:spec|test)[.][jt]sx?$|" +
  "^src/setupTests[.][jt]sx?$|[.]d[.]ts$";
const testModuleRegex = new RegExp(testModulePattern);

const normalizeSourcePath = (relativePath) => relativePath.replaceAll("\\", "/");

const assertRealSourceTree = (directory, label = "source tree") => {
  const rootStat = fs.lstatSync(directory);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new TypeError(`${label} must be a real directory, not a symbolic link.`);
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

module.exports = {
  assertRealSourceTree,
  collectProductionSourcePaths,
  isProductionSourcePath,
  testModulePattern,
};
