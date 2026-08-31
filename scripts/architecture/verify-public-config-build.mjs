import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { validatePublicBuildEnvironment } from "./validate-public-build-env.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const buildRoot = await mkdtemp(
  path.join(tmpdir(), "airbob-public-config-build-"),
);
const unpredictableCanaryId = randomUUID().replaceAll("-", "").toUpperCase();

const publicCanaries = Object.freeze({
  REACT_APP_API_URL: "https://public-api-canary.example.invalid",
  REACT_APP_GOOGLE_MAPS_API_KEY: "public_maps_browser_key_canary",
  REACT_APP_TOSS_CLIENT_KEY: "test_ck_public_toss_client_key_canary",
  REACT_APP_CLOUDFRONT_DOMAIN: "public-assets-canary.example.invalid",
});

const forbiddenCanaries = Object.freeze({
  REACT_APP_QA_PASSWORD: "forbidden_qa_password_canary",
  REACT_APP_TOSS_SECRET_KEY: "forbidden_toss_secret_canary",
  REACT_APP_SESSION_COOKIE: "forbidden_cookie_canary",
  REACT_APP_ACCESS_TOKEN: "forbidden_access_token_canary",
  REACT_APP_PRIVATE_SIGNING_KEY: "forbidden_private_key_canary",
  REACT_APP_UNKNOWN_RUNTIME_VALUE: "forbidden_unknown_runtime_canary",
  [`REACT_APP_UNPREDICTABLE_${unpredictableCanaryId}`]: `forbidden_unpredictable_runtime_${unpredictableCanaryId}`,
  AIRBOB_QA_PASSWORD: "forbidden_server_qa_password_canary",
});

const acceptedPublicAssetBases = Object.freeze({
  rootRelative: "/public-url-root-relative-canary/assets-v1",
  httpsPath: "https://public-url-cdn-canary.example.invalid/airbob/assets-v1",
});

const invalidPublicAssetBases = Object.freeze([
  {
    name: "surrounding whitespace",
    value: " https://public-url-whitespace-canary.example.invalid/assets ",
  },
  { name: "dot-relative base", value: "./" },
  {
    name: "protocol-relative base",
    value: "//public-url-protocol-relative-canary.example.invalid/assets",
  },
  {
    name: "insecure HTTP base",
    value: "http://public-url-http-canary.example.invalid/assets",
  },
  {
    name: "data URL base",
    value: "data:text/html,public-url-data-canary",
  },
  {
    name: "blob URL base",
    value: "blob:https://public-url-blob-canary.example.invalid/id",
  },
  {
    name: "credentialed HTTPS base",
    value:
      "https://public-url-user-canary:public-url-password-canary@public-url-credentials-canary.example.invalid/assets",
  },
  {
    name: "absolute query",
    value: "https://public-url-query-canary.example.invalid/assets?release=1",
  },
  {
    name: "absolute fragment",
    value: "https://public-url-fragment-canary.example.invalid/assets#release",
  },
  { name: "root-relative query", value: "/public-url-query-canary?release=1" },
  {
    name: "root-relative fragment",
    value: "/public-url-fragment-canary#release",
  },
  {
    name: "invalid percent encoding",
    value: "/public-url-percent-canary/%asset",
  },
  {
    name: "percent-encoded path",
    value: "/public-url-encoded-path-canary/assets%20v1",
  },
  {
    name: "percent-encoded server secret",
    value: "/assets/%74est%5fsk%5fprivate",
  },
  {
    name: "backslash navigation",
    value: "/public-url-backslash-canary\\remote",
  },
  {
    name: "HTML attribute injection",
    value: '/public-url-html-canary"onerror="public-url-script-canary',
  },
  {
    name: "misplaced server secret",
    value: "/assets/test_sk_forbidden_public_url_canary",
  },
]);

const invalidEncodedRuntimeInputs = Object.freeze([
  {
    name: "percent-encoded API host",
    fieldName: "REACT_APP_API_URL",
    value: "https://%74est%5fsk%5fprivate.example.invalid",
    expectedCategory: "API origin",
  },
  {
    name: "percent-encoded Google Maps key",
    fieldName: "REACT_APP_GOOGLE_MAPS_API_KEY",
    value: "%74est%5fsk%5fprivate",
    expectedCategory: "Google Maps browser key",
  },
  {
    name: "percent-encoded CloudFront host",
    fieldName: "REACT_APP_CLOUDFRONT_DOMAIN",
    value: "%74est%5fsk%5fprivate.example.invalid",
    expectedCategory: "CloudFront domain",
  },
  {
    name: "control-split API host",
    fieldName: "REACT_APP_API_URL",
    value: "https://te\nst_sk_private.example.invalid",
    expectedCategory: "API origin",
  },
  {
    name: "control-split CloudFront host",
    fieldName: "REACT_APP_CLOUDFRONT_DOMAIN",
    value: "te\tst_sk_private.example.invalid",
    expectedCategory: "CloudFront domain",
  },
]);

