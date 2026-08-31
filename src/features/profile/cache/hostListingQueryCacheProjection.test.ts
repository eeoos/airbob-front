import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type { HostListingPage } from "../model/hostListing";
import type { HostListingsApiPort } from "../ports/hostListingsApiPort";
import { createHostListingInfiniteQueryOptions } from "../queries/hostListingQueries";
import { createHostListingQueryCacheProjection } from "./hostListingQueryCacheProjection";

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:member_a" as AuthenticatedSessionScope["subject"],
  epoch: 4,
};
const scopeB: AuthenticatedSessionScope = {
  subject: "subject:member_b" as AuthenticatedSessionScope["subject"],
  epoch: 4,
};

const emptyPage: HostListingPage = {
  listings: [],
  pageInfo: { currentSize: 0, hasNext: false, nextCursor: null },
};

describe("host listing cache projection", () => {
  it("invalidates every status only inside the captured authenticated scope", async () => {
    const api: HostListingsApiPort = {
      getHostListings: vi.fn().mockResolvedValue(emptyPage),
    };
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const scopeAPublished = createHostListingInfiniteQueryOptions(
      { scope: scopeA, status: "PUBLISHED" },
      api,
    );
    const scopeADraft = createHostListingInfiniteQueryOptions(
      { scope: scopeA, status: "DRAFT" },
      api,
    );
    const scopeBPublished = createHostListingInfiniteQueryOptions(
      { scope: scopeB, status: "PUBLISHED" },
      api,
    );
    await Promise.all([
      client.fetchInfiniteQuery(scopeAPublished),
      client.fetchInfiniteQuery(scopeADraft),
      client.fetchInfiniteQuery(scopeBPublished),
    ]);

    await createHostListingQueryCacheProjection(client).refreshRequired({
      scope: scopeA,
    });

    expect(
      client.getQueryCache().find({
        exact: true,
        queryKey: scopeAPublished.queryKey,
      })?.state.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryCache().find({
        exact: true,
        queryKey: scopeADraft.queryKey,
      })?.state.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryCache().find({
        exact: true,
        queryKey: scopeBPublished.queryKey,
      })?.state.isInvalidated,
    ).toBe(false);
    client.clear();
  });

  it("rejects publication when an active listing refetch fails", async () => {
    const refetchError = new Error("active listing refetch failed");
    const getHostListings = vi
      .fn()
      .mockResolvedValueOnce(emptyPage)
      .mockRejectedValueOnce(refetchError);
    const api = { getHostListings } as HostListingsApiPort;
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const options = createHostListingInfiniteQueryOptions(
      { scope: scopeA, status: "PUBLISHED" },
      api,
    );
    const observer = new InfiniteQueryObserver(client, options);
    let unsubscribe: () => void = () => undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        unsubscribe = observer.subscribe((result) => {
          if (result.isSuccess) resolve();
          if (result.isError) reject(result.error);
        });
      });

      await expect(
        createHostListingQueryCacheProjection(client).refreshRequired({
          scope: scopeA,
        }),
      ).rejects.toBe(refetchError);
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
