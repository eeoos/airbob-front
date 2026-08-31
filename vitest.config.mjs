import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.mjs";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: "unit",
      globals: true,
      environment: "jsdom",
      environmentOptions: {
        jsdom: {
          url: "http://localhost/",
        },
      },
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{js,jsx,mjs,ts,tsx}"],
      fileParallelism: false,
      maxWorkers: 1,
      sequence: {
        hooks: "list",
      },
      css: {
        modules: {
          classNameStrategy: "non-scoped",
        },
      },
      clearMocks: false,
      mockReset: false,
      restoreMocks: false,
      coverage: {
        provider: "v8",
        reportsDirectory: "coverage",
        reporter: ["text", "json-summary", "html"],
        include: ["src/**/*.{js,jsx,mjs,ts,tsx}"],
        exclude: [
          "src/**/*.d.ts",
          "src/**/*.{test,spec}.{js,jsx,mjs,ts,tsx}",
          "src/**/__tests__/**",
          "src/**/__mocks__/**",
          "src/test/**",
        ],
        thresholds: {
          statements: 87,
          branches: 79,
          functions: 89,
          lines: 89,
        },
      },
    },
  }),
);
