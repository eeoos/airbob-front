import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(architectureDirectory, "../..");
const knipBinary = path.join(projectRoot, "node_modules/knip/bin/knip.js");
const packageData = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const strictProductionCommand =
  "knip --production --reporter compact --no-progress";

if (packageData.scripts["lint:dead-code"] !== strictProductionCommand) {
  throw new Error(
    `lint:dead-code must remain the global strict production scan: ${strictProductionCommand}`,
  );
}
const fixtureRoot = await realpath(
  await mkdtemp(path.join(os.tmpdir(), "airbob-knip-lazy-")),
);

const files = {
  "package.json": JSON.stringify({ private: true, type: "module" }),
  "knip.json": JSON.stringify({
    entry: ["src/index.ts!"],
    project: [
      "src/**/*.{js,jsx,mjs,ts,tsx}!",
      "!src/**/__tests__/**/*.{js,jsx,mjs,ts,tsx}!",
      "!src/**/__mocks__/**/*.{js,jsx,mjs,ts,tsx}!",
    ],
  }),
  "src/index.ts":
    'const lazy = (loader: () => Promise<unknown>) => loader; export const loadSearch = lazy(() => import("./app/router/routes/SearchRoute"));\n',
  "src/app/router/routes/SearchRoute.ts":
    'import { SearchScreen } from "../../../screens/search/SearchScreen"; export default SearchScreen;\n',
  "src/screens/search/SearchScreen.ts":
    'export const SearchScreen = () => "search";\n',
  "src/app/router/routes/DeadRoute.ts":
    'export default function DeadRoute() { return "dead"; }\n',
  "src/shared/Dead.js": "export const deadShared = true;\n",
  "src/shared/DeadModule.mjs": "export const deadModule = true;\n",
  "src/shared/__tests__/helper.ts": "export const testHelper = true;\n",
  "src/shared/__mocks__/client.ts": "export const mockClient = true;\n",
  "src/shared/__tests__/helper.mjs": "export const testModuleHelper = true;\n",
  "src/features/search/DeadFeature.jsx":
    "export const DeadFeature = () => null;\n",
  "src/features/legacy/DeadLegacy.ts": "export const deadLegacy = true;\n",
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
      "--production",
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

  const { issues: rows } = JSON.parse(result.stdout);
  const unusedFiles = new Set(
    rows.filter((row) => row.files.length > 0).map((row) => row.file),
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
      throw new Error(
        `Knip treated test-only support as production: ${testOnlyPath}`,
      );
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
      "--reporter",
      "json",
      "--no-progress",
      "--no-config-hints",
    ],
    { encoding: "utf8" },
  );
  if (strictResult.status === 0) {
    throw new Error(
      `Global strict Knip fixture did not fail on unreachable production files.\nstdout: ${strictResult.stdout}\nstderr: ${strictResult.stderr}`,
    );
  }
  let strictRows;
  try {
    ({ issues: strictRows } = JSON.parse(strictResult.stdout));
  } catch {
    throw new Error(
      `Global strict Knip fixture did not return JSON.\nstdout: ${strictResult.stdout}\nstderr: ${strictResult.stderr}`,
    );
  }
  const strictUnusedFiles = new Set(
    strictRows.filter((row) => row.files.length > 0).map((row) => row.file),
  );

  [
    "src/app/router/routes/DeadRoute.ts",
    "src/shared/Dead.js",
    "src/shared/DeadModule.mjs",
    "src/features/search/DeadFeature.jsx",
    "src/features/legacy/DeadLegacy.ts",
  ].forEach((unusedPath) => {
    if (!strictUnusedFiles.has(unusedPath)) {
      throw new Error(`Global strict Knip missed ${unusedPath}.`);
    }
  });
  [
    "src/shared/__tests__/helper.ts",
    "src/shared/__tests__/helper.mjs",
    "src/shared/__mocks__/client.ts",
  ].forEach((testOnlyPath) => {
    if (strictUnusedFiles.has(testOnlyPath)) {
      throw new Error(
        `Global strict Knip included test-only support: ${testOnlyPath}`,
      );
    }
  });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(
  "Global strict Knip lazy-route, JavaScript/JSX/MJS, and test-support fixtures passed.\n",
);
