import {
  ApiHarness,
  apiSuccess,
  isExactE2eApiUrl,
} from "../fixtures/api";
import { test, expect } from "../fixtures/test";
import { E2E_API_ORIGIN } from "../support/runtimeOrigins";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

test("network isolation is active for tests that request only a page", async ({
  page,
}) => {
  const authResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/v1/auth/me",
  );

  await page.goto("/login");

  expect((await authResponse).status()).toBe(401);
  await expect(
    page.getByRole("heading", { name: "로그인", level: 2 }),
  ).toBeVisible();
});

test("the production-build server rejects an unexpected Host header", async ({
  appBaseURL: baseURL,
  request,
}) => {
  const response = await request.get(baseURL, {
    headers: { host: "attacker.invalid" },
  });

  expect(response.status()).toBe(421);
});

test("the exact synthetic API origin handles CORS without journaling its preflight", async ({
  appBaseURL: baseURL,
  browser,
}) => {
  expect(
    isExactE2eApiUrl(
      new URL(
        "https://synthetic-user:synthetic-password@api.airbob-e2e.invalid/api/v1/probe",
      ),
    ),
  ).toBe(false);

  const context = await browser.newContext({ baseURL });
  const harness = new ApiHarness(context, new URL(baseURL).origin);
  harness.register("POST", "/api/v1/harness-cors-probe", (request) =>
    apiSuccess(request.body, 201),
  );
  await harness.install();

  try {
    const page = await context.newPage();
    await page.goto("/robots.txt");

    const apiResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url() === `${E2E_API_ORIGIN}/api/v1/harness-cors-probe`,
    );
    const outcome = await page.evaluate(async (apiOrigin) => {
      const response = await fetch(`${apiOrigin}/api/v1/harness-cors-probe`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ probe: "synthetic" }),
      });

      return {
        body: await response.json(),
        status: response.status,
      };
    }, E2E_API_ORIGIN);
    const apiHeaders = await (await apiResponsePromise).allHeaders();

    expect(outcome).toEqual({
      body: {
        success: true,
        data: { probe: "synthetic" },
        error: null,
      },
      status: 201,
    });
    expect(apiHeaders).toMatchObject({
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": new URL(baseURL).origin,
    });
    expect(harness.requests).toEqual([
      expect.objectContaining({
        method: "POST",
        pathname: "/api/v1/harness-cors-probe",
        body: { probe: "synthetic" },
      }),
    ]);
    harness.assertNoUnhandledRequests();
  } finally {
    await context.close();
  }
});

