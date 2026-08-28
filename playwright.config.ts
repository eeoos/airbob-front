import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";
const e2ePort = new URL(baseURL).port;

export default defineConfig({
  testDir: "./tests/e2e/specs",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  globalTeardown: "./tests/e2e/support/scan-artifacts.mjs",
  reporter: [["./tests/e2e/support/redacted-line-reporter.mjs"]],
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    viewport: { width: 1280, height: 720 },
    serviceWorkers: "block",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node tests/e2e/support/serve-production-build.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      BROWSER: "none",
      CI: "false",
      AIRBOB_E2E_PORT: e2ePort,
      REACT_APP_API_URL: baseURL,
      REACT_APP_GOOGLE_MAPS_API_KEY: "",
      REACT_APP_TOSS_CLIENT_KEY: "test_ck_synthetic_characterization",
    },
  },
});
