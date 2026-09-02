import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { LocalIntegrationBlockedError } from "./environment.mjs";
import { runStandalonePreflight } from "./run-preflight.mjs";

const createChild = ({ exitOnSigterm = true } = {}) => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.signals = [];
  child.kill = (signal) => {
    child.signals.push(signal);
    if (signal === "SIGKILL" || exitOnSigterm) {
      child.signalCode = signal;
      queueMicrotask(() => child.emit("exit", null, signal));
    }
    return true;
  };
  return child;
};

test("parses configuration before spawning Vite", async () => {
  let spawnCount = 0;

  await assert.rejects(
    runStandalonePreflight({
      environment: {},
      loadEnvironmentImpl: () => {
        throw new LocalIntegrationBlockedError("invalid runner configuration");
      },
      startViteImpl: () => {
        spawnCount += 1;
        return createChild();
      },
    }),
    LocalIntegrationBlockedError,
  );

  assert.equal(spawnCount, 0);
});

test("retries bounded transient readiness failures with parsed configuration", async () => {
  const child = createChild();
  const configuration = Object.freeze({ appOrigin: "synthetic" });
  const failureReasons = [
    "backend readiness is unreachable",
    "mysql dependency is unreachable",
    "elasticsearch accommodation alias is not ready",
    "debezium connector is not ready",
  ];
  const sleeps = [];
  let attempt = 0;

  const result = await runStandalonePreflight({
    attempts: 5,
    environment: {},
    loadEnvironmentImpl: () => configuration,
    retryDelayMs: 7,
    runPreflightImpl: async ({ configuration: receivedConfiguration }) => {
      assert.equal(receivedConfiguration, configuration);
      const failureReason = failureReasons[attempt];
      attempt += 1;
      if (failureReason) throw new LocalIntegrationBlockedError(failureReason);
      return { project: "local-core", status: "ready" };
    },
    sleepImpl: async (delayMs) => {
      sleeps.push(delayMs);
    },
    startViteImpl: () => child,
  });

  assert.deepEqual(result, { project: "local-core", status: "ready" });
  assert.equal(attempt, 5);
  assert.deepEqual(sleeps, [7, 7, 7, 7]);
  assert.deepEqual(child.signals, ["SIGTERM"]);
});

test("escalates a bounded Vite shutdown from SIGTERM to SIGKILL", async () => {
  const child = createChild({ exitOnSigterm: false });

  const result = await runStandalonePreflight({
    attempts: 1,
    environment: {},
    loadEnvironmentImpl: () => Object.freeze({ appOrigin: "synthetic" }),
    runPreflightImpl: async () => ({
      project: "local-core",
      status: "ready",
    }),
    sigkillTimeoutMs: 10,
    sigtermTimeoutMs: 1,
    startViteImpl: () => child,
  });

  assert.deepEqual(result, { project: "local-core", status: "ready" });
  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
});
