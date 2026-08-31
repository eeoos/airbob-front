import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
export const frontendBundleBudgetPath = path.join(
  projectRoot,
  "frontend-bundle-budgets.json",
);

const budgetKeys = Object.freeze([
  "initialJavaScriptGzipBytes",
  "lazyRouteIncrementalJavaScriptGzipBytes",
]);

const assertPositiveInteger = (value, fieldName) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `Frontend bundle budget ${fieldName} must be a positive integer.`,
    );
  }
};

export const validateFrontendBundleBudgets = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Frontend bundle budgets must be a JSON object.");
  }

  const keys = Object.keys(value).sort();
  if (
    keys.length !== budgetKeys.length ||
    budgetKeys.some((key) => !keys.includes(key))
  ) {
    throw new Error(
      `Frontend bundle budgets must define only: ${budgetKeys.join(", ")}.`,
    );
  }

  budgetKeys.forEach((key) => assertPositiveInteger(value[key], key));

  return Object.freeze({
    initialJavaScriptGzipBytes: value.initialJavaScriptGzipBytes,
    lazyRouteIncrementalJavaScriptGzipBytes:
      value.lazyRouteIncrementalJavaScriptGzipBytes,
  });
};

export const readFrontendBundleBudgets = async () =>
  validateFrontendBundleBudgets(
    JSON.parse(await readFile(frontendBundleBudgetPath, "utf8")),
  );

export const enforceFrontendBundleBudgets = ({
  budgets,
  initialJavaScriptGzipBytes,
  lazyRouteIncrementalJavaScriptGzipMeasurements,
}) => {
  const validatedBudgets = validateFrontendBundleBudgets(budgets);
  assertPositiveInteger(
    initialJavaScriptGzipBytes,
    "measured initialJavaScriptGzipBytes",
  );

  if (
    !Array.isArray(lazyRouteIncrementalJavaScriptGzipMeasurements) ||
    lazyRouteIncrementalJavaScriptGzipMeasurements.length === 0
  ) {
    throw new Error(
      "Frontend bundle verification requires at least one lazy-route measurement.",
    );
  }

  if (
    initialJavaScriptGzipBytes > validatedBudgets.initialJavaScriptGzipBytes
  ) {
    throw new Error(
      `Vite initial JavaScript graph exceeded its ${validatedBudgets.initialJavaScriptGzipBytes}-byte gzip budget: ${initialJavaScriptGzipBytes} bytes.`,
    );
  }

  const seenRouteNames = new Set();
  lazyRouteIncrementalJavaScriptGzipMeasurements.forEach(
    ({ routeName, gzipBytes }) => {
      if (typeof routeName !== "string" || routeName.length === 0) {
        throw new Error("Lazy-route bundle measurements require a route name.");
      }
      if (seenRouteNames.has(routeName)) {
        throw new Error(
          `Duplicate lazy-route bundle measurement: ${routeName}.`,
        );
      }
      seenRouteNames.add(routeName);
      assertPositiveInteger(gzipBytes, `measured lazy route ${routeName}`);

      if (
        gzipBytes > validatedBudgets.lazyRouteIncrementalJavaScriptGzipBytes
      ) {
        throw new Error(
          `Lazy route ${routeName} exceeded its ${validatedBudgets.lazyRouteIncrementalJavaScriptGzipBytes}-byte incremental JavaScript gzip budget: ${gzipBytes} bytes.`,
        );
      }
    },
  );

  const maximumLazyRouteIncrementalJavaScriptGraph =
    lazyRouteIncrementalJavaScriptGzipMeasurements.reduce(
      (maximum, measurement) =>
        measurement.gzipBytes > maximum.gzipBytes ? measurement : maximum,
    );

  return {
    initialJavaScriptGzipBytes,
    maximumLazyRouteIncrementalJavaScriptGraph,
  };
};

