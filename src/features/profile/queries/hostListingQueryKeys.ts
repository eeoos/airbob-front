import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { withSessionScopeKey } from "../../../platform/query/sessionScope";
import type { HostListingFilterStatus } from "../model/hostListing";

const root = ["profile", "host-listings"] as const;

export interface HostListingQueryFilter {
  readonly size: number;
  readonly status: HostListingFilterStatus;
}

export const hostListingQueryKeys = {
  root,
  list: (
    scope: AuthenticatedSessionScope,
    filter: HostListingQueryFilter,
  ) => withSessionScopeKey(scope, [...root, { ...filter }] as const),
};
