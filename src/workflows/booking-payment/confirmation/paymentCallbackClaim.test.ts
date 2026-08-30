import type {
  CheckoutOwnership,
  CheckoutOwnershipApiPort,
} from "../../../features/reservations/payment/public";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import type {
  BookingPaymentOperationId,
  CallbackData,
  CallbackRepository,
  CheckoutData,
  CheckoutRepository,
} from "../checkout";
import {
  claimPaymentCallback,
  resolveServerPaymentCallbackReplay,
  toPaymentCallbackDocument,
  type PaymentCallbackClaimDependencies,
  type PaymentCallbackFreshTuple,
} from "./paymentCallbackClaim";

const operationId = "operation_1" as BookingPaymentOperationId;
const scope = {
  subject: "subject:member_1",
  epoch: 7,
} as AuthenticatedSessionScope;
const fresh: PaymentCallbackFreshTuple = {
  reservationUid: "reservation-7",
  orderId: "reservation-7",
  paymentKey: "payment_key_7",
  amount: 120_000,
};
const checkout: CheckoutData = {
  operationId,
  accommodationId: 31,
  reservationUid: fresh.reservationUid,
  orderName: "Airbob stay",
  amount: fresh.amount,
  checkIn: "2026-09-01",
  checkOut: "2026-09-03",
  adultOccupancy: 2,
  childOccupancy: 1,
  infantOccupancy: 0,
  petOccupancy: 0,
  couponName: null,
  couponDiscount: null,
};
const callback: CallbackData = {
  operationId,
  reservationUid: fresh.reservationUid,
  orderId: fresh.orderId,
  paymentKey: fresh.paymentKey,
  amount: fresh.amount,
  phase: "received",
};

const setupClaim = () => {
  const readForCallback = jest.fn<
    ReturnType<CheckoutRepository["readForCallback"]>,
    Parameters<CheckoutRepository["readForCallback"]>
  >(() => ({ status: "found", data: checkout }));
  const readCallback = jest.fn<
    ReturnType<CallbackRepository["read"]>,
    Parameters<CallbackRepository["read"]>
  >(() => ({ status: "missing" }));
  const writeCallback = jest.fn<
    ReturnType<CallbackRepository["write"]>,
    Parameters<CallbackRepository["write"]>
  >(({ data }) => ({ status: "written", data }));
  const consumeLegacyHint = jest.fn<
    ReturnType<CallbackRepository["consumeLegacyConfirmedPaymentHint"]>,
    Parameters<CallbackRepository["consumeLegacyConfirmedPaymentHint"]>
  >(() => ({ status: "hint", shouldReconcile: false }));
  const dependencies: PaymentCallbackClaimDependencies = {
    checkout: { readForCallback },
    callback: {
      read: readCallback,
      write: writeCallback,
      consumeLegacyConfirmedPaymentHint: consumeLegacyHint,
    },
  };

  return {
    consumeLegacyHint,
    dependencies,
    readCallback,
    readForCallback,
    writeCallback,
  };
};

const claim = (
  dependencies: PaymentCallbackClaimDependencies,
  overrides: Partial<{
    reservationUid: string;
    fresh: PaymentCallbackFreshTuple;
    isCurrent: () => boolean;
  }> = {},
) =>
  claimPaymentCallback(dependencies, {
    scope,
    reservationUid: fresh.reservationUid,
    fresh,
    isCurrent: () => true,
    ...overrides,
  });

