import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(architectureDirectory, "../..");
const knipBinary = path.join(projectRoot, "node_modules/knip/dist/cli.js");
const targetPreprocessor = path.join(
  projectRoot,
  "scripts/architecture/knip-target-ratchet.mjs",
);
const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "airbob-knip-lazy-"));

const files = {
  "package.json": JSON.stringify({ private: true, type: "module" }),
  "architecture-ratchet.json": JSON.stringify({
    migratedFeatures: ["search"],
  }),
  "knip.json": JSON.stringify({
    entry: ["src/index.ts!"],
    project: [
      "src/**/*.{js,jsx,mjs,ts,tsx}!",
      "!src/**/__tests__/**/*.{js,jsx,mjs,ts,tsx}!",
      "!src/**/__mocks__/**/*.{js,jsx,mjs,ts,tsx}!",
    ],
  }),
  "src/index.ts":
    'export const loadSearch = () => import("./app/router/routes/SearchRoute");\n',
  "src/app/router/routes/SearchRoute.ts":
    'import { SearchScreen } from "../../../screens/search/SearchScreen"; export default SearchScreen;\n',
  "src/screens/search/SearchScreen.ts":
    'export const SearchScreen = () => "search";\n',
  "src/app/router/routes/DeadRoute.ts":
    'export default function DeadRoute() { return "dead"; }\n',
  "src/shared/Dead.js": "export const deadShared = true;\n",
  "src/shared/DeadModule.mjs": "export const deadModule = true;\n",
  "src/shared/__tests__/helper.ts":
    "export const testHelper = true;\n",
  "src/shared/__mocks__/client.ts":
    "export const mockClient = true;\n",
  "src/shared/__tests__/helper.mjs":
    "export const testModuleHelper = true;\n",
  "src/features/search/DeadFeature.jsx":
    "export const DeadFeature = () => null;\n",
  "src/features/legacy/DeadLegacy.ts":
    "export const deadLegacy = true;\n",
  "knip-preprocessor.mjs": `import { createTargetRatchet } from ${JSON.stringify(
    pathToFileURL(targetPreprocessor).href,
  )};\nexport default createTargetRatchet({ projectRoot: new URL('.', import.meta.url).pathname });\n`,
};

try {
  for (const [relativePath, source] of Object.entries(files)) {
    const filePath = path.join(fixtureRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, source, "utf8");
  }

  const result = spawnSync(
    process.execPath,
    [
      knipBinary,
      "--directory",
      fixtureRoot,
      "--config",
      "knip.json",
      "--reporter",
      "json",
      "--no-exit-code",
      "--no-progress",
      "--no-config-hints",
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(`Knip fixture failed to execute.\n${result.stderr}`);
  }

  const rows = JSON.parse(result.stdout);
  const unusedFiles = new Set(
    rows.filter((row) => row.files).map((row) => row.file),
  );

  if (!unusedFiles.has("src/app/router/routes/DeadRoute.ts")) {
    throw new Error("Knip did not report the unreachable route fixture.");
  }

  [
    "src/app/router/routes/SearchRoute.ts",
    "src/screens/search/SearchScreen.ts",
  ].forEach((reachablePath) => {
    if (unusedFiles.has(reachablePath)) {
      throw new Error(
        `Knip treated the literal lazy route as unreachable: ${reachablePath}`,
      );
    }
  });

  [
    "src/shared/__tests__/helper.ts",
    "src/shared/__tests__/helper.mjs",
    "src/shared/__mocks__/client.ts",
  ].forEach((testOnlyPath) => {
    if (unusedFiles.has(testOnlyPath)) {
      throw new Error(`Knip treated test-only support as production: ${testOnlyPath}`);
    }
  });

  [
    "src/app/router/routes/DeadRoute.ts",
    "src/shared/Dead.js",
    "src/shared/DeadModule.mjs",
    "src/features/search/DeadFeature.jsx",
    "src/features/legacy/DeadLegacy.ts",
  ].forEach((unusedPath) => {
    if (!unusedFiles.has(unusedPath)) {
      throw new Error(`Knip did not report the unused fixture: ${unusedPath}`);
    }
  });

  const strictResult = spawnSync(
    process.execPath,
    [
      knipBinary,
      "--directory",
      fixtureRoot,
      "--config",
      "knip.json",
      "--production",
      "--preprocessor",
      "./knip-preprocessor.mjs",
      "--reporter",
      "json",
      "--no-progress",
      "--no-config-hints",
    ],
    { encoding: "utf8" },
  );
  if (strictResult.status === 0) {
    throw new Error(
      `Target Knip fixture did not fail on unreachable target files.\nstdout: ${strictResult.stdout}\nstderr: ${strictResult.stderr}`,
    );
  }
  const strictRows = JSON.parse(strictResult.stdout);
  const strictUnusedFiles = new Set(
    strictRows.filter((row) => row.files).map((row) => row.file),
  );

  [
    "src/app/router/routes/DeadRoute.ts",
    "src/shared/Dead.js",
    "src/shared/DeadModule.mjs",
    "src/features/search/DeadFeature.jsx",
  ].forEach((unusedPath) => {
    if (!strictUnusedFiles.has(unusedPath)) {
      throw new Error(`Target Knip ratchet missed ${unusedPath}.`);
    }
  });
  if (strictUnusedFiles.has("src/features/legacy/DeadLegacy.ts")) {
    throw new Error("Target Knip ratchet blocked unchanged legacy reachability debt.");
  }
  [
    "src/shared/__tests__/helper.ts",
    "src/shared/__tests__/helper.mjs",
    "src/shared/__mocks__/client.ts",
  ].forEach((testOnlyPath) => {
    if (strictUnusedFiles.has(testOnlyPath)) {
      throw new Error(`Target Knip ratchet included test-only support: ${testOnlyPath}`);
    }
  });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(
  "Knip lazy-route, JavaScript/JSX/MJS, test-support, and migrated-feature fixtures passed.\n",
);
