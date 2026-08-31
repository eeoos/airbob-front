import type { Mocked } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type {
  ListingEditorAccommodation,
  ListingEditorApiPort,
  ListingEditorImage,
} from "../../features/accommodations/listing-editor/ports/listingEditorApiPort";
import type { ListingEditorQueryPort } from "../../features/accommodations/listing-editor/ports/listingEditorQueryPort";
import { createListingEditorQueryPort } from "../../features/accommodations/listing-editor/queries/listingEditorQueries";
import { listingEditorQueryKeys } from "../../features/accommodations/listing-editor/queries/listingEditorQueryKeys";
import { AppError } from "../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import {
  createListingEditorWorkflow,
  type ListingEditorPublicationPort,
  type ListingEditorRouteLease,
  type ListingEditorSessionPort,
} from "./editorCommands";

type ListingEditorContinuationPort = Parameters<
  typeof createListingEditorWorkflow
>[0]["continuation"];

const scope = {
  epoch: 4,
  subject: "subject:member_test" as AuthenticatedSessionScope["subject"],
};
const replacementScope = {
  epoch: 5,
  subject: "subject:member_replacement" as AuthenticatedSessionScope["subject"],
};

const accommodation = {
  id: 31,
  name: "Server listing",
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
  images: [
    { id: 301, imageUrl: "/one.jpg" },
    { id: 302, imageUrl: "/two.jpg" },
  ],
} as const;

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const networkError = (message = "network failed") =>
  new AppError({
    code: "NETWORK_ERROR",
    kind: "network",
    message,
    retryable: true,
  });

const validationError = () =>
  new AppError({
    code: "VALIDATION_ERROR",
    kind: "validation",
    message: "invalid",
  });

const notFoundError = () =>
  new AppError({
    code: "I004",
    kind: "http",
    message: "missing",
    status: 404,
  });

const forbiddenError = () =>
  new AppError({
    code: "FORBIDDEN",
    kind: "http",
    message: "denied",
    status: 403,
  });

const emptyDataError = () =>
  new AppError({
    code: "EMPTY_LISTING_EDITOR_DATA",
    kind: "empty-data",
    message: "empty",
  });

const createApi = (): Mocked<ListingEditorApiPort> => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
  getHostDetail: vi.fn().mockResolvedValue(accommodation),
  publish: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  uploadImages: vi.fn().mockResolvedValue([]),
});

const createHarness = () => {
  let routeCurrent = true;
  let sessionCurrent = true;
  let sessionScope = scope;
  const api = createApi();
  const query: Mocked<ListingEditorQueryPort> = {
    getHostDetail: vi.fn((accommodationId, options) =>
      api.getHostDetail(accommodationId, {
        ...(options.signal ? { signal: options.signal } : {}),
      }),
    ),
    projectHostDetail: vi.fn(),
    setHostDetail: vi.fn(),
  };
  const publication: Mocked<ListingEditorPublicationPort> = {
    publishEditorChanged: vi.fn().mockResolvedValue(undefined),
  };
  const continuation: Mocked<ListingEditorContinuationPort> = {
    complete: vi.fn().mockResolvedValue(undefined),
  };
  const routeLease: ListingEditorRouteLease = {
    isCurrent: () => routeCurrent,
  };
  const session: ListingEditorSessionPort = {
    captureAuthenticatedSession: () => sessionScope,
    isCurrentSession: (capturedScope) =>
      sessionCurrent &&
      capturedScope.subject === sessionScope.subject &&
      capturedScope.epoch === sessionScope.epoch,
  };
  const workflow = createListingEditorWorkflow({
    accommodationId: 31,
    api,
    continuation,
    instanceId: "editor-route-a",
    publication,
    query,
    routeLease,
    session,
  });

  return {
    api,
    continuation,
    publication,
    query,
    setRouteCurrent: (current: boolean) => {
      routeCurrent = current;
    },
    setSessionCurrent: (current: boolean) => {
      sessionCurrent = current;
    },
    setSessionScope: (nextScope: AuthenticatedSessionScope) => {
      sessionScope = nextScope;
    },
    workflow,
  };
};

const createQueryBackedHarness = () => {
  const api = createApi();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  const query = createListingEditorQueryPort(queryClient, api);
  const publication: Mocked<ListingEditorPublicationPort> = {
    publishEditorChanged: vi.fn().mockResolvedValue(undefined),
  };
  const continuation: Mocked<ListingEditorContinuationPort> = {
    complete: vi.fn().mockResolvedValue(undefined),
  };
  const workflow = createListingEditorWorkflow({
    accommodationId: 31,
    api,
    continuation,
    instanceId: "editor-query-backed",
    publication,
    query,
    routeLease: { isCurrent: () => true },
    session: {
      captureAuthenticatedSession: () => scope,
      isCurrentSession: (capturedScope) =>
        capturedScope.subject === scope.subject &&
        capturedScope.epoch === scope.epoch,
    },
  });

  return { api, continuation, publication, query, queryClient, workflow };
};

