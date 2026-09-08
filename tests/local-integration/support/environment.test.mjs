import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalPlaywrightEnvironment,
  createLocalViteEnvironment,
  loadLocalIntegrationEnvironment,
  LOCAL_INTEGRATION_ENV_KEYS,
  LocalIntegrationBlockedError,
} from "./environment.mjs";

const FIXED_NOW = new Date("2026-09-02T01:00:00.000Z");

const createEnvironment = (overrides = {}) => ({
  AIRBOB_LOCAL_ACTIVE_PROJECT: "local-core",
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
  AIRBOB_LOCAL_RESET_AUTHORIZED_AT: "2026-09-02T00:55:00.000Z",
  AIRBOB_LOCAL_RESET_OWNER_LABEL: "backend-local-owner",
  AIRBOB_LOCAL_RESET_PROCEDURE_LABEL: "exact-disposable-profile-reset",
  AIRBOB_LOCAL_RUN_ID: "10000000-0000-4000-8000-000000000000",
  AIRBOB_LOCAL_SEARCH_DESTINATION: "제주",
  AIRBOB_LOCAL_TOSS_FAILURE_PROFILE: "confirm-test-code-configured",
  AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE: "TEST_CONFIRM_FAILURE",
  AIRBOB_LOCAL_TOSS_CARD_CVC: "123",
  AIRBOB_LOCAL_TOSS_CARD_EXPIRY: "12/30",
  AIRBOB_LOCAL_TOSS_CARD_NUMBER: "4444444444444444",
  AIRBOB_LOCAL_TOSS_CARD_PASSWORD: "00",
  AIRBOB_LOCAL_TOSS_PROVIDER_PROFILE: "sandbox-test-only",
  AIRBOB_LOCAL_TOSS_SANDBOX_PROFILE: "enabled",
  AIRBOB_LOCAL_TOSS_SERVER_PROFILE: "sandbox-configured",
  AIRBOB_LOCAL_WISHLIST_ACCOMMODATION_ID: "201",
  AIRBOB_QA_EMAIL: "local-qa@example.invalid",
  AIRBOB_QA_PASSWORD: "synthetic-local-password",
  REACT_APP_TOSS_CLIENT_KEY: "test_ck_synthetic_browser_key",
  ...overrides,
});

const loadEnvironment = ({ environment, requireToss = false }) =>
  loadLocalIntegrationEnvironment({
    environment,
    now: () => FIXED_NOW,
    requireToss,
  });

test("parses the exact disposable core fixture contract", () => {
  const configuration = loadEnvironment({
    environment: createEnvironment(),
  });

  assert.equal(configuration.mutationProfile, "disposable");
  assert.equal(configuration.dataOwnershipProfile, "backend-owned-disposable");
  assert.equal(configuration.backend.revision, "b2ec09a");
  assert.deepEqual(configuration.resetAuthorization, {
    authorizedAt: "2026-09-02T00:55:00.000Z",
    ownerLabel: "backend-local-owner",
    procedureLabel: "exact-disposable-profile-reset",
  });
  assert.equal(
    configuration.backend.readinessUrl,
    "http://127.0.0.1:8080/actuator/health/readiness",
  );
  assert.deepEqual(configuration.backend.requiredHealthComponents, [
    "accommodationInventory",
  ]);
  assert.equal(configuration.backend.allowAggregateOnlyReadiness, true);
  assert.deepEqual(configuration.backend.ports, {
    mysql: 3307,
    redis: 6379,
    cacheRedis: 6380,
    elasticsearch: 9200,
    kafka: 9092,
    debezium: 8083,
  });
  assert.equal(configuration.fixtures.paid.length, 3);
  assert.equal(configuration.fixtures.complimentary.couponId, 73);
  assert.equal(configuration.toss, null);
});

