import type { PaymentOperationApiPort } from "../../../../features/reservations/payment/public";
import { AppError } from "../../../../platform/http/errors";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../../platform/session/sessionScope";
import type { SessionRuntimeLeaseId } from "../../../../platform/session/runtimeLeaseId";
import type { SessionStorageDriver } from "../../../../platform/storage/sessionStorageDriver";
import {
  BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
  BOOKING_PAYMENT_V2_JOURNAL_KEY,
  BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
} from "../../journal/namespace";
import { createBookingPaymentJournalRepository } from "../../journal/repository";
import type {
  BookingPaymentAttempt,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentQuote,
  BookingPaymentReady,
  BookingPaymentRuntimeLease,
} from "../../journal/types";
import { BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS } from "../../journal/validation";
import { createBookingPaymentRecoveryWorkflow } from "./paymentRecovery";
import type {
  BookingPaymentConfirmationResumeReferenceState,
  BookingPaymentOperationReference,
  BookingPaymentRecoveryWorkflow,
  BookingPaymentSuccessCallback,
} from "./types";

const initialNow = Date.parse("2026-09-01T10:00:00Z");
const owner = "subject:member_a" as SessionSubject;
const flowId = "10000000-0000-4000-8000-000000000001";
const quoteUid = "20000000-0000-4000-8000-000000000002";
const reservationUid = "30000000-0000-4000-8000-000000000003";
const paymentAttemptId = "40000000-0000-4000-8000-000000000004";
const operationId = "50000000-0000-4000-8000-000000000005";
const otherOperationId = "90000000-0000-4000-8000-000000000009";
const paymentKey = "provider-secret-never-in-safe-results";

const oldLease: BookingPaymentRuntimeLease = {
  runtimeLeaseId: "60000000-0000-4000-8000-000000000006",
  sessionEpoch: 4,
};
const currentScope: AuthenticatedSessionScope = {
  subject: owner,
  epoch: 5,
  runtimeLeaseId:
    "70000000-0000-4000-8000-000000000007" as SessionRuntimeLeaseId,
};
const reloadScope: AuthenticatedSessionScope = {
  subject: owner,
  epoch: 6,
  runtimeLeaseId:
    "80000000-0000-4000-8000-000000000008" as SessionRuntimeLeaseId,
};

const quote: BookingPaymentQuote = {
  quoteUid,
  accommodationId: 7,
  orderName: "Seoul stay",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  guestCount: 2,
  nightlyPrice: 1_000,
  nights: 2,
  subtotal: 2_000,
  discountAmount: 100,
  amount: 1_900,
  currency: "KRW",
  paymentRequired: true,
  inventoryHeld: false,
  quoteExpiresAt: "2026-09-01T10:05:00Z",
  serverTime: "2026-09-01T10:00:00Z",
};

const ready: BookingPaymentReady = {
  reservationUid,
  orderName: "Seoul stay",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  guestCount: 2,
  subtotal: 2_000,
  discountAmount: 100,
  amount: 1_900,
  currency: "KRW",
  status: "PAYMENT_PENDING",
  paymentRequired: true,
  paymentAllowed: true,
  holdExpiresAt: "2026-09-01T10:15:00Z",
  serverTime: "2026-09-01T10:00:00Z",
};

const attempt: BookingPaymentAttempt = {
  paymentAttemptId,
  orderId: reservationUid,
  amount: 1_900,
  currency: "KRW",
  holdExpiresAt: "2026-09-01T10:15:00Z",
  remainingSeconds: 900,
  serverTime: "2026-09-01T10:00:00Z",
};

const journalData = (
  phase:
    | "attempt-ready"
    | "callback-received"
    | "confirm-submitting" = "attempt-ready",
): BookingPaymentJournalData => ({
  phase,
  flowId,
  serverIntent: {
    accommodationId: 7,
    checkInDate: "2026-09-10",
    checkOutDate: "2026-09-12",
    guestCount: 2,
    couponId: null,
  },
  presentationIntent: {
    adultCount: 2,
    childCount: 0,
    infantCount: 0,
    petCount: 0,
  },
  recoveryExpiresAt: initialNow + 15 * 60_000,
  quote,
  checkout: {
    method: "POST",
    resource: "/api/v1/reservations",
    body: { quoteUid, requestMessage: null },
    idempotencyKey: "checkout-key-123",
    requestFingerprint: "a".repeat(64),
  },
  ready,
  attempt,
});

const journal = (
  phase:
    | "attempt-ready"
    | "callback-received"
    | "confirm-submitting" = "attempt-ready",
): BookingPaymentJournalEnvelope => ({
  purpose: "booking-payment-journal",
  version: 2,
  privacyClass: "sensitive",
  containsPii: false,
  owner,
  createdAt: initialNow - 10 * 60_000,
  hardExpiresAt: initialNow - 10 * 60_000 + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
  lease: oldLease,
  data: journalData(phase),
});

interface StorageHarnessOptions {
  readonly noOpRemoveKeys?: ReadonlySet<string>;
}

const createStorageHarness = (
  entries: Record<string, string> = {},
  options: StorageHarnessOptions = {},
) => {
  const values = new Map(Object.entries(entries));
  const driver: SessionStorageDriver = {
    keys: () => ({ ok: true, value: [...values.keys()] }),
    getItem: (key) => ({ ok: true, value: values.get(key) ?? null }),
    setItem: (key, value) => {
      values.set(key, value);
      return { ok: true, value: undefined };
    },
    removeItem: (key) => {
      if (!options.noOpRemoveKeys?.has(key)) values.delete(key);
      return { ok: true, value: undefined };
    },
  };
  return { driver, values };
};

