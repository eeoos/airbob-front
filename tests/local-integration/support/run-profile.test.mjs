import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  runLocalIntegrationProfile,
  writeSafeManifest,
} from "./run-profile.mjs";

const createEnvironment = () => ({
  AWS_SECRET_ACCESS_KEY: "private-ambient-cloud-key",
  AIRBOB_LOCAL_BACKEND_REVISION: "b2ec09a",
  AIRBOB_LOCAL_COMPLIMENTARY_COUPON_ID: "73",
  AIRBOB_LOCAL_COMPLIMENTARY_FIXTURE: JSON.stringify({
    accommodationId: "204",
    checkIn: "2026-10-20",
    checkOut: "2026-10-22",
  }),
  AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE: "backend-owned-disposable",
  AIRBOB_LOCAL_MUTATION_PROFILE: "disposable",
  AIRBOB_LOCAL_PAID_FIXTURES: JSON.stringify([
    {
      accommodationId: "201",
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
    },
    {
      accommodationId: "202",
      checkIn: "2026-10-13",
      checkOut: "2026-10-15",
    },
    {
      accommodationId: "203",
      checkIn: "2026-10-16",
      checkOut: "2026-10-18",
    },
  ]),
  AIRBOB_LOCAL_RESET_AUTHORIZED_AT: "2026-09-02T01:00:00.000Z",
  AIRBOB_LOCAL_RESET_OWNER_LABEL: "backend-local-owner",
  AIRBOB_LOCAL_RESET_PROCEDURE_LABEL: "restore-local-snapshot-v1",
  AIRBOB_LOCAL_SEARCH_DESTINATION: "제주",
  AIRBOB_LOCAL_TOSS_CARD_CVC: "123",
  AIRBOB_LOCAL_TOSS_CARD_EXPIRY: "12/30",
  AIRBOB_LOCAL_TOSS_CARD_NUMBER: "4444444444444444",
  AIRBOB_LOCAL_TOSS_CARD_PASSWORD: "00",
  AIRBOB_LOCAL_TOSS_FAILURE_PROFILE: "confirm-test-code-configured",
  AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE: "TEST_CONFIRM_FAILURE",
  AIRBOB_LOCAL_TOSS_PROVIDER_PROFILE: "sandbox-test-only",
  AIRBOB_LOCAL_TOSS_SANDBOX_PROFILE: "enabled",
  AIRBOB_LOCAL_TOSS_SERVER_PROFILE: "sandbox-configured",
  AIRBOB_LOCAL_WISHLIST_ACCOMMODATION_ID: "201",
  AIRBOB_QA_EMAIL: "local-qa@example.invalid",
  AIRBOB_QA_PASSWORD: "synthetic-local-password",
  REACT_APP_TOSS_CLIENT_KEY: "test_ck_synthetic_browser_key",
});

const fixedClock = () => new Date("2026-09-02T01:01:00.000Z");
const frontend = Object.freeze({
  revision: "3164d7008b0c091a2c17d5c85d29c3755b9a662a",
  workspaceState: "clean",
});

const withManifestRoot = async (run) => {
  const manifestRoot = await mkdtemp(
    path.join(os.tmpdir(), "airbob-local-profile-"),
  );
  try {
    await run(manifestRoot);
  } finally {
    await rm(manifestRoot, { force: true, recursive: true });
  }
};

test("runs core and Toss in one run identity before returning Toss success", async () => {
  await withManifestRoot(async (manifestRoot) => {
    const calls = [];
    const exitCode = await runLocalIntegrationProfile({
      clock: fixedClock,
      environment: createEnvironment(),
      manifestRoot,
      project: "local-toss-sandbox",
      readFrontend: () => frontend,
      runId: "10000000-0000-4000-8000-000000000001",
      runPreflight: async ({ requireToss }) => {
        calls.push(`preflight:${requireToss ? "toss" : "core"}`);
      },
      runProject: async ({ environment, project }) => {
        assert.equal(environment.AWS_SECRET_ACCESS_KEY, undefined);
        calls.push(`project:${project}:${environment.AIRBOB_LOCAL_RUN_ID}`);
        return 0;
      },
    });

    assert.equal(exitCode, 0);
    assert.deepEqual(calls, [
      "preflight:core",
      "project:local-core:10000000-0000-4000-8000-000000000001",
      "preflight:toss",
      "project:local-toss-sandbox:10000000-0000-4000-8000-000000000001",
    ]);
    const core = JSON.parse(
      await readFile(path.join(manifestRoot, "local-core/result.json"), "utf8"),
    );
    const toss = JSON.parse(
      await readFile(
        path.join(manifestRoot, "local-toss-sandbox/result.json"),
        "utf8",
      ),
    );
    assert.equal(core.assertionStatus, "PASS");
    assert.equal(toss.assertionStatus, "PASS");
    assert.equal(core.evidenceStatus, "BLOCKED_UNVERIFIED");
    assert.equal(toss.cleanupStatus, "EXTERNAL_RESET_REQUIRED");
    assert.equal(core.runId, toss.runId);
  });
});