describe("createListingEditorWorkflow", () => {
  it("shares one hydration command and exposes an atomic detail/images baseline", async () => {
    const harness = createHarness();
    const pending = deferred<ListingEditorAccommodation>();
    harness.api.getHostDetail.mockReturnValueOnce(pending.promise);

    const first = harness.workflow.hydrate();
    const duplicate = harness.workflow.hydrate();

    expect(duplicate).toBe(first);
    expect(harness.api.getHostDetail).toHaveBeenCalledTimes(1);
    expect(harness.query.getHostDetail).toHaveBeenCalledWith(31, {
      scope,
      signal: expect.any(AbortSignal),
    });
    pending.resolve(accommodation);

    await expect(first).resolves.toMatchObject({
      accommodation,
      baselineRevision: 0,
      status: "ready",
    });
    expect(harness.workflow.getState()).toMatchObject({
      baseline: accommodation,
      baselineRevision: 0,
      status: "ready",
    });
  });

  it.each([
    [
      new AppError({
        code: "I004",
        kind: "http",
        message: "missing",
        status: 404,
      }),
      "invalid-resource",
    ],
    [
      new AppError({
        code: "FORBIDDEN",
        kind: "http",
        message: "denied",
        status: 403,
      }),
      "denied",
    ],
    [
      new AppError({
        code: "INVALID_RESPONSE",
        kind: "invalid-response",
        message: "malformed envelope",
      }),
      "retryable-load-error",
    ],
    [networkError(), "retryable-load-error"],
  ] as const)("classifies hydration failures as %s", async (error, status) => {
    const harness = createHarness();
    harness.api.getHostDetail.mockRejectedValueOnce(error);

    await expect(harness.workflow.hydrate()).resolves.toMatchObject({ status });
    expect(harness.workflow.getState().status).toBe(status);
  });

  it("rejects a mismatched hydration resource without publishing it", async () => {
    const harness = createHarness();
    harness.api.getHostDetail.mockResolvedValueOnce({
      ...accommodation,
      id: 32,
    });

    await expect(harness.workflow.hydrate()).resolves.toMatchObject({
      status: "invalid-resource",
    });
    expect(harness.workflow.getState().status).toBe("invalid-resource");
  });

  it("treats a missing image as a confirmed delete without reconciliation", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.deleteImage.mockRejectedValueOnce(notFoundError());

    await expect(
      harness.workflow.deleteImage({ imageId: 301, originalIndex: 0 }),
    ).resolves.toMatchObject({
      accommodation: {
        images: [{ id: 302, imageUrl: "/two.jpg" }],
      },
      baselineRevision: 1,
      status: "delete-confirmed",
    });
    expect(harness.api.getHostDetail).toHaveBeenCalledTimes(1);
    expect(harness.publication.publishEditorChanged).toHaveBeenCalledWith({
      accommodationId: 31,
      outcome: "saved",
      scope,
    });
    expect(harness.query.projectHostDetail).toHaveBeenCalledWith({
      fallback: expect.objectContaining({
        id: 31,
        images: [{ id: 302, imageUrl: "/two.jpg" }],
      }),
      accommodationId: 31,
      projection: {
        kind: "replace-images",
        images: [{ id: 302, imageUrl: "/two.jpg" }],
      },
      scope,
    });
  });

  it("retries only delete publication after the server deletion is confirmed", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.publication.publishEditorChanged
      .mockRejectedValueOnce(new Error("cache publication failed"))
      .mockResolvedValueOnce(undefined);

    await expect(
      harness.workflow.deleteImage({ imageId: 301, originalIndex: 0 }),
    ).resolves.toMatchObject({
      accommodation: {
        images: [{ id: 302, imageUrl: "/two.jpg" }],
      },
      baselineRevision: 1,
      journal: { deletionReconciled: true },
      phase: "publication",
      status: "recoverable-error",
    });
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      accommodation: {
        images: [{ id: 302, imageUrl: "/two.jpg" }],
      },
      baselineRevision: 1,
      status: "delete-confirmed",
    });

    expect(harness.api.deleteImage).toHaveBeenCalledTimes(1);
    expect(harness.api.getHostDetail).toHaveBeenCalledTimes(1);
    expect(harness.publication.publishEditorChanged).toHaveBeenCalledTimes(2);
  });

  it("restores a definitive delete rejection without reading host detail", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.deleteImage.mockRejectedValueOnce(validationError());

    await expect(
      harness.workflow.deleteImage({ imageId: 301, originalIndex: 0 }),
    ).resolves.toMatchObject({
      imageId: 301,
      originalIndex: 0,
      status: "delete-rejected",
    });
    expect(harness.api.getHostDetail).toHaveBeenCalledTimes(1);
    expect(harness.workflow.getState()).toMatchObject({
      phase: "delete",
      retry: "allowed",
      status: "recoverable-error",
    });
  });

  it("reconciles an ambiguous delete and accepts server-confirmed absence", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.deleteImage.mockRejectedValueOnce(networkError());
    harness.api.getHostDetail.mockResolvedValueOnce({
      ...accommodation,
      images: [{ id: 302, imageUrl: "/two.jpg" }],
    });

    await expect(
      harness.workflow.deleteImage({ imageId: 301, originalIndex: 0 }),
    ).resolves.toMatchObject({
      accommodation: {
        images: [{ id: 302, imageUrl: "/two.jpg" }],
      },
      status: "delete-confirmed",
    });
    expect(harness.api.deleteImage).toHaveBeenCalledTimes(1);
    expect(harness.api.getHostDetail).toHaveBeenCalledTimes(2);
  });

  it("reconciles only server-confirmed images without replacing non-image baseline fields", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.deleteImage.mockRejectedValueOnce(networkError());
    harness.api.getHostDetail.mockResolvedValueOnce({
      ...accommodation,
      name: "Concurrent remote name",
      description: "Concurrent remote description",
      images: [
        { id: 302, imageUrl: "/two-server.jpg" },
        { id: 303, imageUrl: "/three-server.jpg" },
      ],
    });

    await expect(
      harness.workflow.deleteImage({ imageId: 301, originalIndex: 0 }),
    ).resolves.toMatchObject({
      accommodation: {
        description: accommodation.description,
        name: accommodation.name,
        images: [
          { id: 302, imageUrl: "/two-server.jpg" },
          { id: 303, imageUrl: "/three-server.jpg" },
        ],
      },
      status: "delete-confirmed",
    });
  });

  it("keeps concurrent Query fields while projecting delete, upload, and update deltas once", async () => {
    const harness = createQueryBackedHarness();
    await harness.workflow.hydrate();
    const concurrentDetail: ListingEditorAccommodation = {
      ...accommodation,
      description: "Concurrent remote description",
      name: "Concurrent remote name",
      images: [{ id: 302, imageUrl: "/two-server.jpg" }],
    };
    harness.api.deleteImage.mockRejectedValueOnce(networkError());
    harness.api.getHostDetail.mockResolvedValueOnce(concurrentDetail);

    await expect(
      harness.workflow.deleteImage({ imageId: 301, originalIndex: 0 }),
    ).resolves.toMatchObject({
      accommodation: {
        description: accommodation.description,
        name: accommodation.name,
        images: concurrentDetail.images,
      },
      status: "delete-confirmed",
    });
    expect(
      harness.queryClient.getQueryData<ListingEditorAccommodation>(
        listingEditorQueryKeys.detail(scope, 31),
      ),
    ).toMatchObject(concurrentDetail);
    const projectionSpy = vi.spyOn(harness.query, "projectHostDetail");

    const file = new File(["image"], "room.png", { type: "image/png" });
    harness.api.uploadImages.mockResolvedValueOnce([
      { id: 401, imageUrl: "/uploaded.jpg" },
    ]);
    harness.publication.publishEditorChanged
      .mockRejectedValueOnce(new Error("saved publication failed"))
      .mockResolvedValueOnce(undefined);

    await expect(
      harness.workflow.execute({
        intent: "advance",
        pendingFiles: [file],
        update: { name: "Local editor name" },
      }),
    ).resolves.toMatchObject({
      journal: { saved: true, uploaded: true },
      phase: "publication",
      status: "recoverable-error",
    });
    expect(
      harness.queryClient.getQueryData<ListingEditorAccommodation>(
        listingEditorQueryKeys.detail(scope, 31),
      ),
    ).toMatchObject({
      description: "Concurrent remote description",
      name: "Local editor name",
      images: [
        { id: 302, imageUrl: "/two-server.jpg" },
        { id: 401, imageUrl: "/uploaded.jpg" },
      ],
    });
    expect(projectionSpy).toHaveBeenCalledTimes(2);

    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "completed",
    });
    expect(
      harness.queryClient.getQueryData<ListingEditorAccommodation>(
        listingEditorQueryKeys.detail(scope, 31),
      ),
    ).toMatchObject({
      description: "Concurrent remote description",
      name: "Local editor name",
      images: [
        { id: 302, imageUrl: "/two-server.jpg" },
        { id: 401, imageUrl: "/uploaded.jpg" },
      ],
    });
    expect(projectionSpy).toHaveBeenCalledTimes(2);
    expect(harness.api.deleteImage).toHaveBeenCalledTimes(1);
    expect(harness.api.uploadImages).toHaveBeenCalledTimes(1);
    expect(harness.api.update).toHaveBeenCalledTimes(1);
    harness.queryClient.clear();
  });

  it.each([
    [notFoundError(), "invalid-resource"],
    [emptyDataError(), "invalid-resource"],
    [forbiddenError(), "denied"],
  ] as const)(
    "terminates delete reconciliation after %s as %s without repeating DELETE",
    async (reconciliationError, status) => {
      const harness = createHarness();
      await harness.workflow.hydrate();
      harness.api.deleteImage.mockRejectedValueOnce(networkError());
      harness.api.getHostDetail.mockRejectedValueOnce(reconciliationError);

      const command = harness.workflow.deleteImage({
        imageId: 301,
        originalIndex: 0,
      });

      await expect(command).resolves.toMatchObject({ status });
      expect(harness.workflow.getState()).toMatchObject({ status });
      expect(harness.workflow.retry()).toBe(command);
      expect(harness.api.deleteImage).toHaveBeenCalledTimes(1);
      expect(harness.api.getHostDetail).toHaveBeenCalledTimes(2);
      expect(harness.publication.publishEditorChanged).not.toHaveBeenCalled();
    },
  );

  it("terminates a mismatched reconciliation resource without repeating DELETE", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.deleteImage.mockRejectedValueOnce(networkError());
    harness.api.getHostDetail.mockResolvedValueOnce({
      ...accommodation,
      id: 32,
    });

    const command = harness.workflow.deleteImage({
      imageId: 301,
      originalIndex: 0,
    });

    await expect(command).resolves.toMatchObject({
      status: "invalid-resource",
    });
    expect(harness.workflow.retry()).toBe(command);
    expect(harness.api.deleteImage).toHaveBeenCalledTimes(1);
    expect(harness.api.getHostDetail).toHaveBeenCalledTimes(2);
  });

  it("retries unresolved delete reconciliation without repeating DELETE", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.deleteImage.mockRejectedValueOnce(networkError());
    harness.api.getHostDetail
      .mockRejectedValueOnce(networkError("reconciliation failed"))
      .mockResolvedValueOnce({
        ...accommodation,
        images: [{ id: 302, imageUrl: "/two.jpg" }],
      });

    await expect(
      harness.workflow.deleteImage({ imageId: 301, originalIndex: 0 }),
    ).resolves.toMatchObject({
      phase: "reconcile-delete",
      status: "recoverable-error",
    });
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "delete-confirmed",
    });

    expect(harness.api.deleteImage).toHaveBeenCalledTimes(1);
    expect(harness.api.getHostDetail).toHaveBeenCalledTimes(3);
  });

  it("refuses to dismiss unresolved delete reconciliation and retries GET only", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.deleteImage.mockRejectedValueOnce(networkError());
    harness.api.getHostDetail
      .mockRejectedValueOnce(networkError("reconciliation failed"))
      .mockResolvedValueOnce({
        ...accommodation,
        images: [{ id: 302, imageUrl: "/two.jpg" }],
      });

    await harness.workflow.deleteImage({ imageId: 301, originalIndex: 0 });

    expect(harness.workflow.acknowledgeError()).toBe(false);
    expect(harness.workflow.getState()).toMatchObject({
      phase: "reconcile-delete",
      status: "recoverable-error",
    });
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "delete-confirmed",
    });
    expect(harness.api.deleteImage).toHaveBeenCalledTimes(1);
  });

  it("runs upload, update, both publications, publish, and continuation in order", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const file = new File(["image"], "room.png", { type: "image/png" });
    const order: string[] = [];
    harness.api.uploadImages.mockImplementationOnce(async () => {
      order.push("upload");
      return [{ id: 401, imageUrl: "/uploaded.jpg" }];
    });
    harness.api.update.mockImplementationOnce(async () => {
      order.push("update");
    });
    harness.publication.publishEditorChanged.mockImplementation(
      async (input) => {
        order.push(`publication:${input.outcome}`);
      },
    );
    harness.api.publish.mockImplementationOnce(async () => {
      order.push("publish");
    });
    harness.continuation.complete.mockImplementationOnce(async () => {
      order.push("continue");
    });

    const result = await harness.workflow.execute({
      intent: "publish",
      pendingFiles: [file],
      update: { name: "Changed name" },
    });

    expect(order).toEqual([
      "upload",
      "update",
      "publication:saved",
      "publish",
      "publication:published",
      "continue",
    ]);
    expect(result).toMatchObject({
      accommodation: {
        name: "Changed name",
        images: [
          { id: 301, imageUrl: "/one.jpg" },
          { id: 302, imageUrl: "/two.jpg" },
          { id: 401, imageUrl: "/uploaded.jpg" },
        ],
      },
      baselineRevision: 2,
      journal: {
        finalPublication: true,
        published: true,
        savePublication: true,
        saved: true,
        uploaded: true,
      },
      status: "completed",
    });
    expect(harness.query.projectHostDetail).toHaveBeenNthCalledWith(1, {
      fallback: expect.objectContaining({
        images: expect.arrayContaining([
          { id: 401, imageUrl: "/uploaded.jpg" },
        ]),
        name: accommodation.name,
      }),
      accommodationId: 31,
      projection: {
        kind: "append-images",
        images: [{ id: 401, imageUrl: "/uploaded.jpg" }],
      },
      scope,
    });
    expect(harness.query.projectHostDetail).toHaveBeenNthCalledWith(2, {
      fallback: expect.objectContaining({ name: "Changed name" }),
      accommodationId: 31,
      projection: {
        kind: "apply-update",
        update: { name: "Changed name" },
      },
      scope,
    });
  });

  it("locks a partial upload response before update or publish", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const files = [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ];
    harness.api.uploadImages.mockResolvedValueOnce([
      { id: 401, imageUrl: "/uploaded-one.jpg" },
    ]);

    const command = harness.workflow.execute({
      intent: "publish",
      pendingFiles: files,
      update: { name: "Must not save" },
    });

    await expect(command).resolves.toMatchObject({
      error: {
        code: "LISTING_EDITOR_UPLOAD_COUNT_MISMATCH",
        kind: "invalid-response",
      },
      phase: "upload",
      status: "ambiguous",
    });
    expect(harness.workflow.retry()).toBe(command);
    expect(harness.api.uploadImages).toHaveBeenCalledTimes(1);
    expect(harness.api.update).not.toHaveBeenCalled();
    expect(harness.api.publish).not.toHaveBeenCalled();
    expect(harness.publication.publishEditorChanged).not.toHaveBeenCalled();
    expect(harness.continuation.complete).not.toHaveBeenCalled();
  });

  it("returns the exact active Promise so the first intent wins", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const pending = deferred<readonly ListingEditorImage[]>();
    harness.api.uploadImages.mockReturnValueOnce(pending.promise);
    const file = new File(["image"], "room.png", { type: "image/png" });

    const first = harness.workflow.execute({
      intent: "publish",
      pendingFiles: [file],
      update: {},
    });
    const duplicate = harness.workflow.execute({
      intent: "save-exit",
      pendingFiles: [],
      update: { name: "must not win" },
    });
    const deleteIntent = harness.workflow.deleteImage({
      imageId: 301,
      originalIndex: 0,
    });

    expect(duplicate).toBe(first);
    expect(deleteIntent).toBe(first);
    pending.resolve([{ id: 401, imageUrl: "/uploaded.jpg" }]);
    await first;
    expect(harness.api.update).not.toHaveBeenCalled();
    expect(harness.api.publish).toHaveBeenCalledTimes(1);
  });

  it("shares the active Promise with an intent issued synchronously by a state subscriber", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const pending = deferred<void>();
    harness.api.update.mockReturnValueOnce(pending.promise);
    let reentrant: Promise<unknown> | null = null;
    const unsubscribe = harness.workflow.subscribe((state) => {
      if (state.status !== "preparing" || reentrant) return;
      reentrant = harness.workflow.execute({
        intent: "publish",
        pendingFiles: [],
        update: { name: "Must not win" },
      });
    });

    const first = harness.workflow.execute({
      intent: "advance",
      pendingFiles: [],
      update: { name: "First intent" },
    });

    expect(reentrant).toBe(first);
    pending.resolve(undefined);
    await first;
    unsubscribe();
    expect(harness.api.update).toHaveBeenCalledWith(
      31,
      { name: "First intent" },
      expect.any(Object),
    );
    expect(harness.api.publish).not.toHaveBeenCalled();
  });

  it("allows sequential operations after an advance returns the machine to ready", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();

    const advance = harness.workflow.execute({
      intent: "advance",
      pendingFiles: [],
      update: { name: "First step" },
    });
    await expect(advance).resolves.toMatchObject({
      accommodation: { name: "First step" },
      status: "completed",
    });

    const publish = harness.workflow.execute({
      intent: "publish",
      pendingFiles: [],
      update: { description: "Final step" },
    });
    expect(publish).not.toBe(advance);
    await expect(publish).resolves.toMatchObject({
      accommodation: {
        description: "Final step",
        name: "First step",
      },
      baselineRevision: 2,
      status: "completed",
    });
    expect(harness.api.update).toHaveBeenCalledTimes(2);
    expect(harness.api.publish).toHaveBeenCalledTimes(1);
  });

  it("resumes after an upload succeeded without uploading the same files twice", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const file = new File(["image"], "room.png", { type: "image/png" });
    harness.api.uploadImages.mockResolvedValueOnce([
      { id: 401, imageUrl: "/uploaded.jpg" },
    ]);
    harness.api.update
      .mockRejectedValueOnce(validationError())
      .mockResolvedValueOnce(undefined);

    await expect(
      harness.workflow.execute({
        intent: "publish",
        pendingFiles: [file],
        update: { name: "Changed" },
      }),
    ).resolves.toMatchObject({ phase: "save", status: "recoverable-error" });
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "completed",
    });

    expect(harness.api.uploadImages).toHaveBeenCalledTimes(1);
    expect(harness.api.update).toHaveBeenCalledTimes(2);
    expect(harness.api.publish).toHaveBeenCalledTimes(1);
  });

  it("retries image-only publication from the upload journal without uploading again", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const file = new File(["image"], "room.png", { type: "image/png" });
    const onUploadProgress = vi.fn();
    harness.api.uploadImages.mockResolvedValueOnce([
      { id: 401, imageUrl: "/uploaded.jpg" },
    ]);
    harness.publication.publishEditorChanged
      .mockRejectedValueOnce(new Error("saved publication failed"))
      .mockResolvedValueOnce(undefined);

    await expect(
      harness.workflow.execute({
        intent: "advance",
        onUploadProgress,
        pendingFiles: [file],
        update: {},
      }),
    ).resolves.toMatchObject({
      journal: { uploaded: true },
      phase: "publication",
      status: "recoverable-error",
    });
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "completed",
    });

    expect(harness.api.uploadImages).toHaveBeenCalledTimes(1);
    expect(harness.publication.publishEditorChanged).toHaveBeenCalledTimes(2);
    expect(harness.continuation.complete).toHaveBeenCalledTimes(1);
  });

  it("retries Query projection after upload without retaining or resending the File", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const file = new File(["image"], "room.png", { type: "image/png" });
    harness.api.uploadImages.mockResolvedValueOnce([
      { id: 401, imageUrl: "/uploaded.jpg" },
    ]);
    harness.query.projectHostDetail
      .mockImplementationOnce(() => {
        throw new Error("query projection failed");
      })
      .mockImplementationOnce(() => undefined);

    await expect(
      harness.workflow.execute({
        intent: "advance",
        onUploadProgress: vi.fn(),
        pendingFiles: [file],
        update: {},
      }),
    ).resolves.toMatchObject({
      journal: { uploaded: true },
      phase: "publication",
      status: "recoverable-error",
    });
    expect(harness.workflow.acknowledgeError()).toBe(false);
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "completed",
    });

    expect(harness.api.uploadImages).toHaveBeenCalledTimes(1);
    expect(harness.query.projectHostDetail).toHaveBeenCalledTimes(2);
    expect(harness.publication.publishEditorChanged).toHaveBeenCalledTimes(1);
  });

  it("does not repeat save publication when API publish is retried", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.publish
      .mockRejectedValueOnce(validationError())
      .mockResolvedValueOnce(undefined);

    await expect(
      harness.workflow.execute({
        intent: "publish",
        pendingFiles: [],
        update: { name: "Saved once" },
      }),
    ).resolves.toMatchObject({
      journal: { published: false, savePublication: true, saved: true },
      phase: "publish",
      status: "recoverable-error",
    });
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "completed",
    });

    const outcomes = harness.publication.publishEditorChanged.mock.calls.map(
      ([input]) => input.outcome,
    );
    expect(harness.api.update).toHaveBeenCalledTimes(1);
    expect(harness.api.publish).toHaveBeenCalledTimes(2);
    expect(outcomes.filter((outcome) => outcome === "saved")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === "published")).toHaveLength(
      1,
    );
  });

  it("does not repeat API publish when final publication is retried", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.publication.publishEditorChanged
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("final publication failed"))
      .mockResolvedValueOnce(undefined);

    await expect(
      harness.workflow.execute({
        intent: "publish",
        pendingFiles: [],
        update: { name: "Published once" },
      }),
    ).resolves.toMatchObject({
      journal: { finalPublication: false, published: true },
      phase: "publication",
      status: "recoverable-error",
    });
    expect(harness.workflow.acknowledgeError()).toBe(false);
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "completed",
    });

    expect(harness.api.update).toHaveBeenCalledTimes(1);
    expect(harness.api.publish).toHaveBeenCalledTimes(1);
    expect(harness.publication.publishEditorChanged).toHaveBeenCalledTimes(3);
    expect(harness.continuation.complete).toHaveBeenCalledTimes(1);
  });

  it("does not repeat completed mutation/publication phases when continuation is retried", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.continuation.complete
      .mockRejectedValueOnce(new Error("navigation failed"))
      .mockResolvedValueOnce(undefined);

    await expect(
      harness.workflow.execute({
        intent: "publish",
        pendingFiles: [],
        update: { name: "Ready to leave" },
      }),
    ).resolves.toMatchObject({
      journal: {
        finalPublication: true,
        published: true,
        savePublication: true,
        saved: true,
      },
      phase: "continuation",
      status: "recoverable-error",
    });
    expect(harness.workflow.acknowledgeError()).toBe(false);
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "completed",
    });

    expect(harness.api.update).toHaveBeenCalledTimes(1);
    expect(harness.api.publish).toHaveBeenCalledTimes(1);
    expect(harness.publication.publishEditorChanged).toHaveBeenCalledTimes(2);
    expect(harness.continuation.complete).toHaveBeenCalledTimes(2);
  });

  it("reports a safe dismissal when no successful server work must be recovered", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.update.mockRejectedValueOnce(validationError());

    await expect(
      harness.workflow.execute({
        intent: "advance",
        pendingFiles: [],
        update: { name: "Rejected draft" },
      }),
    ).resolves.toMatchObject({
      journal: { saved: false, uploaded: false },
      phase: "save",
      status: "recoverable-error",
    });

    expect(harness.workflow.canAcknowledgeError()).toBe(true);
    expect(harness.workflow.acknowledgeError()).toBe(true);
    expect(harness.workflow.canAcknowledgeError()).toBe(false);
    expect(harness.workflow.getState()).toMatchObject({ status: "ready" });
  });

  it("refuses dismissal while a successful save still needs publication", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.publication.publishEditorChanged.mockRejectedValueOnce(
      new Error("cache publication failed"),
    );

    await expect(
      harness.workflow.execute({
        intent: "advance",
        pendingFiles: [],
        update: { name: "Already saved" },
      }),
    ).resolves.toMatchObject({
      journal: { savePublication: false, saved: true },
      phase: "publication",
      status: "recoverable-error",
    });

    expect(harness.workflow.canAcknowledgeError()).toBe(false);
    expect(harness.workflow.acknowledgeError()).toBe(false);
    expect(harness.workflow.getState()).toMatchObject({
      operation: { journal: { saved: true } },
      phase: "publication",
      status: "recoverable-error",
    });
    await expect(harness.workflow.retry()).resolves.toMatchObject({
      status: "completed",
    });
    expect(harness.api.update).toHaveBeenCalledTimes(1);
  });

  it("locks an ambiguous mutation outcome and returns its terminal Promise forever", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    harness.api.update.mockRejectedValueOnce(networkError());

    const first = harness.workflow.execute({
      intent: "publish",
      pendingFiles: [],
      update: { name: "Possibly saved" },
    });
    await expect(first).resolves.toMatchObject({
      phase: "save",
      status: "ambiguous",
    });

    harness.workflow.acknowledgeError();
    expect(harness.workflow.getState()).toMatchObject({
      retry: "locked",
      status: "recoverable-error",
    });
    expect(harness.workflow.retry()).toBe(first);
    expect(
      harness.workflow.execute({
        intent: "publish",
        pendingFiles: [],
        update: { name: "Do not repeat" },
      }),
    ).toBe(first);
    expect(harness.api.update).toHaveBeenCalledTimes(1);
    expect(harness.api.publish).not.toHaveBeenCalled();
  });

  it("does not continue after the captured session becomes stale", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const pending = deferred<void>();
    harness.api.update.mockReturnValueOnce(pending.promise);

    const command = harness.workflow.execute({
      intent: "publish",
      pendingFiles: [],
      update: { name: "Late save" },
    });
    harness.setSessionCurrent(false);
    pending.resolve(undefined);

    await expect(command).resolves.toEqual({ status: "stale" });
    expect(harness.publication.publishEditorChanged).not.toHaveBeenCalled();
    expect(harness.api.publish).not.toHaveBeenCalled();
    expect(harness.continuation.complete).not.toHaveBeenCalled();
  });

  it("never retries an operation or projects its baseline into a replacement session", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const file = new File(["image"], "room.png", { type: "image/png" });
    harness.api.uploadImages.mockResolvedValueOnce([
      { id: 401, imageUrl: "/uploaded.jpg" },
    ]);
    harness.api.update.mockRejectedValueOnce(validationError());

    await expect(
      harness.workflow.execute({
        intent: "advance",
        pendingFiles: [file],
        update: { name: "Session A draft" },
      }),
    ).resolves.toMatchObject({
      phase: "save",
      status: "recoverable-error",
    });
    harness.setSessionScope(replacementScope);

    await expect(harness.workflow.retry()).resolves.toEqual({
      status: "stale",
    });
    expect(harness.api.update).toHaveBeenCalledTimes(1);
    expect(harness.query.projectHostDetail).toHaveBeenCalledWith(
      expect.objectContaining({ scope }),
    );
    expect(harness.query.projectHostDetail).not.toHaveBeenCalledWith(
      expect.objectContaining({ scope: replacementScope }),
    );
  });

  it("stops after an upload completes under an expired route lease", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const pending = deferred<readonly ListingEditorImage[]>();
    harness.api.uploadImages.mockReturnValueOnce(pending.promise);

    const command = harness.workflow.execute({
      intent: "publish",
      pendingFiles: [new File(["image"], "room.png")],
      update: { name: "Must not save" },
    });
    harness.setRouteCurrent(false);
    pending.resolve([{ id: 401, imageUrl: "/uploaded.jpg" }]);

    await expect(command).resolves.toEqual({ status: "stale" });
    expect(harness.api.update).not.toHaveBeenCalled();
    expect(harness.api.publish).not.toHaveBeenCalled();
    expect(harness.publication.publishEditorChanged).not.toHaveBeenCalled();
    expect(harness.continuation.complete).not.toHaveBeenCalled();
  });

  it("stops after an update completes under an expired route lease", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const pending = deferred<void>();
    harness.api.update.mockReturnValueOnce(pending.promise);

    const command = harness.workflow.execute({
      intent: "publish",
      pendingFiles: [],
      update: { name: "Late save" },
    });
    harness.setRouteCurrent(false);
    pending.resolve(undefined);

    await expect(command).resolves.toEqual({ status: "stale" });
    expect(harness.api.publish).not.toHaveBeenCalled();
    expect(harness.publication.publishEditorChanged).not.toHaveBeenCalled();
    expect(harness.continuation.complete).not.toHaveBeenCalled();
  });

  it("stops after API publish completes under an expired route lease", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const pending = deferred<void>();
    harness.api.publish.mockReturnValueOnce(pending.promise);

    const command = harness.workflow.execute({
      intent: "publish",
      pendingFiles: [],
      update: {},
    });
    harness.setRouteCurrent(false);
    pending.resolve(undefined);

    await expect(command).resolves.toEqual({ status: "stale" });
    expect(harness.publication.publishEditorChanged).not.toHaveBeenCalled();
    expect(harness.continuation.complete).not.toHaveBeenCalled();
  });

  it("stops after delete reconciliation completes under an expired route lease", async () => {
    const harness = createHarness();
    await harness.workflow.hydrate();
    const pending = deferred<ListingEditorAccommodation>();
    harness.api.deleteImage.mockRejectedValueOnce(networkError());
    harness.api.getHostDetail.mockReturnValueOnce(pending.promise);

    const command = harness.workflow.deleteImage({
      imageId: 301,
      originalIndex: 0,
    });
    harness.setRouteCurrent(false);
    pending.resolve({
      ...accommodation,
      images: [{ id: 302, imageUrl: "/two.jpg" }],
    });

    await expect(command).resolves.toEqual({ status: "stale" });
    expect(harness.api.deleteImage).toHaveBeenCalledTimes(1);
    expect(harness.publication.publishEditorChanged).not.toHaveBeenCalled();
  });

  it("aborts the active transport and suppresses its completion when disposed", async () => {
    const harness = createHarness();
    const pending = deferred<typeof accommodation>();
    harness.api.getHostDetail.mockReturnValueOnce(pending.promise);

    const command = harness.workflow.hydrate();
    const signal = harness.api.getHostDetail.mock.calls.at(0)?.[1]?.signal;
    harness.workflow.dispose();

    expect(signal?.aborted).toBe(true);
    pending.resolve(accommodation);
    await expect(command).resolves.toEqual({ status: "stale" });
    expect(harness.workflow.getState().status).toBe("stale");
  });
});