const callback = (
  overrides: Partial<BookingPaymentSuccessCallback> = {},
): BookingPaymentSuccessCallback => ({
  reservationUid,
  orderId: reservationUid,
  paymentKey,
  amount: 1_900,
  firstCapturedAt: initialNow,
  ...overrides,
});

const reference: BookingPaymentOperationReference = {
  flowId,
  operationId,
  reservationUid,
};

const resumeReference: BookingPaymentConfirmationResumeReferenceState = {
  purpose: "booking-payment-flow-reference",
  version: 2,
  flowId,
  locator: { kind: "reservation", reservationUid },
};

const operationDetail = (
  overrides: Partial<
    Awaited<ReturnType<PaymentOperationApiPort["getPaymentOperation"]>>
  > = {},
): Awaited<ReturnType<PaymentOperationApiPort["getPaymentOperation"]>> => ({
  operationId,
  orderId: reservationUid,
  status: "PENDING",
  updatedAt: "2026-09-01T10:01:00Z",
  nextAction: "POLL",
  retryAfterSeconds: 2,
  serverTime: "2026-09-01T10:01:01Z",
  userFailureCode: null,
  ...overrides,
});

const createApi = (): PaymentOperationApiPort => ({
  beginPaymentAttempt: vi.fn(),
  releaseHold: vi.fn(),
  confirmPaymentOperation: vi.fn().mockResolvedValue({ operationId }),
  getPaymentOperation: vi.fn().mockResolvedValue(operationDetail()),
});

const createHarness = (
  options: StorageHarnessOptions = {},
  phase:
    | "attempt-ready"
    | "callback-received"
    | "confirm-submitting" = "attempt-ready",
) => {
  let now = initialNow;
  let routeCurrent = true;
  let sessionCurrent = true;
  let scope: AuthenticatedSessionScope | null = currentScope;
  const storage = createStorageHarness(
    { [BOOKING_PAYMENT_V2_JOURNAL_KEY]: JSON.stringify(journal(phase)) },
    options,
  );
  const repository = createBookingPaymentJournalRepository({
    driver: storage.driver,
    now: () => now,
  });
  const api = createApi();
  const createWorkflow = () =>
    createBookingPaymentRecoveryWorkflow({
      api,
      repository,
      routeLease: { isCurrent: () => routeCurrent },
      session: {
        captureAuthenticatedSession: () => scope,
        isCurrentSession: (candidate) =>
          sessionCurrent &&
          scope !== null &&
          candidate.subject === scope.subject &&
          candidate.epoch === scope.epoch &&
          candidate.runtimeLeaseId === scope.runtimeLeaseId,
      },
    });
  return {
    ...storage,
    api,
    repository,
    createWorkflow,
    setNow: (value: number) => {
      now = value;
    },
    setRouteCurrent: (value: boolean) => {
      routeCurrent = value;
    },
    setSessionCurrent: (value: boolean) => {
      sessionCurrent = value;
    },
    setScope: (value: AuthenticatedSessionScope | null) => {
      scope = value;
    },
  };
};

const submitFreshCallback = async (
  workflow: BookingPaymentRecoveryWorkflow,
  descriptor: BookingPaymentSuccessCallback,
) => {
  const claimed = workflow.claimCallback(descriptor);
  return claimed.status === "confirmation-ready"
    ? workflow.resumeConfirmation(claimed.reference)
    : claimed;
};

const seedReceipt = async (
  harness: ReturnType<typeof createHarness>,
  acceptedOperationId = operationId,
) => {
  vi.mocked(harness.api.confirmPaymentOperation).mockResolvedValueOnce({
    operationId: acceptedOperationId,
  });
  const result = await submitFreshCallback(
    harness.createWorkflow(),
    callback(),
  );
  expect(result.status).toBe("operation-accepted");
  return result;
};

