import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(architectureDirectory, "../..");
const dependencyCruiseBinary = path.join(
  projectRoot,
  "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
);
const dependencyConfigBuilder = path.join(
  projectRoot,
  "scripts/architecture/create-dependency-config.cjs",
);
const { createDependencyConfig } = require(dependencyConfigBuilder);
const { collectProductionSourcePaths, isProductionSourcePath } = require(
  path.join(projectRoot, "scripts/architecture/source-policy.cjs"),
);
const fixtureCacheRoot = path.join(
  projectRoot,
  "node_modules/.cache/airbob-architecture-fixtures",
);

let omittedRegistryWasRejected = false;
try {
  createDependencyConfig({ projectRoot });
} catch (error) {
  if (!String(error.message).includes("migratedFeatures")) {
    throw error;
  }

  omittedRegistryWasRejected = true;
}
if (!omittedRegistryWasRejected) {
  throw new Error("Dependency rules silently defaulted to an empty registry.");
}

const baseFiles = {
  "package.json": JSON.stringify({
    private: true,
    devDependencies: { picocolors: "1.1.1" },
  }),
  "node_modules/picocolors/package.json": JSON.stringify({
    name: "picocolors",
    version: "1.1.1",
    main: "index.js",
  }),
  "node_modules/picocolors/index.js":
    'exports.red = (value) => value;\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      allowJs: true,
      module: "esnext",
      moduleResolution: "node",
      strict: true,
      target: "es2020",
    },
    include: ["src"],
  }),
};

const writeFixture = async (root, files, migratedFeatures = []) => {
  for (const [relativePath, source] of Object.entries({
    ...baseFiles,
    ".dependency-cruiser.cjs":
      `const { createDependencyConfig } = require(${JSON.stringify(dependencyConfigBuilder)});\n` +
      `module.exports = createDependencyConfig({ projectRoot: __dirname, migratedFeatures: ${JSON.stringify(migratedFeatures)} });\n`,
    ...files,
  })) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, source, "utf8");
  }
};

const cruise = (root) => {
  const result = spawnSync(
    process.execPath,
    [
      dependencyCruiseBinary,
      "--config",
      path.join(root, ".dependency-cruiser.cjs"),
      "--output-type",
      "json",
      "src",
    ],
    {
      cwd: root,
      encoding: "utf8",
    },
  );

  if (!result.stdout) {
    throw new Error(
      `Dependency fixture produced no JSON.\n${result.stderr || ""}`,
    );
  }

  return {
    report: JSON.parse(result.stdout),
    status: result.status,
    stderr: result.stderr,
  };
};

const validationStatus = (root) =>
  spawnSync(
    process.execPath,
    [
      dependencyCruiseBinary,
      "--config",
      path.join(root, ".dependency-cruiser.cjs"),
      "--output-type",
      "err-long",
      "src",
    ],
    {
      cwd: root,
      encoding: "utf8",
    },
  ).status;

const getViolationNames = (report, severity = "error") =>
  report.summary.violations
    .filter((violation) => violation.rule.severity === severity)
    .map((violation) => violation.rule.name);

const excludedProductionEntries = [
  "src/setupTests.ts",
  "src/setupTests.mjs",
  "src/test/helper.js",
  "src/test/helper.jsx",
  "src/test/helper.mjs",
  "src/test/helper.ts",
  "src/test/renderApp.tsx",
  "src/shared/runtime.test.ts",
  "src/shared/runtime.test.mjs",
  "src/shared/runtime.spec.tsx",
  "src/shared/types.d.ts",
  "src/shared/__tests__/helper.ts",
  "src/shared/__mocks__/client.ts",
];

for (const relativePath of excludedProductionEntries) {
  if (isProductionSourcePath(relativePath)) {
    throw new Error(
      `Architecture wrapper classified test-only source as production: ${relativePath}`,
    );
  }
}

for (const relativePath of [
  "src/shared/runtime.ts",
  "src/app/entry.tsx",
  "src/platform/tool.js",
  "src/shared/runtime.mjs",
]) {
  if (!isProductionSourcePath(relativePath)) {
    throw new Error(
      `Architecture wrapper excluded production source: ${relativePath}`,
    );
  }
}

