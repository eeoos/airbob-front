import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getArchitectureComparisonRevisions,
  readFileAtRevision,
} from "./git-baselines.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");

const dependencyDeclarations = (packageData) =>
  Object.fromEntries(
    Object.entries(packageData.dependencies ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
const dependencyNames = (declarations) => Object.keys(declarations);
const registrySemverRangePattern =
  /^(?:\^|~)?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const canonicalKnipConfig = Object.freeze({
  $schema: "./node_modules/knip/schema.json",
  entry: Object.freeze([
    "src/index.tsx!",
    "src/test/**/*.{js,jsx,mjs,ts,tsx}",
    "src/**/*.{test,spec}.{js,jsx,mjs,ts,tsx}",
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "scripts/**/*.{cjs,mjs}",
    "tests/e2e/specs/**/*.spec.ts",
    "tests/e2e/support/**/*.mjs",
    "tests/architecture/**/*.mjs",
    ".dependency-cruiser.cjs",
    "stylelint.config.mjs",
  ]),
  project: Object.freeze([
    "src/**/*.{js,jsx,mjs,ts,tsx}!",
    "!src/**/__tests__/**/*.{js,jsx,mjs,ts,tsx}!",
    "!src/**/__mocks__/**/*.{js,jsx,mjs,ts,tsx}!",
    "!src/**/*.{test,spec}.{js,jsx,mjs,ts,tsx}!",
    "!src/test/**/*.{js,jsx,mjs,ts,tsx}!",
    "vite.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "scripts/**/*.{cjs,mjs}",
    "tests/**/*.{ts,mjs}",
    ".dependency-cruiser.cjs",
    "stylelint.config.mjs",
  ]),
  vite: false,
  vitest: false,
  rules: Object.freeze([
    "files",
    "dependencies",
    "devDependencies",
    "unlisted",
    "binaries",
    "unresolved",
    "exports",
    "nsExports",
    "types",
    "nsTypes",
    "enumMembers",
    "classMembers",
    "duplicates",
  ]),
});

const assertExactSequence = (name, actual, expected) => {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(
      `Knip ${name} must match the canonical architecture coverage exactly.`,
    );
  }
};

export const assertNoUnsupportedRuntimeDependencySections = (packageData) => {
  const unsupportedDependencies = [
    "optionalDependencies",
    "peerDependencies",
  ].flatMap(
    (section) =>
      Object.keys(packageData[section] ?? {}).map((name) => `${section}:${name}`),
  );
  const unsupportedInstallGraphSections = [
    "overrides",
    "resolutions",
    "bundleDependencies",
    "bundledDependencies",
    "workspaces",
  ].filter((section) => {
    const value = packageData[section];

    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === "object") {
      return Object.keys(value).length > 0;
    }

    return value !== undefined && value !== null && value !== false;
  });
  const unsupported = [
    ...unsupportedDependencies,
    ...unsupportedInstallGraphSections,
  ];

  if (unsupported.length > 0) {
    throw new Error(
      "Private frontend install graph must be declared directly in dependencies/devDependencies; " +
        `unsupported entries: ${unsupported.sort().join(", ")}`,
    );
  }
};

export const assertPackageLockIsSoleNpmLockOwner = (root) => {
  if (fs.existsSync(path.join(root, "npm-shrinkwrap.json"))) {
    throw new Error(
      "npm-shrinkwrap.json is forbidden; package-lock.json is the sole npm install-graph owner.",
    );
  }
};

export const assertRegistryDependencySpecs = (packageData) => {
  const unsupportedSpecs = ["dependencies", "devDependencies"].flatMap(
    (section) =>
      Object.entries(packageData[section] ?? {})
        .filter(
          ([, spec]) =>
            typeof spec !== "string" ||
            !registrySemverRangePattern.test(spec),
        )
        .map(([name, spec]) => `${section}:${name}@${String(spec)}`),
  );

  if (unsupportedSpecs.length > 0) {
    throw new Error(
      "Dependency declarations must use registry semver versions; npm aliases, tags, URLs, and local/git specs are forbidden: " +
        unsupportedSpecs.sort().join(", "),
    );
  }
};

export const findArtificialProductionEntries = (entries = []) =>
  entries.filter(
    (entry) =>
      typeof entry === "string" &&
      entry.startsWith("src/") &&
      entry !== "src/index.tsx!" &&
      !entry.startsWith("src/test/") &&
      !entry.includes("{test,spec}"),
  );

