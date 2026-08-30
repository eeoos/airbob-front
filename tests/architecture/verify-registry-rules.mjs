import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findLiveRemovedFeatures } from "../../scripts/architecture/verify-architecture-ratchet.mjs";
import {
  assertKnipConfigIsCanonical,
  assertNoUnsupportedRuntimeDependencySections,
  assertPackageLockIsSoleNpmLockOwner,
  assertRegistryDependencySpecs,
  assertNoNewUnusedDependencies,
  findNewUnusedDependencies,
  findArtificialProductionEntries,
} from "../../scripts/architecture/verify-unused-dependency-ratchet.mjs";

const require = createRequire(import.meta.url);
const { readArchitectureRatchet, validateArchitectureRatchetData } = require(
  "../../scripts/architecture/read-architecture-ratchet.cjs",
);
const { createTargetPolicy } = require(
  "../../scripts/architecture/target-policy.cjs",
);
const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = await mkdtemp(
  path.join(os.tmpdir(), "airbob-architecture-registry-"),
);

const writeFixture = async ({ registry, files = {} }) => {
  await rm(fixtureRoot, { recursive: true, force: true });
  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "architecture-ratchet.json"),
    JSON.stringify(registry),
    "utf8",
  );

  for (const [relativePath, source] of Object.entries(files)) {
    const filePath = path.join(fixtureRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, source, "utf8");
  }
};

const expectFailure = async (name, fixture, expectedMessage) => {
  await writeFixture(fixture);

  try {
    readArchitectureRatchet({ projectRoot: fixtureRoot });
  } catch (error) {
    if (String(error.message).includes(expectedMessage)) {
      return;
    }

    throw new Error(`${name} failed for the wrong reason: ${error.message}`);
  }

  throw new Error(`${name} unexpectedly passed.`);
};

