import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const configuredBuildPath = process.env.BUILD_PATH?.trim();
const buildDirectory = path.resolve(
  projectRoot,
  configuredBuildPath || "build",
);

const collectTextArtifacts = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTextArtifacts(absolutePath)));
    } else if (
      entry.isFile() &&
      /(?:\.html|\.json|\.js(?:\.map)?)$/.test(entry.name)
    ) {
      files.push(absolutePath);
    }
  }
  return files;
};

const textArtifacts = await collectTextArtifacts(buildDirectory);
if (textArtifacts.length === 0) {
  throw new Error(
    "The production build contains no text artifacts to inspect.",
  );
}

let hasOfficialV2Runtime = false;
const legacyRuntimeFindings = [];
for (const absolutePath of textArtifacts) {
  const source = await readFile(absolutePath, "utf8");
  const projectPath = path
    .relative(projectRoot, absolutePath)
    .replaceAll("\\", "/");
  if (
    absolutePath.endsWith(".js") &&
    source.includes("https://js.tosspayments.com/v2/standard")
  ) {
    hasOfficialV2Runtime = true;
  }
  const legacyMarkers = ["https://js.tosspayments.com/v1"];
  if (absolutePath.endsWith(".js")) {
    legacyMarkers.push("toss-payments-v1");
  }
  for (const legacyMarker of legacyMarkers) {
    if (source.includes(legacyMarker)) {
      legacyRuntimeFindings.push(`${projectPath}:${legacyMarker}`);
    }
  }
}

if (!hasOfficialV2Runtime) {
  throw new Error("The official Toss v2 runtime is missing from the build.");
}
if (legacyRuntimeFindings.length > 0) {
  throw new Error(
    `The production build contains a legacy Toss runtime:\n${legacyRuntimeFindings.join("\n")}`,
  );
}

process.stdout.write(
  `Toss production build passed (${textArtifacts.length} text artifacts, v2 only).\n`,
);
