import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findSensitiveTextViolations,
  readRuntimeSensitiveValues,
  redactSensitiveText,
} from "../../e2e/support/sensitive-text.mjs";
import {
  createLocalPlaywrightEnvironment,
  loadLocalIntegrationEnvironment,
  LOCAL_INTEGRATION_ENV_KEYS,
  LOCAL_INTEGRATION_PROJECTS,
  LocalIntegrationBlockedError,
} from "./environment.mjs";
import { runStandalonePreflight } from "./run-preflight.mjs";
import {
  assertFrontendReady,
  assertFrontendUnchanged,
  LOCAL_INTEGRATION_MANIFEST_ROOT,
  readFrontendState,
  readMatchingCoreManifest,
} from "./runner-gate.mjs";

const supportDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(supportDirectory, "../../..");
const playwrightEntry = path.join(
  projectRoot,
  "node_modules/@playwright/test/cli.js",
);
const manifestPath = (manifestRoot, project) =>
  path.join(manifestRoot, project, "result.json");

const ensureOwnedDirectory = async (directory) => {
  await mkdir(directory, { mode: 0o700, recursive: true });
  const stats = await lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("Local integration result directory was unsafe.");
  }
  return realpath(directory);
};

export const writeSafeManifest = async ({
  environment,
  manifest,
  manifestRoot,
}) => {
  const runtimeSensitiveValues = readRuntimeSensitiveValues(environment);
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const redacted = redactSensitiveText(serialized, { runtimeSensitiveValues });

  if (
    redacted !== serialized ||
    findSensitiveTextViolations(redacted, { runtimeSensitiveValues }).length > 0
  ) {
    throw new Error("Local integration result manifest was not privacy-safe.");
  }

  if (!Object.values(LOCAL_INTEGRATION_PROJECTS).includes(manifest.project)) {
    throw new Error("Local integration result project was invalid.");
  }

  const canonicalRoot = await ensureOwnedDirectory(path.resolve(manifestRoot));
  const projectDirectory = path.join(canonicalRoot, manifest.project);
  const canonicalProjectDirectory =
    await ensureOwnedDirectory(projectDirectory);
  if (path.dirname(canonicalProjectDirectory) !== canonicalRoot) {
    throw new Error("Local integration result path escaped its root.");
  }

  const outputPath = manifestPath(canonicalRoot, manifest.project);
  const temporaryPath = path.join(
    canonicalProjectDirectory,
    `.result-${randomUUID()}.tmp`,
  );
  let temporaryFile = null;
  try {
    temporaryFile = await open(
      temporaryPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW |
        constants.O_WRONLY,
      0o600,
    );
    await temporaryFile.writeFile(serialized, { encoding: "utf8" });
    await temporaryFile.sync();
    await temporaryFile.close();
    temporaryFile = null;

    let existing = null;
    try {
      existing = await lstat(outputPath);
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) {
        throw error;
      }
    }
    if (existing !== null) {
      if (!existing.isFile() && !existing.isSymbolicLink()) {
        throw new Error("Local integration result target was unsafe.");
      }
      await rm(outputPath, { force: true });
    }
    await rename(temporaryPath, outputPath);
    return outputPath;
  } finally {
    await temporaryFile?.close();
    await rm(temporaryPath, { force: true });
  }
};

export const runPlaywrightProject = ({
  environment,
  project,
  spawnImpl = spawn,
}) =>
  new Promise((resolve, reject) => {
    const child = spawnImpl(
      process.execPath,
      [
        playwrightEntry,
        "test",
        "--config=playwright.local-integration.config.ts",
        `--project=${project}`,
      ],
      {
        cwd: projectRoot,
        env: environment,
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve(code === 0 && signal === null ? 0 : 1);
    });
  });

