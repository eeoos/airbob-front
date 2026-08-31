import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { collectProductionSourcePaths } = require("./source-policy.cjs");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const sourceRoot = path.join(projectRoot, "src");
const dependencyCruiseBinary = path.join(
  projectRoot,
  "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
);
const productionSources = collectProductionSourcePaths({
  projectRoot,
  sourceRoot,
});
const result = spawnSync(
  process.execPath,
  [
    dependencyCruiseBinary,
    "--config",
    path.join(projectRoot, ".dependency-cruiser.cjs"),
    "--output-type",
    "err-long",
    "--",
    ...productionSources,
  ],
  {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
