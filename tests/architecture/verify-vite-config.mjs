import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "vite";
import { PUBLIC_RUNTIME_ENV_KEYS } from "../../scripts/architecture/validate-public-build-env.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const configFile = path.join(projectRoot, "vite.config.ts");
const environmentKeys = [
  "BUILD_PATH",
  "PUBLIC_URL",
  "REACT_APP_API_URL",
  "REACT_APP_GOOGLE_MAPS_API_KEY",
  "REACT_APP_TOSS_CLIENT_KEY",
  "REACT_APP_CLOUDFRONT_DOMAIN",
];
const originalEnvironment = new Map(
  environmentKeys.map((key) => [key, process.env[key]]),
);

const restoreEnvironment = () => {
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

try {
  delete process.env.BUILD_PATH;
  delete process.env.PUBLIC_URL;
  process.env.REACT_APP_API_URL = "https://api.example.invalid";
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY = "synthetic_maps_browser_key";
  process.env.REACT_APP_TOSS_CLIENT_KEY = "test_ck_synthetic_browser_key";
  process.env.REACT_APP_CLOUDFRONT_DOMAIN = "assets.example.invalid";

  const developmentConfig = await resolveConfig(
    { configFile, logLevel: "silent" },
    "serve",
    "development",
    "development",
  );

  assert.equal(developmentConfig.configFile, configFile);
  assert.equal(developmentConfig.base, "/");
  assert.deepEqual(developmentConfig.envPrefix, []);
  assert.equal(developmentConfig.server.host, "127.0.0.1");
  assert.equal(developmentConfig.server.port, 3000);
  assert.equal(developmentConfig.server.strictPort, true);
  assert.deepEqual(developmentConfig.server.proxy?.["/api"], {
    target: "http://localhost:8080",
    changeOrigin: true,
  });
  assert.equal(developmentConfig.preview.host, "127.0.0.1");
  assert.equal(developmentConfig.preview.port, 3000);
  assert.equal(developmentConfig.preview.strictPort, true);
  assert.equal(
    developmentConfig.define["process.env.NODE_ENV"],
    '"development"',
  );
  assert.equal(
    developmentConfig.define["process.env.REACT_APP_API_URL"],
    '"https://api.example.invalid"',
  );
  assert.deepEqual(
    Object.keys(developmentConfig.define).sort(),
    [
      "process.env.NODE_ENV",
      ...PUBLIC_RUNTIME_ENV_KEYS.map((key) => `process.env.${key}`),
    ].sort(),
  );
  assert.deepEqual(
    developmentConfig.css.postcss.plugins.map(
      ({ postcssPlugin }) => postcssPlugin,
    ),
    ["postcss-global-data", "postcss-custom-media"],
  );
  assert.equal(developmentConfig.css.devSourcemap, true);
  const testConfig = await resolveConfig(
    { configFile, logLevel: "silent" },
    "serve",
    "test",
    "test",
  );

  assert.equal(testConfig.mode, "test");
  assert.equal(testConfig.base, "/");
  assert.equal(testConfig.define, undefined);

  const defaultBuildDirectory = path.join(projectRoot, "build");
  const productionConfig = await resolveConfig(
    { configFile, logLevel: "silent" },
    "build",
    "production",
    "production",
  );

  assert.equal(productionConfig.build.outDir, defaultBuildDirectory);
  assert.equal(productionConfig.build.assetsDir, "static");
  assert.equal(productionConfig.build.cssCodeSplit, true);
  assert.equal(productionConfig.build.emptyOutDir, true);
  assert.equal(productionConfig.build.sourcemap, true);
  assert.deepEqual(productionConfig.build.target, [
    "chrome111",
    "edge111",
    "firefox114",
    "safari16.4",
    "ios16.4",
  ]);
  assert.equal(
    productionConfig.define["process.env.NODE_ENV"],
    '"production"',
  );

  process.stdout.write(
    "Vite config preserves the exact env, test isolation, proxy, CSS, output, and sourcemap contracts.\n",
  );
} finally {
  restoreEnvironment();
}
