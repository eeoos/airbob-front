import type {
  ReservationBookingApiPort,
  ReservationQuote,
  ReservationReady,
} from "../../../../features/reservations/booking/public";
import type { PaymentOperationApiPort } from "../../../../features/reservations/payment/public";
import { AppError } from "../../../../platform/http/errors";
import type { SessionRuntimeLeaseId } from "../../../../platform/session/runtimeLeaseId";
import type { SessionSubject } from "../../../../platform/session/sessionScope";
import { createSessionStorageDriver } from "../../../../platform/storage/sessionStorageDriverCore";
import {
  PaymentGatewayError,
  type PaymentGatewayRequest,
} from "../../checkout/paymentGateway";
import { createBookingPaymentJournalRepository } from "../../journal/repository";
import { clearTerminalBookingPaymentBrowserState } from "../../journal/retiredState";
import { createBookingTransactionWorkflow } from "./bookingTransaction";
import type {
  BookingTransactionHandle,
  BookingTransactionQuoteInput,
  BookingTransactionWorkflow,
} from "./types";

const JOURNAL_KEY = "airbob:booking-payment-v2:journal";
const FLOW_ID = "10000000-0000-4000-8000-000000000001";
const IDEMPOTENCY_ID = "20000000-0000-4000-8000-000000000002";
const QUOTE_UID = "30000000-0000-4000-8000-000000000003";
const RESERVATION_UID = "40000000-0000-4000-8000-000000000004";
const ATTEMPT_ID = "50000000-0000-4000-8000-000000000005";
const RUNTIME_LEASE_ID =
  "60000000-0000-4000-8000-000000000006" as SessionRuntimeLeaseId;
const NOW = Date.parse("2026-09-01T10:00:00Z");

const scope = {
  subject: "subject:booking_member" as SessionSubject,
  epoch: 4,
  runtimeLeaseId: RUNTIME_LEASE_ID,
};

const paidQuote = (
  overrides: Partial<ReservationQuote> = {},
): ReservationQuote => ({
  quoteUid: QUOTE_UID,
  accommodationId: 7,
  orderName: "합정 테스트 숙소 2박",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  guestCount: 3,
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
  ...overrides,
});

const paidReady = (
  overrides: Partial<ReservationReady> = {},
): ReservationReady => ({
  reservationUid: RESERVATION_UID,
  orderName: "합정 테스트 숙소 2박",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  guestCount: 3,
  subtotal: 2_000,
  discountAmount: 100,
  amount: 1_900,
  currency: "KRW",
  status: "PAYMENT_PENDING",
  paymentRequired: true,
  paymentAllowed: true,
  holdExpiresAt: "2026-09-01T10:15:00Z",
  serverTime: "2026-09-01T10:00:00Z",
  ...overrides,
});

const quoteInput = (): BookingTransactionQuoteInput => ({
  intent: {
    type: "reservation.start",
    accommodationId: 7,
    checkIn: "2026-09-10",
    checkOut: "2026-09-12",
    adultCount: 2,
    childCount: 1,
    infantCount: 1,
    petCount: 0,
    couponId: 31,
  },
  accommodation: {
    id: 7,
    maxOccupancy: 4,
    maxInfants: 2,
    maxPets: 1,
  },
  availability: {
    accommodationId: 7,
    bookingWindowStartInclusive: "2026-09-01",
    bookingWindowEndExclusive: "2027-01-01",
    unavailableRanges: [],
  },
  appliedCoupon: { id: 31, name: "가을 쿠폰", discount: 100 },
  publishPreparedHandle: () => true,
  routeLease: { isCurrent: () => true },
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createStorageHarness = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries));
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  return {
    values,
    driver: createSessionStorageDriver({ getStorage: () => storage }),
  };
};

const phase = (values: Map<string, string>): string | null => {
  const raw = values.get(JOURNAL_KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as { data: { phase: string } }).data.phase;
};

interface WorkflowHarnessOptions {
  readonly quote?: ReservationQuote;
  readonly ready?: ReservationReady;
  readonly bookingApi?: ReservationBookingApiPort;
  readonly paymentApi?: Pick<
    PaymentOperationApiPort,
    "beginPaymentAttempt" | "releaseHold"
  >;
  readonly journal?: ReturnType<typeof createBookingPaymentJournalRepository>;
  readonly gateway?: {
    prepare: ReturnType<typeof vi.fn<() => Promise<void>>>;
    requestPayment: ReturnType<
      typeof vi.fn<(input: PaymentGatewayRequest) => Promise<void>>
    >;
  };
}