describe("claimPaymentCallback", () => {
  it("claims an exact fresh callback and permits the one initial confirmation", () => {
    const harness = setupClaim();

    expect(claim(harness.dependencies)).toEqual({
      status: "ready",
      callback,
      document: {
        operationId,
        reservationUid: fresh.reservationUid,
        amount: fresh.amount,
        accommodationId: checkout.accommodationId,
        checkIn: checkout.checkIn,
        checkOut: checkout.checkOut,
        guestCount: 3,
      },
      persistCallback: true,
      shouldConfirm: true,
    });
    expect(harness.writeCallback).toHaveBeenCalledWith({
      scope,
      data: callback,
      isCurrent: expect.any(Function),
    });
  });

  it("turns an exact legacy marker into a reconcile-only hint", () => {
    const harness = setupClaim();
    harness.consumeLegacyHint.mockReturnValue({
      status: "hint",
      shouldReconcile: true,
    });

    expect(claim(harness.dependencies)).toMatchObject({
      status: "ready",
      callback: { phase: "reconciling" },
      persistCallback: true,
      shouldConfirm: false,
    });
    expect(harness.consumeLegacyHint).toHaveBeenCalledWith({
      orderId: fresh.orderId,
      paymentKey: fresh.paymentKey,
      amount: fresh.amount,
    });
    expect(harness.writeCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phase: "reconciling" }),
      }),
    );
  });

  it("keeps a persisted received callback eligible for its first confirmation", () => {
    const harness = setupClaim();
    harness.readCallback.mockReturnValue({ status: "found", data: callback });

    expect(
      claimPaymentCallback(harness.dependencies, {
        scope,
        reservationUid: fresh.reservationUid,
        isCurrent: () => true,
      }),
    ).toMatchObject({
      status: "ready",
      callback,
      persistCallback: true,
      shouldConfirm: true,
    });
    expect(harness.consumeLegacyHint).not.toHaveBeenCalled();
    expect(harness.writeCallback).not.toHaveBeenCalled();
  });

  it("keeps a duplicate fresh delivery confirm-capable while still received", () => {
    const harness = setupClaim();
    harness.readCallback.mockReturnValue({ status: "found", data: callback });

    expect(claim(harness.dependencies)).toMatchObject({
      status: "ready",
      shouldConfirm: true,
    });
    expect(harness.writeCallback).not.toHaveBeenCalled();
  });

  it.each(["confirming", "reconciling"] as const)(
    "keeps a persisted %s callback reconciliation-only",
    (phase) => {
      const harness = setupClaim();
      harness.readCallback.mockReturnValue({
        status: "found",
        data: { ...callback, phase },
      });

      expect(claim(harness.dependencies)).toMatchObject({
        status: "ready",
        callback: { phase },
        shouldConfirm: false,
      });
      expect(harness.writeCallback).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["operation", { operationId: "operation_2" as BookingPaymentOperationId }],
    ["reservation", { reservationUid: "another-reservation" }],
    ["order", { orderId: "another-reservation" }],
    ["payment key", { paymentKey: "another_key" }],
    ["amount", { amount: fresh.amount + 1 }],
  ])("rejects a persisted callback %s mismatch", (_label, override) => {
    const harness = setupClaim();
    harness.readCallback.mockReturnValue({
      status: "found",
      data: { ...callback, ...override },
    });

    expect(claim(harness.dependencies)).toEqual({
      status: "invalid",
      reason: "callback-mismatch",
    });
    expect(harness.writeCallback).not.toHaveBeenCalled();
  });

  it("requires the route reservation to own the checkout", () => {
    const harness = setupClaim();
    harness.readForCallback.mockReturnValue({
      status: "found",
      data: { ...checkout, reservationUid: "another-reservation" },
    });

    expect(claim(harness.dependencies)).toEqual({
      status: "invalid",
      reason: "checkout-unavailable",
    });
    expect(harness.readCallback).not.toHaveBeenCalled();
  });

  it("requires server replay only for an exact fresh tuple with no checkout", () => {
    const harness = setupClaim();
    harness.readForCallback.mockReturnValue({ status: "missing" });

    expect(claim(harness.dependencies)).toEqual({
      status: "server-replay-required",
      fresh,
    });
    expect(
      claimPaymentCallback(harness.dependencies, {
        scope,
        reservationUid: fresh.reservationUid,
        isCurrent: () => true,
      }),
    ).toEqual({ status: "invalid", reason: "checkout-unavailable" });
    expect(harness.readCallback).not.toHaveBeenCalled();
  });

  it.each([
    ["route mismatch", { ...fresh, reservationUid: "another-reservation" }],
    ["order mismatch", { ...fresh, orderId: "another-reservation" }],
    ["blank key", { ...fresh, paymentKey: "" }],
    ["unsafe amount", { ...fresh, amount: Number.MAX_SAFE_INTEGER + 1 }],
  ])("rejects an invalid fresh tuple: %s", (_label, invalidFresh) => {
    const harness = setupClaim();

    expect(claim(harness.dependencies, { fresh: invalidFresh })).toEqual({
      status: "invalid",
      reason: "invalid-fresh-tuple",
    });
    expect(harness.readForCallback).not.toHaveBeenCalled();
  });

  it.each([
    [
      "callback read",
      "callback-unavailable",
      (harness: ReturnType<typeof setupClaim>) =>
        harness.readCallback.mockReturnValue({
          status: "storage-error",
          error: { kind: "storage-unavailable", operation: "get" },
        }),
    ],
    [
      "legacy marker",
      "marker-unavailable",
      (harness: ReturnType<typeof setupClaim>) =>
        harness.consumeLegacyHint.mockReturnValue({
          status: "storage-error",
          error: { kind: "storage-unavailable", operation: "get" },
        }),
    ],
    [
      "callback write",
      "callback-write-failed",
      (harness: ReturnType<typeof setupClaim>) =>
        harness.writeCallback.mockReturnValue({
          status: "storage-error",
          error: { kind: "storage-unavailable", operation: "set" },
        }),
    ],
  ])("fails closed on %s storage failure", (_label, reason, arrange) => {
    const harness = setupClaim();
    arrange(harness);

    expect(claim(harness.dependencies)).toEqual({
      status: "invalid",
      reason,
    });
  });

  it("returns stale before any read when the route or session is no longer current", () => {
    const harness = setupClaim();

    expect(
      claim(harness.dependencies, {
        isCurrent: () => false,
      }),
    ).toEqual({ status: "stale" });
    expect(harness.readForCallback).not.toHaveBeenCalled();
  });

  it("returns stale when currentness changes after the checkout read", () => {
    const harness = setupClaim();
    const isCurrent = jest
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    expect(claim(harness.dependencies, { isCurrent })).toEqual({
      status: "stale",
    });
    expect(harness.readCallback).not.toHaveBeenCalled();
  });

  it("maps a stale callback write without permitting confirmation", () => {
    const harness = setupClaim();
    harness.writeCallback.mockReturnValue({ status: "stale" });

    expect(claim(harness.dependencies)).toEqual({ status: "stale" });
  });

  it("projects a checkout into the workflow-owned callback document", () => {
    expect(toPaymentCallbackDocument(checkout)).toEqual({
      operationId,
      reservationUid: fresh.reservationUid,
      amount: fresh.amount,
      accommodationId: checkout.accommodationId,
      checkIn: checkout.checkIn,
      checkOut: checkout.checkOut,
      guestCount: 3,
    });
  });
});

