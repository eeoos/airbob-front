import { fileURLToPath } from "node:url";
import {
  loadLocalIntegrationEnvironment,
  LOCAL_INTEGRATION_PROJECTS,
  LocalIntegrationBlockedError,
} from "./environment.mjs";
import { runLocalIntegrationPreflight } from "./preflight.mjs";
import { startLocalIntegrationVite } from "./start-vite.mjs";

const DEFAULT_ATTEMPTS = 30;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_SIGTERM_TIMEOUT_MS = 2_000;
const DEFAULT_SIGKILL_TIMEOUT_MS = 1_000;

const childHasExited = (child) =>
  child.exitCode !== null || child.signalCode !== null;

const waitForChildExit = (child, timeoutMs) =>
  new Promise((resolve) => {
    if (childHasExited(child)) {
      resolve(true);
      return;
    }

    let timeout = null;
    const finish = (exited) => {
      child.off("exit", onExit);
      if (timeout !== null) clearTimeout(timeout);
      resolve(exited);
    };
    const onExit = () => finish(true);
    child.once("exit", onExit);
    timeout = setTimeout(() => finish(false), timeoutMs);

    if (childHasExited(child)) finish(true);
  });

const stopChild = async (
  child,
  {
    sigkillTimeoutMs = DEFAULT_SIGKILL_TIMEOUT_MS,
    sigtermTimeoutMs = DEFAULT_SIGTERM_TIMEOUT_MS,
  } = {},
) => {
  if (childHasExited(child)) return;
  child.kill("SIGTERM");
  if (await waitForChildExit(child, sigtermTimeoutMs)) return;

  child.kill("SIGKILL");
  if (!(await waitForChildExit(child, sigkillTimeoutMs))) {
    throw new LocalIntegrationBlockedError("frontend did not stop");
  }
};

export const runStandalonePreflight = async ({
  attempts = DEFAULT_ATTEMPTS,
  environment = process.env,
  loadEnvironmentImpl = loadLocalIntegrationEnvironment,
  requireRunnerIdentity = false,
  requireToss = false,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  runPreflightImpl = runLocalIntegrationPreflight,
  sigkillTimeoutMs = DEFAULT_SIGKILL_TIMEOUT_MS,
  sigtermTimeoutMs = DEFAULT_SIGTERM_TIMEOUT_MS,
  sleepImpl = (delayMs) =>
    new Promise((resolve) => setTimeout(resolve, delayMs)),
  startViteImpl = startLocalIntegrationVite,
} = {}) => {
  const selectedProject = requireToss
    ? LOCAL_INTEGRATION_PROJECTS.toss
    : LOCAL_INTEGRATION_PROJECTS.core;
  const configuration = loadEnvironmentImpl({
    environment,
    expectedProject: requireRunnerIdentity ? selectedProject : null,
    requireRunnerIdentity,
    requireToss,
  });
  const vite = startViteImpl({
    environment,
    stdio: ["ignore", "ignore", "ignore"],
  });

  try {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (childHasExited(vite)) {
        throw new LocalIntegrationBlockedError("frontend failed to start");
      }

      try {
        return await runPreflightImpl({
          configuration,
          environment,
          requireToss,
        });
      } catch (error) {
        lastError = error;
        if (!(error instanceof LocalIntegrationBlockedError)) throw error;
        if (attempt + 1 < attempts) await sleepImpl(retryDelayMs);
      }
    }

    throw (
      lastError ?? new LocalIntegrationBlockedError("frontend is unreachable")
    );
  } finally {
    await stopChild(vite, { sigkillTimeoutMs, sigtermTimeoutMs });
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const requireToss = process.argv.includes("--project=local-toss-sandbox");
  try {
    const result = await runStandalonePreflight({ requireToss });
    process.stdout.write(
      `Local integration preflight passed for ${result.project}.\n`,
    );
  } catch (error) {
    const message =
      error instanceof LocalIntegrationBlockedError
        ? error.message
        : "Local integration BLOCKED / UNVERIFIED: preflight failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
