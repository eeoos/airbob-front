import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const projectRoot = process.cwd();
const require = createRequire(import.meta.url);
const {
  collectProductionSourcePaths,
  findForbiddenRuntimeTokenAccess,
  findRuntimeDesignLiteralViolations,
  runtimeDesignLiteralIntegrationPaths,
  runtimeDesignTokenOwnerPath,
} = require("../../scripts/architecture/source-policy.cjs");

const sourcePaths = collectProductionSourcePaths({
  projectRoot,
  sourceRoot: path.join(projectRoot, "src"),
});

const expectedRuntimeDesignLiteralIntegrationPaths = [
  "src/features/search/components/SearchMap/lib/infoWindowContent.ts",
  "src/features/search/components/SearchMap/lib/infoWindowDom.ts",
];

if (
  JSON.stringify(runtimeDesignLiteralIntegrationPaths) !==
  JSON.stringify(expectedRuntimeDesignLiteralIntegrationPaths)
) {
  throw new Error(
    `Runtime design-literal exceptions changed outside the explicit two-adapter inventory:\n${runtimeDesignLiteralIntegrationPaths.join("\n")}`,
  );
}

const designLiteralViolations = sourcePaths.flatMap((relativePath) =>
  findRuntimeDesignLiteralViolations(
    relativePath,
    fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
  ).map(({ kind, match }) => `${relativePath}:${kind}:${match}`),
);

if (designLiteralViolations.length > 0) {
  throw new Error(
    `Runtime design literals must use the shared typed policy:\n${designLiteralViolations.join("\n")}`,
  );
}

const runtimeTokenAccessViolations = sourcePaths.flatMap((relativePath) =>
  findForbiddenRuntimeTokenAccess(
    relativePath,
    fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
  ).map(({ kind, match }) => `${relativePath}:${kind}:${match}`),
);

if (runtimeTokenAccessViolations.length > 0) {
  throw new Error(
    `Shared/screens must not read runtime design values from the DOM or platform:\n${runtimeTokenAccessViolations.join("\n")}`,
  );
}

for (const integrationPath of runtimeDesignLiteralIntegrationPaths) {
  if (!sourcePaths.includes(integrationPath)) {
    throw new Error(
      `Missing explicit vendor integration adapter: ${integrationPath}`,
    );
  }
}

if (!sourcePaths.includes(runtimeDesignTokenOwnerPath)) {
  throw new Error(
    `Missing runtime design-token owner: ${runtimeDesignTokenOwnerPath}`,
  );
}

const ownerSource = fs.readFileSync(
  path.join(projectRoot, runtimeDesignTokenOwnerPath),
  "utf8",
);
if (/\b(?:document|getComputedStyle)\b/u.test(ownerSource)) {
  throw new Error("The runtime design-token owner must remain pure.");
}

const invalidLiteralFixtures = [
  'export const color = "#fff";',
  'export const color = "rgba(0, 0, 0, 0.2)";',
  'export const style = { borderRadius: "12px" };',
  'export const style = { boxShadow: "0 2px 8px rgb(0 0 0 / 15%)" };',
];
for (const source of invalidLiteralFixtures) {
  if (
    findRuntimeDesignLiteralViolations(
      "src/screens/__architecture__/Invalid.tsx",
      source,
    ).length === 0
  ) {
    throw new Error(`Invalid runtime design literal escaped policy: ${source}`);
  }
}

if (
  findRuntimeDesignLiteralViolations(
    runtimeDesignLiteralIntegrationPaths[0],
    'export const vendorColor = "#fff";',
  ).length > 0
) {
  throw new Error("The explicit vendor integration exception is not narrow.");
}

const invalidAccessFixtures = [
  "export const value = getComputedStyle(document.documentElement);",
  'import { reader } from "../../platform/browser/runtimeDesignTokenReader";',
];
for (const source of invalidAccessFixtures) {
  if (
    findForbiddenRuntimeTokenAccess(
      "src/shared/__architecture__/Invalid.ts",
      source,
    ).length === 0
  ) {
    throw new Error(`Invalid runtime token access escaped policy: ${source}`);
  }
}
