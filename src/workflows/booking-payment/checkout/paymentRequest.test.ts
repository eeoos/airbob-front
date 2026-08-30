import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import {
  PaymentGatewayError,
  type PaymentGatewayPort,
} from "./paymentGateway";
import {
  createPaymentRequestWorkflow,
  type PaymentRequestCommand,
} from "./paymentRequest";

const scopeA: AuthenticatedSessionScope = {
  epoch: 3,
  subject: "subject:checkout_a" as SessionSubject,
};
const scopeB: AuthenticatedSessionScope = {
  epoch: 4,
  subject: "subject:checkout_b" as SessionSubject,
};

const command = (): PaymentRequestCommand => ({
  amount: 120_000,
  customerEmail: "guest@example.com",
  customerName: "게스트",
  failUrl: "https://airbob.test/reservations/r-1/fail",
  orderId: "r-1",
  orderName: "테스트 숙소 예약",
  reservationUid: "r-1",
  routeLease: { isCurrent: () => true },
  successUrl: "https://airbob.test/reservations/r-1/success",
});

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const setup = (gatewayOverrides: Partial<PaymentGatewayPort> = {}) => {
  let currentScope: AuthenticatedSessionScope | null = scopeA;
  const gateway: PaymentGatewayPort = {
    prepare: jest.fn().mockResolvedValue(undefined),
    requestPayment: jest.fn().mockResolvedValue(undefined),
    ...gatewayOverrides,
  };
  const session = {
    captureAuthenticatedSession: jest.fn(() => currentScope),
    isCurrentSession: jest.fn(
      (scope: AuthenticatedSessionScope) =>
        currentScope?.subject === scope.subject &&
        currentScope.epoch === scope.epoch,
    ),
  };
  const workflow = createPaymentRequestWorkflow({ gateway, session });

  return {
    gateway,
    setScope(scope: AuthenticatedSessionScope | null) {
      currentScope = scope;
    },
    workflow,
  };
};

describe("payment request workflow", () => {
  it("prepares the gateway behind route and session fences", async () => {
    const { gateway, workflow } = setup();

    await expect(
      workflow.prepare({ routeLease: command().routeLease }),
    ).resolves.toEqual({ status: "ready" });
    expect(gateway.prepare).toHaveBeenCalledTimes(1);
  });

  it.each([
    { amount: 0, label: "amount" },
    { orderId: "another-order", label: "order" },
    { customerEmail: "", label: "email" },
    { successUrl: "ftp://airbob.test/callback", label: "success URL" },
  ])("rejects an invalid $label before gateway I/O", async (override) => {
    const { gateway, workflow } = setup();

    await expect(
      workflow.request({ ...command(), ...override }),
    ).resolves.toEqual({ status: "invalid" });
    expect(gateway.requestPayment).not.toHaveBeenCalled();
  });

  it("shares one active request Promise and terminal-locks an accepted request", async () => {
    const pending = deferred<void>();
    const requestPayment = jest.fn().mockReturnValue(pending.promise);
    const { workflow } = setup({ requestPayment });

    const first = workflow.request(command());
    const duplicate = workflow.request(command());
    expect(duplicate).toBe(first);
    await Promise.resolve();
    expect(requestPayment).toHaveBeenCalledTimes(1);

    pending.resolve();
    await expect(first).resolves.toEqual({ status: "requested" });
    await expect(workflow.request(command())).resolves.toEqual({
      status: "locked",
      terminal: "requested",
    });
  });

  it.each(["cancelled", "recoverable"] as const)(
    "keeps %s gateway failures retryable",
    async (kind) => {
      const error = new PaymentGatewayError({
        kind,
        message: "safe",
        silent: kind === "cancelled",
      });
      const { workflow } = setup({
        requestPayment: jest
          .fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(undefined),
      });

      await expect(workflow.request(command())).resolves.toEqual({
        status: kind === "cancelled" ? "cancelled" : "retryable-error",
        error,
      });
      await expect(workflow.request(command())).resolves.toEqual({
        status: "requested",
      });
    },
  );

  it("terminal-locks a definitive gateway failure", async () => {
    const error = new PaymentGatewayError({
      kind: "terminal",
      message: "safe",
    });
    const { workflow } = setup({
      requestPayment: jest.fn().mockRejectedValue(error),
    });

    await expect(workflow.request(command())).resolves.toEqual({
      status: "terminal-failure",
      error,
    });
    await expect(workflow.request(command())).resolves.toEqual({
      status: "locked",
      terminal: "terminal-failure",
    });
  });

  it("ignores a late gateway result after the session changes", async () => {
    const pending = deferred<void>();
    const { setScope, workflow } = setup({
      requestPayment: jest.fn().mockReturnValue(pending.promise),
    });
    const result = workflow.request(command());
    await Promise.resolve();

    setScope(scopeB);
    pending.resolve();
    await expect(result).resolves.toEqual({ status: "stale" });
  });

  it("disposes without allowing a late result to publish", async () => {
    const pending = deferred<void>();
    const { workflow } = setup({
      requestPayment: jest.fn().mockReturnValue(pending.promise),
    });
    const result = workflow.request(command());
    await Promise.resolve();

    workflow.dispose();
    workflow.dispose();
    pending.resolve();
    await expect(result).resolves.toEqual({ status: "stale" });
  });
});
