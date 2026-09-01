import type { Mock } from "vitest";
import { AppError } from "../../../platform/http/errors";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../../test/sessionFixtures";
import type {
  CheckoutOwnership,
  CheckoutOwnershipApiPort,
  PaymentApiPort,
  PaymentRecord,
} from "../../../features/reservations/payment/public";
import {
  createPaymentConfirmationWorkflow,
  type PaymentConfirmationCommand,
} from "./paymentConfirmation";

const scopeA: AuthenticatedSessionScope = {
  subject: "subject:payment_a" as SessionSubject,
  epoch: 4,
  runtimeLeaseId: testSessionRuntimeLeaseId,
};
const scopeB: AuthenticatedSessionScope = {
  subject: "subject:payment_b" as SessionSubject,
  epoch: 5,
  runtimeLeaseId: testSessionRuntimeLeaseId,
};

const command = (): PaymentConfirmationCommand => ({
  amount: 120000,
  orderId: "reservation-123",
  paymentKey: "payment-key-1",
  reservationUid: "reservation-123",
  ownership: {
    operationId: "operation-1",
    accommodationId: 42,
    checkIn: "2026-09-10",
    checkOut: "2026-09-12",
    guestCount: 2,
  },
  routeLease: { isCurrent: () => true },
  markConfirming: vi.fn(() => true),
});

const payment = (overrides: Partial<PaymentRecord> = {}): PaymentRecord => ({
  orderId: "reservation-123",
  paymentKey: "payment-key-1",
  status: "DONE",
  totalAmount: 120000,
  ...overrides,
});

const ownership = (
  overrides: Partial<CheckoutOwnership> = {},
): CheckoutOwnership => ({
  reservationUid: "reservation-123",
  accommodationId: 42,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  guestCount: 2,
  payment: null,
  ...overrides,
});

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const setup = ({
  confirm = vi.fn().mockResolvedValue(undefined),
  getByPaymentKey = vi.fn().mockResolvedValue(payment()),
  getCheckoutOwnership = vi.fn().mockResolvedValue(ownership()),
}: {
  confirm?: Mock;
  getByPaymentKey?: Mock;
  getCheckoutOwnership?: Mock;
} = {}) => {
  let currentScope: AuthenticatedSessionScope | null = scopeA;
  const api: PaymentApiPort = {
    confirm,
    getByOrderId: vi.fn(),
    getByPaymentKey,
  };
  const ownershipApi: CheckoutOwnershipApiPort = {
    getCheckoutOwnership,
  };
  const session = {
    captureAuthenticatedSession: vi.fn(() => currentScope),
    isCurrentSession: vi.fn(
      (scope: AuthenticatedSessionScope) =>
        currentScope?.subject === scope.subject &&
        currentScope.epoch === scope.epoch &&
        currentScope.runtimeLeaseId === scope.runtimeLeaseId,
    ),
  };
  const workflow = createPaymentConfirmationWorkflow({
    api,
    ownershipApi,
    session,
  });

  return {
    api,
    ownershipApi,
    setScope: (scope: AuthenticatedSessionScope | null) => {
      currentScope = scope;
    },
    workflow,
  };
};