const scenarios = [
  {
    name: "valid target DAG",
    files: {
      "src/shared/value.ts": "export const value = 1;\n",
      "src/platform/client.ts":
        'import { value } from "../shared/value"; export const client = value;\n',
      "src/features/search/model.ts":
        'import { value } from "../../shared/value"; export type Search = typeof value;\n',
      "src/features/search/api/searchPort.ts":
        "export const searchPort = true;\n",
      "src/features/search/ui/header.ts":
        'export { type Search } from "../model";\n',
      "src/app/header/Header.ts":
        'import type { Search } from "../../features/search/ui/header"; export type HeaderSearch = Search;\n',
      "src/workflows/search/command.ts":
        'import { searchPort } from "../../features/search/api/searchPort"; import { client } from "../../platform/client"; import { workflowValue } from "./model"; export const command = [client, searchPort, workflowValue];\n',
      "src/workflows/search/model.ts":
        "export const workflowValue = 1;\n",
      "src/screens/search/SearchScreen.ts":
        'import type { Search } from "../../features/search/model"; import { view } from "./SearchView"; export const screen = (value: Search) => [value, view];\n',
      "src/screens/search/SearchView.ts": "export const view = true;\n",
      "src/app/entry.ts":
        'import { screen } from "../screens/search/SearchScreen"; import { command } from "../workflows/search/command"; export const app = [screen, command];\n',
    },
  },
  {
    name: "shared imports app",
    expectedRule: "shared-is-domain-free",
    files: {
      "src/app/entry.ts": "export const app = true;\n",
      "src/shared/bad.ts":
        'import { app } from "../app/entry"; export const bad = app;\n',
    },
  },
  {
    name: "MJS shared module imports app",
    expectedRule: "shared-is-domain-free",
    files: {
      "src/app/entry.mjs": "export const app = true;\n",
      "src/shared/bad.mjs":
        'import { app } from "../app/entry.mjs"; export const bad = app;\n',
    },
  },
  {
    name: "shared imports removed pages",
    expectedRule: "shared-is-domain-free",
    files: {
      "src/pages/Legacy.ts": "export const legacy = true;\n",
      "src/shared/bad.ts":
        'import { legacy } from "../pages/Legacy"; export const bad = legacy;\n',
    },
  },
  {
    name: "app imports a legacy global root",
    expectedRule: "app-imports-only-target-layers",
    files: {
      "src/routes/legacy.ts": "export const legacyRoute = true;\n",
      "src/app/entry.ts":
        'import { legacyRoute } from "../routes/legacy"; export const app = legacyRoute;\n',
    },
  },
  {
    name: "app imports feature public UI and port surfaces",
    files: {
      "src/features/search/ui/SearchShell.ts":
        "export const searchShell = true;\n",
      "src/features/search/ports/searchPort.ts":
        "export const searchPort = true;\n",
      "src/features/search/public.ts":
        "export const publicSearch = true;\n",
      "src/features/accommodations/listing-editor/public.ts":
        "export const listingEditor = true;\n",
      "src/app/entry.ts":
        'import { searchShell } from "../features/search/ui/SearchShell"; import { searchPort } from "../features/search/ports/searchPort"; import { publicSearch } from "../features/search/public"; import { listingEditor } from "../features/accommodations/listing-editor/public"; export const app = [searchShell, searchPort, publicSearch, listingEditor];\n',
    },
  },
  {
    name: "app imports a private feature module",
    expectedRule: "app-uses-feature-public-surfaces",
    files: {
      "src/features/accommodations/listing-editor/model/private.ts":
        "export const privateEditor = true;\n",
      "src/app/entry.ts":
        'import { privateEditor } from "../features/accommodations/listing-editor/model/private"; export const app = privateEditor;\n',
    },
  },
  {
    name: "migrated search adapter imports a private feature helper",
    expectedRule: "app-uses-feature-public-surfaces",
    files: {
      "src/features/search/hooks/private.ts":
        "export const privateSearch = true;\n",
      "src/app/router/routes/SearchRoute.ts":
        'import { privateSearch } from "../../../features/search/hooks/private"; export const route = privateSearch;\n',
    },
  },
  {
    name: "platform imports a feature",
    expectedRule: "platform-imports-only-shared",
    files: {
      "src/features/catalog/port.ts": "export const port = true;\n",
      "src/platform/client.ts":
        'import { port } from "../features/catalog/port"; export const client = port;\n',
    },
  },
  {
    name: "workflow imports a screen",
    expectedRule: "workflows-use-only-allowed-layers",
    files: {
      "src/screens/search/view.ts": "export const view = true;\n",
      "src/workflows/search/command.ts":
        'import { view } from "../../screens/search/view"; export const command = view;\n',
    },
  },
  {
    name: "workflow imports a peer workflow",
    expectedRule: "workflows-have-no-peer-imports",
    files: {
      "src/workflows/checkout/command.ts": "export const checkout = true;\n",
      "src/workflows/search/command.ts":
        'import { checkout } from "../checkout/command"; export const search = checkout;\n',
    },
  },
  {
    name: "workflow imports a private feature module",
    expectedRule: "workflows-use-feature-public-ports",
    files: {
      "src/features/search/components/private.ts":
        "export const privateSearch = true;\n",
      "src/workflows/search/command.ts":
        'import { privateSearch } from "../../features/search/components/private"; export const search = privateSearch;\n',
    },
  },
  {
    name: "screen imports platform",
    expectedRule: "screens-use-only-allowed-layers",
    files: {
      "src/platform/client.ts": "export const client = true;\n",
      "src/screens/search/SearchController.ts":
        'import { client } from "../../platform/client"; export const controller = client;\n',
    },
  },
  {
    name: "screen imports a legacy global root",
    expectedRules: [
      "screens-use-only-allowed-layers",
      "production-does-not-import-retired-global-api",
    ],
    files: {
      "src/api/client.ts": "export const client = true;\n",
      "src/screens/search/SearchController.ts":
        'import { client } from "../../api/client"; export const controller = client;\n',
    },
  },
  {
    name: "screen imports a peer screen",
    expectedRule: "screens-have-no-peer-imports",
    files: {
      "src/screens/profile/view.ts": "export const profile = true;\n",
      "src/screens/search/SearchController.ts":
        'import { profile } from "../profile/view"; export const controller = profile;\n',
    },
  },
  {
    name: "private cross-feature import",
    expectedRule: "feature-catalog-has-no-peer-imports",
    files: {
      "src/features/loyalty/hooks/private.ts":
        "export const privateLoyalty = true;\n",
      "src/features/catalog/model.ts":
        'import { privateLoyalty } from "../loyalty/hooks/private"; export const catalog = privateLoyalty;\n',
    },
  },
  {
    name: "feature imports a peer appShell compatibility filename",
    expectedRule: "feature-catalog-has-no-peer-imports",
    files: {
      "src/features/loyalty/appShell.ts":
        "export const legacyLoyaltyShell = true;\n",
      "src/features/catalog/model.ts":
        'import { legacyLoyaltyShell } from "../loyalty/appShell"; export const catalog = legacyLoyaltyShell;\n',
    },
  },
  {
    name: "feature imports a peer publicCache compatibility filename",
    expectedRule: "feature-catalog-has-no-peer-imports",
    files: {
      "src/features/loyalty/publicCache.ts":
        "export const legacyLoyaltyCache = true;\n",
      "src/features/catalog/model.ts":
        'import { legacyLoyaltyCache } from "../loyalty/publicCache"; export const catalog = legacyLoyaltyCache;\n',
    },
  },
  {
    name: "accommodations parent cannot bridge the listing editor public surface",
    expectedRule: "feature-accommodations-has-no-peer-imports",
    files: {
      "src/features/accommodations/listing-editor/public.ts":
        "export const editor = true;\n",
      "src/features/accommodations/public.ts":
        'import { editor } from "./listing-editor/public"; export const accommodation = editor;\n',
    },
  },
  {
    name: "accommodations listing editor imports parent private module",
    expectedRule: "feature-accommodations-listing-editor-has-no-peer-imports",
    files: {
      "src/features/accommodations/private.ts":
        "export const accommodation = true;\n",
      "src/features/accommodations/listing-editor/model.ts":
        'import { accommodation } from "../private"; export const editor = accommodation;\n',
    },
  },
  {
    name: "migrated feature imports a legacy global root",
    migratedFeatures: ["catalog"],
    expectedRules: [
      "migrated-feature-catalog-uses-target-layers",
      "production-does-not-import-retired-global-api",
    ],
    files: {
      "src/api/catalog.ts": "export const request = true;\n",
      "src/features/catalog/model.ts":
        'import { request } from "../../api/catalog"; export const catalog = request;\n',
    },
  },
  {
    name: "UI imports the global API",
    expectedRule: "production-does-not-import-retired-global-api",
    files: {
      "src/api/client.ts": "export const request = true;\n",
      "src/components/Card.ts":
        'import { request } from "../api/client"; export const card = request;\n',
    },
  },
  {
    name: "feature public UI imports the global API",
    expectedRule: "production-does-not-import-retired-global-api",
    files: {
      "src/api/client.ts": "export const request = true;\n",
      "src/features/search/ui/PublicWidget.ts":
        'import { request } from "../../../api/client"; export const widget = request;\n',
    },
  },
  {
    name: "UI imports a wire DTO",
    expectedRule: "production-does-not-import-retired-global-wire-dtos",
    files: {
      "src/types/wire.ts": "export type Wire = { id: number };\n",
      "src/components/Card.ts":
        'import type { Wire } from "../types/wire"; export type Card = Wire;\n',
    },
  },
  {
    name: "feature root public UI imports a wire DTO",
    expectedRule: "production-does-not-import-retired-global-wire-dtos",
    files: {
      "src/types/wire.ts": "export type Wire = { id: number };\n",
      "src/features/search/public.tsx":
        'import type { Wire } from "../../types/wire"; export type PublicSearch = Wire;\n',
    },
  },
  {
    name: "non-UI feature module imports the retired global API",
    expectedRule: "production-does-not-import-retired-global-api",
    files: {
      "src/api/catalog.ts": "export const request = true;\n",
      "src/features/catalog/model.ts":
        'import { request } from "../../api/catalog"; export const catalog = request;\n',
    },
  },
  {
    name: "non-UI feature module imports a retired global wire DTO",
    expectedRule: "production-does-not-import-retired-global-wire-dtos",
    files: {
      "src/types/wire.ts": "export type Wire = { id: number };\n",
      "src/features/catalog/model.ts":
        'import type { Wire } from "../../types/wire"; export type Catalog = Wire;\n',
    },
  },
  {
    name: "feature imports removed pages",
    expectedRule: "features-do-not-import-removed-pages",
    files: {
      "src/pages/Legacy.ts": "export const legacy = true;\n",
      "src/features/search/model.ts":
        'import { legacy } from "../../pages/Legacy"; export const search = legacy;\n',
    },
  },
  {
    name: "module cycle",
    expectedRule: "target-has-no-module-cycles",
    files: {
      "src/shared/a.ts":
        'import { b } from "./b"; export const a = b ?? "a";\n',
      "src/shared/b.ts":
        'import { a } from "./a"; export const b = a ?? "b";\n',
    },
  },
  {
    name: "folder cycle without a module cycle",
    expectedRule: "target-has-no-folder-cycles",
    forbiddenRule: "target-has-no-module-cycles",
    files: {
      "src/app/a/to-b.ts":
        'import { fromB } from "../b/from-b"; export const toB = fromB;\n',
      "src/app/a/from-a.ts": "export const fromA = true;\n",
      "src/app/b/from-b.ts": "export const fromB = true;\n",
      "src/app/b/to-a.ts":
        'import { fromA } from "../a/from-a"; export const toA = fromA;\n',
    },
  },
  {
    name: "type-only cycle",
    expectedRule: "target-has-no-module-cycles",
    expectsTypeOnlyEdge: true,
    files: {
      "src/shared/a.ts":
        'import type { B } from "./b"; export type A = { b?: B };\n',
      "src/shared/b.ts":
        'import type { A } from "./a"; export type B = { a?: A };\n',
    },
  },
  {
    name: "production imports a test",
    expectedRule: "production-does-not-import-tests",
    files: {
      "src/shared/runtime.test.ts": "export const fixture = true;\n",
      "src/shared/runtime.ts":
        'import { fixture } from "./runtime.test"; export const runtime = fixture;\n',
    },
  },
  {
    name: "production imports a __tests__ helper",
    expectedRule: "production-does-not-import-tests",
    files: {
      "src/shared/__tests__/helper.ts": "export const fixture = true;\n",
      "src/shared/runtime.ts":
        'import { fixture } from "./__tests__/helper"; export const runtime = fixture;\n',
    },
  },
  {
    name: "production imports a __mocks__ module",
    expectedRule: "production-does-not-import-tests",
    files: {
      "src/platform/__mocks__/client.ts": "export const mockClient = true;\n",
      "src/platform/client.ts":
        'import { mockClient } from "./__mocks__/client"; export const client = mockClient;\n',
    },
  },
  {
    name: "production imports a src test harness",
    expectedRules: [
      "production-does-not-import-tests",
      "shared-is-domain-free",
    ],
    files: {
      "src/test/renderApp.tsx": "export const renderApp = true;\n",
      "src/shared/runtime.ts":
        'import { renderApp } from "../test/renderApp"; export const runtime = renderApp;\n',
    },
  },
  {
    name: "production imports a dev dependency",
    expectedRule: "production-does-not-import-dev-dependencies",
    files: {
      "src/app/entry.ts":
        'import { red } from "picocolors"; export const app = red("app");\n',
    },
  },
  {
    name: "unresolvable import",
    expectedRule: "no-unresolvable",
    files: {
      "src/shared/value.ts":
        'import { missing } from "./missing"; export const value = missing;\n',
    },
  },
];

