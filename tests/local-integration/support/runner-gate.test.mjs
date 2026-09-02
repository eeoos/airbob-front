import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalIntegrationBlockedError } from "./environment.mjs";
import {
  assertFrontendReady,
  assertFrontendUnchanged,
  readMatchingCoreManifest,
} from "./runner-gate.mjs";

const frontend = Object.freeze({
  revision: "3164d7008b0c091a2c17d5c85d29c3755b9a662a",
  workspaceState: "clean",
});

const withManifestRoot = async (run) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airbob-runner-gate-"));
  try {
    await run(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
};

test("requires a clean stable frontend generation", () => {
  assert.doesNotThrow(() => assertFrontendReady(frontend));
  assert.doesNotThrow(() => assertFrontendUnchanged(frontend, frontend));
  assert.throws(
    () => assertFrontendReady({ ...frontend, workspaceState: "dirty" }),
    LocalIntegrationBlockedError,
  );
  assert.throws(
    () =>
      assertFrontendUnchanged(frontend, {
        ...frontend,
        revision: "4164d7008b0c091a2c17d5c85d29c3755b9a662a",
      }),
    LocalIntegrationBlockedError,
  );
});

test("requires a same-run core pass before Toss", async () => {
  await withManifestRoot(async (manifestRoot) => {
    const directory = path.join(manifestRoot, "local-core");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "result.json"),
      JSON.stringify({
        schema: "airbob-local-integration-result-v1",
        runId: "10000000-0000-4000-8000-000000000001",
        project: "local-core",
        assertionStatus: "PASS",
        frontend,
        backend: { revision: "b2ec09a" },
      }),
    );

    await assert.doesNotReject(() =>
      readMatchingCoreManifest({
        backendRevision: "b2ec09a",
        frontend,
        manifestRoot,
        runId: "10000000-0000-4000-8000-000000000001",
      }),
    );
    await assert.rejects(
      () =>
        readMatchingCoreManifest({
          backendRevision: "b2ec09a",
          frontend,
          manifestRoot,
          runId: "10000000-0000-4000-8000-000000000002",
        }),
      LocalIntegrationBlockedError,
    );
  });
});
