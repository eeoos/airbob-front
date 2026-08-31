import path from "node:path";
import postcssGlobalData from "@csstools/postcss-global-data";
import react from "@vitejs/plugin-react";
import postcssCustomMedia from "postcss-custom-media";
import { defineConfig, type Plugin } from "vite";
import {
  loadPublicBuildEnvironment,
  PUBLIC_RUNTIME_ENV_KEYS,
  validatePublicBuildEnvironment,
} from "./scripts/architecture/validate-public-build-env.mjs";

const projectRoot = path.resolve(process.cwd());
const defaultBuildDirectory = path.join(projectRoot, "build");
const customMediaPath = path.join(
  projectRoot,
  "src/shared/styles/custom-media.css",
);
const defineString = (value: string | undefined): string =>
  JSON.stringify(value ?? "");
const normalizePublicAssetBase = (value: string | undefined): string => {
  const configuredBase = value?.trim() || "/";
  return configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
};

const publicBuildConfigPlugin = (): Plugin => ({
  name: "airbob-public-build-config",
  config: (_config, { command, mode }) => {
    // Vitest owns NODE_ENV and lets individual tests override public values.
    // Production and development builds still use the exact public allowlist
    // below, while the test runner receives no compile-time substitutions.
    if (mode === "test") {
      return {};
    }

    const publicEnvironment = loadPublicBuildEnvironment({
      mode,
      root: projectRoot,
    });

    if (command === "build") {
      validatePublicBuildEnvironment(publicEnvironment);
    }

    const configuredBuildPath = process.env.BUILD_PATH?.trim() || "build";
    const resolvedBuildDirectory = path.resolve(projectRoot, configuredBuildPath);
    const runtimeMode = command === "build" ? "production" : "development";

    return {
      base: normalizePublicAssetBase(publicEnvironment.PUBLIC_URL),
      define: {
        "process.env.NODE_ENV": JSON.stringify(runtimeMode),
        ...Object.fromEntries(
          PUBLIC_RUNTIME_ENV_KEYS.map((key) => [
            `process.env.${key}`,
            defineString(publicEnvironment[key]),
          ]),
        ),
      },
      build: {
        emptyOutDir: resolvedBuildDirectory === defaultBuildDirectory,
        outDir: resolvedBuildDirectory,
      },
    };
  },
});

export default defineConfig({
  appType: "spa",
  clearScreen: false,
  // Browser configuration is exposed only through the exact define entries
  // above. Vite's prefix-based import.meta.env channel is intentionally closed.
  envPrefix: [],
  plugins: [publicBuildConfigPlugin(), react()],
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [
        postcssGlobalData({ files: [customMediaPath] }),
        postcssCustomMedia({ preserve: false }),
      ],
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
  build: {
    assetsDir: "static",
    cssCodeSplit: true,
    sourcemap: true,
    target: "baseline-widely-available",
  },
});
