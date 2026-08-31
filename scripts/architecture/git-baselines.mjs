import { spawnSync } from "node:child_process";

const runGit = (projectRoot, args, { optional = false } = {}) => {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (optional) {
      return null;
    }

    throw new Error(
      `git ${args.join(" ")} failed.\n${result.stderr || result.stdout}`,
    );
  }

  return result.stdout.trim();
};

const resolveRevision = (projectRoot, revision, { optional = true } = {}) =>
  runGit(projectRoot, ["rev-parse", "--verify", revision], { optional });

const resolveMergeBase = (projectRoot, left, right, { optional = true } = {}) =>
  runGit(projectRoot, ["merge-base", left, right], { optional });

export const getArchitectureComparisonRevisions = (projectRoot) => {
  const revisions = [];
  const addRevision = (label, revision) => {
    if (!revision || revisions.some((entry) => entry.revision === revision)) {
      return;
    }

    revisions.push({ label, revision });
  };

  const githubEventName = process.env.GITHUB_EVENT_NAME?.trim();
  const pushBeforeSha =
    githubEventName && githubEventName !== "push"
      ? ""
      : process.env.AIRBOB_PUSH_BEFORE_SHA?.trim();
  if (pushBeforeSha && !/^0+$/.test(pushBeforeSha)) {
    if (!/^[0-9a-f]{40}$/i.test(pushBeforeSha)) {
      throw new Error("AIRBOB_PUSH_BEFORE_SHA must be a full Git commit SHA.");
    }

    addRevision(
      "push-event before SHA",
      resolveRevision(projectRoot, `${pushBeforeSha}^{commit}`, {
        optional: false,
      }),
    );
  }

  const githubBaseRef = process.env.GITHUB_BASE_REF?.trim();
  if (githubBaseRef) {
    const remoteBase = resolveRevision(
      projectRoot,
      `origin/${githubBaseRef}^{commit}`,
    );
    const localBase = remoteBase
      ? null
      : resolveRevision(projectRoot, `${githubBaseRef}^{commit}`);
    const baseRevision = remoteBase ?? localBase;

    if (!baseRevision) {
      throw new Error(
        `Unable to resolve the pull-request base branch ${githubBaseRef}. ` +
          "CI checkout must fetch full history.",
      );
    }

    addRevision(
      `pull-request base ${githubBaseRef}`,
      resolveMergeBase(projectRoot, "HEAD", baseRevision, {
        optional: false,
      }),
    );
  } else {
    const currentBranch = runGit(projectRoot, ["branch", "--show-current"], {
      optional: true,
    });
    const mainRevision = resolveRevision(projectRoot, "main^{commit}");

    if (mainRevision && currentBranch && currentBranch !== "main") {
      addRevision(
        "local main merge-base",
        resolveMergeBase(projectRoot, "HEAD", mainRevision),
      );
    }
  }

  addRevision(
    "working-tree base HEAD",
    resolveRevision(projectRoot, "HEAD^{commit}"),
  );
  addRevision(
    "previous commit",
    resolveRevision(projectRoot, "HEAD^1^{commit}"),
  );

  if (revisions.length === 0) {
    throw new Error("Architecture ratchets require a readable Git baseline.");
  }

  return revisions;
};

export const readFileAtRevision = (projectRoot, revision, relativePath) =>
  runGit(projectRoot, ["show", `${revision}:${relativePath}`], {
    optional: true,
  });

export const listFilesAtRevision = (projectRoot, revision, relativePath) => {
  const output = runGit(
    projectRoot,
    ["ls-tree", "-r", "--name-only", revision, "--", relativePath],
    { optional: false },
  );

  return output ? output.split(/\r?\n/).filter(Boolean) : [];
};
