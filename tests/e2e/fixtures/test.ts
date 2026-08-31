import { test as base, expect } from "@playwright/test";
import { ApiHarness } from "./api";
import { installSessionFixture, type SessionFixture } from "./session";

interface CharacterizationFixtures {
  appBaseURL: string;
  api: ApiHarness;
  session: SessionFixture;
  fixedClock: void;
}

export const test = base.extend<CharacterizationFixtures>({
  appBaseURL: async ({ baseURL }, use) => {
    if (!baseURL) {
      throw new Error("Playwright baseURL is required.");
    }

    await use(baseURL);
  },
  fixedClock: [
    async ({ page }, use) => {
      await page.clock.install({ time: new Date("2026-07-01T12:00:00+09:00") });
      await use();
    },
    { auto: true },
  ],
  api: [
    async ({ appBaseURL, context }, use) => {
      const api = new ApiHarness(context, new URL(appBaseURL).origin);
      await api.install();
      await use(api);
      api.assertNoUnhandledRequests();
    },
    { auto: true },
  ],
  session: [
    async ({ api }, use) => {
      await use(installSessionFixture(api));
    },
    { auto: true },
  ],
});

export { expect };
