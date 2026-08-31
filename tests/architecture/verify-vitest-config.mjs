import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const sourceRoot = path.join(projectRoot, "src");
const setupPath = path.join(sourceRoot, "test/setup.ts");
const vitestConfigPath = path.join(projectRoot, "vitest.config.ts");
const packageData = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);
const loadedVitestConfig = await loadConfigFromFile(
  { command: "serve", mode: "test" },
  vitestConfigPath,
  projectRoot,
);

assert.ok(
  loadedVitestConfig,
  "Vitest TypeScript config must load through Vite.",
);
const vitestConfig = loadedVitestConfig.config;

const collectTestFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectTestFiles(entryPath);
    }

    return entry.isFile() &&
      /[.](?:test|spec)[.](?:mjs|[jt]sx?)$/.test(entry.name)
      ? [entryPath]
      : [];
  });

assert.equal(packageData.scripts.test, "vitest");
assert.equal(packageData.scripts["test:ci"], "vitest run");
assert.equal(
  packageData.scripts["test:ci:no-cache"],
  "vitest run --coverage --no-cache",
);
assert.equal(packageData.scripts["test:coverage"], "vitest run --coverage");
assert.equal(packageData.dependencies?.["react-scripts"], undefined);
assert.equal(packageData.dependencies?.["@types/jest"], undefined);
assert.equal(packageData.devDependencies?.vitest, "4.1.11");
assert.equal(packageData.devDependencies?.jsdom, "28.1.0");
assert.equal(packageData.devDependencies?.["@vitest/coverage-v8"], "4.1.11");

assert.equal(fs.existsSync(path.join(sourceRoot, "setupTests.ts")), false);
assert.equal(fs.existsSync(setupPath), true);
const setupSource = fs.readFileSync(setupPath, "utf8");
assert.match(setupSource, /@testing-library\/jest-dom\/vitest/);
assert.doesNotMatch(setupSource, /vi[.]mock|axios|react-router/);

assert.equal(vitestConfig.test.name, "unit");
assert.equal(vitestConfig.test.globals, true);
assert.equal(vitestConfig.test.environment, "jsdom");
assert.equal(
  vitestConfig.test.environmentOptions.jsdom.url,
  "http://localhost/",
);
assert.deepEqual(vitestConfig.test.setupFiles, ["./src/test/setup.ts"]);
assert.deepEqual(vitestConfig.test.include, [
  "src/**/*.{test,spec}.{js,jsx,mjs,ts,tsx}",
]);
assert.equal(vitestConfig.test.fileParallelism, false);
assert.equal(vitestConfig.test.maxWorkers, 1);
assert.equal(vitestConfig.test.sequence.hooks, "list");
assert.equal(vitestConfig.test.css.modules.classNameStrategy, "non-scoped");
assert.equal(vitestConfig.test.clearMocks, false);
assert.equal(vitestConfig.test.mockReset, false);
assert.equal(vitestConfig.test.restoreMocks, false);
assert.equal(vitestConfig.test.coverage.provider, "v8");
assert.deepEqual(vitestConfig.test.coverage.thresholds, {
  statements: 87,
  branches: 79,
  functions: 89,
  lines: 89,
});

const forbiddenPatterns = [
  /\bjest\s*[.(]/,
  /\bvi[.](?:Mock|Mocked|MockedFunction|SpyInstance|requireActual)\b/,
  /\{\s*virtual\s*:\s*true\s*\}/,
];
const violations = collectTestFiles(sourceRoot).flatMap((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const relativePath = path
    .relative(projectRoot, filePath)
    .replaceAll("\\", "/");

  return forbiddenPatterns
    .filter((pattern) => pattern.test(source))
    .map((pattern) => `${relativePath}: ${pattern}`);
});

assert.deepEqual(
  violations,
  [],
  `Vitest sources retain Jest compatibility syntax:\n${violations.join("\n")}`,
);

process.stdout.write(
  "Vitest owns unit/integration execution without CRA or Jest compatibility shims.\n",
);