await mkdir(fixtureCacheRoot, { recursive: true });

const symlinkFixtureRoot = await mkdtemp(
  path.join(fixtureCacheRoot, "source-symlink-"),
);
try {
  const sourceRoot = path.join(symlinkFixtureRoot, "src");
  await mkdir(path.join(sourceRoot, "legacy-app"), { recursive: true });
  await writeFile(
    path.join(sourceRoot, "legacy-app/entry.ts"),
    "export const app = true;\n",
  );
  await symlink("legacy-app", path.join(sourceRoot, "app"));

  let fixedTargetSymlinkWasRejected = false;
  try {
    collectProductionSourcePaths({
      projectRoot: symlinkFixtureRoot,
      sourceRoot,
    });
  } catch (error) {
    if (!String(error.message).includes("Symbolic links are forbidden under src")) {
      throw error;
    }

    fixedTargetSymlinkWasRejected = true;
  }
  if (!fixedTargetSymlinkWasRejected) {
    throw new Error("A fixed target symlink escaped production graph collection.");
  }
} finally {
  await rm(symlinkFixtureRoot, { recursive: true, force: true });
}

for (const scenario of scenarios) {
  const fixtureRoot = await mkdtemp(
    path.join(fixtureCacheRoot, "dependency-rule-"),
  );

  try {
    await writeFixture(
      fixtureRoot,
      scenario.files,
      scenario.migratedFeatures,
    );
    const { report, status, stderr } = cruise(fixtureRoot);
    const errors = getViolationNames(report);
    const errorSet = new Set(errors);
    const expectedRules = new Set(
      scenario.expectedRules ??
        (scenario.expectedRule ? [scenario.expectedRule] : []),
    );

    if (expectedRules.size === 0 && (status !== 0 || errors.length > 0)) {
      throw new Error(
        `${scenario.name} should pass but failed with ${errors.join(", ")}.\n${stderr}`,
      );
    }

    if (expectedRules.size > 0 && validationStatus(fixtureRoot) === 0) {
      throw new Error(
        `${scenario.name} reported an architecture error without a failing process status.`,
      );
    }

    const missingRules = [...expectedRules].filter(
      (ruleName) => !errorSet.has(ruleName),
    );
    const unexpectedRules = [...errorSet].filter(
      (ruleName) => !expectedRules.has(ruleName),
    );
    if (missingRules.length > 0 || unexpectedRules.length > 0) {
      const dependencies = report.modules.flatMap((module) =>
        module.dependencies.map((dependency) => ({
          from: module.source,
          to: dependency.resolved,
          types: dependency.dependencyTypes,
        })),
      );
      throw new Error(
        `${scenario.name} rule mismatch. Missing: ${missingRules.join(", ")}; unexpected: ${unexpectedRules.join(", ")}\n${JSON.stringify(dependencies, null, 2)}`,
      );
    }

    if (scenario.forbiddenRule && errors.includes(scenario.forbiddenRule)) {
      throw new Error(
        `${scenario.name} unexpectedly triggered ${scenario.forbiddenRule}.`,
      );
    }

    if (scenario.expectsTypeOnlyEdge) {
      const hasTypeOnlyEdge = report.modules.some((module) =>
        module.dependencies.some((dependency) =>
          dependency.dependencyTypes?.includes("type-only"),
        ),
      );

      if (!hasTypeOnlyEdge) {
        throw new Error("Type-only dependency disappeared from the graph.");
      }
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

process.stdout.write(
  `Dependency architecture fixtures passed (${scenarios.length} scenarios).\n`,
);
