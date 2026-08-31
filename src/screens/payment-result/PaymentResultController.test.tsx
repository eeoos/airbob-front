import type { Mock } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type {
  CheckoutOwnership,
  CheckoutOwnershipApiPort,
  PaymentApiPort,
  PaymentRecord,
} from "../../features/reservations/payment/public";
import { AppError } from "../../platform/http/errors";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import { renderApp } from "../../test/renderApp";
import type {
  CallbackData,
  CheckoutData,
} from "../../workflows/booking-payment/checkout";
import { PaymentResultController } from "./PaymentResultController";
import {
  type PaymentCallbackDocument,
  toPaymentCallbackDocument,
} from "../../workflows/booking-payment/confirmation";

const scope: AuthenticatedSessionScope = {
  epoch: 7,
  subject: "subject:payment_result" as SessionSubject,
};

const checkout = (): CheckoutData => ({
  operationId: "operation-1" as CheckoutData["operationId"],
  accommodationId: 42,
  reservationUid: "reservation-1",
  orderName: "테스트 숙소 예약",
  amount: 120_000,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultOccupancy: 2,
  childOccupancy: 0,
  infantOccupancy: 0,
  petOccupancy: 0,
  couponName: null,
  couponDiscount: null,
});

const documentFromCheckout = (
  checkoutData: CheckoutData = checkout(),
): PaymentCallbackDocument => toPaymentCallbackDocument(checkoutData);

const callback = (): CallbackData => ({
  operationId: checkout().operationId,
  reservationUid: "reservation-1",
  orderId: "reservation-1",
  paymentKey: "payment-key-1",
  amount: 120_000,
  phase: "received",
});

const payment = (
  overrides: Partial<PaymentRecord> = {},
): PaymentRecord => ({
  orderId: "reservation-1",
  paymentKey: "payment-key-1",
  totalAmount: 120_000,
  status: "DONE",
  ...overrides,
});

