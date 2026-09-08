import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCAL_INTEGRATION_PROJECTS,
  LocalIntegrationBlockedError,
} from "./environment.mjs";

const supportDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(supportDirectory, "../../..");
export const LOCAL_INTEGRATION_MANIFEST_ROOT = path.join(
  projectRoot,
  "test-results/local-integration",
);

const coreManifestPath = (manifestRoot) =>
  path.join(manifestRoot, LOCAL_INTEGRATION_PROJECTS.core, "result.json");

export const readFrontendState = () => {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const worktree = execFileSync("git", ["status", "--porcelain"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new LocalIntegrationBlockedError("frontend revision is unavailable");
  }

  return Object.freeze({
    revision,
    workspaceState: worktree.length === 0 ? "clean" : "dirty",
  });
};

export const assertFrontendReady = (frontend) => {
  if (
    frontend?.workspaceState !== "clean" ||
    !/^[0-9a-f]{40}$/.test(frontend?.revision ?? "")
  ) {
    throw new LocalIntegrationBlockedError("frontend workspace is not clean");
  }
};

export const assertFrontendUnchanged = (expected, current) => {
  assertFrontendReady(expected);
  assertFrontendReady(current);
  if (
    current.revision !== expected.revision ||
    current.workspaceState !== expected.workspaceState
  ) {
    throw new LocalIntegrationBlockedError(
      "frontend changed after the core project",
    );
  }
};

export const readMatchingCoreManifest = async ({
  backendRevision,
  frontend,
  manifestRoot = LOCAL_INTEGRATION_MANIFEST_ROOT,
  runId,
}) => {
  let manifest;
  try {
    manifest = JSON.parse(
      await readFile(coreManifestPath(manifestRoot), "utf8"),
    );
  } catch {
    throw new LocalIntegrationBlockedError(
      "matching local-core result is unavailable",
    );
  }

  if (
    manifest?.schema !== "airbob-local-integration-result-v1" ||
    manifest.project !== LOCAL_INTEGRATION_PROJECTS.core ||
    manifest.runId !== runId ||
    manifest.assertionStatus !== "PASS" ||
    manifest.frontend?.revision !== frontend.revision ||
    manifest.frontend?.workspaceState !== "clean" ||
    manifest.backend?.revision !== backendRevision
  ) {
    throw new LocalIntegrationBlockedError(
      "matching local-core result is unavailable",
    );
  }

  return manifest;
};