const readManifestRecord = (manifest, manifestKey) => {
  const record = manifest[manifestKey];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Vite manifest entry is missing: ${manifestKey}.`);
  }
  if (typeof record.file !== "string" || record.file.length === 0) {
    throw new Error(`Vite manifest entry has no output file: ${manifestKey}.`);
  }
  if (
    record.imports !== undefined &&
    (!Array.isArray(record.imports) ||
      record.imports.some((entry) => typeof entry !== "string"))
  ) {
    throw new Error(`Vite manifest imports are invalid: ${manifestKey}.`);
  }
  return record;
};

const collectStaticJavascriptFiles = (manifest, manifestKeys) => {
  const visitedManifestKeys = new Set();
  const javascriptFiles = new Set();

  const visit = (manifestKey) => {
    if (visitedManifestKeys.has(manifestKey)) return;
    visitedManifestKeys.add(manifestKey);

    const record = readManifestRecord(manifest, manifestKey);
    if (record.file.endsWith(".js")) javascriptFiles.add(record.file);
    (record.imports ?? []).forEach(visit);
  };

  manifestKeys.forEach(visit);
  return javascriptFiles;
};

const sumJavascriptGzipBytes = (files, javascriptGzipBytesByFile) =>
  [...files].reduce((total, fileName) => {
    const gzipBytes = javascriptGzipBytesByFile.get(fileName);
    if (!Number.isSafeInteger(gzipBytes) || gzipBytes <= 0) {
      throw new Error(
        `Vite manifest references an unmeasured JavaScript file: ${fileName}.`,
      );
    }
    return total + gzipBytes;
  }, 0);

const measureJavascriptFiles = (files, javascriptGzipBytesByFile) =>
  [...files]
    .map((fileName) => ({
      fileName,
      gzipBytes: sumJavascriptGzipBytes(
        new Set([fileName]),
        javascriptGzipBytesByFile,
      ),
    }))
    .sort(
      (left, right) =>
        right.gzipBytes - left.gzipBytes ||
        left.fileName.localeCompare(right.fileName),
    );

export const measureFrontendBundleGraphs = ({
  manifest,
  initialJavaScriptFiles,
  lazyRouteManifestEntries,
  javascriptGzipBytesByFile,
}) => {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Vite manifest must be an object.");
  }
  if (
    !(javascriptGzipBytesByFile instanceof Map) ||
    javascriptGzipBytesByFile.size === 0
  ) {
    throw new Error("JavaScript gzip measurements must be a non-empty Map.");
  }

  const manifestKeysByFile = new Map();
  Object.keys(manifest).forEach((manifestKey) => {
    const { file } = readManifestRecord(manifest, manifestKey);
    const existingKey = manifestKeysByFile.get(file);
    if (existingKey && existingKey !== manifestKey) {
      throw new Error(`Vite manifest output is not unique: ${file}.`);
    }
    manifestKeysByFile.set(file, manifestKey);
  });

  const initialManifestKeys = initialJavaScriptFiles.map((fileName) => {
    const manifestKey = manifestKeysByFile.get(fileName);
    if (!manifestKey) {
      throw new Error(
        `Initial HTML JavaScript is absent from the Vite manifest: ${fileName}.`,
      );
    }
    return manifestKey;
  });
  const initialGraphFiles = collectStaticJavascriptFiles(
    manifest,
    initialManifestKeys,
  );

  const lazyRouteIncrementalJavaScriptGzipMeasurements =
    lazyRouteManifestEntries.map(({ routeName, manifestKey }) => {
      const incrementalFiles = collectStaticJavascriptFiles(manifest, [
        manifestKey,
      ]);
      initialGraphFiles.forEach((fileName) =>
        incrementalFiles.delete(fileName),
      );

      return {
        routeName,
        gzipBytes: sumJavascriptGzipBytes(
          incrementalFiles,
          javascriptGzipBytesByFile,
        ),
        files: measureJavascriptFiles(
          incrementalFiles,
          javascriptGzipBytesByFile,
        ),
      };
    });

  return {
    initialJavaScriptGzipBytes: sumJavascriptGzipBytes(
      initialGraphFiles,
      javascriptGzipBytesByFile,
    ),
    initialFiles: [...initialGraphFiles].sort(),
    lazyRouteIncrementalJavaScriptGzipMeasurements,
  };
};