test("refuses mutation data unless the profile is exactly disposable", () => {
  const environment = createEnvironment({
    AIRBOB_LOCAL_MUTATION_PROFILE: "shared",
  });

  assert.throws(
    () => loadEnvironment({ environment }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("BLOCKED / UNVERIFIED") &&
      !error.message.includes(environment.AIRBOB_QA_PASSWORD),
  );
});

test("refuses mutation data without backend-owned disposable attestation", () => {
  const environment = createEnvironment({
    AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE: "read-only",
  });

  assert.throws(
    () => loadEnvironment({ environment }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE") &&
      !error.message.includes(environment.AIRBOB_QA_PASSWORD),
  );
});

test("refuses overlapping slots for the same accommodation", () => {
  const environment = createEnvironment({
    AIRBOB_LOCAL_PAID_FIXTURES: JSON.stringify([
      {
        accommodationId: "201",
        checkIn: "2026-10-10",
        checkOut: "2026-10-13",
      },
      {
        accommodationId: "201",
        checkIn: "2026-10-12",
        checkOut: "2026-10-15",
      },
      {
        accommodationId: "203",
        checkIn: "2026-10-16",
        checkOut: "2026-10-18",
      },
    ]),
  });

  assert.throws(
    () => loadEnvironment({ environment }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("overlapping local stay fixtures"),
  );
});

test("validates Toss credentials but exposes only test-only provider inputs", () => {
  const environment = createEnvironment();
  const configuration = loadEnvironment({
    environment,
    requireToss: true,
  });

  assert.deepEqual(configuration.toss, {
    runToss: true,
    clientKeyPresent: true,
    expectedFailureCode: "TEST_CONFIRM_FAILURE",
    failureProfileConfigured: true,
    provider: {
      cardNumber: "4444444444444444",
      expiry: "12/30",
      cvc: "123",
      password: "00",
      testOnly: true,
    },
  });
  assert.equal(
    Object.hasOwn(configuration.toss ?? {}, "serverCredential"),
    false,
  );
});

test("refuses backend-owned Toss server keys in the Playwright process", () => {
  const environment = createEnvironment({
    AIRBOB_LOCAL_TOSS_SECRET_KEY: "test_sk_must_remain_backend_only",
  });

  assert.throws(
    () => loadEnvironment({ environment, requireToss: true }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("prohibited AIRBOB_LOCAL_TOSS_SECRET_KEY") &&
      !error.message.includes(environment.AIRBOB_LOCAL_TOSS_SECRET_KEY),
  );
});

test("the Vite child receives public values and blank runner-only values", () => {
  const environment = createEnvironment({
    PATH: "/synthetic/bin",
    REACT_APP_GOOGLE_MAPS_API_KEY: "synthetic_maps_key",
  });
  const viteEnvironment = createLocalViteEnvironment(environment);

  assert.equal(viteEnvironment.REACT_APP_TOSS_CLIENT_KEY, "");
  assert.equal(viteEnvironment.REACT_APP_GOOGLE_MAPS_API_KEY, "");
  assert.equal(viteEnvironment.REACT_APP_CLOUDFRONT_DOMAIN, "");
  assert.equal(viteEnvironment.AIRBOB_QA_EMAIL, "");
  assert.equal(viteEnvironment.AIRBOB_QA_PASSWORD, "");
  assert.equal(viteEnvironment.AIRBOB_LOCAL_TOSS_SERVER_PROFILE, "");
  assert.equal(viteEnvironment.AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE, "");
  assert.equal(viteEnvironment.AIRBOB_LOCAL_BACKEND_REVISION, "");
  assert.equal(viteEnvironment.AIRBOB_LOCAL_ACTIVE_PROJECT, "");
  assert.equal(viteEnvironment.AIRBOB_LOCAL_RESET_AUTHORIZED_AT, "");
  assert.equal(viteEnvironment.AIRBOB_LOCAL_RESET_OWNER_LABEL, "");
  assert.equal(viteEnvironment.AIRBOB_LOCAL_RESET_PROCEDURE_LABEL, "");
  assert.equal(viteEnvironment.AIRBOB_LOCAL_RUN_ID, "");
  assert.equal(Object.hasOwn(viteEnvironment, "PATH"), false);

  const tossViteEnvironment = createLocalViteEnvironment({
    ...environment,
    AIRBOB_LOCAL_ACTIVE_PROJECT: "local-toss-sandbox",
  });
  assert.equal(
    tossViteEnvironment.REACT_APP_TOSS_CLIENT_KEY,
    environment.REACT_APP_TOSS_CLIENT_KEY,
  );
  assert.throws(
    () =>
      createLocalViteEnvironment({
        ...environment,
        AIRBOB_LOCAL_ACTIVE_PROJECT: "local-toss-sandbox",
        REACT_APP_TOSS_CLIENT_KEY: "test_sk_must_never_reach_vite",
      }),
    LocalIntegrationBlockedError,
  );
});

test("the Playwright child receives only declared profile and runtime values", () => {
  const environment = createEnvironment({
    AWS_SECRET_ACCESS_KEY: "private-ambient-cloud-key",
    DATABASE_URL: "private-ambient-database-url",
    HOME: "/safe/runtime-home",
    PATH: "/safe/runtime-path",
  });
  const child = createLocalPlaywrightEnvironment(environment, {
    [LOCAL_INTEGRATION_ENV_KEYS.activeProject]: "local-toss-sandbox",
    [LOCAL_INTEGRATION_ENV_KEYS.runId]: "run-filtered-child",
  });

  assert.equal(child.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(child.DATABASE_URL, undefined);
  assert.equal(child.HOME, "/safe/runtime-home");
  assert.equal(child.PATH, "/safe/runtime-path");
  assert.equal(child.AIRBOB_QA_EMAIL, environment.AIRBOB_QA_EMAIL);
  assert.equal(child.AIRBOB_QA_PASSWORD, environment.AIRBOB_QA_PASSWORD);
  assert.equal(child.AIRBOB_LOCAL_ACTIVE_PROJECT, "local-toss-sandbox");
  assert.equal(child.AIRBOB_LOCAL_RUN_ID, "run-filtered-child");
  assert.equal(Object.isFrozen(child), true);

  const coreChild = createLocalPlaywrightEnvironment(environment, {
    [LOCAL_INTEGRATION_ENV_KEYS.activeProject]: "local-core",
    [LOCAL_INTEGRATION_ENV_KEYS.runId]: "run-filtered-core",
  });
  assert.equal(coreChild.REACT_APP_TOSS_CLIENT_KEY, undefined);
  assert.equal(coreChild.AIRBOB_LOCAL_TOSS_CARD_NUMBER, undefined);
  assert.equal(coreChild.AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE, undefined);
});

test("requires an exact runner project and UUID before browser execution", () => {
  const configuration = loadLocalIntegrationEnvironment({
    environment: createEnvironment(),
    expectedProject: "local-core",
    now: () => FIXED_NOW,
    requireRunnerIdentity: true,
  });

  assert.deepEqual(configuration.runner, {
    activeProject: "local-core",
    runId: "10000000-0000-4000-8000-000000000000",
  });
  assert.throws(
    () =>
      loadLocalIntegrationEnvironment({
        environment: createEnvironment({
          AIRBOB_LOCAL_ACTIVE_PROJECT: "local-toss-sandbox",
        }),
        expectedProject: "local-core",
        now: () => FIXED_NOW,
        requireRunnerIdentity: true,
      }),
    LocalIntegrationBlockedError,
  );
  assert.throws(
    () =>
      loadLocalIntegrationEnvironment({
        environment: createEnvironment({ AIRBOB_LOCAL_RUN_ID: "manual-run" }),
        expectedProject: "local-core",
        now: () => FIXED_NOW,
        requireRunnerIdentity: true,
      }),
    LocalIntegrationBlockedError,
  );
});

test("refuses stale reset authorization metadata without values", () => {
  const environment = createEnvironment({
    AIRBOB_LOCAL_RESET_AUTHORIZED_AT: "2026-09-02T00:40:00.000Z",
  });

  assert.throws(
    () => loadEnvironment({ environment }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("AIRBOB_LOCAL_RESET_AUTHORIZED_AT") &&
      !error.message.includes(environment.AIRBOB_LOCAL_RESET_AUTHORIZED_AT),
  );
});

test("requires a lowercase Git backend revision without printing values", () => {
  for (const revision of ["ABCDEF1", "not-a-git-revision", "abc123"]) {
    const environment = createEnvironment({
      AIRBOB_LOCAL_BACKEND_REVISION: revision,
    });

    assert.throws(
      () => loadEnvironment({ environment }),
      (error) =>
        error instanceof LocalIntegrationBlockedError &&
        error.message.includes("AIRBOB_LOCAL_BACKEND_REVISION") &&
        !error.message.includes(revision),
    );
  }
});

test("refuses unsafe reset authorization labels without printing values", () => {
  const environment = createEnvironment({
    AIRBOB_LOCAL_RESET_OWNER_LABEL: "release-engineer-name",
  });

  assert.throws(
    () => loadEnvironment({ environment }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("AIRBOB_LOCAL_RESET_OWNER_LABEL") &&
      !error.message.includes(environment.AIRBOB_LOCAL_RESET_OWNER_LABEL),
  );
});

test("refuses non-slug reset procedures without printing values", () => {
  const environment = createEnvironment({
    AIRBOB_LOCAL_RESET_PROCEDURE_LABEL: "Exact Reset Procedure",
  });

  assert.throws(
    () => loadEnvironment({ environment }),
    (error) =>
      error instanceof LocalIntegrationBlockedError &&
      error.message.includes("AIRBOB_LOCAL_RESET_PROCEDURE_LABEL") &&
      !error.message.includes(environment.AIRBOB_LOCAL_RESET_PROCEDURE_LABEL),
  );
});

test("requires a safe uppercase Toss failure discriminator", () => {
  for (const expectedFailureCode of [undefined, "mixedCaseFailure"]) {
    const environment = createEnvironment({
      AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE: expectedFailureCode,
    });

    assert.throws(
      () => loadEnvironment({ environment, requireToss: true }),
      (error) =>
        error instanceof LocalIntegrationBlockedError &&
        error.message.includes("AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE") &&
        !error.message.includes(String(expectedFailureCode)),
    );
  }
});

test("marks custom readiness paths as requiring visible components", () => {
  const configuration = loadEnvironment({
    environment: createEnvironment({
      AIRBOB_LOCAL_BACKEND_READINESS_PATH: "/actuator/custom-readiness",
    }),
  });

  assert.equal(configuration.backend.allowAggregateOnlyReadiness, false);
});
