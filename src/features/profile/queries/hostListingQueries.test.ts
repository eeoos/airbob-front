import { QueryClient } from "@tanstack/react-query";
import type { Mocked } from "vitest";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type { HostListingPage, HostListingStatus } from "../model/hostListing";
import type {
  HostListingsApiPort,
  HostListingsRequest,
} from "../ports/hostListingsApiPort";
import { hostListingQueryKeys } from "./hostListingQueryKeys";
import { createHostListingInfiniteQueryOptions } from "./hostListingQueries";

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:member_a" as AuthenticatedSessionScope["subject"],
  epoch: 4,
};
const scopeB: AuthenticatedSessionScope = {
  subject: "subject:member_b" as AuthenticatedSessionScope["subject"],
  epoch: 4,
};

const page = (
  id: number,
  nextCursor: string | null = null,
  status: HostListingStatus = "PUBLISHED",
): HostListingPage => ({
  listings: [
    {
      id,
      name: `숙소 ${id}`,
      thumbnailUrl: null,
      status,
      type: null,
      addressSummary: null,
      createdAt: "2026-08-30T00:00:00Z",
    },
  ],
  pageInfo: {
    currentSize: 1,
    hasNext: nextCursor !== null,
    nextCursor,
  },
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe("host listing query boundary", () => {
  it("keys and tags the authenticated subject, epoch and status while forwarding page cursor and signal", async () => {
    const api: Mocked<HostListingsApiPort> = {
      getHostListings: vi.fn().mockResolvedValue(page(31, "cursor-2")),
    };
    const options = createHostListingInfiniteQueryOptions(
      { scope: scopeA, status: "PUBLISHED" },
      api,
    );
    const signal = new AbortController().signal;

    await options.queryFn({ pageParam: "cursor-1", signal });

    expect(options.queryKey).toEqual([
      "profile",
      "host-listings",
      { size: 20, status: "PUBLISHED" },
      { session: { subject: scopeA.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scopeA });
    expect(options.retry).toBe(false);
    expect(api.getHostListings).toHaveBeenCalledWith(
      { cursor: "cursor-1", size: 20, status: "PUBLISHED" },
      { signal },
    );
    expect(options.getNextPageParam(page(31, "cursor-2"))).toBe("cursor-2");
    expect(options.getNextPageParam(page(31))).toBeUndefined();
  });

  it("isolates status, subject and epoch in semantic list keys", () => {
    const published = hostListingQueryKeys.list(scopeA, {
      size: 20,
      status: "PUBLISHED",
    });

    expect(
      hostListingQueryKeys.list(scopeA, { size: 20, status: "DRAFT" }),
    ).not.toEqual(published);
    expect(
      hostListingQueryKeys.list(scopeB, { size: 20, status: "PUBLISHED" }),
    ).not.toEqual(published);
    expect(
      hostListingQueryKeys.list(
        { ...scopeA, epoch: 5 },
        { size: 20, status: "PUBLISHED" },
      ),
    ).not.toEqual(published);
  });

  it("keeps a late response in its original status cache", async () => {
    const published = deferred<HostListingPage>();
    const draft = deferred<HostListingPage>();
    const api: HostListingsApiPort = {
      getHostListings: vi.fn((request: HostListingsRequest) =>
        request.status === "PUBLISHED" ? published.promise : draft.promise,
      ),
    };
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const publishedOptions = createHostListingInfiniteQueryOptions(
      { scope: scopeA, status: "PUBLISHED" },
      api,
    );
    const draftOptions = createHostListingInfiniteQueryOptions(
      { scope: scopeA, status: "DRAFT" },
      api,
    );

    const oldRequest = client.fetchInfiniteQuery(publishedOptions);
    const currentRequest = client.fetchInfiniteQuery(draftOptions);
    draft.resolve(page(42, null, "DRAFT"));
    await expect(currentRequest).resolves.toMatchObject({
      pages: [{ listings: [{ id: 42 }] }],
    });
    published.resolve(page(31));
    await expect(oldRequest).resolves.toMatchObject({
      pages: [{ listings: [{ id: 31 }] }],
    });

    expect(client.getQueryData(draftOptions.queryKey)).toMatchObject({
      pages: [{ listings: [{ id: 42 }] }],
    });
    expect(client.getQueryData(publishedOptions.queryKey)).toMatchObject({
      pages: [{ listings: [{ id: 31 }] }],
    });
    client.clear();
  });
});
