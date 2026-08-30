const fs = require("node:fs");
const path = require("node:path");
const { assertRealSourceTree } = require("./source-policy.cjs");

const configuredNestedFeatureScopes = Object.freeze([
  "accommodations/detail",
  "accommodations/edit",
  "reservations/payment",
]);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getNestedFeatureScopes = (scope, featureScopes) =>
  featureScopes.filter(
    (candidate) =>
      candidate !== scope && candidate.startsWith(`${scope}/`),
  );

const createFeatureOwnershipPathPattern = (scope, featureScopes) => {
  const nestedScopes = getNestedFeatureScopes(scope, featureScopes);
  const childExclusion =
    nestedScopes.length === 0
      ? ""
      : `(?!(?:${nestedScopes
          .map(
            (child) =>
              `/${escapeRegex(child.slice(scope.length + 1))}`,
          )
          .join("|")})(?:/|$))`;

  return (
    `^src/features/${escapeRegex(scope)}` +
    `${childExclusion}(?:/|$)`
  );
};

const createFeatureSurfacePathPattern = (featureScopes, surfacePattern) => {
  const scopePattern =
    featureScopes.length === 0
      ? "(?!)"
      : featureScopes.map(escapeRegex).join("|");

  return `^src/features/(?:${scopePattern})/(?:${surfacePattern})`;
};

const getFeatureOwnershipScope = (projectPath) => {
  const normalizedPath = String(projectPath).replaceAll("\\", "/");
  const featurePath = normalizedPath.match(/^src\/features\/([^/]+)(?:\/(.*))?$/);

  if (!featurePath) {
    return null;
  }

  const topLevelScope = featurePath[1];
  const nestedScope = configuredNestedFeatureScopes
    .filter(
      (scope) =>
        normalizedPath === `src/features/${scope}` ||
        normalizedPath.startsWith(`src/features/${scope}/`),
    )
    .sort((left, right) => right.length - left.length)[0];

  return nestedScope ?? topLevelScope;
};

const discoverFeatureOwnershipScopes = (projectRoot) => {
  const featuresRoot = path.join(projectRoot, "src/features");

  if (!fs.existsSync(featuresRoot)) {
    return [];
  }

  assertRealSourceTree(featuresRoot, "src/features");

  const topLevelScopes = fs
    .readdirSync(featuresRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      if (!/^[a-z][a-z0-9-]*$/.test(entry.name)) {
        throw new TypeError(
          `Invalid feature directory for architecture rules: ${entry.name}`,
        );
      }

      return entry.name;
    });
  const presentNestedScopes = configuredNestedFeatureScopes.filter((scope) =>
    fs.existsSync(path.join(featuresRoot, ...scope.split("/"))),
  );

  return [...topLevelScopes, ...presentNestedScopes].sort();
};

module.exports = Object.freeze({
  configuredNestedFeatureScopes,
  createFeatureOwnershipPathPattern,
  createFeatureSurfacePathPattern,
  discoverFeatureOwnershipScopes,
  getFeatureOwnershipScope,
});