export const assertKnipConfigIsCanonical = (knipConfig) => {
  const suppressionKeys = Object.keys(knipConfig).filter(
    (key) => key === "exclude" || key.startsWith("ignore"),
  );
  if (suppressionKeys.length > 0) {
    throw new Error(
      `Knip suppression keys are forbidden: ${suppressionKeys.sort().join(", ")}`,
    );
  }

  const artificialProductionEntries = findArtificialProductionEntries(
    knipConfig.entry,
  );
  if (artificialProductionEntries.length > 0) {
    throw new Error(
      "Knip production modules must be reached from src/index.tsx, not artificial entries: " +
      artificialProductionEntries.join(", "),
    );
  }

  const canonicalTopLevelKeys = [
    "$schema",
    "entry",
    "project",
    "rules",
    "vite",
    "vitest",
  ];
  const actualTopLevelKeys = Object.keys(knipConfig).sort();
  if (
    actualTopLevelKeys.length !== canonicalTopLevelKeys.length ||
    actualTopLevelKeys.some(
      (key, index) => key !== [...canonicalTopLevelKeys].sort()[index],
    )
  ) {
    throw new Error(
      "Knip config may contain only the canonical schema, entry, project, explicit Vite/Vitest ownership, and rules keys.",
    );
  }

  if (knipConfig.$schema !== canonicalKnipConfig.$schema) {
    throw new Error("Knip schema path must remain canonical.");
  }

  assertExactSequence("entry", knipConfig.entry, canonicalKnipConfig.entry);
  assertExactSequence("project", knipConfig.project, canonicalKnipConfig.project);
  if (
    knipConfig.vite !== canonicalKnipConfig.vite ||
    knipConfig.vitest !== canonicalKnipConfig.vitest
  ) {
    throw new Error(
      "Knip Vite/Vitest plugins must remain disabled; explicit entry/project globs own reachability while dedicated config tests own semantics.",
    );
  }

  const actualRuleNames = Object.keys(knipConfig.rules ?? {});
  assertExactSequence("rule set", actualRuleNames, canonicalKnipConfig.rules);
  const weakenedRules = actualRuleNames.filter(
    (ruleName) => knipConfig.rules[ruleName] !== "error",
  );
  if (weakenedRules.length > 0) {
    throw new Error(
      `Knip rules must remain error-level: ${weakenedRules.join(", ")}`,
    );
  }
};

const equalDeclarations = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

export const findNewUnusedDependencies = ({
  currentDependencies,
  baselineDependencies,
  changedDependencies = [],
  unusedDependencies,
}) => {
  const current = new Set(currentDependencies);
  const baseline = new Set(baselineDependencies);
  const changed = new Set(changedDependencies);

  return unusedDependencies
    .filter(
      (name) =>
        current.has(name) && (!baseline.has(name) || changed.has(name)),
    )
    .sort();
};

export const assertNoNewUnusedDependencies = ({
  baselineLabel,
  currentDependencies,
  baselineDependencies,
  changedDependencies,
  unusedDependencies,
}) => {
  const newUnusedDependencies = findNewUnusedDependencies({
    currentDependencies,
    baselineDependencies,
    changedDependencies,
    unusedDependencies,
  });

  if (newUnusedDependencies.length > 0) {
    throw new Error(
      `New unused runtime dependencies relative to ${baselineLabel}: ${newUnusedDependencies.join(", ")}`,
    );
  }
};

const readCurrentUnusedDependencies = () => {
  const knipBinary = path.join(projectRoot, "node_modules/knip/dist/cli.js");
  const result = spawnSync(
    process.execPath,
    [
      knipBinary,
      "--production",
      "--reporter",
      "json",
      "--no-progress",
      "--no-exit-code",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Knip dependency ratchet failed to execute.\n${result.stderr}`);
  }

  const rows = JSON.parse(result.stdout);
  const packageRow = rows.find((row) => row.file === "package.json");

  return [...(packageRow?.dependencies ?? [])].sort();
};

export const verifyUnusedDependencyRatchet = () => {
  const currentPackage = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
  assertNoUnsupportedRuntimeDependencySections(currentPackage);
  assertRegistryDependencySpecs(currentPackage);
  assertPackageLockIsSoleNpmLockOwner(projectRoot);
  assertKnipConfigIsCanonical(
    JSON.parse(fs.readFileSync(path.join(projectRoot, "knip.json"), "utf8")),
  );
  const currentDeclarations = dependencyDeclarations(currentPackage);
  const currentDependencies = dependencyNames(currentDeclarations);
  const comparisons = getArchitectureComparisonRevisions(projectRoot);
  const baseline = comparisons
    .map((comparison) => {
      const source = readFileAtRevision(
        projectRoot,
        comparison.revision,
        "package.json",
      );

      if (source === null) {
        return null;
      }

      const declarations = dependencyDeclarations(JSON.parse(source));

      return {
        ...comparison,
        declarations,
        dependencies: dependencyNames(declarations),
      };
    })
    .find(
      (comparison) =>
        comparison !== null &&
        !equalDeclarations(comparison.declarations, currentDeclarations),
    );

  if (!baseline) {
    process.stdout.write(
      "Unused dependency ratchet passed (runtime dependency declarations unchanged).\n",
    );
    return;
  }

  assertNoNewUnusedDependencies({
    baselineLabel: baseline.label,
    currentDependencies,
    baselineDependencies: baseline.dependencies,
    changedDependencies: currentDependencies.filter(
      (name) => baseline.declarations[name] !== currentDeclarations[name],
    ),
    unusedDependencies: readCurrentUnusedDependencies(),
  });

  process.stdout.write(
    `Unused dependency ratchet passed relative to ${baseline.label}.\n`,
  );
};

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  verifyUnusedDependencyRatchet();
}
