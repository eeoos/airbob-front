import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format, getFileInfo, resolveConfig } from "prettier";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const prettierConfigPath = path.join(projectRoot, ".prettierrc.json");
const editorConfigPath = path.join(projectRoot, ".editorconfig");
const prettierIgnorePath = path.join(projectRoot, ".prettierignore");
const exampleSourcePath = path.join(projectRoot, "src/format-contract.ts");
const packageData = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);

assert.equal(packageData.prettier, undefined);
assert.equal(packageData.devDependencies.prettier, "3.9.6");
assert.equal(packageData.scripts.format, "prettier --write .");
assert.equal(packageData.scripts["format:check"], "prettier --check .");

const architectureRuleCommands =
  packageData.scripts["test:architecture-rules"].split(" && ");
assert.equal(
  architectureRuleCommands.filter(
    (command) =>
      command === "node tests/architecture/verify-prettier-config.mjs",
  ).length,
  1,
);

assert.equal(fs.existsSync(prettierConfigPath), true);
assert.equal(fs.existsSync(editorConfigPath), true);
assert.equal(fs.existsSync(prettierIgnorePath), true);

const resolvedConfig = await resolveConfig(exampleSourcePath, {
  editorconfig: true,
  useCache: false,
});
assert.notEqual(resolvedConfig, null);
assert.equal(resolvedConfig.singleQuote, false);
assert.equal(resolvedConfig.tabWidth, 2);
assert.equal(resolvedConfig.useTabs, false);
assert.equal(resolvedConfig.endOfLine, "lf");

const formatted = await format(
  'const message = "hello";\nconst values = [1,2,3]\n',
  {
    ...resolvedConfig,
    filepath: exampleSourcePath,
  },
);
assert.equal(
  formatted,
  'const message = "hello";\nconst values = [1, 2, 3];\n',
);

const editorConfigSource = fs.readFileSync(editorConfigPath, "utf8");
for (const requiredSetting of [
  /^root\s*=\s*true$/imu,
  /^\[\*\]$/mu,
  /^charset\s*=\s*utf-8$/imu,
  /^end_of_line\s*=\s*lf$/imu,
  /^insert_final_newline\s*=\s*true$/imu,
  /^indent_style\s*=\s*space$/imu,
  /^indent_size\s*=\s*2$/imu,
  /^trim_trailing_whitespace\s*=\s*true$/imu,
]) {
  assert.match(editorConfigSource, requiredSetting);
}

for (const ignoredPath of [
  "build/generated.js",
  "coverage/report.json",
  "node_modules/example/index.js",
  "playwright-report/index.html",
  "test-results/result.json",
  ".gstack/qa-reports/report.md",
  ".vercel/output/config.json",
  "docs/archive/historical.md",
  "docs/superpowers/plans/historical.md",
  "docs/architecture/current-frontend-architecture.md",
  "docs/architecture/frontend-browser-data-inventory.md",
  "docs/architecture/frontend-ownership-matrix.md",
  "package-lock.json",
]) {
  const fileInfo = await getFileInfo(path.join(projectRoot, ignoredPath), {
    ignorePath: prettierIgnorePath,
    resolveConfig: false,
    withNodeModules: true,
  });
  assert.equal(fileInfo.ignored, true, `${ignoredPath} must remain ignored.`);
}

const sourceFileInfo = await getFileInfo(exampleSourcePath, {
  ignorePath: prettierIgnorePath,
  resolveConfig: false,
  withNodeModules: true,
});
assert.equal(sourceFileInfo.ignored, false);
assert.equal(sourceFileInfo.inferredParser, "typescript");

process.stdout.write(
  "Prettier resolves the shared config and EditorConfig, formats source deterministically, and excludes generated or hand-maintained artifacts.\n",
);
