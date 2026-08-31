/** @type {import("dependency-cruiser").IConfiguration} */

const {
  createDependencyConfig,
} = require("./scripts/architecture/create-dependency-config.cjs");
const {
  migratedFeatures,
} = require("./scripts/architecture/read-architecture-ratchet.cjs");

module.exports = createDependencyConfig({
  migratedFeatures,
  projectRoot: __dirname,
});
