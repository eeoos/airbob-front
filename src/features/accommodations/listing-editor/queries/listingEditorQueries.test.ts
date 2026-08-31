import { QueryClient } from "@tanstack/react-query";
import type { Mocked } from "vitest";
import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import type { ListingEditorApiPort } from "../ports/listingEditorApiPort";
import type { ListingEditorAccommodation } from "../model/listingEditor";
import { listingEditorQueryKeys } from "./listingEditorQueryKeys";
import {
  createListingEditorQueryOptions,
  createListingEditorQueryPort,
} from "./listingEditorQueries";

const scopeA = {
  epoch: 4,
  subject: "subject:member_a" as AuthenticatedSessionScope["subject"],
};
const nextEpochScope = { ...scopeA, epoch: 5 };
const scopeB = {
  epoch: 4,
  subject: "subject:member_b" as AuthenticatedSessionScope["subject"],
};

const accommodation = (
  id: number,
  name = `listing-${id}`,
): ListingEditorAccommodation => ({
  id,
  name,
  description: "Description",
  type: "APARTMENT",
  basePrice: 120_000,
  currency: "KRW",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  address: {
    postalCode: "04000",
    country: "대한민국",
    state: "서울특별시",
    city: "서울",
    district: "마포구",
    street: "월드컵북로",
    detail: "101호",
  },
  occupancyPolicy: {
    maxOccupancy: 4,
    infantOccupancy: 1,
    petOccupancy: 0,
  },
  amenities: [{ name: "WIFI", count: 1 }],
  images: [{ id: id * 10, imageUrl: `/${id}.jpg` }],
});