try {
  await writeFixture({
    registry: {
      migratedFeatures: [
        "accommodations/detail",
        "accommodations/edit",
        "search",
      ],
    },
    files: {
      "src/features/accommodations/detail/model.ts":
        "export const detail = true;\n",
      "src/features/accommodations/edit/model.ts": "export const edit = true;\n",
      "src/features/search/model.jsx": "export const search = true;\n",
    },
  });
  const valid = readArchitectureRatchet({ projectRoot: fixtureRoot });
  if (
    valid.migratedFeatures.join(",") !==
    "accommodations/detail,accommodations/edit,search"
  ) {
    throw new Error("Valid top-level and nested feature paths were not preserved.");
  }
  const nestedPolicy = createTargetPolicy({ projectRoot: fixtureRoot });
  if (
    !nestedPolicy.isTargetPath(
      "src/features/accommodations/edit/model.ts",
    ) ||
    !nestedPolicy.isTargetPath(
      "src/features/accommodations/detail/model.ts",
    ) ||
    nestedPolicy.isTargetPath("src/features/accommodations/model.ts")
  ) {
    throw new Error("Nested feature promotion leaked into its parent scope.");
  }

  await writeFixture({
    registry: { migratedFeatures: ["accommodations"] },
    files: {
      "src/features/accommodations/model.ts":
        "export const accommodation = true;\n",
      "src/features/accommodations/detail/model.ts":
        "export const detail = true;\n",
      "src/features/accommodations/edit/model.ts":
        "export const edit = true;\n",
    },
  });
  const parentPolicy = createTargetPolicy({ projectRoot: fixtureRoot });
  if (
    !parentPolicy.isTargetPath("src/features/accommodations/model.ts") ||
    parentPolicy.isTargetPath(
      "src/features/accommodations/detail/model.ts",
    ) ||
    parentPolicy.isTargetPath(
      "src/features/accommodations/edit/model.ts",
    )
  ) {
    throw new Error("Parent feature promotion swallowed the editor scope.");
  }

  await expectFailure(
    "missing feature",
    { registry: { migratedFeatures: ["missing"] } },
    "does not exist",
  );
  await expectFailure(
    "test-only feature",
    {
      registry: { migratedFeatures: ["search"] },
      files: {
        "src/features/search/__tests__/model.test.ts":
          "export const testOnly = true;\n",
      },
    },
    "no production source",
  );
  await expectFailure(
    "parent feature with only nested child source",
    {
      registry: { migratedFeatures: ["accommodations"] },
      files: {
        "src/features/accommodations/edit/model.ts":
          "export const edit = true;\n",
      },
    },
    "no production source",
  );
  await expectFailure(
    "duplicate feature",
    {
      registry: { migratedFeatures: ["search", "search"] },
      files: { "src/features/search/model.ts": "export const search = true;\n" },
    },
    "must not contain duplicates",
  );
  await expectFailure(
    "unsorted feature",
    {
      registry: { migratedFeatures: ["wishlist", "search"] },
      files: {
        "src/features/search/model.ts": "export const search = true;\n",
        "src/features/wishlist/model.ts": "export const wishlist = true;\n",
      },
    },
    "must remain sorted",
  );
  await expectFailure(
    "unknown registry key",
    {
      registry: { migratedFeatures: [], ignoredFeatures: ["search"] },
    },
    "must contain only",
  );
  await expectFailure(
    "undeclared nested feature scope",
    {
      registry: { migratedFeatures: ["catalog/admin"] },
      files: {
        "src/features/catalog/admin/model.ts": "export const admin = true;\n",
      },
    },
    "undeclared nested feature scopes",
  );
  const historicalNestedFeature = validateArchitectureRatchetData(
    { migratedFeatures: ["catalog/admin"] },
    { validateConfiguredNestedScopes: false },
  );
  if (historicalNestedFeature.migratedFeatures[0] !== "catalog/admin") {
    throw new Error("A retired historical nested scope could not be compared.");
  }

  await writeFixture({
    registry: { migratedFeatures: [] },
    files: { "src/features/search/model.js": "export const search = true;\n" },
  });
  const liveRemoval = findLiveRemovedFeatures({
    baselineFeatures: ["search"],
    currentFeatures: [],
    root: fixtureRoot,
  });
  if (liveRemoval.join(",") !== "search") {
    throw new Error("A live strict-registry rollback was not rejected.");
  }
  await rm(path.join(fixtureRoot, "src/features/search"), {
    recursive: true,
    force: true,
  });
  if (
    findLiveRemovedFeatures({
      baselineFeatures: ["search"],
      currentFeatures: [],
      root: fixtureRoot,
    }).length !== 0
  ) {
    throw new Error("A removed U22 feature root could not leave the registry.");
  }

  const newUnused = findNewUnusedDependencies({
    currentDependencies: ["existing-debt", "new-unused", "used-package"],
    baselineDependencies: ["existing-debt"],
    unusedDependencies: ["existing-debt", "new-unused"],
  });
  if (newUnused.join(",") !== "new-unused") {
    throw new Error("The changed unused-dependency ratchet did not isolate new debt.");
  }
  let newUnusedWasRejected = false;
  try {
    assertNoNewUnusedDependencies({
      baselineLabel: "fixture base",
      currentDependencies: ["new-unused"],
      baselineDependencies: [],
      unusedDependencies: ["new-unused"],
    });
  } catch (error) {
    if (!String(error.message).includes("new-unused")) {
      throw error;
    }

    newUnusedWasRejected = true;
  }
  if (!newUnusedWasRejected) {
    throw new Error("A newly introduced unused runtime dependency passed.");
  }
  let unsupportedRuntimeSectionWasRejected = false;
  try {
    assertNoUnsupportedRuntimeDependencySections({
      optionalDependencies: { "optional-runtime": "1.0.0" },
    });
  } catch (error) {
    if (!String(error.message).includes("optional-runtime")) {
      throw error;
    }

    unsupportedRuntimeSectionWasRejected = true;
  }
  if (!unsupportedRuntimeSectionWasRejected) {
    throw new Error("An optional runtime dependency bypassed the Knip ratchet.");
  }
  let installOverrideWasRejected = false;
  try {
    assertNoUnsupportedRuntimeDependencySections({
      overrides: { "follow-redirects": "npm:other-package@1.0.0" },
    });
  } catch (error) {
    if (!String(error.message).includes("overrides")) {
      throw error;
    }

    installOverrideWasRejected = true;
  }
  if (!installOverrideWasRejected) {
    throw new Error("A root package override redirected the install graph.");
  }
  let workspaceInstallGraphWasRejected = false;
  try {
    assertNoUnsupportedRuntimeDependencySections({
      workspaces: ["packages/*"],
    });
  } catch (error) {
    if (!String(error.message).includes("workspaces")) {
      throw error;
    }

    workspaceInstallGraphWasRejected = true;
  }
  if (!workspaceInstallGraphWasRejected) {
    throw new Error("A workspace package expanded the npm install graph.");
  }

  await writeFile(path.join(fixtureRoot, "npm-shrinkwrap.json"), "{}\n");
  let competingLockfileWasRejected = false;
  try {
    assertPackageLockIsSoleNpmLockOwner(fixtureRoot);
  } catch (error) {
    if (!String(error.message).includes("npm-shrinkwrap.json")) {
      throw error;
    }

    competingLockfileWasRejected = true;
  }
  await rm(path.join(fixtureRoot, "npm-shrinkwrap.json"));
  if (!competingLockfileWasRejected) {
    throw new Error("npm-shrinkwrap.json replaced the canonical lock owner.");
  }
  let dependencyAliasWasRejected = false;
  try {
    assertRegistryDependencySpecs({
      dependencies: { axios: "npm:lodash@4.17.21" },
    });
  } catch (error) {
    if (!String(error.message).includes("npm:lodash")) {
      throw error;
    }

    dependencyAliasWasRejected = true;
  }
  if (!dependencyAliasWasRejected) {
    throw new Error("An npm alias hid behind an existing dependency name.");
  }

  const changedUnused = findNewUnusedDependencies({
    currentDependencies: ["existing-debt"],
    baselineDependencies: ["existing-debt"],
    changedDependencies: ["existing-debt"],
    unusedDependencies: ["existing-debt"],
  });
  if (changedUnused.join(",") !== "existing-debt") {
    throw new Error("A changed spec for existing unused debt escaped the ratchet.");
  }
  let knipSuppressionWasRejected = false;
  try {
    assertKnipConfigIsCanonical({
      entry: ["src/index.tsx!"],
      ignoreDependencies: ["hidden-package"],
    });
  } catch (error) {
    if (!String(error.message).includes("ignoreDependencies")) {
      throw error;
    }

    knipSuppressionWasRejected = true;
  }
  if (!knipSuppressionWasRejected) {
    throw new Error("A Knip dependency suppression bypassed the policy.");
  }
  let artificialEntryWasRejected = false;
  try {
    assertKnipConfigIsCanonical({
      entry: ["src/index.tsx!", "src/features/search/DeadRoute.tsx"],
    });
  } catch (error) {
    if (!String(error.message).includes("DeadRoute.tsx")) {
      throw error;
    }

    artificialEntryWasRejected = true;
  }
  if (!artificialEntryWasRejected) {
    throw new Error("An artificial production entry hid dead source.");
  }

  const testHarnessEntries = [
    "src/test/helper.js",
    "src/test/helper.jsx",
    "src/test/helper.mjs",
    "src/test/helper.ts",
    "src/test/renderApp.tsx",
  ];
  if (findArtificialProductionEntries(testHarnessEntries).length > 0) {
    throw new Error("A src/test harness was mistaken for production source.");
  }

  const canonicalKnipConfig = JSON.parse(
    await readFile(path.join(architectureDirectory, "../../knip.json"), "utf8"),
  );
  assertKnipConfigIsCanonical(canonicalKnipConfig);

  let weakenedKnipRuleWasRejected = false;
  try {
    assertKnipConfigIsCanonical({
      ...canonicalKnipConfig,
      rules: { ...canonicalKnipConfig.rules, files: "off" },
    });
  } catch (error) {
    if (!String(error.message).includes("files")) {
      throw error;
    }

    weakenedKnipRuleWasRejected = true;
  }
  if (!weakenedKnipRuleWasRejected) {
    throw new Error("A disabled Knip reachability rule bypassed the policy.");
  }

  let narrowedKnipProjectWasRejected = false;
  try {
    assertKnipConfigIsCanonical({
      ...canonicalKnipConfig,
      project: canonicalKnipConfig.project.filter(
        (entry) => entry !== "src/**/*.{js,jsx,mjs,ts,tsx}!",
      ),
    });
  } catch (error) {
    if (!String(error.message).includes("project")) {
      throw error;
    }

    narrowedKnipProjectWasRejected = true;
  }
  if (!narrowedKnipProjectWasRejected) {
    throw new Error("A narrowed Knip project glob bypassed the policy.");
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(
  `Architecture registry fixtures passed from ${path.relative(process.cwd(), architectureDirectory)}.\n`,
);
