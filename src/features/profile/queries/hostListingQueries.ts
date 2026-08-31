import { createSessionQueryMeta } from "../../../platform/query/sessionScope";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { hostListingsApi as defaultHostListingsApi } from "../api/hostListingsApi";
import type { HostListingFilterStatus } from "../model/hostListing";
import type { HostListingsApiPort } from "../ports/hostListingsApiPort";
import { hostListingQueryKeys } from "./hostListingQueryKeys";

export const HOST_LISTINGS_PAGE_SIZE = 20;

export interface HostListingInfiniteQueryOptions {
  readonly enabled?: boolean;
  readonly scope: AuthenticatedSessionScope;
  readonly size?: number;
  readonly status: HostListingFilterStatus;
}

export const createHostListingInfiniteQueryOptions = (
  {
    enabled = true,
    scope,
    size = HOST_LISTINGS_PAGE_SIZE,
    status,
  }: HostListingInfiniteQueryOptions,
  api: HostListingsApiPort = defaultHostListingsApi,
) => ({
  queryKey: hostListingQueryKeys.list(scope, { size, status }),
  queryFn: ({
    pageParam,
    signal,
  }: {
    readonly pageParam: string | undefined;
    readonly signal: AbortSignal;
  }) =>
    api.getHostListings(
      {
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
        size,
        status,
      },
      { signal },
    ),
  initialPageParam: undefined as string | undefined,
  enabled,
  getNextPageParam: (lastPage: Awaited<ReturnType<HostListingsApiPort["getHostListings"]>>) =>
    lastPage.pageInfo.hasNext
      ? lastPage.pageInfo.nextCursor ?? undefined
      : undefined,
  meta: createSessionQueryMeta(scope),
  retry: false as const,
  throwOnError: false as const,
});
