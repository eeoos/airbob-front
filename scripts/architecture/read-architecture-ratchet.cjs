const fs = require("node:fs");
const path = require("node:path");
const {
  configuredNestedFeatureScopes,
  getFeatureOwnershipScope,
} = require("./feature-scope-policy.cjs");
const { isProductionSourcePath } = require("./source-policy.cjs");

const defaultProjectRoot = path.resolve(__dirname, "../..");
const featurePathPattern =
  /^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/;

const freezeRatchet = (migratedFeatures) =>
  Object.freeze({
    migratedFeatures: Object.freeze([...migratedFeatures]),
  });

const validateArchitectureRatchetData = (
  data,
  { validateConfiguredNestedScopes = true } = {},
) => {
  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !Array.isArray(data.migratedFeatures) ||
    Object.keys(data).some((key) => key !== "migratedFeatures") ||
    data.migratedFeatures.some(
      (name) => typeof name !== "string" || !featurePathPattern.test(name),
    )
  ) {
    throw new TypeError(
      "architecture-ratchet.json must contain only a migratedFeatures array of feature paths.",
    );
  }

  if (new Set(data.migratedFeatures).size !== data.migratedFeatures.length) {
    throw new TypeError(
      "architecture-ratchet.json migratedFeatures must not contain duplicates.",
    );
  }

  const unsupportedNestedFeatures = validateConfiguredNestedScopes
    ? data.migratedFeatures.filter(
        (name) =>
          name.includes("/") && !configuredNestedFeatureScopes.includes(name),
      )
    : [];
  if (unsupportedNestedFeatures.length > 0) {
    throw new TypeError(
      "architecture-ratchet.json contains undeclared nested feature scopes: " +
        unsupportedNestedFeatures.join(", "),
    );
  }

  const sortedMigratedFeatures = [...data.migratedFeatures].sort();
  if (
    data.migratedFeatures.some(
      (name, index) => name !== sortedMigratedFeatures[index],
    )
  ) {
    throw new TypeError(
      "architecture-ratchet.json migratedFeatures must remain sorted.",
    );
  }

  return freezeRatchet(data.migratedFeatures);
};

const hasProductionSource = (projectRoot, directory, feature) =>
  fs.readdirSync(directory, { withFileTypes: true }).some((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return hasProductionSource(projectRoot, entryPath, feature);
    }

    const projectPath = path
      .relative(projectRoot, entryPath)
      .replaceAll("\\", "/");

    return (
      entry.isFile() &&
      isProductionSourcePath(projectPath) &&
      getFeatureOwnershipScope(projectPath) === feature
    );
  });

const validateRegisteredFeatureRoots = (ratchet, projectRoot) => {
  const featuresRoot = path.join(projectRoot, "src/features");

  for (const feature of ratchet.migratedFeatures) {
    const featureRoot = path.join(featuresRoot, ...feature.split("/"));
    let featureStat;

    try {
      featureStat = fs.lstatSync(featureRoot);
    } catch {
      throw new TypeError(
        `architecture-ratchet.json migrated feature does not exist: ${feature}`,
      );
    }

    if (!featureStat.isDirectory()) {
      throw new TypeError(
        `architecture-ratchet.json migrated feature must be a real directory: ${feature}`,
      );
    }

    if (!hasProductionSource(projectRoot, featureRoot, feature)) {
      throw new TypeError(
        `architecture-ratchet.json migrated feature has no production source: ${feature}`,
      );
    }
  }

  return ratchet;
};

const readArchitectureRatchet = ({ projectRoot = defaultProjectRoot } = {}) => {
  const ratchetPath = path.join(projectRoot, "architecture-ratchet.json");
  const data = JSON.parse(fs.readFileSync(ratchetPath, "utf8"));
  const ratchet = validateArchitectureRatchetData(data);

  return validateRegisteredFeatureRoots(ratchet, projectRoot);
};

module.exports = Object.freeze({
  ...readArchitectureRatchet(),
  readArchitectureRatchet,
  validateArchitectureRatchetData,
});
