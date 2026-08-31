import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));

const packageData = readJson("package.json");
const appConfig = readJson("tsconfig.json");
const testConfig = readJson("tsconfig.test.json");
const toolingConfig = readJson("tsconfig.tooling.json");
const e2eConfig = readJson("tsconfig.e2e.json");
const compiler = appConfig.compilerOptions;

assert.equal(packageData.type, "module");
assert.equal(
  packageData.dependencies?.typescript ??
    packageData.devDependencies?.typescript,
  "5.9.3",
);
assert.deepEqual(appConfig.include, ["src"]);
assert.deepEqual(compiler.types, ["vite/client"]);
assert.equal(compiler.target, "ES2022");
assert.deepEqual(compiler.lib, ["ES2022", "DOM", "DOM.Iterable"]);
assert.equal(compiler.module, "ESNext");
assert.equal(compiler.moduleResolution, "Bundler");
assert.equal(compiler.strict, true);
assert.equal(compiler.exactOptionalPropertyTypes, true);
assert.equal(compiler.noFallthroughCasesInSwitch, true);
assert.equal(compiler.noImplicitOverride, true);
assert.equal(compiler.noImplicitReturns, true);
assert.equal(compiler.noUncheckedIndexedAccess, true);
assert.equal(compiler.noUncheckedSideEffectImports, true);
assert.equal(compiler.verbatimModuleSyntax, true);
assert.equal(compiler.erasableSyntaxOnly, true);
assert.equal(compiler.allowArbitraryExtensions, undefined);
assert.equal(compiler.allowImportingTsExtensions, true);
assert.equal(compiler.moduleDetection, "force");
assert.equal(compiler.isolatedModules, true);
assert.equal(compiler.noEmit, true);

assert.equal(testConfig.extends, "./tsconfig.json");
assert.deepEqual(testConfig.compilerOptions.types, [
  "vite/client",
  "vitest/globals",
  "@testing-library/jest-dom",
  "node",
]);
assert.equal(toolingConfig.extends, "./tsconfig.json");
assert.deepEqual(toolingConfig.compilerOptions.lib, ["ES2022"]);
assert.deepEqual(toolingConfig.compilerOptions.types, ["node"]);
assert.deepEqual(toolingConfig.include, ["vite.config.ts", "vitest.config.ts"]);
assert.equal(e2eConfig.extends, "./tsconfig.json");
assert.deepEqual(e2eConfig.compilerOptions.types, ["node", "@playwright/test"]);

assert.equal(
  packageData.scripts.typecheck,
  "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
);
assert.equal(
  packageData.scripts["typecheck:tooling"],
  "tsc --noEmit -p tsconfig.tooling.json",
);
assert.equal(
  packageData.scripts["typecheck:e2e"],
  "tsc --noEmit -p tsconfig.e2e.json",
);
assert.equal(fs.existsSync(path.join(projectRoot, "vite.config.ts")), true);
assert.equal(fs.existsSync(path.join(projectRoot, "vitest.config.ts")), true);
assert.equal(fs.existsSync(path.join(projectRoot, "vite.config.mjs")), false);
assert.equal(fs.existsSync(path.join(projectRoot, "vitest.config.mjs")), false);
assert.equal(
  fs.existsSync(path.join(projectRoot, "src/react-app-env.d.ts")),
  false,
);

process.stdout.write(
  "TypeScript 5.9 keeps browser, test, tooling, and Playwright environments explicitly separated.\n",
);
