import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(architectureDirectory, "../..");
const verifierPath = path.join(
  projectRoot,
  "scripts/architecture/verify-toss-production-build.mjs",
);
const fixtureRoot = await mkdtemp(
  path.join(os.tmpdir(), "airbob-toss-build-gate-"),
);
const staticDirectory = path.join(fixtureRoot, "static/js");
const mainScriptPath = path.join(staticDirectory, "main.fixture.js");
const indexPath = path.join(fixtureRoot, "index.html");

const runVerifier = () =>
  spawnSync(process.execPath, [verifierPath], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      BUILD_PATH: fixtureRoot,
    },
  });

try {
  await mkdir(staticDirectory, { recursive: true });
  await writeFile(indexPath, "<!doctype html><div id=\"root\"></div>");
  await writeFile(
    mainScriptPath,
    'export const src = "https://js.tosspayments.com/v2/standard";',
  );

  const validResult = runVerifier();
  if (validResult.status !== 0) {
    throw new Error(
      `The Toss build verifier rejected its valid BUILD_PATH fixture: ${validResult.stderr}`,
    );
  }

  await writeFile(
    indexPath,
    '<script src="https://js.tosspayments.com/v1"></script>',
  );
  const legacyHtmlResult = runVerifier();
  if (legacyHtmlResult.status === 0) {
    throw new Error("A legacy Toss script in BUILD_PATH HTML bypassed the gate.");
  }

  await writeFile(indexPath, "<!doctype html><div id=\"root\"></div>");
  await writeFile(mainScriptPath, "export const runtime = 'missing';");
  const missingV2Result = runVerifier();
  if (missingV2Result.status === 0) {
    throw new Error("A BUILD_PATH without the official v2 runtime passed.");
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write("Toss production BUILD_PATH fixtures passed (3 scenarios).\n");