const safeSystemEnvironment = Object.fromEntries(
  ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "SystemRoot"]
    .map((name) => [name, process.env[name]])
    .filter((entry) => typeof entry[1] === "string"),
);

const redactedCanaryValues = [
  ...Object.values(publicCanaries),
  ...Object.values(forbiddenCanaries),
  ...Object.values(acceptedPublicAssetBases),
  ...invalidPublicAssetBases.map(({ value }) => value),
  ...invalidEncodedRuntimeInputs.map(({ value }) => value),
].filter((value) => value.length >= 12);

const redactCanaries = (value) =>
  redactedCanaryValues.reduce(
    (safeValue, canary) => safeValue.replaceAll(canary, "[redacted-canary]"),
    value,
  );

const collectTextFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTextFiles(entryPath);
      if (!entry.isFile()) return [];

      return /[.](?:css|html|js|json|map|txt)$/.test(entry.name)
        ? [entryPath]
        : [];
    }),
  );

  return nestedFiles.flat();
};

const collectTextFilesIfPresent = async (directory) => {
  try {
    return await collectTextFiles(directory);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const REQUIRED_PUBLIC_FILES = Object.freeze([
  "favicon.ico",
  "index.html",
  "logo192.png",
  "logo512.png",
  "manifest.json",
  "robots.txt",
]);
const U16_INITIAL_JAVASCRIPT_GZIP_CEILING_BYTES = 147_730;

const readLazyRouteChunkPrefixes = async () => {
  const lazyRouteSource = await readFile(
    path.join(projectRoot, "src/app/router/lazyRoutes.tsx"),
    "utf8",
  );
  const routeModuleNames = [
    ...lazyRouteSource.matchAll(
      /import\(\s*["']\.\/routes\/([^"']+)["']\s*\)/g,
    ),
  ].map((match) => match[1]);
  const uniqueRouteModuleNames = [...new Set(routeModuleNames)];

  if (
    uniqueRouteModuleNames.length === 0 ||
    uniqueRouteModuleNames.length !== routeModuleNames.length
  ) {
    throw new Error(
      "The lazy-route manifest is empty or contains duplicate modules.",
    );
  }

  return uniqueRouteModuleNames.map((moduleName) => `${moduleName}-`);
};

const verifyViteBuildContract = async ({
  directory,
  publicAssetBase,
  requiredLazyRouteChunks,
}) => {
  const rootEntries = new Set(await readdir(directory));
  const missingPublicFiles = REQUIRED_PUBLIC_FILES.filter(
    (fileName) => !rootEntries.has(fileName),
  );

  if (missingPublicFiles.length > 0 || rootEntries.has("asset-manifest.json")) {
    throw new Error(
      `Production build public-file contract failed: ${missingPublicFiles.join(", ") || "retired asset-manifest.json was emitted"}.`,
    );
  }

  const staticDirectory = path.join(directory, "static");
  const staticEntries = await readdir(staticDirectory);
  const unhashedStaticAssets = staticEntries.filter(
    (fileName) =>
      !/-[A-Za-z0-9_-]{8,64}\.[A-Za-z0-9]+(?:\.map)?$/.test(fileName),
  );
  if (unhashedStaticAssets.length > 0) {
    throw new Error(
      `Immutable /static assets must be content-hashed: ${unhashedStaticAssets.join(", ")}.`,
    );
  }
  const javascriptFiles = staticEntries.filter((fileName) =>
    fileName.endsWith(".js"),
  );
  const cssFiles = staticEntries.filter((fileName) =>
    fileName.endsWith(".css"),
  );
  const staticEntrySet = new Set(staticEntries);

  if (
    javascriptFiles.length < requiredLazyRouteChunks.length + 1 ||
    cssFiles.length === 0
  ) {
    throw new Error(
      "Production build did not retain split JavaScript and CSS assets.",
    );
  }

  const missingRouteChunks = requiredLazyRouteChunks.filter(
    (prefix) =>
      !javascriptFiles.some((fileName) => fileName.startsWith(prefix)),
  );
  if (missingRouteChunks.length > 0) {
    throw new Error(
      `Production build collapsed lazy route chunks: ${missingRouteChunks.join(", ")}.`,
    );
  }

  const missingSourceMaps = javascriptFiles.filter(
    (fileName) => !staticEntrySet.has(`${fileName}.map`),
  );
  if (missingSourceMaps.length > 0) {
    throw new Error(
      `Production build omitted JavaScript source maps: ${missingSourceMaps.join(", ")}.`,
    );
  }

  const cssSource = (
    await Promise.all(
      cssFiles.map((fileName) =>
        readFile(path.join(staticDirectory, fileName), "utf8"),
      ),
    )
  ).join("\n");
  if (/@custom-media\b|@media\s*\(\s*--/i.test(cssSource)) {
    throw new Error("Production CSS contains unresolved custom-media syntax.");
  }

  const normalizedBase = `${publicAssetBase.replace(/\/+$/, "")}/`;
  const indexSource = await readFile(
    path.join(directory, "index.html"),
    "utf8",
  );
  const requiredBuiltReferences = [
    `${normalizedBase}favicon.ico`,
    `${normalizedBase}logo192.png`,
    `${normalizedBase}manifest.json`,
    `${normalizedBase}static/`,
  ];
  if (
    requiredBuiltReferences.some(
      (reference) => !indexSource.includes(reference),
    ) ||
    indexSource.includes("%BASE_URL%") ||
    !/<script\b[^>]*\btype=["']module["'][^>]*>/i.test(indexSource)
  ) {
    throw new Error(
      "Production HTML did not preserve the validated Vite base contract.",
    );
  }

  const initialJavascriptReferences = new Set(
    [
      ...indexSource.matchAll(
        /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+\.js)["'][^>]*>/gi,
      ),
    ]
      .map((match) => match[1])
      .filter((reference) => reference.includes("/static/")),
  );
  if (initialJavascriptReferences.size === 0) {
    throw new Error(
      "Production HTML did not declare its initial JavaScript graph.",
    );
  }

  const initialJavascriptGzipBytes = (
    await Promise.all(
      [...initialJavascriptReferences].map(async (reference) => {
        const fileName = new URL(
          reference,
          "https://airbob-build.invalid",
        ).pathname
          .split("/")
          .at(-1);
        if (!fileName || !staticEntrySet.has(fileName)) {
          throw new Error(
            "Production HTML references a missing initial JavaScript asset.",
          );
        }
        return gzipSync(await readFile(path.join(staticDirectory, fileName)))
          .byteLength;
      }),
    )
  ).reduce((total, bytes) => total + bytes, 0);
  if (initialJavascriptGzipBytes > U16_INITIAL_JAVASCRIPT_GZIP_CEILING_BYTES) {
    throw new Error(
      `Vite initial JavaScript graph exceeded the U16 parity ceiling: ${initialJavascriptGzipBytes} bytes.`,
    );
  }

  return initialJavascriptGzipBytes;
};

const runPackageBuild = ({
  buildPath,
  publicAssetBase,
  environmentOverrides = {},
}) =>
  spawnSync(npmExecutable, ["run", "build", "--silent"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...safeSystemEnvironment,
      ...publicCanaries,
      ...forbiddenCanaries,
      ...environmentOverrides,
      BUILD_PATH: buildPath,
      CI: "true",
      NODE_ENV: "production",
      PUBLIC_URL: publicAssetBase,
    },
    maxBuffer: 20 * 1024 * 1024,
  });

try {
  const initialJavascriptGzipMeasurements = [];
  const requiredLazyRouteChunks = await readLazyRouteChunkPrefixes();
  const invalidBuildInputs = [
    {
      name: "missing API origin",
      environment: {
        ...publicCanaries,
        REACT_APP_API_URL: undefined,
      },
      expectedCategory: "API origin",
    },
    ...[
      "http://public-api-canary.example.invalid",
      "https://user:password@public-api-canary.example.invalid",
      "https://public-api-canary.example.invalid/path",
      "https://public-api-canary.example.invalid?query=1",
      "https://public-api-canary.example.invalid#fragment",
    ].map((apiUrl, index) => ({
      name: `unsafe API origin ${index + 1}`,
      environment: {
        ...publicCanaries,
        REACT_APP_API_URL: apiUrl,
      },
      expectedCategory: "API origin",
    })),
    ...[
      "http://public-assets-canary.example.invalid",
      "https://user:password@public-assets-canary.example.invalid",
      "https://public-assets-canary.example.invalid/path",
      "https://public-assets-canary.example.invalid?query=1",
      "https://public-assets-canary.example.invalid#fragment",
      "public-assets-canary.example.invalid:8443",
    ].map((cloudFrontDomain, index) => ({
      name: `unsafe CloudFront domain ${index + 1}`,
      environment: {
        ...publicCanaries,
        REACT_APP_CLOUDFRONT_DOMAIN: cloudFrontDomain,
      },
      expectedCategory: "CloudFront domain",
    })),
    ...[
      [
        "API origin",
        "REACT_APP_API_URL",
        (secret) => `https://${secret}.example.invalid`,
      ],
      [
        "Google Maps browser key",
        "REACT_APP_GOOGLE_MAPS_API_KEY",
        (secret) => secret,
      ],
      [
        "Toss browser client-key",
        "REACT_APP_TOSS_CLIENT_KEY",
        (secret) => secret,
      ],
      [
        "CloudFront domain",
        "REACT_APP_CLOUDFRONT_DOMAIN",
        (secret) => `${secret}.example.invalid`,
      ],
    ].flatMap(([expectedCategory, fieldName, createValue]) =>
      ["test", "live"].map((environmentPrefix) => ({
        name: `${fieldName} rejects ${environmentPrefix} server secret`,
        environment: {
          ...publicCanaries,
          [fieldName]: createValue(
            `${environmentPrefix}_sk_forbidden_misplaced_secret_canary`,
          ),
        },
        expectedCategory,
      })),
    ),
    {
      name: "invalid Google Maps browser-key characters",
      environment: {
        ...publicCanaries,
        REACT_APP_GOOGLE_MAPS_API_KEY: "maps.key.with.invalid.characters",
      },
      expectedCategory: "Google Maps browser key",
    },
    {
      name: "invalid Toss client-key category",
      environment: {
        ...publicCanaries,
        REACT_APP_TOSS_CLIENT_KEY: "toss-public-key",
      },
      expectedCategory: "Toss browser client-key",
    },
    ...invalidPublicAssetBases.map(({ name, value }) => ({
      name: `unsafe PUBLIC_URL ${name}`,
      environment: {
        ...publicCanaries,
        PUBLIC_URL: value,
      },
      expectedCategory: "public asset-base",
    })),
    ...invalidEncodedRuntimeInputs.map(
      ({ name, fieldName, value, expectedCategory }) => ({
        name,
        environment: {
          ...publicCanaries,
          [fieldName]: value,
        },
        expectedCategory,
      }),
    ),
  ];

  invalidBuildInputs.forEach(({ name, environment, expectedCategory }) => {
    let failure;
    try {
      validatePublicBuildEnvironment(environment);
    } catch (error) {
      failure = error;
    }

    if (!(failure instanceof Error)) {
      throw new Error(`Public build validation accepted ${name}.`);
    }
    if (!failure.message.includes(expectedCategory)) {
      throw new Error(`Public build validation misclassified ${name}.`);
    }
    if (
      Object.values(environment)
        .filter((value) => typeof value === "string" && value.length > 0)
        .some((value) => failure.message.includes(value))
    ) {
      throw new Error(`Public build validation exposed the value for ${name}.`);
    }
  });
  validatePublicBuildEnvironment({
    ...publicCanaries,
    REACT_APP_CLOUDFRONT_DOMAIN: undefined,
  });
  validatePublicBuildEnvironment({
    ...publicCanaries,
    REACT_APP_CLOUDFRONT_DOMAIN:
      "https://public-assets-canary.example.invalid:443",
  });
  validatePublicBuildEnvironment({
    ...publicCanaries,
    PUBLIC_URL: undefined,
  });
  validatePublicBuildEnvironment({
    ...publicCanaries,
    PUBLIC_URL: "",
  });
  validatePublicBuildEnvironment({
    ...publicCanaries,
    PUBLIC_URL: acceptedPublicAssetBases.rootRelative,
  });
  validatePublicBuildEnvironment({
    ...publicCanaries,
    PUBLIC_URL: acceptedPublicAssetBases.httpsPath,
  });
  validatePublicBuildEnvironment(publicCanaries);

  for (const [index, { name, value }] of invalidPublicAssetBases.entries()) {
    const rejectedBuildPath = path.join(buildRoot, `rejected-${index + 1}`);
    const rejectedBuild = runPackageBuild({
      buildPath: rejectedBuildPath,
      publicAssetBase: value,
    });
    const rawOutput = `${rejectedBuild.stdout ?? ""}\n${rejectedBuild.stderr ?? ""}`;

    if (rejectedBuild.error) throw rejectedBuild.error;
    if (rejectedBuild.status === 0) {
      throw new Error(`Production build accepted unsafe PUBLIC_URL ${name}.`);
    }
    if (!rawOutput.includes("public asset-base")) {
      throw new Error(
        `Production build misclassified unsafe PUBLIC_URL ${name}.`,
      );
    }
    if (value.length >= 12 && rawOutput.includes(value)) {
      throw new Error(`Production build exposed unsafe PUBLIC_URL ${name}.`);
    }

    const rejectedFiles = await collectTextFilesIfPresent(rejectedBuildPath);
    if (rejectedFiles.length > 0) {
      throw new Error(
        `Production build emitted assets for unsafe PUBLIC_URL ${name}.`,
      );
    }
  }

  for (const [index, invalidInput] of invalidEncodedRuntimeInputs.entries()) {
    const rejectedBuildPath = path.join(
      buildRoot,
      `rejected-runtime-${index + 1}`,
    );
    const rejectedBuild = runPackageBuild({
      buildPath: rejectedBuildPath,
      publicAssetBase: "",
      environmentOverrides: {
        [invalidInput.fieldName]: invalidInput.value,
      },
    });
    const rawOutput = `${rejectedBuild.stdout ?? ""}\n${rejectedBuild.stderr ?? ""}`;

    if (rejectedBuild.error) throw rejectedBuild.error;
    if (rejectedBuild.status === 0) {
      throw new Error(`Production build accepted ${invalidInput.name}.`);
    }
    if (!rawOutput.includes(invalidInput.expectedCategory)) {
      throw new Error(`Production build misclassified ${invalidInput.name}.`);
    }
    if (rawOutput.includes(invalidInput.value)) {
      throw new Error(`Production build exposed ${invalidInput.name}.`);
    }

    const rejectedFiles = await collectTextFilesIfPresent(rejectedBuildPath);
    if (rejectedFiles.length > 0) {
      throw new Error(
        `Production build emitted assets for ${invalidInput.name}.`,
      );
    }
  }

  for (const [name, publicAssetBase] of Object.entries(
    acceptedPublicAssetBases,
  )) {
    const acceptedBuildPath = path.join(buildRoot, `accepted-${name}`);
    const build = runPackageBuild({
      buildPath: acceptedBuildPath,
      publicAssetBase,
    });

    if (build.error) throw build.error;
    if (build.status !== 0) {
      const output = redactCanaries(
        `${build.stdout ?? ""}\n${build.stderr ?? ""}`,
      );
      throw new Error(
        `Hostile-env production build failed for ${name} PUBLIC_URL:\n${output.slice(-8000)}`,
      );
    }

    const builtFiles = await collectTextFiles(acceptedBuildPath);
    const builtSource = (
      await Promise.all(builtFiles.map((file) => readFile(file, "utf8")))
    ).join("\n");

    const leakedCategories = Object.entries(forbiddenCanaries)
      .filter(([, canary]) => builtSource.includes(canary))
      .map(([fieldName]) => fieldName)
      .sort();

    if (leakedCategories.length > 0) {
      throw new Error(
        `Production build exposed forbidden environment categories: ${leakedCategories.join(", ")}`,
      );
    }

    const missingPublicCategories = Object.entries(publicCanaries)
      .filter(([, canary]) => !builtSource.includes(canary))
      .map(([fieldName]) => fieldName)
      .sort();

    if (missingPublicCategories.length > 0) {
      throw new Error(
        `Production build did not prove the public environment allowlist: ${missingPublicCategories.join(", ")}`,
      );
    }
    if (!builtSource.includes(publicAssetBase)) {
      throw new Error(
        `Production build did not preserve the validated ${name} PUBLIC_URL.`,
      );
    }

    initialJavascriptGzipMeasurements.push(
      await verifyViteBuildContract({
        directory: acceptedBuildPath,
        publicAssetBase,
        requiredLazyRouteChunks,
      }),
    );
  }

  const maximumInitialJavascriptGzipBytes = Math.max(
    ...initialJavascriptGzipMeasurements,
  );
  process.stdout.write(
    `Production builds contain only four approved app-runtime public categories plus a validated PUBLIC_URL asset base; the Vite initial JavaScript graph is at most ${(maximumInitialJavascriptGzipBytes / 1000).toFixed(2)} kB gzip.\n`,
  );
} finally {
  await rm(buildRoot, { recursive: true, force: true });
}
