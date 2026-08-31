import type { Mocked } from "vitest";
import type { HostListingActionsApiPort } from "../../features/accommodations/ports/hostListingActionsApiPort";
import { AppError } from "../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import {
  createHostListingManagementWorkflow,
  type HostListingManagementPublicationPort,
} from "./hostListingManagement";

const scope: AuthenticatedSessionScope = {
  subject: "subject:member_7" as AuthenticatedSessionScope["subject"],
  epoch: 4,
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createHarness = () => {
  const api: Mocked<HostListingActionsApiPort> = {
    delete: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    unpublish: vi.fn().mockResolvedValue(undefined),
  };
  const publication: Mocked<HostListingManagementPublicationPort> = {
    publishHostListingChanged: vi.fn().mockResolvedValue(undefined),
  };
  let routeCurrent = true;
  let sessionCurrent = true;
  let capturedScope: AuthenticatedSessionScope | null = scope;
  const workflow = createHostListingManagementWorkflow({
    api,
    publication,
    routeLease: { isCurrent: () => routeCurrent },
    session: {
      captureAuthenticatedSession: () => capturedScope,
      isCurrentSession: (candidate) =>
        sessionCurrent &&
        candidate.subject === scope.subject &&
        candidate.epoch === scope.epoch,
    },
  });

  return {
    api,
    publication,
    workflow,
    setCapturedScope: (value: AuthenticatedSessionScope | null) => {
      capturedScope = value;
    },
    setRouteCurrent: (value: boolean) => {
      routeCurrent = value;
    },
    setSessionCurrent: (value: boolean) => {
      sessionCurrent = value;
    },
  };
};

describe("host listing management workflow", () => {
  it("runs one typed action and publishes the captured session result", async () => {
    const harness = createHarness();

    await expect(
      harness.workflow.execute({ action: "unpublish", accommodationId: 31 }),
    ).resolves.toEqual({
      action: "unpublish",
      accommodationId: 31,
      status: "applied",
      publication: { status: "succeeded" },
    });

    expect(harness.api.unpublish).toHaveBeenCalledWith(31, {
      signal: expect.any(AbortSignal),
    });
    expect(harness.publication.publishHostListingChanged).toHaveBeenCalledWith({
      action: "unpublish",
      accommodationId: 31,
      scope,
    });
  });

  it("returns the exact active Promise so a different concurrent intent cannot overtake the first", async () => {
    const harness = createHarness();
    const pending = deferred<void>();
    harness.api.publish.mockReturnValueOnce(pending.promise);

    const first = harness.workflow.execute({
      action: "publish",
      accommodationId: 31,
    });
    const duplicate = harness.workflow.execute({
      action: "publish",
      accommodationId: 31,
    });
    const competing = harness.workflow.execute({
      action: "delete",
      accommodationId: 42,
    });

    expect(duplicate).toBe(first);
    expect(competing).toBe(first);
    expect(harness.api.publish).toHaveBeenCalledTimes(1);
    expect(harness.api.delete).not.toHaveBeenCalled();

    pending.resolve(undefined);
    await expect(first).resolves.toMatchObject({
      action: "publish",
      accommodationId: 31,
      status: "applied",
    });
    expect(harness.publication.publishHostListingChanged).toHaveBeenCalledTimes(
      1,
    );
  });

  it("does not publish or grant UI authority after disposal during an active request", async () => {
    const harness = createHarness();
    const pending = deferred<void>();
    harness.api.delete.mockReturnValueOnce(pending.promise);
    const command = harness.workflow.execute({
      action: "delete",
      accommodationId: 31,
    });
    const signal = harness.api.delete.mock.calls.at(0)?.[1]?.signal;

    harness.workflow.dispose();
    expect(signal?.aborted).toBe(true);
    pending.resolve(undefined);

    await expect(command).resolves.toEqual({
      action: "delete",
      accommodationId: 31,
      status: "applied-stale",
      publication: { status: "skipped" },
    });
    expect(
      harness.publication.publishHostListingChanged,
    ).not.toHaveBeenCalled();
    expect(
      harness.workflow.execute({ action: "publish", accommodationId: 42 }),
    ).toBe(command);
  });

  it("keeps disposal as a global terminal when no command is active", async () => {
    const harness = createHarness();

    harness.workflow.dispose();

    const first = harness.workflow.execute({
      action: "delete",
      accommodationId: 31,
    });
    const different = harness.workflow.execute({
      action: "publish",
      accommodationId: 42,
    });

    expect(different).toBe(first);
    await expect(first).resolves.toEqual({ status: "stale" });
    expect(harness.api.delete).not.toHaveBeenCalled();
    expect(harness.api.publish).not.toHaveBeenCalled();
  });

  it("checks the captured session again before cache publication", async () => {
    const harness = createHarness();
    const pending = deferred<void>();
    harness.api.publish.mockReturnValueOnce(pending.promise);
    const command = harness.workflow.execute({
      action: "publish",
      accommodationId: 31,
    });

    harness.setSessionCurrent(false);
    pending.resolve(undefined);

    await expect(command).resolves.toMatchObject({
      status: "applied-stale",
      publication: { status: "skipped" },
    });
    expect(
      harness.publication.publishHostListingChanged,
    ).not.toHaveBeenCalled();

    harness.setSessionCurrent(true);
    expect(
      harness.workflow.execute({ action: "publish", accommodationId: 31 }),
    ).toBe(command);

    const different = harness.workflow.execute({
      action: "unpublish",
      accommodationId: 42,
    });
    expect(different).not.toBe(command);
    await expect(different).resolves.toMatchObject({
      action: "unpublish",
      accommodationId: 42,
      status: "applied",
    });
    expect(harness.api.unpublish).toHaveBeenCalledTimes(1);
  });

  it("retains API success and its terminal Promise when cache publication fails", async () => {
    const harness = createHarness();
    harness.publication.publishHostListingChanged.mockRejectedValueOnce(
      new Error("cache unavailable"),
    );
    const command = harness.workflow.execute({
      action: "publish",
      accommodationId: 31,
    });

    await expect(command).resolves.toMatchObject({
      action: "publish",
      accommodationId: 31,
      status: "applied",
      publication: {
        status: "failed",
        error: { code: "UNKNOWN_ERROR", kind: "unknown" },
      },
    });

    const repeated = harness.workflow.execute({
      action: "publish",
      accommodationId: 31,
    });
    expect(repeated).toBe(command);
    await repeated;

    const differentListing = harness.workflow.execute({
      action: "publish",
      accommodationId: 32,
    });
    expect(differentListing).not.toBe(command);
    await expect(differentListing).resolves.toMatchObject({
      action: "publish",
      accommodationId: 32,
      status: "applied",
      publication: { status: "succeeded" },
    });
    expect(harness.api.publish).toHaveBeenCalledTimes(2);
  });

  it("returns normalized definitive and ambiguous mutation failures", async () => {
    const definitiveHarness = createHarness();
    definitiveHarness.api.publish.mockRejectedValueOnce(
      new AppError({
        kind: "validation",
        code: "A003",
        message: "Missing required listing fields.",
        status: 422,
      }),
    );
    await expect(
      definitiveHarness.workflow.execute({
        action: "publish",
        accommodationId: 31,
      }),
    ).resolves.toMatchObject({
      status: "definitive-failure",
      error: { code: "A003", kind: "validation", status: 422 },
    });

    const ambiguousHarness = createHarness();
    ambiguousHarness.api.delete.mockRejectedValueOnce(
      new AppError({
        kind: "network",
        code: "NETWORK_ERROR",
        message: "The result is unknown.",
        retryable: true,
      }),
    );
    const ambiguous = ambiguousHarness.workflow.execute({
      action: "delete",
      accommodationId: 31,
    });
    await expect(ambiguous).resolves.toMatchObject({
      status: "ambiguous",
      error: { code: "NETWORK_ERROR", kind: "network" },
    });
    expect(
      ambiguousHarness.workflow.execute({
        action: "delete",
        accommodationId: 31,
      }),
    ).toBe(ambiguous);
    expect(ambiguousHarness.api.delete).toHaveBeenCalledTimes(1);

    const differentAction = ambiguousHarness.workflow.execute({
      action: "publish",
      accommodationId: 31,
    });
    expect(differentAction).not.toBe(ambiguous);
    await expect(differentAction).resolves.toMatchObject({
      action: "publish",
      accommodationId: 31,
      status: "applied",
    });
    expect(ambiguousHarness.api.publish).toHaveBeenCalledTimes(1);
  });

  it("aborts and releases a command that exceeds the route deadline", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.api.publish.mockImplementationOnce(
      () => new Promise<void>(() => undefined),
    );

    try {
      const command = harness.workflow.execute({
        action: "publish",
        accommodationId: 31,
      });
      const signal = harness.api.publish.mock.calls.at(0)?.[1]?.signal;

      vi.advanceTimersByTime(15_000);

      await expect(command).resolves.toMatchObject({
        status: "ambiguous",
        error: {
          code: "HOST_LISTING_COMMAND_TIMEOUT",
          kind: "timeout",
          retryable: true,
        },
      });
      expect(signal?.aborted).toBe(true);

      await expect(
        harness.workflow.execute({
          action: "unpublish",
          accommodationId: 32,
        }),
      ).resolves.toMatchObject({
        action: "unpublish",
        accommodationId: 32,
        status: "applied",
      });
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it("rejects invalid IDs and missing authenticated sessions before transport", async () => {
    const harness = createHarness();

    await expect(
      harness.workflow.execute({ action: "delete", accommodationId: 0 }),
    ).resolves.toMatchObject({
      status: "invalid",
      error: { code: "INVALID_HOST_LISTING_COMMAND" },
    });
    harness.setCapturedScope(null);
    await expect(
      harness.workflow.execute({ action: "publish", accommodationId: 31 }),
    ).resolves.toMatchObject({
      status: "definitive-failure",
      error: { code: "AUTHENTICATED_SESSION_REQUIRED" },
    });
    expect(harness.api.delete).not.toHaveBeenCalled();
    expect(harness.api.publish).not.toHaveBeenCalled();
  });

  it("does not start transport when the route lease is already stale", async () => {
    const harness = createHarness();
    harness.setRouteCurrent(false);

    await expect(
      harness.workflow.execute({ action: "publish", accommodationId: 31 }),
    ).resolves.toEqual({ status: "stale" });
    expect(harness.api.publish).not.toHaveBeenCalled();
    expect(
      harness.publication.publishHostListingChanged,
    ).not.toHaveBeenCalled();
  });
});
