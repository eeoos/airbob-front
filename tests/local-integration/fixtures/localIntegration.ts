import { loadLocalIntegrationEnvironment } from "../support/environment.mjs";
import { LOCAL_INTEGRATION_PROJECTS } from "../support/environment.mjs";

export { observeLocalApiRequests } from "./rawRequestObservation";
export type {
  LocalApiRequestObservation,
  ObservedLocalApiRequest,
} from "./rawRequestObservation";

export type LocalIntegrationFixtureConfig = ReturnType<
  typeof loadLocalIntegrationEnvironment
>;

/** Load runner-owned fixture data without wrapping or extending Playwright. */
export const loadLocalIntegrationFixtureConfig = (
  options: { readonly requireToss?: boolean } = {},
): LocalIntegrationFixtureConfig =>
  loadLocalIntegrationEnvironment({
    environment: process.env,
    expectedProject:
      options.requireToss === true
        ? LOCAL_INTEGRATION_PROJECTS.toss
        : LOCAL_INTEGRATION_PROJECTS.core,
    requireRunnerIdentity: true,
    requireToss: options.requireToss ?? false,
  });
