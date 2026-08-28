import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyArchitectureRatchet } from "../../scripts/architecture/verify-architecture-ratchet.mjs";

const fixtureRoot = await mkdtemp(
  path.join(os.tmpdir(), "airbob-git-baseline-"),
);

const git = (args) => {
  const result = spawnSync("git", args, {
    cwd: fixtureRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed.\n${result.stderr}`);
  }

  return result.stdout.trim();
};

const commitAll = (message) => {
  git(["add", "."]);
  git(["commit", "-m", message]);
  return git(["rev-parse", "HEAD"]);
};

const previousPushBefore = process.env.AIRBOB_PUSH_BEFORE_SHA;
const previousBaseRef = process.env.GITHUB_BASE_REF;
const previousEventName = process.env.GITHUB_EVENT_NAME;

try {
  git(["init"]);
  git(["config", "user.email", "architecture-fixture@example.invalid"]);
  git(["config", "user.name", "Architecture Fixture"]);
  await mkdir(path.join(fixtureRoot, "src/features/search"), {
    recursive: true,
  });
  await writeFile(
    path.join(fixtureRoot, "src/features/search/model.ts"),
    "export const search = true;\n",
  );
  await writeFile(
    path.join(fixtureRoot, "architecture-ratchet.json"),
    `${JSON.stringify({ migratedFeatures: ["search"] }, null, 2)}\n`,
  );
  const pushBeforeSha = commitAll("establish strict feature");

  process.env.GITHUB_EVENT_NAME = "pull_request";
  process.env.AIRBOB_PUSH_BEFORE_SHA = "not-a-push-sha";
  delete process.env.GITHUB_BASE_REF;
  verifyArchitectureRatchet({ root: fixtureRoot });

  await writeFile(
    path.join(fixtureRoot, "architecture-ratchet.json"),
    `${JSON.stringify({ migratedFeatures: [] }, null, 2)}\n`,
  );
  commitAll("weaken registry");
  await writeFile(path.join(fixtureRoot, "unrelated.txt"), "later commit\n");
  commitAll("add unrelated change");

  process.env.AIRBOB_PUSH_BEFORE_SHA = pushBeforeSha;
  process.env.GITHUB_EVENT_NAME = "push";
  delete process.env.GITHUB_BASE_REF;

  let rollbackWasRejected = false;
  try {
    verifyArchitectureRatchet({ root: fixtureRoot });
  } catch (error) {
    if (!String(error.message).includes("search")) {
      throw error;
    }

    rollbackWasRejected = true;
  }

  if (!rollbackWasRejected) {
    throw new Error("A multi-commit push hid a live registry rollback.");
  }

  await rm(path.join(fixtureRoot, "src/features/search"), {
    recursive: true,
    force: true,
  });
  await mkdir(path.join(fixtureRoot, "src/features/search-v2"), {
    recursive: true,
  });
  await writeFile(
    path.join(fixtureRoot, "src/features/search-v2/model.ts"),
    "export const search = true;\n",
  );
  commitAll("rename feature without strict promotion");

  let renameDemotionWasRejected = false;
  try {
    verifyArchitectureRatchet({ root: fixtureRoot });
  } catch (error) {
    if (!String(error.message).includes("search-v2")) {
      throw error;
    }

    renameDemotionWasRejected = true;
  }
  if (!renameDemotionWasRejected) {
    throw new Error("A feature rename escaped the strict registry.");
  }

  await writeFile(
    path.join(fixtureRoot, "architecture-ratchet.json"),
    `${JSON.stringify({ migratedFeatures: ["search-v2"] }, null, 2)}\n`,
  );
  commitAll("register renamed feature");
  await symlink(
    "search-v2",
    path.join(fixtureRoot, "src/features/search-v3"),
  );
  commitAll("alias strict feature through a symlink");

  let symlinkDemotionWasRejected = false;
  try {
    verifyArchitectureRatchet({ root: fixtureRoot });
  } catch (error) {
    if (!String(error.message).includes("Symbolic links are forbidden")) {
      throw error;
    }

    symlinkDemotionWasRejected = true;
  }
  if (!symlinkDemotionWasRejected) {
    throw new Error("A feature symlink escaped the strict registry.");
  }

  await rm(path.join(fixtureRoot, "src/features/search-v3"));
  await rename(
    path.join(fixtureRoot, "src/features"),
    path.join(fixtureRoot, "src/legacy-features"),
  );
  await symlink("legacy-features", path.join(fixtureRoot, "src/features"));
  commitAll("alias the complete feature root through a symlink");

  let rootSymlinkWasRejected = false;
  try {
    verifyArchitectureRatchet({ root: fixtureRoot });
  } catch (error) {
    if (!String(error.message).includes("src/features must be a real directory")) {
      throw error;
    }

    rootSymlinkWasRejected = true;
  }
  if (!rootSymlinkWasRejected) {
    throw new Error("A symbolic src/features root escaped strict ownership.");
  }
} finally {
  if (previousPushBefore === undefined) {
    delete process.env.AIRBOB_PUSH_BEFORE_SHA;
  } else {
    process.env.AIRBOB_PUSH_BEFORE_SHA = previousPushBefore;
  }
  if (previousBaseRef === undefined) {
    delete process.env.GITHUB_BASE_REF;
  } else {
    process.env.GITHUB_BASE_REF = previousBaseRef;
  }
  if (previousEventName === undefined) {
    delete process.env.GITHUB_EVENT_NAME;
  } else {
    process.env.GITHUB_EVENT_NAME = previousEventName;
  }
  await rm(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write("Git push-baseline fixture passed.\n");
