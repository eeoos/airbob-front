const {
  readArchitectureRatchet,
} = require("./read-architecture-ratchet.cjs");
const {
  discoverFeatureOwnershipScopes,
  getFeatureOwnershipScope,
} = require("./feature-scope-policy.cjs");

const fixedTargetLayers = ["app", "screens", "workflows", "platform", "shared"];

const toProjectPath = (filePath, projectRoot) => {
  const normalized = String(filePath).replaceAll("\\", "/");
  const normalizedRoot = projectRoot.replaceAll("\\", "/").replace(/\/$/, "");

  if (normalized.startsWith(`${normalizedRoot}/`)) {
    return normalized.slice(normalizedRoot.length + 1);
  }

  const sourceIndex = normalized.lastIndexOf("/src/");
  return sourceIndex >= 0 ? normalized.slice(sourceIndex + 1) : normalized;
};

const isWithin = (filePath, root) =>
  filePath === root || filePath.startsWith(`${root}/`);

const createTargetPolicy = ({ projectRoot }) => {
  const { migratedFeatures } = readArchitectureRatchet({ projectRoot });
  const featureScopes = discoverFeatureOwnershipScopes(projectRoot).sort(
    (left, right) => right.split("/").length - left.split("/").length,
  );
  const featureScopeSet = new Set(featureScopes);
  const migratedSet = new Set(migratedFeatures);

  const getFeatureOwner = (filePath) => {
    const projectPath = toProjectPath(filePath, projectRoot);

    const owner = getFeatureOwnershipScope(projectPath);

    return owner !== null && featureScopeSet.has(owner) ? owner : null;
  };

  const isTargetPath = (filePath) => {
    const projectPath = toProjectPath(filePath, projectRoot);

    if (
      fixedTargetLayers.some((layer) =>
        isWithin(projectPath, `src/${layer}`),
      )
    ) {
      return true;
    }

    const featureOwner = getFeatureOwner(projectPath);
    return featureOwner !== null && migratedSet.has(featureOwner);
  };

  return Object.freeze({
    isTargetPath,
  });
};

module.exports = Object.freeze({
  createTargetPolicy,
});
