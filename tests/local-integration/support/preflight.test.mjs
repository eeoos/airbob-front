import assert from "node:assert/strict";
import test from "node:test";
import { LocalIntegrationBlockedError } from "./environment.mjs";
import { runLocalIntegrationPreflight } from "./preflight.mjs";

const createEnvironment = () => ({
  AIRBOB_LOCAL_BACKEND_REVISION: "b2ec09a",
  AIRBOB_LOCAL_COMPLIMENTARY_COUPON_ID: "73",
  AIRBOB_LOCAL_COMPLIMENTARY_FIXTURE: JSON.stringify({
    accommodationId: "204",
    checkIn: "2026-10-20",
    checkOut: "2026-10-22",
  }),
  AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE: "backend-owned-disposable",
  AIRBOB_LOCAL_MUTATION_PROFILE: "disposable",
  AIRBOB_LOCAL_PAID_FIXTURES: JSON.stringify([
    {
      accommodationId: "201",
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
    },
    {
      accommodationId: "202",
      checkIn: "2026-10-13",
      checkOut: "2026-10-15",
    },
    {
      accommodationId: "203",
      checkIn: "2026-10-16",
      checkOut: "2026-10-18",
    },
  ]),
  AIRBOB_LOCAL_RESET_AUTHORIZED_AT: new Date().toISOString(),
  AIRBOB_LOCAL_RESET_OWNER_LABEL: "backend-local-owner",
  AIRBOB_LOCAL_RESET_PROCEDURE_LABEL: "exact-disposable-profile-reset",
  AIRBOB_LOCAL_SEARCH_DESTINATION: "제주",
  AIRBOB_LOCAL_WISHLIST_ACCOMMODATION_ID: "201",
  AIRBOB_QA_EMAIL: "local-qa@example.invalid",
  AIRBOB_QA_PASSWORD: "synthetic-local-password",
});

const createFetch =
  ({
    connectorState = "RUNNING",
    exposeComponents = true,
    inventoryStatus = "UP",
    taskState = "RUNNING",
  } = {}) =>
  async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes("/actuator/")) {
      const health = exposeComponents
        ? {
            status: "UP",
            components: {
              accommodationInventory: { status: inventoryStatus },
            },
          }
        : { status: "UP" };
      return new Response(JSON.stringify(health), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (requestUrl.includes("/connectors/")) {
      return new Response(
        JSON.stringify({
          connector: { state: connectorState },
          tasks: [{ state: taskState }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response("ready", { status: 200 });
  };

test("checks frontend, backend readiness, and every local dependency port", async () => {
  const connectedPorts = [];
  const result = await runLocalIntegrationPreflight({
    environment: createEnvironment(),
    fetchImpl: createFetch(),
    connectImpl: async ({ port }) => {
      connectedPorts.push(port);
    },
  });

  assert.deepEqual(result, { project: "local-core", status: "ready" });
  assert.deepEqual(connectedPorts, [3307, 6379, 6380, 9200, 9092, 8083]);
});

test("classifies incomplete messaging readiness as blocked and unverified", async () => {
  await assert.rejects(
    runLocalIntegrationPreflight({
      environment: createEnvironment(),
      fetchImpl: createFetch({ inventoryStatus: "DOWN" }),
      connectImpl: async () => {},
    }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("BLOCKED / UNVERIFIED") &&
      error.message.includes("backend health component"),
  );
});

test("accepts aggregate UP when Actuator hides readiness components", async () => {
  const result = await runLocalIntegrationPreflight({
    environment: createEnvironment(),
    fetchImpl: createFetch({ exposeComponents: false }),
    connectImpl: async () => {},
  });

  assert.deepEqual(result, { project: "local-core", status: "ready" });
});

test("blocks custom readiness paths when Actuator hides components", async () => {
  const environment = {
    ...createEnvironment(),
    AIRBOB_LOCAL_BACKEND_READINESS_PATH: "/actuator/custom-readiness",
  };

  await assert.rejects(
    runLocalIntegrationPreflight({
      environment,
      fetchImpl: createFetch({ exposeComponents: false }),
      connectImpl: async () => {},
    }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("custom backend readiness components"),
  );
});

test("blocks mutation when the Debezium connector task is not running", async () => {
  await assert.rejects(
    runLocalIntegrationPreflight({
      environment: createEnvironment(),
      fetchImpl: createFetch({ taskState: "FAILED" }),
      connectImpl: async () => {},
    }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("debezium connector is not ready"),
  );
});

test("does not print a failed dependency address or environment value", async () => {
  const environment = createEnvironment();
  let failure;
  try {
    await runLocalIntegrationPreflight({
      environment,
      fetchImpl: createFetch(),
      connectImpl: async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:3307");
      },
    });
  } catch (error) {
    failure = error;
  }

  assert.ok(failure instanceof LocalIntegrationBlockedError);
  assert.equal(failure.message.includes("127.0.0.1"), false);
  assert.equal(failure.message.includes(environment.AIRBOB_QA_PASSWORD), false);
});