test("does not start Toss after a failed core project", async () => {
  await withManifestRoot(async (manifestRoot) => {
    const projects = [];
    const exitCode = await runLocalIntegrationProfile({
      clock: fixedClock,
      environment: createEnvironment(),
      manifestRoot,
      project: "local-toss-sandbox",
      readFrontend: () => frontend,
      runId: "10000000-0000-4000-8000-000000000002",
      runPreflight: async () => {},
      runProject: async ({ project }) => {
        projects.push(project);
        return 1;
      },
    });

    assert.equal(exitCode, 1);
    assert.deepEqual(projects, ["local-core"]);
  });
});

test("records blocked preflight without starting a browser project", async () => {
  await withManifestRoot(async (manifestRoot) => {
    let started = false;
    const { LocalIntegrationBlockedError } = await import("./environment.mjs");
    const exitCode = await runLocalIntegrationProfile({
      clock: fixedClock,
      environment: createEnvironment(),
      manifestRoot,
      project: "local-core",
      readFrontend: () => frontend,
      runId: "10000000-0000-4000-8000-000000000003",
      runPreflight: async () => {
        throw new LocalIntegrationBlockedError("backend is unavailable");
      },
      runProject: async () => {
        started = true;
        return 0;
      },
    });

    assert.equal(exitCode, 2);
    assert.equal(started, false);
    const manifest = JSON.parse(
      await readFile(path.join(manifestRoot, "local-core/result.json"), "utf8"),
    );
    assert.equal(manifest.preflightStatus, "BLOCKED_UNVERIFIED");
    assert.equal(manifest.assertionStatus, "NOT_RUN");
    assert.equal(manifest.cleanupStatus, "NOT_REQUIRED");
  });
});

test("blocks Toss when frontend state changes after core", async () => {
  await withManifestRoot(async (manifestRoot) => {
    const projects = [];
    let frontendReadCount = 0;
    const driftedFrontend = Object.freeze({
      revision: "4164d7008b0c091a2c17d5c85d29c3755b9a662a",
      workspaceState: "clean",
    });
    const exitCode = await runLocalIntegrationProfile({
      clock: fixedClock,
      environment: createEnvironment(),
      manifestRoot,
      project: "local-toss-sandbox",
      readFrontend: () => {
        frontendReadCount += 1;
        return frontendReadCount === 1 ? frontend : driftedFrontend;
      },
      runId: "10000000-0000-4000-8000-000000000004",
      runPreflight: async () => {},
      runProject: async ({ project }) => {
        projects.push(project);
        return 0;
      },
    });

    assert.equal(exitCode, 2);
    assert.deepEqual(projects, ["local-core"]);
    const toss = JSON.parse(
      await readFile(
        path.join(manifestRoot, "local-toss-sandbox/result.json"),
        "utf8",
      ),
    );
    assert.equal(toss.preflightStatus, "BLOCKED_UNVERIFIED");
    assert.equal(toss.assertionStatus, "NOT_RUN");
    assert.equal(toss.frontend.revision, driftedFrontend.revision);
  });
});

test("atomically replaces a stale manifest symlink without following it", async () => {
  await withManifestRoot(async (manifestRoot) => {
    const projectDirectory = path.join(manifestRoot, "local-core");
    const outsideDirectory = await mkdtemp(
      path.join(os.tmpdir(), "airbob-manifest-target-"),
    );
    try {
      await mkdir(projectDirectory, { recursive: true });
      const outsideTarget = path.join(outsideDirectory, "outside.json");
      await writeFile(outsideTarget, "sentinel\n");
      await symlink(outsideTarget, path.join(projectDirectory, "result.json"));

      const outputPath = await writeSafeManifest({
        environment: createEnvironment(),
        manifest: {
          schema: "airbob-local-integration-result-v1",
          runId: "10000000-0000-4000-8000-000000000005",
          project: "local-core",
          assertionStatus: "NOT_RUN",
          evidenceStatus: "BLOCKED_UNVERIFIED",
        },
        manifestRoot,
      });

      assert.equal(await readFile(outsideTarget, "utf8"), "sentinel\n");
      assert.equal((await lstat(outputPath)).isFile(), true);
      assert.equal((await lstat(outputPath)).mode & 0o777, 0o600);
    } finally {
      await rm(outsideDirectory, { force: true, recursive: true });
    }
  });
});