test("the harness records and blocks every non-allowlisted data channel", async ({
  appBaseURL: baseURL,
  browser,
}) => {
  const context = await browser.newContext({ baseURL });
  const harness = new ApiHarness(context, new URL(baseURL).origin);
  harness.register(
    "GET",
    "/api/v2/registered-same-origin",
    apiSuccess({ mustNotBeReached: true }),
  );
  await harness.install();

  try {
    const page = await context.newPage();
    await page.goto("/robots.txt");

    const outcomes = await page.evaluate(async () => {
      const request = async (input: string, init?: RequestInit) => {
        try {
          const response = await fetch(input, init);
          return response.status;
        } catch {
          return "blocked";
        }
      };

      const webSocketOutcome = await new Promise<string>((resolve) => {
        const socket = new WebSocket("wss://example.invalid/should-not-connect");
        socket.addEventListener("close", () => resolve("blocked"), { once: true });
        socket.addEventListener("error", () => resolve("blocked"), { once: true });
      });
      const daumQueryScriptOutcome = await new Promise<string>((resolve) => {
        const script = document.createElement("script");
        script.src =
          "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js?synthetic=1";
        script.addEventListener("load", () => resolve("loaded"), { once: true });
        script.addEventListener("error", () => resolve("blocked"), { once: true });
        document.head.appendChild(script);
      });
      const daumCredentialScriptOutcome = await new Promise<string>((resolve) => {
        const script = document.createElement("script");
        script.src =
          "https://user:password@t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
        script.addEventListener("load", () => resolve("loaded"), { once: true });
        script.addEventListener("error", () => resolve("blocked"), { once: true });
        document.head.appendChild(script);
      });
      const daumHttpScriptOutcome = await new Promise<string>((resolve) => {
        const script = document.createElement("script");
        script.src =
          "http://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
        script.addEventListener("load", () => resolve("loaded"), { once: true });
        script.addEventListener("error", () => resolve("blocked"), { once: true });
        document.head.appendChild(script);
      });
      return {
        apiRoot: await request("/api"),
        apiV2: await request("/api/v2/unregistered"),
        registeredSameOriginApi: await request(
          "/api/v2/registered-same-origin",
        ),
        daumCredentialScript: daumCredentialScriptOutcome,
        daumHttpScript: daumHttpScriptOutcome,
        daumPost: await request(
          "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js",
          { method: "POST", body: "synthetic" },
        ),
        daumQueryScript: daumQueryScriptOutcome,
        daumWrongResourceType: await request(
          "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js",
        ),
        externalFetch: await request("https://example.invalid/should-not-connect"),
        nearMissApiHost: await request(
          "https://api.airbob-e2e.invalid.attacker.invalid/api/v1/should-not-connect",
        ),
        httpDowngradeApi: await request(
          "http://api.airbob-e2e.invalid/api/v1/should-not-connect",
        ),
        rogueApiHeader: await request(
          "https://api.airbob-e2e.invalid/api/v1/should-not-connect",
          {
            method: "POST",
            credentials: "include",
            headers: {
              authorization: "synthetic-test-value",
              "content-type": "application/json",
            },
            body: JSON.stringify({ probe: "synthetic" }),
          },
        ),
        unsupportedApiMethod: await request(
          "https://api.airbob-e2e.invalid/api/v1/should-not-connect",
          {
            method: "PUT",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ probe: "synthetic" }),
          },
        ),
        offPrefixFetch: await request("/unregistered-data"),
        webSocket: webSocketOutcome,
      };
    });

    expect(outcomes).toEqual({
      apiRoot: "blocked",
      apiV2: "blocked",
      registeredSameOriginApi: "blocked",
      daumCredentialScript: "blocked",
      daumHttpScript: "blocked",
      daumPost: "blocked",
      daumQueryScript: "blocked",
      daumWrongResourceType: "blocked",
      externalFetch: "blocked",
      nearMissApiHost: "blocked",
      httpDowngradeApi: "blocked",
      rogueApiHeader: "blocked",
      unsupportedApiMethod: "blocked",
      offPrefixFetch: "blocked",
      webSocket: "blocked",
    });

    let isolationError = "";
    try {
      harness.assertNoUnhandledRequests();
    } catch (error) {
      isolationError = toErrorMessage(error);
    }

    expect(isolationError).toContain("GET /api (api)");
    expect(isolationError).toContain("GET /api/v2/unregistered (api)");
    expect(isolationError).toContain(
      "GET /api/v2/registered-same-origin (api)",
    );
    expect(isolationError).toContain("GET /unregistered-data (same-origin-data)");
    expect(isolationError).toContain("POST t1.daumcdn.net/mapjsapi");
    expect(isolationError).toContain("GET example.invalid/should-not-connect");
    expect(isolationError).toContain(
      "GET api.airbob-e2e.invalid.attacker.invalid/api/v1/should-not-connect (external)",
    );
    expect(isolationError).toContain(
      "GET api.airbob-e2e.invalid/api/v1/should-not-connect (external)",
    );
    expect(isolationError).toContain(
      "POST api.airbob-e2e.invalid/api/v1/should-not-connect (api)",
    );
    expect(isolationError).toContain(
      "PUT api.airbob-e2e.invalid/api/v1/should-not-connect (api)",
    );
    expect(
      harness.requests.some(
        ({ pathname }) =>
          pathname === "/api/v1/should-not-connect" ||
          pathname === "/api/v2/registered-same-origin",
      ),
    ).toBe(false);
    expect(isolationError).toContain(
      "WEBSOCKET example.invalid/should-not-connect (external-websocket)",
    );
  } finally {
    await context.close();
  }
});
