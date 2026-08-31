import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(architectureDirectory, "../..");
const knipBinary = path.join(projectRoot, "node_modules/knip/bin/knip.js");

const fixtureRoot = await realpath(
  await mkdtemp(path.join(os.tmpdir(), "airbob-knip-dependency-classification-")),
);

const writeFixtureFile = async (relativePath, source) => {
  const filePath = path.join(fixtureRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, source, "utf8");
};

const createPackage = (name) => ({
  name,
  version: "1.0.0",
  private: true,
  type: "module",
});

const fakePackageFiles = (name) => ({
  [`node_modules/${name}/package.json`]: JSON.stringify({
    name,
    version: "1.0.0",
    type: "module",
    exports: "./index.js",
  }),
  [`node_modules/${name}/index.js`]: "export const value = true;\n",
});

const baseKnipConfig = JSON.stringify({
  entry: ["src/index.js!", "src/**/*.test.js"],
  project: ["src/**/*.js!", "!src/**/*.test.js!"],
  rules: {
    dependencies: "error",
    devDependencies: "error",
    unlisted: "error",
    binaries: "error",
  },
});

const scenarios = [
  {
    name: "runtime dependency declared as development-only",
    packageData: {
      devDependencies: { "runtime-lib": "1.0.0" },
    },
    files: {
      "src/index.js": 'import { value } from "runtime-lib"; void value;\n',
      ...fakePackageFiles("runtime-lib"),
    },
    expectedIssue: "unlisted",
    expectedValue: "runtime-lib",
  },
  {
    name: "test-only dependency declared as runtime",
    packageData: {
      dependencies: { "test-tool": "1.0.0" },
    },
    files: {
      "src/index.js": "export const application = true;\n",
      "src/index.test.js": 'import { value } from "test-tool"; void value;\n',
      ...fakePackageFiles("test-tool"),
    },
    expectedIssue: "dependencies",
    expectedValue: "test-tool",
  },
  {
    name: "unused runtime dependency",
    packageData: {
      dependencies: { "unused-runtime-lib": "1.0.0" },
    },
    files: {
      "src/index.js": "export const application = true;\n",
      ...fakePackageFiles("unused-runtime-lib"),
    },
    expectedIssue: "dependencies",
    expectedValue: "unused-runtime-lib",
  },
  {
    name: "unlisted imported dependency",
    packageData: {},
    files: {
      "src/index.js": 'import { value } from "unlisted-lib"; void value;\n',
      ...fakePackageFiles("unlisted-lib"),
    },
    expectedIssue: "unlisted",
    expectedValue: "unlisted-lib",
  },
  {
    name: "unlisted package binary",
    packageData: {
      scripts: { start: "unlisted-bin" },
    },
    files: {
      "src/index.js": "export const application = true;\n",
    },
    expectedIssue: "binaries",
    expectedValue: "unlisted-bin",
  },
  {
    name: "unused development dependency",
    packageData: {
      devDependencies: { "unused-test-tool": "1.0.0" },
    },
    files: {
      "src/index.js": "export const application = true;\n",
      ...fakePackageFiles("unused-test-tool"),
    },
    mode: "full-development",
    expectedIssue: "devDependencies",
    expectedValue: "unused-test-tool",
  },
];

const runKnip = (scenario) => {
  const result = spawnSync(
    process.execPath,
    [
      knipBinary,
      "--directory",
      fixtureRoot,
      "--config",
      "knip.json",
      "--include",
      "dependencies,devDependencies,unlisted,binaries",
      ...(scenario.mode === "full-development"
        ? []
        : ["--production", "--strict"]),
      "--reporter",
      "json",
      "--no-exit-code",
      "--no-progress",
      "--no-config-hints",
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );

  if (result.error || result.status !== 0) {
    throw new Error(
      `Knip could not execute ${scenario.name}.\n${result.error ?? ""}\n${result.stderr}`,
    );
  }

  try {
    return JSON.parse(result.stdout).issues;
  } catch (error) {
    throw new Error(
      `Knip did not return JSON for ${scenario.name}.\n${result.stdout}\n${result.stderr}\n${error}`,
    );
  }
};

const hasExpectedIssue = (issues, expectedIssue, expectedValue) =>
  issues.some(
    (issue) =>
      issue[expectedIssue] &&
      JSON.stringify(issue[expectedIssue]).includes(expectedValue),
  );

try {
  for (const scenario of scenarios) {
    await writeFixtureFile(
      "package.json",
      JSON.stringify({ ...createPackage("knip-classification-fixture"), ...scenario.packageData }),
    );
    await writeFixtureFile("knip.json", baseKnipConfig);

    for (const [relativePath, source] of Object.entries(scenario.files)) {
      await writeFixtureFile(relativePath, source);
    }

    const issues = runKnip(scenario);
    if (!hasExpectedIssue(issues, scenario.expectedIssue, scenario.expectedValue)) {
      throw new Error(
        `Knip did not flag ${scenario.name} as ${scenario.expectedIssue}:${scenario.expectedValue}.\n` +
          JSON.stringify(issues, null, 2),
      );
    }

    await rm(fixtureRoot, { recursive: true, force: true });
    await mkdir(fixtureRoot, { recursive: true });
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(
  "Knip dependency-classification fixtures passed for misplaced, unused, unlisted, and binary declarations across production and development graphs.\n",
);