const createApi = (): Mocked<ListingEditorApiPort> => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
  getHostDetail: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  uploadImages: vi.fn().mockResolvedValue([]),
});

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
    },
  });

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe("listing editor query boundary", () => {
  it("owns an exact accommodation/session key and matching session metadata", () => {
    const api = createApi();
    const options = createListingEditorQueryOptions(
      { accommodationId: 31, scope: scopeA },
      api,
    );

    expect(options.queryKey).toEqual([
      "accommodation",
      "listing-editor",
      31,
      { session: { subject: scopeA.subject, epoch: 4 } },
    ]);
    expect(options.meta).toEqual({ session: scopeA });
    expect(listingEditorQueryKeys.detail(nextEpochScope, 31)).not.toEqual(
      options.queryKey,
    );
    expect(listingEditorQueryKeys.detail(scopeB, 31)).not.toEqual(
      options.queryKey,
    );
    expect(listingEditorQueryKeys.detail(scopeA, 32)).not.toEqual(
      options.queryKey,
    );
    expect(options.retry).toBe(false);
  });

  it("forwards the Query-owned transport signal without coupling a workflow signal", async () => {
    const api = createApi();
    const queryController = new AbortController();
    api.getHostDetail.mockResolvedValue(accommodation(31));
    const options = createListingEditorQueryOptions(
      { accommodationId: 31, scope: scopeA },
      api,
    );

    await expect(
      options.queryFn({ signal: queryController.signal }),
    ).resolves.toEqual(accommodation(31));

    const forwardedSignal = api.getHostDetail.mock.calls[0][1]?.signal;
    expect(forwardedSignal).toBe(queryController.signal);
  });

  it("lets a same-key live consumer finish when an old workflow consumer aborts", async () => {
    const api = createApi();
    const client = createClient();
    const pending = deferred<ListingEditorAccommodation>();
    const oldController = new AbortController();
    const liveController = new AbortController();
    const oldRemove = vi.spyOn(
      oldController.signal,
      "removeEventListener",
    );
    let transportSignal: AbortSignal | undefined;
    api.getHostDetail.mockImplementation((_id, options) => {
      transportSignal = options?.signal;
      return pending.promise;
    });
    const port = createListingEditorQueryPort(client, api);

    const oldRequest = port.getHostDetail(31, {
      scope: scopeA,
      signal: oldController.signal,
    });
    await Promise.resolve();
    const liveRequest = port.getHostDetail(31, {
      scope: scopeA,
      signal: liveController.signal,
    });
    const oldExpectation = (async () => {
      await expect(oldRequest).rejects.toMatchObject({
        code: "LISTING_EDITOR_QUERY_CANCELLED",
        kind: "cancelled",
      });
    })();

    oldController.abort();

    await oldExpectation;
    expect(api.getHostDetail).toHaveBeenCalledTimes(1);
    expect(transportSignal?.aborted).toBe(false);
    expect(oldRemove).toHaveBeenCalledWith("abort", expect.any(Function));

    pending.resolve(accommodation(31));
    await expect(liveRequest).resolves.toEqual(accommodation(31));
    expect(
      client.getQueryData(listingEditorQueryKeys.detail(scopeA, 31)),
    ).toEqual(accommodation(31));
    client.clear();
  });

  it("settles one aborted consumer immediately while the Query transport may fill cache", async () => {
    const api = createApi();
    const client = createClient();
    const pending = deferred<ListingEditorAccommodation>();
    const workflowController = new AbortController();
    let transportSignal: AbortSignal | undefined;
    api.getHostDetail.mockImplementation((_id, options) => {
      transportSignal = options?.signal;
      return pending.promise;
    });
    const port = createListingEditorQueryPort(client, api);
    const queryKey = listingEditorQueryKeys.detail(scopeA, 31);

    const request = port.getHostDetail(31, {
      scope: scopeA,
      signal: workflowController.signal,
    });
    await Promise.resolve();
    const transportCompletion = client.getQueryCache().find({
      exact: true,
      queryKey,
    })?.promise;
    const cancelled = (async () => {
      await expect(request).rejects.toMatchObject({
        code: "LISTING_EDITOR_QUERY_CANCELLED",
        kind: "cancelled",
      });
    })();

    workflowController.abort();
    await cancelled;
    expect(transportSignal?.aborted).toBe(false);

    pending.resolve(accommodation(31));
    await expect(transportCompletion).resolves.toEqual(accommodation(31));
    expect(
      client.getQueryData<ListingEditorAccommodation>(queryKey),
    ).toEqual(accommodation(31));
    client.clear();
  });

  it("lets QueryClient cancellation abort the shared transport and avoid cache publication", async () => {
    const api = createApi();
    const client = createClient();
    let transportSignal: AbortSignal | undefined;
    api.getHostDetail.mockImplementation((_id, options) => {
      transportSignal = options?.signal;
      return new Promise<ListingEditorAccommodation>(() => undefined);
    });
    const port = createListingEditorQueryPort(client, api);
    const queryKey = listingEditorQueryKeys.detail(scopeA, 31);

    const request = port.getHostDetail(31, { scope: scopeA });
    const cancelled = (async () => {
      await expect(request).rejects.toBeDefined();
    })();
    await Promise.resolve();
    await client.cancelQueries({ exact: true, queryKey });

    await cancelled;
    expect(transportSignal?.aborted).toBe(true);
    expect(client.getQueryData(queryKey)).toBeUndefined();
    client.clear();
  });

  it("publishes only the exact accommodation and session projection", async () => {
    const api = createApi();
    const client = createClient();
    api.getHostDetail
      .mockResolvedValueOnce(accommodation(31, "scope-a"))
      .mockResolvedValueOnce(accommodation(31, "scope-b"))
      .mockResolvedValueOnce(accommodation(32, "other-listing"));
    const port = createListingEditorQueryPort(client, api);

    await port.getHostDetail(31, { scope: scopeA });
    await port.getHostDetail(31, { scope: scopeB });
    await port.getHostDetail(32, { scope: scopeA });
    port.setHostDetail({
      accommodation: accommodation(31, "scope-a-updated"),
      accommodationId: 31,
      scope: scopeA,
    });

    expect(
      client.getQueryData<ListingEditorAccommodation>(
        listingEditorQueryKeys.detail(scopeA, 31),
      )?.name,
    ).toBe("scope-a-updated");
    expect(
      client.getQueryData<ListingEditorAccommodation>(
        listingEditorQueryKeys.detail(scopeB, 31),
      )?.name,
    ).toBe("scope-b");
    expect(
      client.getQueryData<ListingEditorAccommodation>(
        listingEditorQueryKeys.detail(scopeA, 32),
      )?.name,
    ).toBe("other-listing");
    expect(
      client.getQueryCache().find({
        exact: true,
        queryKey: listingEditorQueryKeys.detail(scopeA, 31),
      })?.meta,
    ).toEqual({ session: scopeA });
    client.clear();
  });

  it("projects delete, upload, and update deltas without replacing concurrent fields", () => {
    const client = createClient();
    const port = createListingEditorQueryPort(client, createApi());
    const fallback = accommodation(31, "workflow-baseline");
    const concurrent = {
      ...fallback,
      description: "Concurrent remote description",
      name: "Concurrent remote name",
      images: [
        { id: 310, imageUrl: "/old.jpg" },
        { id: 320, imageUrl: "/keep.jpg" },
      ],
    };
    port.setHostDetail({
      accommodation: concurrent,
      accommodationId: 31,
      scope: scopeA,
    });

    const replaceImages = {
      accommodationId: 31,
      fallback,
      projection: {
        kind: "replace-images" as const,
        images: [{ id: 320, imageUrl: "/keep-server.jpg" }],
      },
      scope: scopeA,
    };
    port.projectHostDetail(replaceImages);
    port.projectHostDetail(replaceImages);

    const appendImages = {
      accommodationId: 31,
      fallback,
      projection: {
        kind: "append-images" as const,
        images: [{ id: 401, imageUrl: "/uploaded.jpg" }],
      },
      scope: scopeA,
    };
    port.projectHostDetail(appendImages);
    port.projectHostDetail(appendImages);

    const applyUpdate = {
      accommodationId: 31,
      fallback,
      projection: {
        kind: "apply-update" as const,
        update: { name: "Local editor name" },
      },
      scope: scopeA,
    };
    port.projectHostDetail(applyUpdate);
    port.projectHostDetail(applyUpdate);

    expect(
      client.getQueryData<ListingEditorAccommodation>(
        listingEditorQueryKeys.detail(scopeA, 31),
      ),
    ).toEqual({
      ...concurrent,
      name: "Local editor name",
      images: [
        { id: 320, imageUrl: "/keep-server.jpg" },
        { id: 401, imageUrl: "/uploaded.jpg" },
      ],
    });
    client.clear();
  });

  it("uses the committed workflow baseline when a delta projection has no cache", () => {
    const client = createClient();
    const port = createListingEditorQueryPort(client, createApi());
    const fallback = accommodation(31, "workflow-baseline");

    port.projectHostDetail({
      accommodationId: 31,
      fallback,
      projection: {
        kind: "apply-update",
        update: { description: "Locally saved description" },
      },
      scope: scopeA,
    });

    expect(
      client.getQueryData<ListingEditorAccommodation>(
        listingEditorQueryKeys.detail(scopeA, 31),
      ),
    ).toEqual({
      ...fallback,
      description: "Locally saved description",
    });
    expect(
      client.getQueryCache().find({
        exact: true,
        queryKey: listingEditorQueryKeys.detail(scopeA, 31),
      })?.meta,
    ).toEqual({ session: scopeA });
    client.clear();
  });

  it("rejects a mismatched resource before it can enter the scoped cache", async () => {
    const api = createApi();
    const client = createClient();
    api.getHostDetail.mockResolvedValue(accommodation(32));
    const port = createListingEditorQueryPort(client, api);

    await expect(port.getHostDetail(31, { scope: scopeA })).rejects.toMatchObject(
      {
        code: "MISMATCHED_LISTING_EDITOR_RESOURCE",
        kind: "invalid-response",
      },
    );
    expect(
      client.getQueryData(listingEditorQueryKeys.detail(scopeA, 31)),
    ).toBeUndefined();
    expect(() =>
      port.setHostDetail({
        accommodation: accommodation(32),
        accommodationId: 31,
        scope: scopeA,
      }),
    ).toThrow("does not match");
    expect(() =>
      port.projectHostDetail({
        accommodationId: 31,
        fallback: accommodation(32),
        projection: { kind: "apply-update", update: { name: "invalid" } },
        scope: scopeA,
      }),
    ).toThrow("does not match");
    client.clear();
  });
});