describe("payment confirmation workflow", () => {
  it.each([
    { paymentKey: "", label: "missing payment key" },
    { orderId: "other", label: "mismatched order" },
    {
      reservationUid: "../admin",
      orderId: "../admin",
      label: "path-shaped reservation",
    },
    { amount: 0, label: "unsafe amount" },
  ])("rejects $label without server I/O", async (override) => {
    const { api, ownershipApi, workflow } = setup();

    await expect(
      workflow.confirm({ ...command(), ...override }),
    ).resolves.toEqual({ status: "invalid" });
    expect(api.confirm).not.toHaveBeenCalled();
    expect(api.getByPaymentKey).not.toHaveBeenCalled();
    expect(ownershipApi.getCheckoutOwnership).not.toHaveBeenCalled();
  });

  it.each([
    ["reservation", { reservationUid: "reservation-other" }],
    ["accommodation", { accommodationId: 99 }],
    ["check-in", { checkIn: "2026-09-11" }],
    ["check-out", { checkOut: "2026-09-13" }],
    ["guest count", { guestCount: 3 }],
    ["payment order", { payment: payment({ orderId: "reservation-other" }) }],
    ["payment amount", { payment: payment({ totalAmount: 1 }) }],
    ["payment key", { payment: payment({ paymentKey: "payment-key-other" }) }],
  ] satisfies ReadonlyArray<readonly [string, Partial<CheckoutOwnership>]>)(
    "rejects an ownership $label mismatch before payment I/O",
    async (_label, override) => {
      const { api, ownershipApi, workflow } = setup({
        getCheckoutOwnership: vi.fn().mockResolvedValue(ownership(override)),
      });

      await expect(workflow.confirm(command())).resolves.toEqual({
        status: "invalid",
      });
      expect(ownershipApi.getCheckoutOwnership).toHaveBeenCalledTimes(1);
      expect(api.confirm).not.toHaveBeenCalled();
      expect(api.getByPaymentKey).not.toHaveBeenCalled();
    },
  );

  it("retries a transient ownership preflight before the one confirm attempt", async () => {
    const preflightError = new AppError({
      kind: "network",
      code: "NETWORK_ERROR",
      message: "ownership unavailable",
      retryable: true,
    });
    const getCheckoutOwnership = vi
      .fn()
      .mockRejectedValueOnce(preflightError)
      .mockResolvedValueOnce(ownership());
    const { api, workflow } = setup({ getCheckoutOwnership });
    const input = command();

    await expect(workflow.confirm(input)).resolves.toEqual({
      status: "preflight-retryable-error",
      error: preflightError,
    });
    expect(input.markConfirming).not.toHaveBeenCalled();
    expect(api.confirm).not.toHaveBeenCalled();
    expect(api.getByPaymentKey).not.toHaveBeenCalled();

    await expect(workflow.confirm(input)).resolves.toEqual({
      status: "confirmed",
    });
    expect(input.markConfirming).toHaveBeenCalledTimes(1);
    expect(api.confirm).toHaveBeenCalledTimes(1);
  });

  it("persists confirming after ownership and before the confirm POST", async () => {
    const events: string[] = [];
    const confirm = vi.fn().mockImplementation(async () => {
      events.push("confirm");
    });
    const getCheckoutOwnership = vi.fn().mockImplementation(async () => {
      events.push("ownership");
      return ownership();
    });
    const input: PaymentConfirmationCommand = {
      ...command(),
      markConfirming: vi.fn(() => {
        events.push("mark-confirming");
        expect(confirm).not.toHaveBeenCalled();
        return true;
      }),
    };
    const { workflow } = setup({ confirm, getCheckoutOwnership });

    await expect(workflow.confirm(input)).resolves.toEqual({
      status: "confirmed",
    });
    expect(events).toEqual(["ownership", "mark-confirming", "confirm"]);
  });

  it("fails closed before POST when confirming cannot be persisted", async () => {
    const input: PaymentConfirmationCommand = {
      ...command(),
      markConfirming: vi.fn(() => false),
    };
    const { api, workflow } = setup();

    await expect(workflow.confirm(input)).resolves.toEqual({
      status: "invalid",
    });
    expect(input.markConfirming).toHaveBeenCalledTimes(1);
    expect(api.confirm).not.toHaveBeenCalled();
    expect(api.getByPaymentKey).not.toHaveBeenCalled();
  });

  it.each([
    ["confirmed", "DONE", "confirmed"],
    ["terminal", "CANCELED", "terminal-failure"],
  ] as const)(
    "accepts an authoritative %s ownership payment before POST",
    async (_label, status, expectedStatus) => {
      const input = command();
      const { api, workflow } = setup({
        getCheckoutOwnership: vi
          .fn()
          .mockResolvedValue(ownership({ payment: payment({ status }) })),
      });

      await expect(workflow.confirm(input)).resolves.toEqual({
        status: expectedStatus,
      });
      expect(input.markConfirming).not.toHaveBeenCalled();
      expect(api.confirm).not.toHaveBeenCalled();
      expect(api.getByPaymentKey).not.toHaveBeenCalled();
    },
  );

  it("shares one active confirmation Promise and terminal-locks success", async () => {
    const pending = deferred<void>();
    const confirm = vi.fn().mockReturnValue(pending.promise);
    const { api, workflow } = setup({ confirm });

    const first = workflow.confirm(command());
    const duplicate = workflow.confirm(command());
    expect(duplicate).toBe(first);
    await flushMicrotasks();
    expect(api.confirm).toHaveBeenCalledTimes(1);

    pending.resolve();
    await expect(first).resolves.toEqual({ status: "confirmed" });
    await expect(workflow.confirm(command())).resolves.toEqual({
      status: "locked",
      terminal: "confirmed",
    });
  });

  it("does not share an active result with a different payment tuple", async () => {
    const pending = deferred<void>();
    const { api, workflow } = setup({
      confirm: vi.fn().mockReturnValue(pending.promise),
    });

    const first = workflow.confirm(command());
    await flushMicrotasks();
    await expect(
      workflow.confirm({ ...command(), paymentKey: "payment-key-2" }),
    ).resolves.toEqual({ status: "invalid" });
    expect(api.confirm).toHaveBeenCalledTimes(1);

    pending.resolve();
    await expect(first).resolves.toEqual({ status: "confirmed" });
  });

  it("reconciles a retryable confirmation failure with server DONE", async () => {
    const confirmError = new AppError({
      kind: "network",
      code: "NETWORK_ERROR",
      message: "network failed",
      retryable: true,
    });
    const { api, workflow } = setup({
      confirm: vi.fn().mockRejectedValue(confirmError),
    });

    await expect(workflow.confirm(command())).resolves.toEqual({
      status: "confirmed",
    });
    expect(api.confirm).toHaveBeenCalledTimes(1);
    expect(api.getByPaymentKey).toHaveBeenCalledTimes(1);
  });

  it("keeps an in-progress server payment recoverable", async () => {
    const confirmError = new AppError({
      kind: "server",
      code: "SERVER_ERROR",
      message: "server failed",
      retryable: true,
    });
    const getByPaymentKey = vi
      .fn()
      .mockResolvedValueOnce(payment({ status: "IN_PROGRESS" }))
      .mockResolvedValueOnce(payment({ status: "DONE" }));
    const { workflow } = setup({
      confirm: vi.fn().mockRejectedValue(confirmError),
      getByPaymentKey,
    });

    await expect(workflow.confirm(command())).resolves.toEqual({
      status: "pending",
    });
    await expect(workflow.reconcile(command())).resolves.toEqual({
      status: "confirmed",
    });
  });

  it("never sends a second confirm after an ambiguous first attempt", async () => {
    const confirmError = new AppError({
      kind: "network",
      code: "NETWORK_ERROR",
      message: "network failed",
      retryable: true,
    });
    const lookupError = new AppError({
      kind: "timeout",
      code: "REQUEST_TIMEOUT",
      message: "timed out",
      retryable: true,
    });
    const { api, workflow } = setup({
      confirm: vi.fn().mockRejectedValue(confirmError),
      getByPaymentKey: vi
        .fn()
        .mockRejectedValueOnce(lookupError)
        .mockResolvedValueOnce(payment({ status: "DONE" })),
    });

    const input = command();

    await expect(workflow.confirm(input)).resolves.toEqual({
      status: "retryable-error",
      error: lookupError,
    });
    await expect(workflow.confirm(input)).resolves.toEqual({
      status: "confirmed",
    });
    expect(input.markConfirming).toHaveBeenCalledTimes(1);
    expect(api.confirm).toHaveBeenCalledTimes(1);
    expect(api.getByPaymentKey).toHaveBeenCalledTimes(2);
  });

  it("reconciles a conflict instead of reporting a charged payment as failed", async () => {
    const conflict = new AppError({
      kind: "conflict",
      code: "PAYMENT_ALREADY_PROCESSED",
      message: "already processed",
      status: 409,
    });
    const { api, workflow } = setup({
      confirm: vi.fn().mockRejectedValue(conflict),
    });

    await expect(workflow.confirm(command())).resolves.toEqual({
      status: "confirmed",
    });
    expect(api.getByPaymentKey).toHaveBeenCalledTimes(1);
  });

  it("server-reconciles the losing tab when two workflow instances confirm together", async () => {
    const firstConfirmation = deferred<void>();
    const conflict = new AppError({
      kind: "conflict",
      code: "PAYMENT_ALREADY_PROCESSED",
      message: "already processed",
      status: 409,
    });
    const confirm = vi
      .fn()
      .mockReturnValueOnce(firstConfirmation.promise)
      .mockRejectedValueOnce(conflict);
    const getByPaymentKey = vi.fn().mockResolvedValue(payment());
    const firstTab = setup({ confirm, getByPaymentKey });
    const secondTab = setup({ confirm, getByPaymentKey });

    const firstResult = firstTab.workflow.confirm(command());
    const secondResult = secondTab.workflow.confirm(command());
    await flushMicrotasks();
    expect(confirm).toHaveBeenCalledTimes(2);

    await expect(secondResult).resolves.toEqual({ status: "confirmed" });
    expect(getByPaymentKey).toHaveBeenCalledTimes(1);
    firstConfirmation.resolve();
    await expect(firstResult).resolves.toEqual({ status: "confirmed" });
  });

  it("does not reconcile an authoritative terminal confirm rejection", async () => {
    const error = new AppError({
      kind: "validation",
      code: "P001",
      message: "invalid payment",
      status: 400,
    });
    const { api, workflow } = setup({
      confirm: vi.fn().mockRejectedValue(error),
    });

    await expect(workflow.confirm(command())).resolves.toEqual({
      error,
      status: "terminal-failure",
    });
    expect(api.getByPaymentKey).not.toHaveBeenCalled();
  });

  it.each([
    { label: "amount", override: { totalAmount: 1 } },
    { label: "order", override: { orderId: "another-order" } },
    { label: "payment key", override: { paymentKey: "another-key" } },
    { label: "missing payment key", override: { paymentKey: null } },
  ])(
    "rejects a reconciled payment whose server $label differs",
    async ({ override }) => {
      const { workflow } = setup({
        getByPaymentKey: vi.fn().mockResolvedValue(payment(override)),
      });

      await expect(workflow.reconcile(command())).resolves.toEqual({
        status: "invalid",
      });
    },
  );

  it.each(["CANCELED", "PARTIAL_CANCELED", "ABORTED", "EXPIRED"] as const)(
    "maps server %s to terminal failure",
    async (status) => {
      const { workflow } = setup({
        getByPaymentKey: vi.fn().mockResolvedValue(payment({ status })),
      });

      await expect(workflow.reconcile(command())).resolves.toEqual({
        status: "terminal-failure",
      });
    },
  );

  it("keeps retryable status lookup failures recoverable", async () => {
    const error = new AppError({
      kind: "timeout",
      code: "REQUEST_TIMEOUT",
      message: "timed out",
      retryable: true,
    });
    const { workflow } = setup({
      getByPaymentKey: vi.fn().mockRejectedValue(error),
    });

    await expect(workflow.reconcile(command())).resolves.toEqual({
      error,
      status: "retryable-error",
    });
  });

  it("terminal-locks a malformed server payment response", async () => {
    const contractError = new TypeError("invalid payment wire");
    const { workflow } = setup({
      getByPaymentKey: vi.fn().mockRejectedValue(contractError),
    });

    await expect(workflow.reconcile(command())).resolves.toEqual({
      status: "terminal-failure",
      error: contractError,
    });
  });

  it("fences a late result after the authenticated session changes", async () => {
    const pending = deferred<PaymentRecord>();
    const { setScope, workflow } = setup({
      getByPaymentKey: vi.fn().mockReturnValue(pending.promise),
    });
    const result = workflow.reconcile(command());
    await flushMicrotasks();

    setScope(scopeB);
    pending.resolve(payment());
    await expect(result).resolves.toEqual({ status: "stale" });
  });

  it("aborts and stale-locks an active operation on disposal", async () => {
    let signal: AbortSignal | undefined;
    const pending = deferred<PaymentRecord>();
    const getByPaymentKey = vi.fn(
      (_key, options: { readonly signal?: AbortSignal }) => {
        signal = options.signal;
        return pending.promise;
      },
    );
    const { workflow } = setup({ getByPaymentKey });
    const result = workflow.reconcile(command());
    await flushMicrotasks();

    workflow.dispose();
    expect(signal?.aborted).toBe(true);
    pending.resolve(payment());
    await expect(result).resolves.toEqual({ status: "stale" });
  });
});
