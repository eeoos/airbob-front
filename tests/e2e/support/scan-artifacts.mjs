import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMITTED_PRIVACY_CANARIES,
  findSensitiveTextViolations,
  redactSensitiveText,
} from "./sensitive-text.mjs";

const supportDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(supportDirectory, "../../..");
// Playwright clears outputDir before each run. The HTML reporter is disabled,
// so only the current run's owned directory is scanned; unrelated stale local
// reports are never deleted or treated as current evidence.
const artifactRoots = ["test-results"];
const allowedTextArtifactExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".log",
  ".md",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export const findTextViolations = (text) => {
  const violations = new Set(findSensitiveTextViolations(text));

  COMMITTED_PRIVACY_CANARIES.forEach((canary, index) => {
    if (text.includes(canary)) {
      violations.add(`committed-canary-${index + 1}`);
    }
  });

  return [...violations].sort();
};

const collectArtifactFiles = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      files.push({ path: entryPath, kind: "symbolic-link" });
    } else if (entry.isDirectory()) {
      files.push(...(await collectArtifactFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push({ path: entryPath, kind: "file" });
    }
  }

  return files;
};

const scanArtifactDirectories = async (directories) => {
  const findings = [];

  for (const absoluteRoot of directories) {
    const files = await collectArtifactFiles(absoluteRoot);

    for (const artifact of files) {
      const relativePath = path.relative(projectRoot, artifact.path);

      if (artifact.kind === "symbolic-link") {
        findings.push(`${relativePath}:symbolic-link-artifact`);
        continue;
      }

      if (
        !allowedTextArtifactExtensions.has(
          path.extname(artifact.path).toLowerCase(),
        )
      ) {
        findings.push(`${relativePath}:unsafe-binary-artifact`);
        continue;
      }

      const text = await readFile(artifact.path, "utf8");
      findTextViolations(text).forEach((violation) => {
        findings.push(`${relativePath}:${violation}`);
      });
    }
  }

  if (findings.length > 0) {
    throw new Error(
      `Playwright artifact privacy policy failed:\n${findings.sort().join("\n")}`,
    );
  }
};

export const scanPlaywrightArtifacts = async () =>
  scanArtifactDirectories(
    artifactRoots.map((artifactRoot) => path.join(projectRoot, artifactRoot)),
  );

const runSelfTest = async () => {
  COMMITTED_PRIVACY_CANARIES.forEach((canary, index) => {
    const violations = findTextViolations(`fixture ${canary}`);
    if (!violations.includes(`committed-canary-${index + 1}`)) {
      throw new Error(`Artifact scanner missed committed canary ${index + 1}.`);
    }
  });

  const allowedSyntheticText =
    "person-a@example.invalid synthetic-password [redacted] test_ck_synthetic";
  if (findTextViolations(allowedSyntheticText).length > 0) {
    throw new Error("Artifact scanner rejected the synthetic fixture allowlist.");
  }

  const detectorCases = [
    ["private.user@real.example", "non-synthetic-email"],
    [
      "https://example.invalid/callback?paymentKey=private-key",
      "sensitive-callback-query",
    ],
    ["test_sk_private_server_key", "server-secret-key"],
    ["Bearer private-access-token", "bearer-credential"],
    ['customerName: "Private Person"', "structured-sensitive-value"],
  ];
  detectorCases.forEach(([input, expectedViolation]) => {
    if (!findTextViolations(input).includes(expectedViolation)) {
      throw new Error(`Artifact scanner missed ${expectedViolation}.`);
    }

    const redacted = redactSensitiveText(input);
    if (redacted === input || findTextViolations(redacted).length > 0) {
      throw new Error(`Reporter redaction missed ${expectedViolation}.`);
    }
  });

  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "airbob-artifact-scan-"),
  );
  try {
    await writeFile(
      path.join(temporaryRoot, "unsafe-report.txt"),
      COMMITTED_PRIVACY_CANARIES.join("\n"),
      "utf8",
    );
    await writeFile(path.join(temporaryRoot, "unsafe-screenshot.png"), "binary");

    let rejectedUnsafeTree = false;
    try {
      await scanArtifactDirectories([temporaryRoot]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rejectedUnsafeTree =
        message.includes("committed-canary-1") &&
        message.includes("unsafe-binary-artifact");
    }

    if (!rejectedUnsafeTree) {
      throw new Error("Artifact scanner accepted an unsafe artifact tree.");
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

export default scanPlaywrightArtifacts;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--self-test")) {
      await runSelfTest();
      process.stdout.write("Playwright artifact privacy scanner self-test passed.\n");
    } else {
      await scanPlaywrightArtifacts();
      process.stdout.write("Playwright artifacts passed the privacy scan.\n");
    }
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Artifact scan failed."}\n`,
    );
    process.exitCode = 1;
  }
}
