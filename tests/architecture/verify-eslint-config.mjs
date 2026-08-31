import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const packageData = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);
const eslintConfigPath = path.join(projectRoot, "eslint.config.mjs");
const eslintConfigSource = fs.readFileSync(eslintConfigPath, "utf8");
const eslint = new ESLint({ cwd: projectRoot });

const calculateConfig = (relativePath) =>
  eslint.calculateConfigForFile(path.join(projectRoot, relativePath));
const ruleSeverity = (config, ruleName) => config.rules?.[ruleName]?.[0];

assert.equal(packageData.eslintConfig, undefined);
assert.deepEqual(
  {
    "@eslint/js": packageData.devDependencies["@eslint/js"],
    "@vitest/eslint-plugin":
      packageData.devDependencies["@vitest/eslint-plugin"],
    eslint: packageData.devDependencies.eslint,
    "eslint-plugin-import": packageData.devDependencies["eslint-plugin-import"],
    "eslint-plugin-jest-dom":
      packageData.devDependencies["eslint-plugin-jest-dom"],
    "eslint-plugin-jsx-a11y":
      packageData.devDependencies["eslint-plugin-jsx-a11y"],
    "eslint-plugin-playwright":
      packageData.devDependencies["eslint-plugin-playwright"],
    "eslint-plugin-react": packageData.devDependencies["eslint-plugin-react"],
    "eslint-plugin-react-hooks":
      packageData.devDependencies["eslint-plugin-react-hooks"],
    "eslint-plugin-testing-library":
      packageData.devDependencies["eslint-plugin-testing-library"],
    globals: packageData.devDependencies.globals,
    "typescript-eslint": packageData.devDependencies["typescript-eslint"],
  },
  {
    "@eslint/js": "9.39.5",
    "@vitest/eslint-plugin": "1.6.27",
    eslint: "9.39.5",
    "eslint-plugin-import": "2.32.0",
    "eslint-plugin-jest-dom": "5.10.1",
    "eslint-plugin-jsx-a11y": "6.10.2",
    "eslint-plugin-playwright": "2.11.0",
    "eslint-plugin-react": "7.37.5",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-testing-library": "7.16.2",
    globals: "17.11.0",
    "typescript-eslint": "8.68.0",
  },
);
assert.equal(packageData.devDependencies["eslint-config-react-app"], undefined);
assert.equal(packageData.scripts.lint, "eslint src");
assert.equal(packageData.scripts["lint:strict"], "eslint src --max-warnings=0");
assert.equal(
  packageData.scripts["lint:e2e"],
  "eslint vite.config.ts vitest.config.ts playwright.config.ts tests/e2e --max-warnings=0",
);
assert.equal(
  packageData.scripts["lint:architecture-tools"],
  "eslint --no-ignore eslint.config.mjs .dependency-cruiser.cjs stylelint.config.mjs scripts tests/architecture --max-warnings=0",
);
assert.equal(eslintConfigSource.includes("FlatCompat"), false);
assert.equal(eslintConfigSource.includes("react-app"), false);
assert.equal(eslintConfigSource.includes("recommended-latest"), false);

const productionConfig = await calculateConfig("src/app/example.tsx");
const javascriptReactConfig = await calculateConfig("src/example.jsx");
const environmentOwnerConfig = await calculateConfig(
  "src/platform/config/env.ts",
);
const vitestConfig = await calculateConfig("src/example.test.tsx");
const playwrightConfig = await calculateConfig(
  "tests/e2e/specs/example.spec.ts",
);
const nodeEsmConfig = await calculateConfig("tests/architecture/example.mjs");
const smokeToolConfig = await calculateConfig(
  "scripts/smoke/frontend-smoke.mjs",
);
const nodeCommonJsConfig = await calculateConfig(".dependency-cruiser.cjs");

assert.equal(productionConfig.languageOptions.globals.window, false);
assert.equal(productionConfig.languageOptions.globals.process, undefined);
assert.equal(
  productionConfig.languageOptions.parser.meta.name,
  "typescript-eslint/parser",
);
assert.equal(ruleSeverity(productionConfig, "react-hooks/rules-of-hooks"), 2);
assert.equal(ruleSeverity(productionConfig, "react-hooks/exhaustive-deps"), 1);
assert.equal(
  javascriptReactConfig.languageOptions.parserOptions.ecmaFeatures.jsx,
  true,
);
assert.equal(
  ruleSeverity(javascriptReactConfig, "react-hooks/rules-of-hooks"),
  2,
);
assert.equal(ruleSeverity(javascriptReactConfig, "jsx-a11y/alt-text"), 2);
assert.equal(ruleSeverity(productionConfig, "no-restricted-globals"), 2);
assert.equal(ruleSeverity(productionConfig, "no-restricted-properties"), 2);
assert.equal(ruleSeverity(productionConfig, "no-restricted-syntax"), 2);
assert.equal(ruleSeverity(productionConfig, "no-restricted-imports"), 2);
assert.equal(
  ruleSeverity(environmentOwnerConfig, "no-restricted-globals"),
  undefined,
);

assert.equal(vitestConfig.languageOptions.globals.vi, true);
assert.equal(vitestConfig.languageOptions.globals.test, true);
assert.equal(vitestConfig.languageOptions.globals.jest, undefined);
assert.equal(ruleSeverity(vitestConfig, "vitest/no-focused-tests"), 2);
assert.equal(vitestConfig.plugins.jest, undefined);

assert.equal(playwrightConfig.languageOptions.globals.process, false);
assert.equal(ruleSeverity(playwrightConfig, "playwright/no-focused-test"), 2);
assert.equal(playwrightConfig.plugins.vitest, undefined);

assert.equal(nodeEsmConfig.languageOptions.globals.process, false);
assert.equal(nodeEsmConfig.languageOptions.globals.require, undefined);
assert.equal(smokeToolConfig.languageOptions.globals.process, false);
assert.equal(smokeToolConfig.languageOptions.globals.require, undefined);
assert.equal(nodeCommonJsConfig.languageOptions.globals.require, false);
assert.equal(nodeCommonJsConfig.languageOptions.sourceType, "commonjs");

for (const duplicatedGraphRule of [
  "import/no-cycle",
  "import/no-unresolved",
  "import/no-unused-modules",
]) {
  assert.equal(productionConfig.rules[duplicatedGraphRule], undefined);
}
assert.equal(productionConfig.linterOptions.reportUnusedDisableDirectives, 2);
assert.equal(productionConfig.linterOptions.reportUnusedInlineConfigs, 2);

const [javascriptReactLintResult] = await eslint.lintText(
  'export function Example() { return <button type="button">Example</button>; }',
  { filePath: path.join(projectRoot, "src/example.jsx") },
);
assert.equal(javascriptReactLintResult?.fatalErrorCount, 0);
assert.equal(javascriptReactLintResult?.errorCount, 0);

process.stdout.write(
  "ESLint 9 flat config separates browser, Vitest, Playwright, and Node environments while leaving graph, reachability, and CSS ownership to their canonical tools.\n",
);
