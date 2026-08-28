import { ApiHarness } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

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
  baseURL,
  request,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required.");
  }

  const response = await request.get(baseURL, {
    headers: { host: "attacker.invalid" },
  });

  expect(response.status()).toBe(421);
});

test("the harness records and blocks every non-allowlisted data channel", async ({
  baseURL,
  browser,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required.");
  }

  const context = await browser.newContext({ baseURL });
  const harness = new ApiHarness(context, new URL(baseURL).origin);
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
          "http://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js?synthetic=1";
        script.addEventListener("load", () => resolve("loaded"), { once: true });
        script.addEventListener("error", () => resolve("blocked"), { once: true });
        document.head.appendChild(script);
      });

      return {
        apiRoot: await request("/api"),
        apiV2: await request("/api/v2/unregistered"),
        daumPost: await request(
          "http://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js",
          { method: "POST", body: "synthetic" },
        ),
        daumQueryScript: daumQueryScriptOutcome,
        externalFetch: await request("https://example.invalid/should-not-connect"),
        offPrefixFetch: await request("/unregistered-data"),
        webSocket: webSocketOutcome,
      };
    });

    expect(outcomes).toEqual({
      apiRoot: 599,
      apiV2: 599,
      daumPost: "blocked",
      daumQueryScript: "blocked",
      externalFetch: "blocked",
      offPrefixFetch: "blocked",
      webSocket: "blocked",
    });

    let isolationError = "";
    try {
      harness.assertNoUnhandledRequests();
    } catch (error) {
      isolationError = error instanceof Error ? error.message : String(error);
    }

    expect(isolationError).toContain("GET /api (api)");
    expect(isolationError).toContain("GET /api/v2/unregistered (api)");
    expect(isolationError).toContain("GET /unregistered-data (same-origin-data)");
    expect(isolationError).toContain("POST t1.daumcdn.net/mapjsapi");
    expect(isolationError).toContain("GET example.invalid/should-not-connect");
    expect(isolationError).toContain(
      "WEBSOCKET example.invalid/should-not-connect (external-websocket)",
    );
  } finally {
    await context.close();
  }
});
