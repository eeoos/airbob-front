import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const {
  isProductionSourcePath,
} = require("../../scripts/architecture/source-policy.cjs");
const architectureDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(architectureDirectory, "../..");
const legacyAdapterProjectPath = "src/platform/integrations/tossPaymentsV1.ts";
const v2AdapterProjectPath = "src/platform/integrations/tossPaymentsV2.ts";
const v2GatewayProjectPath =
  "src/workflows/booking-payment/checkout/paymentGateway.ts";
const sdkPackageName = "@tosspayments/tosspayments-sdk";
const expectedSdkVersion = "2.8.1";

const readJson = async (projectPath) =>
  JSON.parse(await readFile(path.join(projectRoot, projectPath), "utf8"));

const fileExists = async (projectPath) => {
  try {
    await access(path.join(projectRoot, projectPath));
    return true;
  } catch {
    return false;
  }
};

const packageManifest = await readJson("package.json");
const packageLock = await readJson("package-lock.json");
const legacyAdapterExists = await fileExists(legacyAdapterProjectPath);

if (legacyAdapterExists) {
  throw new Error("The retired Toss v1 adapter must not exist in U11.");
}

if (packageManifest.dependencies?.[sdkPackageName] !== expectedSdkVersion) {
  throw new Error(
    `The Toss SDK manifest must pin exactly ${expectedSdkVersion}.`,
  );
}
if (
  packageLock.packages?.[""]?.dependencies?.[sdkPackageName] !==
    expectedSdkVersion ||
  packageLock.packages?.[`node_modules/${sdkPackageName}`]?.version !==
    expectedSdkVersion
) {
  throw new Error("The Toss SDK lockfile does not match the pinned manifest.");
}

const productionFiles = ts.sys
  .readDirectory(
    path.join(projectRoot, "src"),
    [".js", ".jsx", ".mjs", ".ts", ".tsx"],
    undefined,
    ["**/*"],
  )
  .map((absolutePath) => ({
    absolutePath,
    projectPath: path.relative(projectRoot, absolutePath).replaceAll("\\", "/"),
  }))
  .filter(({ projectPath }) => isProductionSourcePath(projectPath));

const directSdkOwners = [];
const legacyImporters = [];
const v2AdapterImporters = [];
const retiredLegacyContractReferences = [];
for (const file of productionFiles) {
  const source = await readFile(file.absolutePath, "utf8");
  if (source.includes(sdkPackageName)) directSdkOwners.push(file.projectPath);
  if (
    file.projectPath !== legacyAdapterProjectPath &&
    source.includes("tossPaymentsV1")
  ) {
    legacyImporters.push(file.projectPath);
  }
  if (
    file.projectPath !== v2AdapterProjectPath &&
    source.includes("tossPaymentsV2")
  ) {
    v2AdapterImporters.push(file.projectPath);
  }
  if (source.includes("toss-payments-v1")) {
    retiredLegacyContractReferences.push(file.projectPath);
  }
}

if (
  directSdkOwners.length !== 1 ||
  directSdkOwners[0] !== v2AdapterProjectPath
) {
  throw new Error(
    `The official Toss SDK must have one production owner: ${directSdkOwners.join(", ")}`,
  );
}
if (legacyImporters.length > 0) {
  throw new Error(
    `The retired v1 adapter is referenced by production source: ${legacyImporters.join(", ")}`,
  );
}
if (
  v2AdapterImporters.length !== 1 ||
  v2AdapterImporters[0] !== v2GatewayProjectPath
) {
  throw new Error(
    `The Toss v2 adapter must have one production consumer: ${v2AdapterImporters.join(", ")}`,
  );
}
if (retiredLegacyContractReferences.length > 0) {
  throw new Error(
    `Retired v1 integration names remain after source removal: ${retiredLegacyContractReferences.join(", ")}`,
  );
}

process.stdout.write(
  "Toss v2-only runtime boundary passed; the retired U10 source is removed.\n",
);