const createWorkflowHarness = (options: WorkflowHarnessOptions = {}) => {
  const storage = createStorageHarness();
  const journal =
    options.journal ??
    createBookingPaymentJournalRepository({
      driver: storage.driver,
      now: () => NOW,
    });
  const createQuote = vi.fn<ReservationBookingApiPort["createQuote"]>();
  createQuote.mockResolvedValue(options.quote ?? paidQuote());
  const checkout = vi.fn<ReservationBookingApiPort["checkout"]>();
  checkout.mockResolvedValue(options.ready ?? paidReady());
  const bookingApi: ReservationBookingApiPort = options.bookingApi ?? {
    createQuote,
    checkout,
  };
  const beginPaymentAttempt =
    vi.fn<PaymentOperationApiPort["beginPaymentAttempt"]>();
  beginPaymentAttempt.mockResolvedValue({
    paymentAttemptId: ATTEMPT_ID,
    orderId: RESERVATION_UID,
    amount: 1_900,
    currency: "KRW",
    holdExpiresAt: "2026-09-01T10:15:00Z",
    remainingSeconds: 900,
    serverTime: "2026-09-01T10:00:00Z",
  });
  const releaseHold = vi.fn<PaymentOperationApiPort["releaseHold"]>();
  releaseHold.mockResolvedValue({
    reservationUid: RESERVATION_UID,
    status: "EXPIRED",
    releasedNow: true,
    serverTime: "2026-09-01T10:01:00Z",
  });
  const paymentApi = options.paymentApi ?? {
    beginPaymentAttempt,
    releaseHold,
  };
  const gateway = options.gateway ?? {
    prepare: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    requestPayment: vi
      .fn<(input: PaymentGatewayRequest) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  let currentSession = true;
  const ids = [FLOW_ID, IDEMPOTENCY_ID];
  const workflow = createBookingTransactionWorkflow({
    bookingApi,
    paymentApi,
    gateway,
    session: {
      captureAuthenticatedSession: () => scope,
      isCurrentSession: () => currentSession,
    },
    journal,
    clearRetiredState: () =>
      clearTerminalBookingPaymentBrowserState({ driver: storage.driver }),
    createUuid: () => {
      const value = ids.shift();
      if (!value) throw new Error("No test UUID remains.");
      return value;
    },
    fingerprint: async () => "f".repeat(43),
  });

  return {
    workflow,
    storage,
    journal,
    bookingApi,
    createQuote,
    checkout,
    paymentApi,
    beginPaymentAttempt,
    releaseHold,
    gateway,
    setSessionCurrent(value: boolean) {
      currentSession = value;
    },
  };
};

const requireQuotedHandle = async (
  workflow: BookingTransactionWorkflow,
  input: BookingTransactionQuoteInput = quoteInput(),
): Promise<BookingTransactionHandle> => {
  const result = await workflow.quote(input);
  if (result.status !== "quoted") {
    throw new Error(`Expected quoted, received ${result.status}.`);
  }
  return result.handle;
};

const requirePaymentHandle = async (
  workflow: BookingTransactionWorkflow,
): Promise<BookingTransactionHandle> => {
  const quotedHandle = await requireQuotedHandle(workflow);
  const result = await workflow.checkout({
    handle: quotedHandle,
    routeLease: { isCurrent: () => true },
  });
  if (result.status !== "payment-ready") {
    throw new Error(`Expected payment-ready, received ${result.status}.`);
  }
  return result.handle;
};

const payInput = (handle: BookingTransactionHandle) => ({
  handle,
  routeLease: { isCurrent: () => true },
  customer: { email: "guest@example.test", name: "테스트 게스트" },
  successUrl: `http://localhost:5173/reservations/${RESERVATION_UID}/success`,
  failUrl: `http://localhost:5173/reservations/${RESERVATION_UID}/fail`,
});

const retryableNetworkError = () =>
  new AppError({
    kind: "network",
    code: "NETWORK_ERROR",
    message: "safe generic message",
    retryable: true,
  });

describe("booking transaction workflow", () => {
  it("single-flights a double quote click and purges retired state before creating a flow", async () => {
    const pendingQuote = deferred<ReservationQuote>();
    const events: string[] = [];
    const storage = createStorageHarness({
      "airbob:booking-payment-v1:checkout": "retired",
    });
    const createQuote = vi
      .fn<ReservationBookingApiPort["createQuote"]>()
      .mockImplementation(async () => {
        events.push("quote");
        return pendingQuote.promise;
      });
    const createUuid = vi.fn(() => {
      events.push("uuid");
      return FLOW_ID;
    });
    const workflow = createBookingTransactionWorkflow({
      bookingApi: { createQuote, checkout: vi.fn() },
      paymentApi: { beginPaymentAttempt: vi.fn(), releaseHold: vi.fn() },
      gateway: { prepare: vi.fn(), requestPayment: vi.fn() },
      session: {
        captureAuthenticatedSession: () => scope,
        isCurrentSession: () => true,
      },
      journal: createBookingPaymentJournalRepository({
        driver: storage.driver,
        now: () => NOW,
      }),
      clearRetiredState: () => {
        events.push("cleanup");
        return clearTerminalBookingPaymentBrowserState({
          driver: storage.driver,
        });
      },
      createUuid,
    });

    const first = workflow.quote(quoteInput());
    const second = workflow.quote(quoteInput());
    expect(first).toBe(second);
    await vi.waitFor(() => expect(createQuote).toHaveBeenCalledOnce());
    expect(events).toEqual(["cleanup", "uuid", "quote"]);
    expect(storage.values.has("airbob:booking-payment-v1:checkout")).toBe(
      false,
    );

    pendingQuote.resolve(paidQuote());
    await expect(first).resolves.toMatchObject({ status: "quoted" });
  });

  it("publishes the first flow handle before quote I/O and blocks an unverified publication", async () => {
    const harness = createWorkflowHarness();
    const events: string[] = [];
    harness.createQuote.mockImplementation(async () => {
      events.push("quote-request");
      return paidQuote();
    });
    const published = vi.fn(() => {
      events.push("history-readback");
      return true;
    });

    await expect(
      harness.workflow.quote({
        ...quoteInput(),
        publishPreparedHandle: published,
      }),
    ).resolves.toMatchObject({ status: "quoted", handle: { flowId: FLOW_ID } });
    expect(published).toHaveBeenCalledWith({
      flowId: FLOW_ID,
      locator: { kind: "accommodation", accommodationId: 7 },
    });
    expect(events).toEqual(["history-readback", "quote-request"]);

    const blockedHarness = createWorkflowHarness();
    await expect(
      blockedHarness.workflow.quote({
        ...quoteInput(),
        publishPreparedHandle: () => false,
      }),
    ).resolves.toEqual({
      status: "blocked",
      reason: "persistence-unavailable",
    });
    expect(blockedHarness.createQuote).not.toHaveBeenCalled();
    expect(blockedHarness.storage.values.has(JOURNAL_KEY)).toBe(false);
  });

  it("never overwrites an active flow reference before quote publication", async () => {
    const harness = createWorkflowHarness();
    await expect(harness.workflow.quote(quoteInput())).resolves.toMatchObject({
      status: "quoted",
      handle: { flowId: FLOW_ID },
    });
    const publishPreparedHandle = vi.fn(() => true);

    await expect(
      harness.workflow.quote({
        ...quoteInput(),
        publishPreparedHandle,
      }),
    ).resolves.toEqual({
      status: "blocked",
      reason: "recovery-required",
    });
    expect(publishPreparedHandle).not.toHaveBeenCalled();
    expect(harness.createQuote).toHaveBeenCalledOnce();
    expect(harness.storage.values.get(JOURNAL_KEY)).toContain(FLOW_ID);
  });

  it("persists one exact checkout body, key, and SHA-256 input across response loss", async () => {
    const harness = createWorkflowHarness();
    const fingerprint = vi.fn(async () => "f".repeat(43));
    const workflow = createBookingTransactionWorkflow({
      bookingApi: harness.bookingApi,
      paymentApi: harness.paymentApi,
      gateway: harness.gateway,
      session: {
        captureAuthenticatedSession: () => scope,
        isCurrentSession: () => true,
      },
      journal: harness.journal,
      clearRetiredState: () => ({ status: "cleared", removed: 0 }),
      createUuid: vi
        .fn()
        .mockReturnValueOnce(FLOW_ID)
        .mockReturnValueOnce(IDEMPOTENCY_ID),
      fingerprint,
    });
    const handle = await requireQuotedHandle(workflow);
    harness.checkout
      .mockRejectedValueOnce(retryableNetworkError())
      .mockResolvedValueOnce(paidReady());

    await expect(
      workflow.checkout({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toMatchObject({ status: "retryable-error", stage: "checkout" });
    expect(phase(harness.storage.values)).toBe("checkout-submitting");

    await expect(
      workflow.checkout({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toMatchObject({ status: "payment-ready" });
    expect(fingerprint).toHaveBeenCalledExactlyOnceWith(
      `{"quote_uid":"${QUOTE_UID}","request_message":null}`,
    );
    expect(harness.checkout).toHaveBeenCalledTimes(2);
    expect(harness.checkout.mock.calls[0]?.[0]).toEqual(
      harness.checkout.mock.calls[1]?.[0],
    );
    expect(harness.checkout.mock.calls[0]?.[0].idempotencyKey).toBe(
      IDEMPOTENCY_ID,
    );
  });

  it.each([
    [
      paidQuote({
        nightlyPrice: 100,
        subtotal: 200,
        discountAmount: 101,
        amount: 99,
      }),
      "amount",
    ],
    [paidQuote({ currency: "USD" }), "currency"],
    [
      paidQuote({
        amount: 2_147_483_648,
        subtotal: 2_147_483_648,
        discountAmount: 0,
        nightlyPrice: 1_073_741_824,
      }),
      "amount",
    ],
  ])(
    "blocks an unsupported positive card quote before creating a hold",
    async (quote, reason) => {
      const harness = createWorkflowHarness({ quote });
      const handle = await requireQuotedHandle(harness.workflow);

      await expect(
        harness.workflow.checkout({
          handle,
          routeLease: { isCurrent: () => true },
        }),
      ).resolves.toMatchObject({ status: "unsupported-payment", reason });
      expect(harness.checkout).not.toHaveBeenCalled();
      expect(phase(harness.storage.values)).toBe("quoted");
      expect(
        harness.workflow.abandonUnheld({
          handle,
          routeLease: { isCurrent: () => true },
        }),
      ).toEqual({ status: "abandoned" });
      expect(harness.storage.values.has(JOURNAL_KEY)).toBe(false);
    },
  );

  it("never calls checkout when the prepared journal write cannot be verified", async () => {
    const storage = createStorageHarness();
    const baseJournal = createBookingPaymentJournalRepository({
      driver: storage.driver,
      now: () => NOW,
    });
    const replaceExpectedPhase = vi
      .fn<typeof baseJournal.replaceExpectedPhase>()
      .mockImplementation((input) =>
        input.expectedPhase === "quoted"
          ? { status: "rejected", reason: "write-not-verified" }
          : baseJournal.replaceExpectedPhase(input),
      );
    const checkout = vi.fn<ReservationBookingApiPort["checkout"]>();
    const workflow = createBookingTransactionWorkflow({
      bookingApi: {
        createQuote: vi.fn().mockResolvedValue(paidQuote()),
        checkout,
      },
      paymentApi: { beginPaymentAttempt: vi.fn(), releaseHold: vi.fn() },
      gateway: { prepare: vi.fn(), requestPayment: vi.fn() },
      session: {
        captureAuthenticatedSession: () => scope,
        isCurrentSession: () => true,
      },
      journal: { ...baseJournal, replaceExpectedPhase },
      clearRetiredState: () => ({ status: "cleared", removed: 0 }),
      createUuid: vi
        .fn()
        .mockReturnValueOnce(FLOW_ID)
        .mockReturnValueOnce(IDEMPOTENCY_ID),
      fingerprint: async () => "f".repeat(43),
    });
    const handle = await requireQuotedHandle(workflow);

    await expect(
      workflow.checkout({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toEqual({
      status: "blocked",
      reason: "persistence-unavailable",
    });
    expect(checkout).not.toHaveBeenCalled();
  });

  it.each(["R016", "R020"] as const)(
    "fails closed on checkout conflict %s without deleting exact replay state",
    async (code) => {
      const harness = createWorkflowHarness();
      const handle = await requireQuotedHandle(harness.workflow);
      harness.checkout.mockRejectedValue(
        new AppError({
          kind: "conflict",
          code,
          message: "conflict",
        }),
      );

      await expect(
        harness.workflow.checkout({
          handle,
          routeLease: { isCurrent: () => true },
        }),
      ).resolves.toEqual({ status: "conflict", code });
      expect(phase(harness.storage.values)).toBe("checkout-submitting");
    },
  );

  it.each(["R017", "R018", "R019"] as const)(
    "verified-closes an unheld checkout after definitive rejection %s",
    async (code) => {
      const harness = createWorkflowHarness();
      const handle = await requireQuotedHandle(harness.workflow);
      harness.checkout.mockRejectedValue(
        new AppError({
          kind: "conflict",
          code,
          message: "definitive rejection",
        }),
      );

      await expect(
        harness.workflow.checkout({
          handle,
          routeLease: { isCurrent: () => true },
        }),
      ).resolves.toMatchObject({
        status: "definitive-failure",
        failure: { code, retryable: false },
      });
      expect(harness.storage.values.has(JOURNAL_KEY)).toBe(false);
    },
  );

  it("does not publish or persist a quote after the session becomes stale", async () => {
    const pendingQuote = deferred<ReservationQuote>();
    const harness = createWorkflowHarness({
      bookingApi: {
        createQuote: vi.fn(() => pendingQuote.promise),
        checkout: vi.fn(),
      },
    });
    const pending = harness.workflow.quote(quoteInput());
    await Promise.resolve();
    harness.setSessionCurrent(false);
    pendingQuote.resolve(paidQuote());

    await expect(pending).resolves.toEqual({ status: "stale" });
    expect(harness.storage.values.has(JOURNAL_KEY)).toBe(false);
  });

  it("keeps only checkout-submitting when the route becomes stale after POST", async () => {
    const pendingReady = deferred<ReservationReady>();
    let routeCurrent = true;
    const harness = createWorkflowHarness();
    const handle = await requireQuotedHandle(harness.workflow);
    harness.checkout.mockImplementation(() => pendingReady.promise);
    const pending = harness.workflow.checkout({
      handle,
      routeLease: { isCurrent: () => routeCurrent },
    });
    await vi.waitFor(() => expect(harness.checkout).toHaveBeenCalledOnce());
    routeCurrent = false;
    pendingReady.resolve(paidReady());

    await expect(pending).resolves.toEqual({ status: "stale" });
    expect(phase(harness.storage.values)).toBe("checkout-submitting");
  });

  it("durably observes a complimentary booking without an attempt or gateway call", async () => {
    const quote = paidQuote({
      subtotal: 2_000,
      discountAmount: 2_000,
      amount: 0,
      paymentRequired: false,
    });
    const ready = paidReady({
      subtotal: 2_000,
      discountAmount: 2_000,
      amount: 0,
      status: "CONFIRMED",
      paymentRequired: false,
      paymentAllowed: false,
      holdExpiresAt: null,
    });
    const harness = createWorkflowHarness({ quote, ready });
    const handle = await requireQuotedHandle(harness.workflow);

    const result = await harness.workflow.checkout({
      handle,
      routeLease: { isCurrent: () => true },
    });
    expect(result).toMatchObject({
      status: "complimentary",
      snapshot: {
        amount: 0,
        canPay: false,
        reservationStatus: "CONFIRMED",
      },
    });
    expect(phase(harness.storage.values)).toBe("complimentary-observed");
    expect(harness.beginPaymentAttempt).not.toHaveBeenCalled();
    expect(harness.gateway.requestPayment).not.toHaveBeenCalled();
    if (result.status !== "complimentary") {
      throw new Error("Expected complimentary result.");
    }
    expect(
      harness.workflow.acknowledgeTerminal({
        handle: result.handle,
        routeLease: { isCurrent: () => true },
      }),
    ).toEqual({ status: "acknowledged" });
    expect(harness.storage.values.has(JOURNAL_KEY)).toBe(false);
  });

  it("records a replayed current reservation status instead of offering payment", async () => {
    const harness = createWorkflowHarness({
      ready: paidReady({
        status: "EXPIRED",
        paymentAllowed: false,
        holdExpiresAt: null,
      }),
    });
    const handle = await requireQuotedHandle(harness.workflow);

    await expect(
      harness.workflow.checkout({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toMatchObject({
      status: "reservation-status",
      snapshot: { reservationStatus: "EXPIRED", canPay: false },
    });
    expect(phase(harness.storage.values)).toBe("reservation-status-observed");
  });

  it("rejoins the exact checkout crash window without relaxing mutation locators", async () => {
    const harness = createWorkflowHarness();
    const accommodationHandle = await requireQuotedHandle(harness.workflow);
    const checkoutResult = await harness.workflow.checkout({
      handle: accommodationHandle,
      routeLease: { isCurrent: () => true },
    });
    if (checkoutResult.status !== "payment-ready") {
      throw new Error("Expected payment-ready checkout.");
    }

    expect(
      harness.workflow.load({
        handle: accommodationHandle,
        routeLease: { isCurrent: () => true },
      }),
    ).toEqual({
      status: "ready",
      handle: checkoutResult.handle,
      snapshot: checkoutResult.snapshot,
    });
    await expect(
      harness.workflow.prepareGateway({
        handle: accommodationHandle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toEqual({ status: "blocked", reason: "invalid-authority" });
    await expect(
      harness.workflow.prepareGateway({
        handle: checkoutResult.handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toEqual({ status: "ready" });
  });

  it("prepares the gateway before click without creating a payment attempt", async () => {
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);

    await expect(
      harness.workflow.prepareGateway({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toEqual({ status: "ready" });
    expect(harness.gateway.prepare).toHaveBeenCalledOnce();
    expect(harness.beginPaymentAttempt).not.toHaveBeenCalled();
    expect(phase(harness.storage.values)).toBe("reservation-ready");
  });

  it("prepares a reloaded attempt-requesting journal without replaying the attempt", async () => {
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);
    harness.beginPaymentAttempt.mockRejectedValueOnce(retryableNetworkError());

    await expect(harness.workflow.pay(payInput(handle))).resolves.toMatchObject(
      { status: "retryable-error", stage: "attempt" },
    );
    expect(phase(harness.storage.values)).toBe("attempt-requesting");

    await expect(
      harness.workflow.prepareGateway({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toEqual({ status: "ready" });
    expect(harness.gateway.prepare).toHaveBeenCalledOnce();
    expect(harness.beginPaymentAttempt).toHaveBeenCalledOnce();
    expect(phase(harness.storage.values)).toBe("attempt-requesting");
  });

  it("rejects callback URLs carrying query data or another reservation before an attempt", async () => {
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);

    await expect(
      harness.workflow.pay({
        ...payInput(handle),
        successUrl:
          "http://localhost:5173/reservations/90000000-0000-4000-8000-000000000009/success?flow=secret",
      }),
    ).resolves.toEqual({ status: "invalid-payment-request" });
    expect(harness.beginPaymentAttempt).not.toHaveBeenCalled();
    expect(harness.gateway.requestPayment).not.toHaveBeenCalled();
    expect(phase(harness.storage.values)).toBe("reservation-ready");
  });

  it("replays the same attempt resource after ambiguity and calls Toss only after attempt-ready", async () => {
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);
    harness.beginPaymentAttempt
      .mockRejectedValueOnce(retryableNetworkError())
      .mockResolvedValueOnce({
        paymentAttemptId: ATTEMPT_ID,
        orderId: RESERVATION_UID,
        amount: 1_900,
        currency: "KRW",
        holdExpiresAt: "2026-09-01T10:15:00Z",
        remainingSeconds: 900,
        serverTime: "2026-09-01T10:00:00Z",
      });
    harness.gateway.requestPayment.mockImplementation(async () => {
      expect(phase(harness.storage.values)).toBe("attempt-ready");
    });

    await expect(harness.workflow.pay(payInput(handle))).resolves.toMatchObject(
      {
        status: "retryable-error",
        stage: "attempt",
      },
    );
    expect(phase(harness.storage.values)).toBe("attempt-requesting");

    await expect(harness.workflow.pay(payInput(handle))).resolves.toMatchObject(
      {
        status: "gateway-requested",
        snapshot: { canRetryPayment: true },
      },
    );
    expect(harness.beginPaymentAttempt).toHaveBeenNthCalledWith(
      1,
      RESERVATION_UID,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(harness.beginPaymentAttempt).toHaveBeenNthCalledWith(
      2,
      RESERVATION_UID,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(harness.gateway.requestPayment).toHaveBeenCalledOnce();
  });

  it("preserves a zero-window replayed attempt but never calls Toss", async () => {
    const harness = createWorkflowHarness({
      ready: paidReady({ holdExpiresAt: "2026-09-01T10:00:00.500Z" }),
    });
    const handle = await requirePaymentHandle(harness.workflow);
    harness.beginPaymentAttempt.mockResolvedValue({
      paymentAttemptId: ATTEMPT_ID,
      orderId: RESERVATION_UID,
      amount: 1_900,
      currency: "KRW",
      holdExpiresAt: "2026-09-01T10:00:00.500Z",
      remainingSeconds: 0,
      serverTime: "2026-09-01T10:00:00Z",
    });

    await expect(harness.workflow.pay(payInput(handle))).resolves.toEqual({
      status: "attempt-unavailable",
      failure: { code: "R022", retryable: false },
    });
    expect(phase(harness.storage.values)).toBe("attempt-ready");
    expect(harness.gateway.requestPayment).not.toHaveBeenCalled();

    await expect(harness.workflow.pay(payInput(handle))).resolves.toEqual({
      status: "attempt-unavailable",
      failure: { code: "R022", retryable: false },
    });
    expect(harness.beginPaymentAttempt).toHaveBeenCalledOnce();
    expect(harness.gateway.requestPayment).not.toHaveBeenCalled();

    await expect(
      harness.workflow.releaseHold({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toMatchObject({ status: "released" });
  });

  it("keeps attempt-ready across Toss cancellation and retries without a new attempt", async () => {
    const gateway = {
      prepare: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      requestPayment: vi
        .fn<(input: PaymentGatewayRequest) => Promise<void>>()
        .mockRejectedValueOnce(
          new PaymentGatewayError({
            kind: "cancelled",
            message: "결제가 취소되었습니다.",
            silent: true,
          }),
        )
        .mockResolvedValueOnce(undefined),
    };
    const harness = createWorkflowHarness({ gateway });
    const handle = await requirePaymentHandle(harness.workflow);

    await expect(harness.workflow.pay(payInput(handle))).resolves.toMatchObject(
      {
        status: "gateway-cancelled",
      },
    );
    expect(phase(harness.storage.values)).toBe("attempt-ready");
    await expect(harness.workflow.pay(payInput(handle))).resolves.toMatchObject(
      {
        status: "gateway-requested",
      },
    );
    expect(harness.beginPaymentAttempt).toHaveBeenCalledOnce();
    expect(gateway.requestPayment).toHaveBeenCalledTimes(2);
    expect(gateway.requestPayment.mock.calls[0]?.[0]).toEqual(
      gateway.requestPayment.mock.calls[1]?.[0],
    );
    expect(harness.storage.values.get(JOURNAL_KEY)).not.toContain(
      "guest@example.test",
    );
    expect(harness.storage.values.get(JOURNAL_KEY)).not.toContain(
      "테스트 게스트",
    );
  });

  it("passes the backend-owned Ready order name to Toss byte-for-byte", async () => {
    const backendOrderName = "  이름이 변경된 숙소 2박  ";
    const harness = createWorkflowHarness({
      quote: paidQuote({ orderName: "변경 전 숙소 2박" }),
      ready: paidReady({ orderName: backendOrderName }),
    });
    const handle = await requirePaymentHandle(harness.workflow);

    await expect(harness.workflow.pay(payInput(handle))).resolves.toMatchObject(
      { status: "gateway-requested" },
    );

    expect(harness.gateway.requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderName: backendOrderName }),
    );
  });

  it("single-flights pay and refuses a racing hold release", async () => {
    const pendingAttempt =
      deferred<
        Awaited<ReturnType<PaymentOperationApiPort["beginPaymentAttempt"]>>
      >();
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);
    harness.beginPaymentAttempt.mockImplementation(
      () => pendingAttempt.promise,
    );

    const firstPay = harness.workflow.pay(payInput(handle));
    const secondPay = harness.workflow.pay(payInput(handle));
    expect(firstPay).toBe(secondPay);
    await vi.waitFor(() =>
      expect(harness.beginPaymentAttempt).toHaveBeenCalledOnce(),
    );
    await expect(
      harness.workflow.releaseHold({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toEqual({ status: "busy" });
    expect(harness.releaseHold).not.toHaveBeenCalled();

    pendingAttempt.resolve({
      paymentAttemptId: ATTEMPT_ID,
      orderId: RESERVATION_UID,
      amount: 1_900,
      currency: "KRW",
      holdExpiresAt: "2026-09-01T10:15:00Z",
      remainingSeconds: 900,
      serverTime: "2026-09-01T10:00:00Z",
    });
    await expect(firstPay).resolves.toMatchObject({
      status: "gateway-requested",
    });
  });

  it("replays an ambiguous hold release and accepts only the exact expired result", async () => {
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);
    harness.releaseHold
      .mockRejectedValueOnce(retryableNetworkError())
      .mockResolvedValueOnce({
        reservationUid: RESERVATION_UID,
        status: "EXPIRED",
        releasedNow: false,
        serverTime: "2026-09-01T10:01:00Z",
      });

    await expect(
      harness.workflow.releaseHold({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toMatchObject({ status: "retryable-error", stage: "release" });
    expect(phase(harness.storage.values)).toBe("hold-release-requesting");

    await expect(
      harness.workflow.releaseHold({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toMatchObject({
      status: "released",
      snapshot: { canPay: false, canReleaseHold: false },
    });
    expect(harness.releaseHold).toHaveBeenCalledTimes(2);
    expect(harness.releaseHold.mock.calls[0]?.[0]).toBe(RESERVATION_UID);
    expect(harness.releaseHold.mock.calls[1]?.[0]).toBe(RESERVATION_UID);
    expect(phase(harness.storage.values)).toBe("hold-released");
  });

  it("can explicitly release a hold after an ambiguous attempt request", async () => {
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);
    harness.beginPaymentAttempt.mockRejectedValueOnce(retryableNetworkError());

    await expect(harness.workflow.pay(payInput(handle))).resolves.toMatchObject(
      { status: "retryable-error", stage: "attempt" },
    );
    expect(phase(harness.storage.values)).toBe("attempt-requesting");
    expect(
      harness.workflow.load({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).toMatchObject({
      status: "ready",
      snapshot: { canReleaseHold: true },
    });

    await expect(
      harness.workflow.releaseHold({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toMatchObject({ status: "released" });
    expect(harness.beginPaymentAttempt).toHaveBeenCalledOnce();
    expect(harness.releaseHold).toHaveBeenCalledOnce();
    expect(phase(harness.storage.values)).toBe("hold-released");
  });

  it("stops replaying release when the backend reports state drift", async () => {
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);
    harness.releaseHold.mockRejectedValueOnce(
      new AppError({
        kind: "conflict",
        code: "R021",
        message: "safe generic message",
        retryable: false,
      }),
    );

    await expect(
      harness.workflow.releaseHold({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).resolves.toEqual({ status: "not-releasable" });
    expect(harness.releaseHold).toHaveBeenCalledOnce();
    expect(phase(harness.storage.values)).toBe("hold-release-requesting");
  });

  it("clears an R021/R023 journal only after an exact authoritative status observation", async () => {
    const harness = createWorkflowHarness();
    const handle = await requirePaymentHandle(harness.workflow);
    harness.beginPaymentAttempt.mockRejectedValueOnce(
      new AppError({
        kind: "conflict",
        code: "R023",
        message: "state drift",
        retryable: false,
      }),
    );
    await expect(harness.workflow.pay(payInput(handle))).resolves.toMatchObject(
      { status: "attempt-unavailable", failure: { code: "R023" } },
    );
    expect(phase(harness.storage.values)).toBe("attempt-requesting");

    expect(
      harness.workflow.acknowledgeReservationStatusDrift({
        handle,
        routeLease: { isCurrent: () => true },
        observation: {
          reservationUid: RESERVATION_UID,
          status: "PAYMENT_PENDING",
          paymentAllowed: true,
          holdExpiresAt: "2026-09-01T10:15:00Z",
          serverTime: "2026-09-01T10:01:00Z",
        },
      }),
    ).toEqual({ status: "not-converged" });
    expect(phase(harness.storage.values)).toBe("attempt-requesting");

    expect(
      harness.workflow.acknowledgeReservationStatusDrift({
        handle,
        routeLease: { isCurrent: () => true },
        observation: {
          reservationUid: RESERVATION_UID,
          status: "PAYMENT_PROCESSING",
          paymentAllowed: false,
          holdExpiresAt: null,
          serverTime: "2026-09-01T10:01:00Z",
        },
      }),
    ).toEqual({ status: "acknowledged" });
    expect(harness.storage.values.has(JOURNAL_KEY)).toBe(false);
  });

  it("loads only an exact caller-owned flow and locator while exposing a safe snapshot", async () => {
    const harness = createWorkflowHarness();
    const handle = await requireQuotedHandle(harness.workflow);

    expect(
      harness.workflow.load({
        handle,
        routeLease: { isCurrent: () => true },
      }),
    ).toMatchObject({
      status: "ready",
      snapshot: {
        nightlyPrice: 1_000,
        nights: 2,
        subtotal: 2_000,
        discountAmount: 100,
        couponDisplayName: "적용된 쿠폰",
        canCheckout: true,
      },
    });
    expect(
      harness.workflow.load({
        handle: {
          ...handle,
          locator: { kind: "accommodation", accommodationId: 8 },
        },
        routeLease: { isCurrent: () => true },
      }),
    ).toEqual({ status: "blocked", reason: "invalid-authority" });
  });

  it("aborts active network work and never publishes after disposal", async () => {
    const pendingQuote = deferred<ReservationQuote>();
    let observedSignal: AbortSignal | undefined;
    const harness = createWorkflowHarness({
      bookingApi: {
        createQuote: vi.fn((_input, options) => {
          observedSignal = options?.signal;
          return pendingQuote.promise;
        }),
        checkout: vi.fn(),
      },
    });
    const pending = harness.workflow.quote(quoteInput());
    await vi.waitFor(() => expect(observedSignal).toBeDefined());

    harness.workflow.dispose();
    expect(observedSignal?.aborted).toBe(true);
    pendingQuote.resolve(paidQuote());
    await expect(pending).resolves.toEqual({
      status: "locked",
      terminal: "disposed",
    });
    expect(harness.storage.values.has(JOURNAL_KEY)).toBe(false);
  });
});
