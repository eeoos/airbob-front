import {
  createInitialPaymentMachineState,
  paymentMachineReducer,
} from "./paymentMachine";

type PaymentMachineState = ReturnType<typeof paymentMachineReducer>;

describe("payment confirmation machine", () => {
  it("starts one confirmation operation and ignores competing starts", () => {
    const confirming = paymentMachineReducer(
      createInitialPaymentMachineState(),
      { type: "CONFIRM_STARTED", operationId: 1 },
    );

    expect(confirming).toEqual({ status: "confirming", operationId: 1 });
    expect(
      paymentMachineReducer(confirming, {
        type: "RECONCILIATION_STARTED",
        operationId: 2,
      }),
    ).toBe(confirming);
  });

  it("ignores stale completion events from an older operation", () => {
    const reconciling: PaymentMachineState = {
      status: "reconciling",
      operationId: 4,
    };

    expect(
      paymentMachineReducer(reconciling, {
        type: "PAYMENT_CONFIRMED",
        operationId: 3,
      }),
    ).toBe(reconciling);
  });

  it.each([
    ["PAYMENT_CONFIRMED", "confirmed"],
    ["PAYMENT_INVALID", "invalid"],
    ["PAYMENT_TERMINAL_FAILURE", "terminal-failure"],
    ["PAYMENT_STALE", "stale"],
  ] as const)("maps %s to the %s terminal", (type, status) => {
    const processing: PaymentMachineState = {
      status: "confirming",
      operationId: 8,
    };

    expect(paymentMachineReducer(processing, { type, operationId: 8 })).toEqual(
      { status },
    );
  });

  it.each(["pending", "retryable-error"] as const)(
    "keeps %s recoverable and permits an explicit reconciliation",
    (outcome) => {
      const processing: PaymentMachineState = {
        status: "confirming",
        operationId: 2,
      };
      const recoverable = paymentMachineReducer(processing, {
        type:
          outcome === "pending"
            ? "PAYMENT_PENDING"
            : "PAYMENT_RETRYABLE_FAILURE",
        operationId: 2,
      });

      expect(recoverable).toEqual({ status: outcome });
      expect(
        paymentMachineReducer(recoverable, {
          type: "RECONCILIATION_STARTED",
          operationId: 3,
        }),
      ).toEqual({ status: "reconciling", operationId: 3 });
      expect(
        paymentMachineReducer(recoverable, {
          type: "CONFIRM_STARTED",
          operationId: 4,
        }),
      ).toBe(recoverable);
    },
  );

  it.each(["confirmed", "invalid", "terminal-failure", "stale"] as const)(
    "does not leave the %s terminal",
    (status) => {
      const terminal: PaymentMachineState = { status };

      expect(
        paymentMachineReducer(terminal, {
          type: "CONFIRM_STARTED",
          operationId: 9,
        }),
      ).toBe(terminal);
    },
  );
});