const runProjectStage = async ({
  clock,
  configuration,
  environment,
  frontend,
  manifestRoot,
  project,
  runId,
  runPreflight,
  runProject,
  expectedFrontend = null,
}) => {
  const startedAt = clock().toISOString();
  const requireToss = project === LOCAL_INTEGRATION_PROJECTS.toss;
  const runnerEnvironment = createLocalPlaywrightEnvironment(environment, {
    [LOCAL_INTEGRATION_ENV_KEYS.activeProject]: project,
    [LOCAL_INTEGRATION_ENV_KEYS.runId]: runId,
  });
  let assertionStatus = "NOT_RUN";
  let cleanupStatus = "NOT_REQUIRED";
  let evidenceStatus = "BLOCKED_UNVERIFIED";
  let exitCode = 2;
  let preflightStatus = "BLOCKED_UNVERIFIED";

  try {
    if (expectedFrontend === null) assertFrontendReady(frontend);
    else assertFrontendUnchanged(expectedFrontend, frontend);
    if (requireToss) {
      await readMatchingCoreManifest({
        backendRevision: configuration.backend.revision,
        frontend,
        manifestRoot,
        runId,
      });
    }
    await runPreflight({
      environment: runnerEnvironment,
      requireRunnerIdentity: true,
      requireToss,
    });
    preflightStatus = "PASS";
    cleanupStatus = "EXTERNAL_RESET_REQUIRED";
    exitCode = await runProject({
      environment: runnerEnvironment,
      project,
    });
    assertionStatus = exitCode === 0 ? "PASS" : "FAIL";
    evidenceStatus = exitCode === 0 ? "BLOCKED_UNVERIFIED" : "FAIL";
  } catch (error) {
    if (!(error instanceof LocalIntegrationBlockedError)) {
      assertionStatus = "FAIL";
      evidenceStatus = "FAIL";
      exitCode = 1;
    }
  }

  const manifest = Object.freeze({
    schema: "airbob-local-integration-result-v1",
    runId,
    project,
    assertionStatus,
    evidenceStatus,
    preflightStatus,
    cleanupStatus,
    startedAt,
    finishedAt: clock().toISOString(),
    frontend,
    backend: Object.freeze({ revision: configuration.backend.revision }),
    resetAuthorization: configuration.resetAuthorization,
  });
  const artifactPath = await writeSafeManifest({
    environment: runnerEnvironment,
    manifest,
    manifestRoot,
  });

  return Object.freeze({ artifactPath, exitCode, manifest });
};

export const runLocalIntegrationProfile = async ({
  clock = () => new Date(),
  environment = process.env,
  manifestRoot = LOCAL_INTEGRATION_MANIFEST_ROOT,
  project = LOCAL_INTEGRATION_PROJECTS.core,
  readFrontend = readFrontendState,
  runId = randomUUID(),
  runPreflight = runStandalonePreflight,
  runProject = runPlaywrightProject,
} = {}) => {
  if (
    project !== LOCAL_INTEGRATION_PROJECTS.core &&
    project !== LOCAL_INTEGRATION_PROJECTS.toss
  ) {
    throw new LocalIntegrationBlockedError("invalid local project");
  }

  const configuration = loadLocalIntegrationEnvironment({
    environment,
    now: clock,
    requireToss: project === LOCAL_INTEGRATION_PROJECTS.toss,
  });
  const coreFrontend = readFrontend();
  const core = await runProjectStage({
    clock,
    configuration,
    environment,
    frontend: coreFrontend,
    manifestRoot,
    project: LOCAL_INTEGRATION_PROJECTS.core,
    runId,
    runPreflight,
    runProject,
  });
  if (core.exitCode !== 0 || project === LOCAL_INTEGRATION_PROJECTS.core) {
    return core.exitCode;
  }

  const tossFrontend = readFrontend();
  const toss = await runProjectStage({
    clock,
    configuration,
    environment,
    frontend: tossFrontend,
    manifestRoot,
    project: LOCAL_INTEGRATION_PROJECTS.toss,
    runId,
    runPreflight,
    runProject,
    expectedFrontend: coreFrontend,
  });
  return toss.exitCode;
};

const readRequestedProject = (argv) => {
  const argument = argv.find((value) => value.startsWith("--project="));
  return (
    argument?.slice("--project=".length) ?? LOCAL_INTEGRATION_PROJECTS.core
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await runLocalIntegrationProfile({
      project: readRequestedProject(process.argv.slice(2)),
    });
  } catch (error) {
    const message =
      error instanceof LocalIntegrationBlockedError
        ? error.message
        : "Local integration BLOCKED / UNVERIFIED: profile orchestration failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
}