const ownership = (
  overrides: Partial<CheckoutOwnership> = {},
): CheckoutOwnership => ({
  reservationUid: "reservation-1",
  accommodationId: 42,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  guestCount: 2,
  payment: null,
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const setup = ({
  mode = "success",
  shouldConfirm = true,
  documentData = documentFromCheckout(),
  callbackData = callback(),
  confirm = vi.fn().mockResolvedValue(undefined),
  getByPaymentKey = vi.fn().mockResolvedValue(payment()),
  getCheckoutOwnership = vi.fn().mockResolvedValue(ownership()),
}: {
  mode?: "success" | "failure";
  shouldConfirm?: boolean;
  documentData?: PaymentCallbackDocument | null;
  callbackData?: CallbackData | null;
  confirm?: Mock;
  getByPaymentKey?: Mock;
  getCheckoutOwnership?: Mock;
} = {}) => {
  const paymentApi: PaymentApiPort = {
    confirm,
    getByOrderId: vi.fn(),
    getByPaymentKey,
  };
  const ownershipApi: CheckoutOwnershipApiPort = {
    getCheckoutOwnership,
  };
  const callbacks = {
    onCallbackPhaseChange: vi.fn().mockReturnValue(true),
    onConfirmed: vi.fn(),
    onInvalid: vi.fn(),
    onOpenProfile: vi.fn(),
    onOpenReservation: vi.fn(),
    onRecoverable: vi.fn(),
    onTerminalFailure: vi.fn(),
  };
  const routeLease = { isCurrent: () => true };
  const sessionMethods = {
    captureAuthenticatedSession: () => scope,
    isCurrentSession: (candidate: AuthenticatedSessionScope) =>
      candidate.subject === scope.subject && candidate.epoch === scope.epoch,
  };
  const controller = (
    session: typeof sessionMethods = sessionMethods,
  ) => (
    <PaymentResultController
      callback={callbackData}
      document={documentData}
      mode={mode}
      shouldConfirm={shouldConfirm}
      routeLease={routeLease}
      session={session}
      paymentApi={paymentApi}
      ownershipApi={ownershipApi}
      {...callbacks}
    />
  );

  const view = renderApp(controller());

  return {
    callbacks,
    ownershipApi,
    paymentApi,
    rerenderWithFreshSessionFacade: () =>
      view.rerender(controller({ ...sessionMethods })),
  };
};

describe("PaymentResultController", () => {
  it("confirms a fresh, joined callback and publishes success once", async () => {
    const { callbacks, ownershipApi, paymentApi } = setup();

    await waitFor(() => expect(callbacks.onConfirmed).toHaveBeenCalledTimes(1));
    expect(callbacks.onCallbackPhaseChange).toHaveBeenCalledWith("confirming");
    expect(ownershipApi.getCheckoutOwnership).toHaveBeenCalledTimes(1);
    expect(paymentApi.confirm).toHaveBeenCalledWith(
      {
        amount: 120_000,
        orderId: "reservation-1",
        paymentKey: "payment-key-1",
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("reconciles a replay without sending another confirm", async () => {
    const { callbacks, ownershipApi, paymentApi } = setup({
      shouldConfirm: false,
    });

    await waitFor(() => expect(callbacks.onConfirmed).toHaveBeenCalledTimes(1));
    expect(callbacks.onCallbackPhaseChange).toHaveBeenCalledWith("reconciling");
    expect(ownershipApi.getCheckoutOwnership).toHaveBeenCalledWith(
      "reservation-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(paymentApi.confirm).not.toHaveBeenCalled();
    expect(paymentApi.getByPaymentKey).toHaveBeenCalledWith(
      "payment-key-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("keeps a success callback received when ownership preflight is retryable", async () => {
    const preflightError = new AppError({
      kind: "network",
      code: "NETWORK_ERROR",
      message: "ownership unavailable",
      retryable: true,
    });
    const { callbacks, paymentApi } = setup({
      getCheckoutOwnership: vi.fn().mockRejectedValue(preflightError),
    });

    await waitFor(() => expect(callbacks.onRecoverable).toHaveBeenCalledTimes(1));
    expect(callbacks.onCallbackPhaseChange).not.toHaveBeenCalled();
    expect(paymentApi.confirm).not.toHaveBeenCalled();
    expect(paymentApi.getByPaymentKey).not.toHaveBeenCalled();
  });

  it("retries received failure recovery and confirms exactly once", async () => {
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
    const { callbacks, paymentApi } = setup({
      mode: "failure",
      shouldConfirm: true,
      getCheckoutOwnership,
    });
    const recheck = screen.getByRole("button", { name: "결제 상태 확인" });

    fireEvent.click(recheck);
    await screen.findByText(
      "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
    expect(callbacks.onCallbackPhaseChange).not.toHaveBeenCalled();
    expect(paymentApi.confirm).not.toHaveBeenCalled();

    fireEvent.click(recheck);
    await waitFor(() => expect(callbacks.onConfirmed).toHaveBeenCalledTimes(1));
    expect(callbacks.onCallbackPhaseChange).toHaveBeenCalledTimes(1);
    expect(callbacks.onCallbackPhaseChange).toHaveBeenCalledWith("confirming");
    expect(paymentApi.confirm).toHaveBeenCalledTimes(1);
  });

  it("keeps an ambiguous failure recovery reconciliation-only", async () => {
    const confirmError = new AppError({
      kind: "timeout",
      code: "REQUEST_TIMEOUT",
      message: "confirm timed out",
      retryable: true,
    });
    const getByPaymentKey = vi
      .fn()
      .mockResolvedValue(payment({ status: "IN_PROGRESS" }));
    const { callbacks, paymentApi } = setup({
      mode: "failure",
      shouldConfirm: true,
      confirm: vi.fn().mockRejectedValue(confirmError),
      getByPaymentKey,
    });
    const recheck = screen.getByRole("button", { name: "결제 상태 확인" });

    fireEvent.click(recheck);
    await screen.findByText(
      "결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.",
    );
    expect(getByPaymentKey).toHaveBeenCalledTimes(1);
    fireEvent.click(recheck);
    await waitFor(() => expect(getByPaymentKey).toHaveBeenCalledTimes(2));

    expect(paymentApi.confirm).toHaveBeenCalledTimes(1);
    expect(callbacks.onCallbackPhaseChange).toHaveBeenCalledTimes(1);
    expect(callbacks.onCallbackPhaseChange).toHaveBeenCalledWith("confirming");
    expect(callbacks.onConfirmed).not.toHaveBeenCalled();
  });

  it("keeps an in-flight confirmation alive when only the session facade identity changes", async () => {
    const pendingOwnership = deferred<CheckoutOwnership>();
    const getCheckoutOwnership = vi
      .fn()
      .mockReturnValue(pendingOwnership.promise);
    const {
      callbacks,
      paymentApi,
      rerenderWithFreshSessionFacade,
    } = setup({ getCheckoutOwnership });

    await waitFor(() => expect(getCheckoutOwnership).toHaveBeenCalledTimes(1));
    rerenderWithFreshSessionFacade();
    await Promise.resolve();
    pendingOwnership.resolve(ownership());

    await waitFor(() => expect(callbacks.onConfirmed).toHaveBeenCalledTimes(1));
    expect(paymentApi.confirm).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: "operation id",
      documentData: {
        ...documentFromCheckout(),
        operationId: "different-operation" as CheckoutData["operationId"],
      },
      callbackData: callback(),
    },
    {
      label: "reservation uid",
      documentData: {
        ...documentFromCheckout(),
        reservationUid: "different-reservation",
      },
      callbackData: callback(),
    },
    {
      label: "amount",
      documentData: { ...documentFromCheckout(), amount: 1 },
      callbackData: callback(),
    },
    {
      label: "callback order id",
      documentData: documentFromCheckout(),
      callbackData: { ...callback(), orderId: "different-order" },
    },
  ])(
    "rejects a reconciliation with a mismatched $label before server I/O",
    async ({ documentData, callbackData }) => {
      const { callbacks, ownershipApi, paymentApi } = setup({
        shouldConfirm: false,
        documentData,
        callbackData,
      });

      await waitFor(() => expect(callbacks.onInvalid).toHaveBeenCalledTimes(1));
      expect(ownershipApi.getCheckoutOwnership).not.toHaveBeenCalled();
      expect(paymentApi.confirm).not.toHaveBeenCalled();
      expect(paymentApi.getByPaymentKey).not.toHaveBeenCalled();
    },
  );

  it("keeps ambiguous confirmation recoverable and never publishes terminal success", async () => {
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
    const { callbacks } = setup({
      confirm: vi.fn().mockRejectedValue(confirmError),
      getByPaymentKey: vi.fn().mockRejectedValue(lookupError),
    });

    await waitFor(() => expect(callbacks.onRecoverable).toHaveBeenCalledTimes(1));
    expect(callbacks.onCallbackPhaseChange).toHaveBeenNthCalledWith(
      1,
      "confirming",
    );
    expect(callbacks.onCallbackPhaseChange).toHaveBeenNthCalledWith(
      2,
      "reconciling",
    );
    expect(callbacks.onConfirmed).not.toHaveBeenCalled();
    expect(callbacks.onTerminalFailure).not.toHaveBeenCalled();
  });

  it("keeps a pending failure screen recoverable for an explicit recheck", async () => {
    const { callbacks } = setup({
      mode: "failure",
      shouldConfirm: false,
      getByPaymentKey: vi.fn().mockResolvedValue(payment({ status: "IN_PROGRESS" })),
    });

    fireEvent.click(screen.getByRole("button", { name: "결제 상태 확인" }));

    expect(
      await screen.findByText(
        "결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.",
      ),
    ).toBeVisible();
    expect(callbacks.onConfirmed).not.toHaveBeenCalled();
    expect(callbacks.onTerminalFailure).not.toHaveBeenCalled();
  });
});
