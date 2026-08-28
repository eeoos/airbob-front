import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  getArchitectureComparisonRevisions,
  listFilesAtRevision,
  readFileAtRevision,
} from "./git-baselines.mjs";

const require = createRequire(import.meta.url);
const {
  readArchitectureRatchet,
  validateArchitectureRatchetData,
} = require("./read-architecture-ratchet.cjs");
const {
  discoverFeatureOwnershipScopes,
  getFeatureOwnershipScope,
} = require("./feature-scope-policy.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const registryPath = "architecture-ratchet.json";

export const findLiveRemovedFeatures = ({
  baselineFeatures,
  currentFeatures,
  root,
}) => {
  const current = new Set(currentFeatures);

  return baselineFeatures.filter(
    (feature) =>
      !current.has(feature) &&
      fs.existsSync(path.join(root, "src/features", ...feature.split("/"))),
  );
};

export const verifyArchitectureRatchet = ({ root = projectRoot } = {}) => {
  const currentRatchet = readArchitectureRatchet({ projectRoot: root });
  const comparisons = getArchitectureComparisonRevisions(root);
  const currentFeatureScopes = discoverFeatureOwnershipScopes(root);

  for (const comparison of comparisons) {
    const historicalFeatureScopes = new Set(
      listFilesAtRevision(
        root,
        comparison.revision,
        "src/features",
      )
        .map(getFeatureOwnershipScope)
        .filter(Boolean),
    );
    const unregisteredNewFeatureScopes = currentFeatureScopes.filter(
      (scope) =>
        !historicalFeatureScopes.has(scope) &&
        !currentRatchet.migratedFeatures.includes(scope),
    );

    if (unregisteredNewFeatureScopes.length > 0) {
      throw new Error(
        `New feature roots must enter the strict registry relative to ${comparison.label}: ` +
          unregisteredNewFeatureScopes.join(", "),
      );
    }

    const source = readFileAtRevision(
      root,
      comparison.revision,
      registryPath,
    );

    if (source === null) {
      continue;
    }

    let historicalData;
    try {
      historicalData = JSON.parse(source);
    } catch (error) {
      throw new Error(
        `${registryPath} at ${comparison.label} is not valid JSON.`,
        { cause: error },
      );
    }

    const historical = validateArchitectureRatchetData(historicalData, {
      validateConfiguredNestedScopes: false,
    });
    const liveRemovedFeatures = findLiveRemovedFeatures({
      baselineFeatures: historical.migratedFeatures,
      currentFeatures: currentRatchet.migratedFeatures,
      root,
    });

    if (liveRemovedFeatures.length > 0) {
      throw new Error(
        `architecture-ratchet.json cannot remove live migrated features relative to ${comparison.label}: ` +
          liveRemovedFeatures.join(", "),
      );
    }
  }

  process.stdout.write(
    `Architecture registry passed existence and monotonic checks against ${comparisons.length} Git baseline(s).\n`,
  );
};

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  verifyArchitectureRatchet();
}