const ownership: CheckoutOwnership = {
  reservationUid: fresh.reservationUid,
  accommodationId: checkout.accommodationId,
  checkIn: checkout.checkIn,
  checkOut: checkout.checkOut,
  guestCount: 3,
  payment: {
    orderId: fresh.orderId,
    paymentKey: fresh.paymentKey,
    totalAmount: fresh.amount,
    status: "DONE",
  },
};

const setupReplay = () => {
  const getCheckoutOwnership = jest.fn<
    ReturnType<CheckoutOwnershipApiPort["getCheckoutOwnership"]>,
    Parameters<CheckoutOwnershipApiPort["getCheckoutOwnership"]>
  >(() => Promise.resolve(ownership));

  return { getCheckoutOwnership };
};

describe("resolveServerPaymentCallbackReplay", () => {
  it("returns an ephemeral reconcile-only document for exact server ownership", async () => {
    const harness = setupReplay();
    const controller = new AbortController();

    await expect(
      resolveServerPaymentCallbackReplay(
        { ownershipApi: harness },
        {
          fresh,
          signal: controller.signal,
          isCurrent: () => true,
        },
      ),
    ).resolves.toEqual({
      status: "ready",
      callback: {
        operationId: "server_replay",
        reservationUid: fresh.reservationUid,
        orderId: fresh.orderId,
        paymentKey: fresh.paymentKey,
        amount: fresh.amount,
        phase: "reconciling",
      },
      document: {
        operationId: "server_replay",
        reservationUid: fresh.reservationUid,
        amount: fresh.amount,
        accommodationId: checkout.accommodationId,
        checkIn: checkout.checkIn,
        checkOut: checkout.checkOut,
        guestCount: 3,
      },
      persistCallback: false,
      shouldConfirm: false,
    });
    expect(harness.getCheckoutOwnership).toHaveBeenCalledWith(
      fresh.reservationUid,
      { signal: controller.signal },
    );
  });

  it.each([
    ["reservation", { reservationUid: "another-reservation" }],
    [
      "accommodation",
      { accommodationId: 0 },
    ],
    ["check-in normalization", { checkIn: "2026-09-01T15:00:00" }],
    ["date order", { checkOut: "2026-08-31" }],
    ["guest count", { guestCount: 0 }],
    ["missing payment", { payment: null }],
    [
      "order",
      { payment: { ...ownership.payment!, orderId: "another-reservation" } },
    ],
    [
      "payment key",
      { payment: { ...ownership.payment!, paymentKey: "another_key" } },
    ],
    [
      "amount",
      { payment: { ...ownership.payment!, totalAmount: fresh.amount + 1 } },
    ],
  ])("rejects server ownership %s mismatch", async (_label, override) => {
    const harness = setupReplay();
    harness.getCheckoutOwnership.mockResolvedValue({
      ...ownership,
      ...override,
    } as CheckoutOwnership);

    await expect(
      resolveServerPaymentCallbackReplay(
        { ownershipApi: harness },
        {
          fresh,
          signal: new AbortController().signal,
          isCurrent: () => true,
        },
      ),
    ).resolves.toEqual({
      status: "invalid",
      reason: "ownership-mismatch",
    });
  });

  it("keeps the scrubbed tuple retryable when ownership cannot be loaded", async () => {
    const harness = setupReplay();
    harness.getCheckoutOwnership.mockRejectedValue(new Error("offline"));

    await expect(
      resolveServerPaymentCallbackReplay(
        { ownershipApi: harness },
        {
          fresh,
          signal: new AbortController().signal,
          isCurrent: () => true,
        },
      ),
    ).resolves.toEqual({
      status: "server-replay-retryable",
      fresh,
      reason: "ownership-unavailable",
    });
  });

  it("does not call the server for an already stale replay", async () => {
    const harness = setupReplay();

    await expect(
      resolveServerPaymentCallbackReplay(
        { ownershipApi: harness },
        {
          fresh,
          signal: new AbortController().signal,
          isCurrent: () => false,
        },
      ),
    ).resolves.toEqual({ status: "stale" });
    expect(harness.getCheckoutOwnership).not.toHaveBeenCalled();
  });

  it("discards ownership returned after the route becomes stale", async () => {
    const harness = setupReplay();
    const isCurrent = jest
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    await expect(
      resolveServerPaymentCallbackReplay(
        { ownershipApi: harness },
        {
          fresh,
          signal: new AbortController().signal,
          isCurrent,
        },
      ),
    ).resolves.toEqual({ status: "stale" });
  });

  it("maps an aborted ownership request to stale", async () => {
    const harness = setupReplay();
    const controller = new AbortController();
    harness.getCheckoutOwnership.mockImplementation(async () => {
      controller.abort();
      throw new Error("aborted");
    });

    await expect(
      resolveServerPaymentCallbackReplay(
        { ownershipApi: harness },
        {
          fresh,
          signal: controller.signal,
          isCurrent: () => true,
        },
      ),
    ).resolves.toEqual({ status: "stale" });
  });
});
