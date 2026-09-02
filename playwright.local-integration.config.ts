import { defineConfig, devices } from "@playwright/test";
import { LOCAL_INTEGRATION_APP_ORIGIN } from "./tests/local-integration/support/environment.mjs";

// Playwright otherwise writes an AI accessibility snapshot into
// error-context.md after failures. The remaining text-only error context is
// sanitized by global teardown before the privacy failure is reported.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export default defineConfig({
  testDir: "./tests/local-integration/specs",
  outputDir: "./test-results/local-integration",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: "./tests/local-integration/support/global-setup.mjs",
  globalTeardown: "./tests/e2e/support/scan-artifacts.mjs",
  reporter: [
    [
      "./tests/e2e/support/redacted-line-reporter.mjs",
      { suiteLabel: "local integration browser tests" },
    ],
  ],
  use: {
    baseURL: LOCAL_INTEGRATION_APP_ORIGIN,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    viewport: { width: 1280, height: 720 },
    serviceWorkers: "block",
    trace: "off",
    video: "off",
    screenshot: "off",
    // HAR recording is intentionally absent. Local runs retain text-only
    // output that the shared teardown privacy scanner can inspect.
  },
  projects: [
    {
      name: "local-core",
      testMatch: "local-core.spec.ts",
      outputDir: "./test-results/local-integration/local-core",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "local-toss-sandbox",
      testMatch: "toss-sandbox.spec.ts",
      outputDir: "./test-results/local-integration/local-toss-sandbox",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node tests/local-integration/support/start-vite.mjs",
    url: LOCAL_INTEGRATION_APP_ORIGIN,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
