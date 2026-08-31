import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";

export interface HostListingCacheProjectionPort {
  refreshRequired(input: {
    readonly scope: AuthenticatedSessionScope;
  }): Promise<void>;
}
