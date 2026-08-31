type PaymentMachineTerminalStatus =
  "confirmed" | "invalid" | "terminal-failure" | "stale";

type PaymentMachineState =
  | { readonly status: "idle" }
  | { readonly status: "confirming"; readonly operationId: number }
  | { readonly status: "reconciling"; readonly operationId: number }
  | { readonly status: "pending" }
  | { readonly status: "retryable-error" }
  | { readonly status: PaymentMachineTerminalStatus };

type PaymentMachineEvent =
  | { readonly type: "CONFIRM_STARTED"; readonly operationId: number }
  | {
      readonly type: "RECONCILIATION_STARTED";
      readonly operationId: number;
    }
  | { readonly type: "PAYMENT_CONFIRMED"; readonly operationId: number }
  | { readonly type: "PAYMENT_PENDING"; readonly operationId: number }
  | {
      readonly type: "PAYMENT_RETRYABLE_FAILURE";
      readonly operationId: number;
    }
  | { readonly type: "PAYMENT_INVALID"; readonly operationId: number }
  | {
      readonly type: "PAYMENT_TERMINAL_FAILURE";
      readonly operationId: number;
    }
  | { readonly type: "PAYMENT_STALE"; readonly operationId: number };

export const createInitialPaymentMachineState = (): PaymentMachineState => ({
  status: "idle",
});

const isProcessing = (
  state: PaymentMachineState,
): state is Extract<
  PaymentMachineState,
  { readonly status: "confirming" | "reconciling" }
> => state.status === "confirming" || state.status === "reconciling";

const isTerminal = (
  state: PaymentMachineState,
): state is Extract<
  PaymentMachineState,
  { readonly status: PaymentMachineTerminalStatus }
> =>
  state.status === "confirmed" ||
  state.status === "invalid" ||
  state.status === "terminal-failure" ||
  state.status === "stale";

export const paymentMachineReducer = (
  state: PaymentMachineState,
  event: PaymentMachineEvent,
): PaymentMachineState => {
  if (
    event.type === "CONFIRM_STARTED" ||
    event.type === "RECONCILIATION_STARTED"
  ) {
    if (isProcessing(state) || isTerminal(state)) return state;

    if (event.type === "CONFIRM_STARTED" && state.status !== "idle") {
      return state;
    }

    return {
      status: event.type === "CONFIRM_STARTED" ? "confirming" : "reconciling",
      operationId: event.operationId,
    };
  }

  if (!isProcessing(state) || state.operationId !== event.operationId) {
    return state;
  }

  switch (event.type) {
    case "PAYMENT_CONFIRMED":
      return { status: "confirmed" };
    case "PAYMENT_PENDING":
      return { status: "pending" };
    case "PAYMENT_RETRYABLE_FAILURE":
      return { status: "retryable-error" };
    case "PAYMENT_INVALID":
      return { status: "invalid" };
    case "PAYMENT_TERMINAL_FAILURE":
      return { status: "terminal-failure" };
    case "PAYMENT_STALE":
      return { status: "stale" };
  }
};