describe("booking payment post-callback recovery workflow", () => {
  it("durably joins the callback before confirmation and returns only a safe operation reference", async () => {
    const harness = createHarness();
    const workflow = harness.createWorkflow();

    const claimed = workflow.claimCallback(callback());

    expect(claimed).toEqual({
      status: "confirmation-ready",
      reference: resumeReference,
    });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(
      JSON.parse(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ?? "null"),
    ).toMatchObject({ data: { phase: "confirm-submitting" } });
    expect(harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
      true,
    );

    const result = await workflow.resumeConfirmation(resumeReference);

    expect(result).toEqual({
      status: "operation-accepted",
      reference,
      cleanup: "complete",
    });
    expect(harness.api.confirmPaymentOperation).toHaveBeenCalledWith(
      {
        paymentKey,
        orderId: reservationUid,
        amount: 1_900,
        paymentAttemptId,
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
    expect(harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
      false,
    );
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );
    expect(JSON.stringify(result)).not.toContain(paymentKey);
    expect(JSON.stringify(result)).not.toContain("paymentAttemptId");
  });

  it("recovers a candidate-claimed callback after the scrubbed route reloads without history state", async () => {
    const harness = createHarness();
    expect(
      harness.repository.recoveryRecords.claimCallbackCredential({
        owner,
        lease: {
          runtimeLeaseId: currentScope.runtimeLeaseId,
          sessionEpoch: currentScope.epoch,
        },
        reservationUid,
        orderId: reservationUid,
        amount: 1_900,
        paymentKey,
        firstCapturedAt: initialNow,
        isCurrent: () => true,
      }),
    ).toMatchObject({ status: "claimed" });
    harness.setScope(reloadScope);
    const workflow = harness.createWorkflow();

    const recovered = workflow.recoverClaimedCallback(reservationUid);

    expect(recovered).toEqual({
      status: "confirmation-ready",
      reference: resumeReference,
    });
    expect(JSON.stringify(recovered)).not.toContain(paymentKey);
    expect(JSON.stringify(recovered)).not.toContain("paymentAttemptId");
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(
      JSON.parse(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ?? "null"),
    ).toMatchObject({
      lease: {
        runtimeLeaseId: reloadScope.runtimeLeaseId,
        sessionEpoch: reloadScope.epoch,
      },
      data: { phase: "confirm-submitting" },
    });

    await expect(
      workflow.resumeConfirmation(resumeReference),
    ).resolves.toMatchObject({ status: "operation-accepted", reference });
    expect(harness.api.confirmPaymentOperation).toHaveBeenCalledOnce();
  });

  it("does not recover a candidate-claimed callback for a different route reservation", () => {
    const harness = createHarness();
    expect(
      harness.repository.recoveryRecords.claimCallbackCredential({
        owner,
        lease: {
          runtimeLeaseId: currentScope.runtimeLeaseId,
          sessionEpoch: currentScope.epoch,
        },
        reservationUid,
        orderId: reservationUid,
        amount: 1_900,
        paymentKey,
        firstCapturedAt: initialNow,
        isCurrent: () => true,
      }),
    ).toMatchObject({ status: "claimed" });

    expect(
      harness.createWorkflow().recoverClaimedCallback(otherOperationId),
    ).toMatchObject({ status: "terminal-failure" });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
  });

  it.each(["callback-received", "confirm-submitting"] as const)(
    "repairs an exact %s journal without weakening the callback tuple join",
    async (phase) => {
      const harness = createHarness({}, phase);
      const workflow = harness.createWorkflow();

      const claimed = workflow.claimCallback(callback());
      expect(claimed).toEqual({
        status: "confirmation-ready",
        reference: resumeReference,
      });
      expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
      const result = await workflow.resumeConfirmation(resumeReference);

      expect(result).toMatchObject({ status: "operation-accepted", reference });
      expect(harness.api.confirmPaymentOperation).toHaveBeenCalledWith(
        {
          paymentKey,
          orderId: reservationUid,
          amount: 1_900,
          paymentAttemptId,
        },
        { signal: expect.any(AbortSignal) },
      );
    },
  );

  it("preserves confirm-submitting authority after timeout and permits only the exact replay", async () => {
    const harness = createHarness();
    vi.mocked(harness.api.confirmPaymentOperation)
      .mockRejectedValueOnce(
        new AppError({
          kind: "timeout",
          code: "REQUEST_TIMEOUT",
          message: "timeout",
          retryable: true,
        }),
      )
      .mockResolvedValueOnce({ operationId });
    const workflow = harness.createWorkflow();
    expect(workflow.claimCallback(callback())).toEqual({
      status: "confirmation-ready",
      reference: resumeReference,
    });

    await expect(
      workflow.resumeConfirmation(resumeReference),
    ).resolves.toMatchObject({
      status: "retryable",
      stage: "confirm",
    });
    expect(
      JSON.parse(harness.values.get(BOOKING_PAYMENT_V2_JOURNAL_KEY) ?? "null"),
    ).toMatchObject({ data: { phase: "confirm-submitting" } });
    expect(harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
      true,
    );
    expect(workflow.claimCallback(callback({ amount: 2_000 }))).toMatchObject({
      status: "terminal-failure",
    });
    expect(harness.api.confirmPaymentOperation).toHaveBeenCalledTimes(1);

    await expect(
      workflow.resumeConfirmation(resumeReference),
    ).resolves.toMatchObject({ status: "operation-accepted", reference });
    expect(harness.api.confirmPaymentOperation).toHaveBeenCalledTimes(2);
  });

  it("recreates the workflow after an ambiguous confirm and resumes from only an exact safe flow reference", async () => {
    const harness = createHarness();
    vi.mocked(harness.api.confirmPaymentOperation)
      .mockRejectedValueOnce(
        new AppError({
          kind: "timeout",
          code: "REQUEST_TIMEOUT",
          message: "timeout",
          retryable: true,
        }),
      )
      .mockResolvedValueOnce({ operationId });

    const firstWorkflow = harness.createWorkflow();
    expect(firstWorkflow.claimCallback(callback())).toEqual({
      status: "confirmation-ready",
      reference: resumeReference,
    });
    await expect(
      firstWorkflow.resumeConfirmation(resumeReference),
    ).resolves.toMatchObject({ status: "retryable", stage: "confirm" });
    harness.setScope(reloadScope);

    const resumed = await harness
      .createWorkflow()
      .resumeConfirmation(resumeReference);

    expect(resumed).toEqual({
      status: "operation-accepted",
      reference,
      cleanup: "complete",
    });
    expect(harness.api.confirmPaymentOperation).toHaveBeenCalledTimes(2);
    expect(harness.api.confirmPaymentOperation).toHaveBeenLastCalledWith(
      {
        paymentKey,
        orderId: reservationUid,
        amount: 1_900,
        paymentAttemptId,
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(JSON.stringify(resumeReference)).not.toContain(paymentKey);
    expect(JSON.stringify(resumed)).not.toContain(paymentKey);
    expect(JSON.stringify(resumed)).not.toContain("paymentAttemptId");
  });

  it("never discovers or resumes pre-Accepted authority from an inexact or indirect state", async () => {
    const harness = createHarness({}, "confirm-submitting");
    await harness.repository.recoveryRecords.claimCallbackCredential({
      owner,
      lease: oldLease,
      reservationUid,
      orderId: reservationUid,
      amount: 1_900,
      paymentKey,
      firstCapturedAt: initialNow,
      isCurrent: () => true,
    });
    harness.setScope(reloadScope);
    const workflow = harness.createWorkflow();

    await expect(
      workflow.resumeConfirmation({
        ...resumeReference,
        locator: { kind: "accommodation", accommodationId: 7 },
      } as never),
    ).resolves.toEqual({ status: "invalid-reference" });
    await expect(
      workflow.resumeConfirmation({
        ...resumeReference,
        flowId: otherOperationId,
      }),
    ).resolves.toMatchObject({ status: "terminal-failure" });
    await expect(
      workflow.resumeConfirmation({
        ...resumeReference,
        providerHint: "unsafe",
      } as never),
    ).resolves.toEqual({ status: "invalid-reference" });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
  });

  it("treats a durable receipt as an absolute no-confirm barrier", async () => {
    const harness = createHarness();
    const workflow = harness.createWorkflow();
    await submitFreshCallback(workflow, callback());
    vi.mocked(harness.api.confirmPaymentOperation).mockClear();

    const replay = workflow.claimCallback(callback());

    expect(replay).toEqual({
      status: "receipt-authoritative",
      fallback: { kind: "reservation-detail", reservationUid },
    });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
  });

  it("keeps a cleanup-pending receipt authoritative and never re-confirms", async () => {
    const harness = createHarness({
      noOpRemoveKeys: new Set([BOOKING_PAYMENT_V2_JOURNAL_KEY]),
    });
    const workflow = harness.createWorkflow();

    await expect(submitFreshCallback(workflow, callback())).resolves.toEqual({
      status: "operation-accepted",
      reference,
      cleanup: "pending",
    });
    expect(workflow.claimCallback(callback())).toMatchObject({
      status: "receipt-authoritative",
    });
    expect(harness.api.confirmPaymentOperation).toHaveBeenCalledTimes(1);
  });

  it("polls an exact live receipt while retrying credential-then-journal cleanup without reconfirming", async () => {
    const blockedRemovals = new Set([
      BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY,
    ]);
    const harness = createHarness({ noOpRemoveKeys: blockedRemovals });
    await expect(
      submitFreshCallback(harness.createWorkflow(), callback()),
    ).resolves.toMatchObject({
      status: "operation-accepted",
      cleanup: "pending",
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
      true,
    );
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);
    harness.setScope(reloadScope);
    const workflow = harness.createWorkflow();

    await expect(workflow.pollOperation(reference)).resolves.toMatchObject({
      status: "unresolved",
      observation: { status: "PENDING" },
    });
    expect(harness.api.confirmPaymentOperation).toHaveBeenCalledTimes(1);
    expect(harness.api.getPaymentOperation).toHaveBeenCalledTimes(1);
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );
    expect(harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
      true,
    );
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(true);

    blockedRemovals.clear();
    await expect(workflow.pollOperation(reference)).resolves.toMatchObject({
      status: "unresolved",
    });
    expect(harness.api.confirmPaymentOperation).toHaveBeenCalledTimes(1);
    expect(harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
      false,
    );
    expect(harness.values.has(BOOKING_PAYMENT_V2_JOURNAL_KEY)).toBe(false);
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );
  });

  it.each([
    "PENDING",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "REQUIRES_REVIEW",
  ] as const)(
    "hands off every public 202 %s response status opaquely",
    async (status) => {
      const harness = createHarness();
      vi.mocked(harness.api.confirmPaymentOperation).mockResolvedValueOnce({
        operationId,
        status,
        providerMessage: "discard-me",
      } as never);

      const result = await submitFreshCallback(
        harness.createWorkflow(),
        callback(),
      );

      expect(result).toMatchObject({ status: "operation-accepted", reference });
      expect(JSON.stringify(result)).not.toContain(status);
      expect(JSON.stringify(result)).not.toContain("discard-me");
    },
  );

  it("fails P006 and malformed Accepted identities closed without exposing the callback secret", async () => {
    const conflictHarness = createHarness();
    vi.mocked(
      conflictHarness.api.confirmPaymentOperation,
    ).mockRejectedValueOnce(
      new AppError({
        kind: "conflict",
        code: "P006",
        message: "tuple conflict with provider data",
      }),
    );
    const conflict = await submitFreshCallback(
      conflictHarness.createWorkflow(),
      callback(),
    );
    expect(conflict).toMatchObject({
      status: "terminal-failure",
      reason: "conflict",
    });
    expect(JSON.stringify(conflict)).not.toContain(paymentKey);

    const malformedHarness = createHarness();
    vi.mocked(
      malformedHarness.api.confirmPaymentOperation,
    ).mockResolvedValueOnce({ operationId: "forged" });
    await expect(
      submitFreshCallback(malformedHarness.createWorkflow(), callback()),
    ).resolves.toMatchObject({
      status: "terminal-failure",
      reason: "invariant",
    });
  });

  it.each([
    [
      "403",
      new AppError({
        kind: "http",
        code: "HTTP_ERROR",
        message: "forbidden",
        status: 403,
      }),
      { status: "terminal-failure", reason: "identity" },
    ],
    [
      "P004",
      new AppError({
        kind: "http",
        code: "P004",
        message: "payment access denied",
        status: 403,
      }),
      { status: "terminal-failure", reason: "identity" },
    ],
    [
      "R008",
      new AppError({
        kind: "http",
        code: "R008",
        message: "reservation access denied",
        status: 403,
      }),
      { status: "terminal-failure", reason: "identity" },
    ],
    [
      "404",
      new AppError({
        kind: "http",
        code: "HTTP_ERROR",
        message: "not found",
        status: 404,
      }),
      { status: "recovery-unavailable" },
    ],
    [
      "408",
      new AppError({
        kind: "http",
        code: "HTTP_ERROR",
        message: "request timeout",
        status: 408,
        retryable: true,
      }),
      { status: "retryable", stage: "confirm" },
    ],
    [
      "429",
      new AppError({
        kind: "http",
        code: "HTTP_ERROR",
        message: "rate limited",
        status: 429,
        retryable: true,
      }),
      { status: "retryable", stage: "confirm" },
    ],
    [
      "P006",
      new AppError({
        kind: "conflict",
        code: "P006",
        message: "tuple conflict",
        status: 409,
      }),
      { status: "terminal-failure", reason: "conflict" },
    ],
    [
      "P007",
      new AppError({
        kind: "server",
        code: "P007",
        message: "execution fence unavailable",
        status: 503,
        retryable: true,
      }),
      { status: "retryable", stage: "confirm" },
    ],
    [
      "unknown transport",
      new AppError({
        kind: "unknown",
        code: "UNKNOWN_ERROR",
        message: "unknown transport failure",
      }),
      { status: "retryable", stage: "confirm" },
    ],
    [
      "network transport with native fetch cause",
      new AppError({
        kind: "network",
        code: "NETWORK_ERROR",
        message: "network transport failure",
        retryable: true,
        cause: new TypeError("Failed to fetch"),
      }),
      { status: "retryable", stage: "confirm" },
    ],
    [
      "mapper invariant",
      new TypeError("Accepted response identity is malformed"),
      { status: "recovery-unavailable" },
    ],
  ] as const)(
    "classifies %s confirmation failures without broad retry fallbacks",
    async (_label, error, expected) => {
      const harness = createHarness();
      vi.mocked(harness.api.confirmPaymentOperation).mockRejectedValueOnce(
        error,
      );
      const workflow = harness.createWorkflow();
      expect(workflow.claimCallback(callback())).toEqual({
        status: "confirmation-ready",
        reference: resumeReference,
      });

      const result = await workflow.resumeConfirmation(resumeReference);

      expect(result).toMatchObject(expected);
      expect(JSON.stringify(result)).not.toContain(error.message);
      expect(
        harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY),
      ).toBe(true);
      expect(harness.api.confirmPaymentOperation).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects structurally inexact callback tuples before durable or network I/O", async () => {
    const harness = createHarness();
    const inexact = { ...callback(), providerCode: "secret" };

    expect(
      harness
        .createWorkflow()
        .claimCallback(inexact as BookingPaymentSuccessCallback),
    ).toEqual({ status: "invalid-callback" });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(harness.values.has(BOOKING_PAYMENT_V2_CALLBACK_CREDENTIAL_KEY)).toBe(
      false,
    );
  });

  it("rejects an expired first capture without confirming", async () => {
    const harness = createHarness();

    expect(
      harness
        .createWorkflow()
        .claimCallback(callback({ firstCapturedAt: initialNow - 10 * 60_000 })),
    ).toMatchObject({ status: "recovery-unavailable" });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
  });

  it("uses one exact confirm promise and aborts it on disposal", async () => {
    const harness = createHarness();
    let resolveAccepted!: (value: { operationId: string }) => void;
    vi.mocked(harness.api.confirmPaymentOperation).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAccepted = resolve;
      }),
    );
    const workflow = harness.createWorkflow();
    expect(workflow.claimCallback(callback())).toEqual({
      status: "confirmation-ready",
      reference: resumeReference,
    });

    const first = workflow.resumeConfirmation(resumeReference);
    const duplicate = workflow.resumeConfirmation(resumeReference);
    expect(duplicate).toBe(first);
    await expect(
      workflow.resumeConfirmation({
        ...resumeReference,
        flowId: otherOperationId,
      }),
    ).resolves.toEqual({ status: "busy" });
    const signal = vi.mocked(harness.api.confirmPaymentOperation).mock
      .calls[0]?.[1]?.signal;
    workflow.dispose();
    expect(signal?.aborted).toBe(true);
    resolveAccepted({ operationId });
    await expect(first).resolves.toEqual({ status: "stale" });
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      false,
    );
  });

  it("persists review, pending, processing, and terminal observations in order", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    vi.mocked(harness.api.getPaymentOperation)
      .mockResolvedValueOnce(
        operationDetail({
          status: "REQUIRES_REVIEW",
          updatedAt: "2026-09-01T10:01:00Z",
          nextAction: "CONTACT_SUPPORT",
          retryAfterSeconds: 99,
          serverTime: "2026-09-01T10:01:01Z",
          userFailureCode: "PAYMENT_REVIEW_REQUIRED",
        }),
      )
      .mockResolvedValueOnce(
        operationDetail({
          status: "PENDING",
          updatedAt: "2026-09-01T10:02:00Z",
          retryAfterSeconds: 1,
          serverTime: "2026-09-01T10:02:01Z",
        }),
      )
      .mockResolvedValueOnce(
        operationDetail({
          status: "PROCESSING",
          updatedAt: "2026-09-01T10:03:00Z",
          retryAfterSeconds: 8,
          serverTime: "2026-09-01T10:03:01Z",
        }),
      )
      .mockResolvedValueOnce(
        operationDetail({
          status: "SUCCEEDED",
          updatedAt: "2026-09-01T10:04:00Z",
          nextAction: "NONE",
          retryAfterSeconds: null,
          serverTime: "2026-09-01T10:04:01Z",
        }),
      );
    const workflow = harness.createWorkflow();

    await expect(workflow.pollOperation(reference)).resolves.toMatchObject({
      status: "unresolved",
      observation: { status: "REQUIRES_REVIEW", retryAfterSeconds: 30 },
    });
    await expect(workflow.pollOperation(reference)).resolves.toMatchObject({
      status: "unresolved",
      observation: { status: "PENDING", retryAfterSeconds: 2 },
    });
    await expect(workflow.pollOperation(reference)).resolves.toMatchObject({
      status: "unresolved",
      observation: { status: "PROCESSING", retryAfterSeconds: 8 },
    });
    await expect(workflow.pollOperation(reference)).resolves.toMatchObject({
      status: "succeeded",
      observation: { status: "SUCCEEDED" },
    });
    expect(harness.api.getPaymentOperation).toHaveBeenCalledTimes(4);

    const stored = harness.repository.recoveryRecords.readReceiptAuthority({
      owner,
      lease: {
        runtimeLeaseId: reloadScope.runtimeLeaseId,
        sessionEpoch: reloadScope.epoch,
      },
      ...reference,
      isCurrent: () => true,
    });
    expect(stored).toMatchObject({
      status: "found",
      authority: { observation: { status: "SUCCEEDED" } },
    });
  });

  it("preserves the receipt on a poll network failure and uses the durable retry hint", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    vi.mocked(harness.api.getPaymentOperation)
      .mockResolvedValueOnce(operationDetail({ retryAfterSeconds: 7 }))
      .mockRejectedValueOnce(
        new AppError({
          kind: "network",
          code: "NETWORK_ERROR",
          message: "offline",
          retryable: true,
          cause: new TypeError("Failed to fetch"),
        }),
      );
    const workflow = harness.createWorkflow();
    await workflow.pollOperation(reference);

    await expect(workflow.pollOperation(reference)).resolves.toEqual({
      status: "retryable",
      reference,
      retryAfterSeconds: 7,
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );
  });

  it.each([
    [
      "retryable HTTP",
      new AppError({
        kind: "http",
        code: "HTTP_ERROR",
        message: "service unavailable",
        status: 503,
        retryable: true,
      }),
      "retryable",
    ],
    [
      "unknown transport",
      new AppError({
        kind: "unknown",
        code: "UNKNOWN_ERROR",
        message: "transport failed",
      }),
      "retryable",
    ],
    [
      "authentication",
      new AppError({
        kind: "authentication",
        code: "AUTH_REQUIRED",
        message: "session expired",
      }),
      "recovery-unavailable",
    ],
    ["opaque runtime", new Error("socket unavailable"), "retryable"],
    [
      "nested mapper invariant",
      { cause: new TypeError("invalid operation detail") },
      "recovery-unavailable",
    ],
  ] as const)(
    "classifies a %s poll failure without discarding its receipt",
    async (_label, error, expectedStatus) => {
      const harness = createHarness();
      await seedReceipt(harness);
      harness.setScope(reloadScope);
      vi.mocked(harness.api.getPaymentOperation).mockRejectedValueOnce(error);

      await expect(
        harness.createWorkflow().pollOperation(reference),
      ).resolves.toMatchObject({ status: expectedStatus });
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
    },
  );

  it.each([
    ["identity mismatch", operationDetail({ operationId: otherOperationId })],
    ["pending invariant", operationDetail({ nextAction: "NONE" } as never)],
    [
      "review invariant",
      operationDetail({
        status: "REQUIRES_REVIEW",
        nextAction: "CONTACT_SUPPORT",
        userFailureCode: null,
      } as never),
    ],
    [
      "success invariant",
      operationDetail({
        status: "SUCCEEDED",
        nextAction: "NONE",
        retryAfterSeconds: 1,
      } as never),
    ],
    [
      "failure invariant",
      operationDetail({
        status: "FAILED",
        nextAction: "START_NEW_CHECKOUT",
        retryAfterSeconds: null,
        userFailureCode: null,
      } as never),
    ],
    ["unknown status", operationDetail({ status: "UNKNOWN" } as never)],
  ] as const)(
    "rejects a %s operation observation without persisting it",
    async (_label, detail) => {
      const harness = createHarness();
      await seedReceipt(harness);
      harness.setScope(reloadScope);
      vi.mocked(harness.api.getPaymentOperation).mockResolvedValueOnce(detail);

      await expect(
        harness.createWorkflow().pollOperation(reference),
      ).resolves.toMatchObject({ status: "recovery-unavailable" });
      expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
        true,
      );
    },
  );

  it("fails a poll adapter invariant closed while preserving its receipt", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    vi.mocked(harness.api.getPaymentOperation).mockRejectedValueOnce(
      new TypeError("operation identity mismatch"),
    );

    await expect(
      harness.createWorkflow().pollOperation(reference),
    ).resolves.toMatchObject({ status: "recovery-unavailable" });
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );
  });

  it("accepts equal-updatedAt monotonic refreshes and rejects an older server observation", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    vi.mocked(harness.api.getPaymentOperation)
      .mockResolvedValueOnce(
        operationDetail({
          retryAfterSeconds: 4,
          serverTime: "2026-09-01T10:01:01Z",
        }),
      )
      .mockResolvedValueOnce(
        operationDetail({
          retryAfterSeconds: 9,
          serverTime: "2026-09-01T10:01:02Z",
        }),
      )
      .mockResolvedValueOnce(
        operationDetail({
          retryAfterSeconds: 5,
          serverTime: "2026-09-01T10:01:01.500Z",
        }),
      );
    const workflow = harness.createWorkflow();

    await workflow.pollOperation(reference);
    await expect(workflow.pollOperation(reference)).resolves.toMatchObject({
      status: "unresolved",
      observation: { retryAfterSeconds: 9 },
    });
    await expect(workflow.pollOperation(reference)).resolves.toMatchObject({
      status: "recovery-unavailable",
    });
    const stored = JSON.parse(
      harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) ?? "null",
    ) as { data: { observation: { retryAfterSeconds: number } } };
    expect(stored.data.observation.retryAfterSeconds).toBe(9);
  });

  it("never polls forged, missing, expired, or stale receipt authority", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    vi.mocked(harness.api.confirmPaymentOperation).mockClear();
    vi.mocked(harness.api.getPaymentOperation).mockClear();
    const workflow = harness.createWorkflow();

    await expect(
      workflow.pollOperation({ ...reference, operationId: otherOperationId }),
    ).resolves.toMatchObject({ status: "recovery-unavailable" });
    expect(harness.api.getPaymentOperation).not.toHaveBeenCalled();

    harness.setSessionCurrent(false);
    await expect(workflow.pollOperation(reference)).resolves.toEqual({
      status: "stale",
    });
    expect(harness.api.getPaymentOperation).not.toHaveBeenCalled();

    harness.setSessionCurrent(true);
    harness.setNow(initialNow + 24 * 60 * 60_000 + 1);
    await expect(workflow.pollOperation(reference)).resolves.toEqual({
      status: "verified-expired",
      reference,
      fallback: { kind: "reservation-detail", reservationUid },
    });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(harness.api.getPaymentOperation).not.toHaveBeenCalled();
    expect(harness.values.size).toBe(0);

    harness.setNow(initialNow);
    harness.values.set(
      BOOKING_PAYMENT_V2_JOURNAL_KEY,
      JSON.stringify({
        ...journal(),
        data: { ...journalData(), flowId: otherOperationId },
      }),
    );
    expect(harness.createWorkflow().claimCallback(callback())).toEqual({
      status: "confirmation-ready",
      reference: {
        ...resumeReference,
        flowId: otherOperationId,
      },
    });

    const missing = createHarness();
    missing.values.delete(BOOKING_PAYMENT_V2_JOURNAL_KEY);
    await expect(
      missing.createWorkflow().pollOperation(reference),
    ).resolves.toMatchObject({ status: "recovery-unavailable" });
    expect(missing.api.getPaymentOperation).not.toHaveBeenCalled();

    const malformed = createHarness();
    malformed.values.delete(BOOKING_PAYMENT_V2_JOURNAL_KEY);
    malformed.values.set(
      BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY,
      JSON.stringify({ purpose: "forged" }),
    );
    await expect(
      malformed.createWorkflow().pollOperation(reference),
    ).resolves.toMatchObject({ status: "recovery-unavailable" });
    expect(malformed.api.getPaymentOperation).not.toHaveBeenCalled();
  });

  it("keeps expired receipt authority when the exact handle is forged or an unknown/newer record is present", async () => {
    const forged = createHarness();
    await seedReceipt(forged);
    forged.setScope(reloadScope);
    forged.setNow(initialNow + 24 * 60 * 60_000 + 1);

    await expect(
      forged
        .createWorkflow()
        .pollOperation({ ...reference, operationId: otherOperationId }),
    ).resolves.toMatchObject({ status: "recovery-unavailable" });
    expect(forged.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );

    const opaque = createHarness();
    await seedReceipt(opaque);
    opaque.setScope(reloadScope);
    opaque.setNow(initialNow + 24 * 60 * 60_000 + 1);
    opaque.values.set("airbob:booking-payment-v2:future-record", "opaque");

    await expect(
      opaque.createWorkflow().pollOperation(reference),
    ).resolves.toMatchObject({ status: "recovery-unavailable" });
    expect(opaque.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );
    expect(opaque.values.has("airbob:booking-payment-v2:future-record")).toBe(
      true,
    );
    expect(opaque.api.getPaymentOperation).not.toHaveBeenCalled();
  });

  it("uses one exact poll lane and aborts it on disposal", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    let resolveDetail!: (value: ReturnType<typeof operationDetail>) => void;
    vi.mocked(harness.api.getPaymentOperation).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDetail = resolve;
      }),
    );
    const workflow = harness.createWorkflow();

    const first = workflow.pollOperation(reference);
    const duplicate = workflow.pollOperation(reference);
    expect(duplicate).toBe(first);
    await expect(
      workflow.pollOperation({ ...reference, operationId: otherOperationId }),
    ).resolves.toEqual({ status: "busy" });
    const signal = vi.mocked(harness.api.getPaymentOperation).mock.calls[0]?.[2]
      ?.signal;
    workflow.dispose();
    expect(signal?.aborted).toBe(true);
    resolveDetail(operationDetail());
    await expect(first).resolves.toEqual({ status: "stale" });
    const stored = JSON.parse(
      harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) ?? "null",
    ) as { data: { observation: unknown } };
    expect(stored.data.observation).toBeNull();
  });

  it("does not persist a poll completion after the route or identity becomes stale", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    let resolveDetail!: (value: ReturnType<typeof operationDetail>) => void;
    vi.mocked(harness.api.getPaymentOperation).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDetail = resolve;
      }),
    );
    const workflow = harness.createWorkflow();

    const pending = workflow.pollOperation(reference);
    harness.setRouteCurrent(false);
    resolveDetail(operationDetail());

    await expect(pending).resolves.toEqual({ status: "stale" });
    const stored = JSON.parse(
      harness.values.get(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY) ?? "null",
    ) as { data: { observation: unknown } };
    expect(stored.data.observation).toBeNull();
  });

  it("acknowledges terminal UI publication with receipt-last cleanup and retries a failed removal", async () => {
    const harness = createHarness({
      noOpRemoveKeys: new Set([BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY]),
    });
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    vi.mocked(harness.api.getPaymentOperation).mockResolvedValueOnce(
      operationDetail({
        status: "FAILED",
        updatedAt: "2026-09-01T10:02:00Z",
        nextAction: "START_NEW_CHECKOUT",
        retryAfterSeconds: null,
        userFailureCode: "PAYMENT_DECLINED",
        serverTime: "2026-09-01T10:02:01Z",
      }),
    );
    const workflow = harness.createWorkflow();
    await workflow.pollOperation(reference);

    expect(workflow.acknowledgeTerminal(reference)).toEqual({
      status: "retryable",
      fallback: { kind: "reservation-detail", reservationUid },
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );
  });

  it("removes the terminal receipt only through explicit UI acknowledgment", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);
    vi.mocked(harness.api.getPaymentOperation).mockResolvedValueOnce(
      operationDetail({
        status: "SUCCEEDED",
        updatedAt: "2026-09-01T10:02:00Z",
        nextAction: "NONE",
        retryAfterSeconds: null,
        serverTime: "2026-09-01T10:02:01Z",
      }),
    );
    const workflow = harness.createWorkflow();
    await workflow.pollOperation(reference);
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );

    expect(workflow.acknowledgeTerminal(reference)).toEqual({
      status: "acknowledged",
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      false,
    );
  });

  it("requires a persisted terminal observation before acknowledgment", async () => {
    const harness = createHarness();
    await seedReceipt(harness);
    harness.setScope(reloadScope);

    expect(harness.createWorkflow().acknowledgeTerminal(reference)).toEqual({
      status: "not-terminal",
    });
    expect(harness.values.has(BOOKING_PAYMENT_V2_OPERATION_RECEIPT_KEY)).toBe(
      true,
    );
  });

  it("fences every public recovery command when authentication is absent", async () => {
    const harness = createHarness();
    harness.setScope(null);
    const workflow = harness.createWorkflow();

    expect(workflow.claimCallback(callback())).toEqual({
      status: "auth-required",
    });
    expect(workflow.recoverClaimedCallback(reservationUid)).toEqual({
      status: "auth-required",
    });
    await expect(workflow.resumeConfirmation(resumeReference)).resolves.toEqual(
      { status: "auth-required" },
    );
    await expect(workflow.pollOperation(reference)).resolves.toEqual({
      status: "auth-required",
    });
    expect(workflow.acknowledgeTerminal(reference)).toEqual({
      status: "auth-required",
    });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(harness.api.getPaymentOperation).not.toHaveBeenCalled();
  });

  it("fences every public recovery command when the session lease is stale", async () => {
    const harness = createHarness();
    harness.setSessionCurrent(false);
    const workflow = harness.createWorkflow();

    expect(workflow.claimCallback(callback())).toEqual({ status: "stale" });
    expect(workflow.recoverClaimedCallback(reservationUid)).toEqual({
      status: "stale",
    });
    await expect(workflow.resumeConfirmation(resumeReference)).resolves.toEqual(
      { status: "stale" },
    );
    await expect(workflow.pollOperation(reference)).resolves.toEqual({
      status: "stale",
    });
    expect(workflow.acknowledgeTerminal(reference)).toEqual({
      status: "stale",
    });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(harness.api.getPaymentOperation).not.toHaveBeenCalled();
  });

  it("fences every public recovery command when the route lease is stale", async () => {
    const harness = createHarness();
    harness.setRouteCurrent(false);
    const workflow = harness.createWorkflow();

    expect(workflow.claimCallback(callback())).toEqual({ status: "stale" });
    expect(workflow.recoverClaimedCallback(reservationUid)).toEqual({
      status: "stale",
    });
    await expect(workflow.resumeConfirmation(resumeReference)).resolves.toEqual(
      { status: "stale" },
    );
    await expect(workflow.pollOperation(reference)).resolves.toEqual({
      status: "stale",
    });
    expect(workflow.acknowledgeTerminal(reference)).toEqual({
      status: "stale",
    });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(harness.api.getPaymentOperation).not.toHaveBeenCalled();
  });

  it("rejects inexact public recovery handles before storage or network I/O", async () => {
    const harness = createHarness();
    const workflow = harness.createWorkflow();
    const inexactResume = {
      ...resumeReference,
      providerCredential: "must-not-be-accepted",
    };
    const inexactOperation = {
      ...reference,
      providerCredential: "must-not-be-accepted",
    };

    expect(workflow.recoverClaimedCallback("not-a-reservation-uuid")).toEqual({
      status: "invalid-callback",
    });
    await expect(
      workflow.resumeConfirmation(
        inexactResume as BookingPaymentConfirmationResumeReferenceState,
      ),
    ).resolves.toEqual({ status: "invalid-reference" });
    await expect(
      workflow.pollOperation(
        inexactOperation as BookingPaymentOperationReference,
      ),
    ).resolves.toEqual({ status: "invalid-reference" });
    expect(
      workflow.acknowledgeTerminal(
        inexactOperation as BookingPaymentOperationReference,
      ),
    ).toEqual({ status: "invalid-reference" });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(harness.api.getPaymentOperation).not.toHaveBeenCalled();
  });

  it("fails closed when the route lease check throws and disposal stays idempotent", async () => {
    const harness = createHarness();
    const workflow = createBookingPaymentRecoveryWorkflow({
      api: harness.api,
      repository: harness.repository,
      routeLease: {
        isCurrent: () => {
          throw new Error("route lease unavailable");
        },
      },
      session: {
        captureAuthenticatedSession: () => currentScope,
        isCurrentSession: () => true,
      },
    });

    expect(workflow.claimCallback(callback())).toEqual({ status: "stale" });
    workflow.dispose();
    workflow.dispose();
    await expect(workflow.pollOperation(reference)).resolves.toEqual({
      status: "stale",
    });
    expect(harness.api.confirmPaymentOperation).not.toHaveBeenCalled();
    expect(harness.api.getPaymentOperation).not.toHaveBeenCalled();
  });
});
