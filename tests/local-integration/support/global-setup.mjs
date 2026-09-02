import {
  loadLocalIntegrationEnvironment,
  LOCAL_INTEGRATION_ENV_KEYS,
  LOCAL_INTEGRATION_PROJECTS,
} from "./environment.mjs";
import { runLocalIntegrationPreflight } from "./preflight.mjs";
import {
  assertFrontendReady,
  readFrontendState,
  readMatchingCoreManifest,
} from "./runner-gate.mjs";

const globalSetup = async () => {
  const activeProject = process.env[LOCAL_INTEGRATION_ENV_KEYS.activeProject];
  const requireToss = activeProject === LOCAL_INTEGRATION_PROJECTS.toss;
  const expectedProject = requireToss
    ? LOCAL_INTEGRATION_PROJECTS.toss
    : LOCAL_INTEGRATION_PROJECTS.core;
  const configuration = loadLocalIntegrationEnvironment({
    environment: process.env,
    expectedProject,
    requireRunnerIdentity: true,
    requireToss,
  });
  const frontend = readFrontendState();
  assertFrontendReady(frontend);

  if (requireToss) {
    await readMatchingCoreManifest({
      backendRevision: configuration.backend.revision,
      frontend,
      runId: configuration.runner.runId,
    });
  }

  await runLocalIntegrationPreflight({ configuration, requireToss });
};

export default globalSetup;
