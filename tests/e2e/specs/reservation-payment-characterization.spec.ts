import type { Page } from "@playwright/test";
import {
  apiFailure,
  apiResponseLost,
  apiSuccess,
  requireApiRequest,
  type ApiHarness,
  type ApiResponseSpec,
} from "../fixtures/api";
import {
  installPaymentGatewayFixture,
  readPaymentGatewayCalls,
  releasePaymentGatewayPreparation,
} from "../fixtures/paymentGateway";
import { SYNTHETIC_USER_A, SYNTHETIC_USER_B } from "../fixtures/session";
import { test, expect } from "../fixtures/test";

const JOURNAL_KEY = "airbob:booking-payment-v2:journal";
const CALLBACK_CREDENTIAL_KEY = "airbob:booking-payment-v2:callback-credential";
const OPERATION_RECEIPT_KEY = "airbob:booking-payment-v2:operation-receipt";
const V2_PREFIX = "airbob:booking-payment-v2:";
const OWNER_A = "subject:member_2t";
const OWNER_B = "subject:member_5m";
const FIXED_NOW = Date.parse("2026-07-01T03:00:00Z");
const FLOW_ID = "10000000-0000-4000-8000-000000000001";
const QUOTE_UID = "20000000-0000-4000-8000-000000000001";
const RESERVATION_UID = "30000000-0000-4000-8000-000000000001";
const ATTEMPT_ID = "40000000-0000-4000-8000-000000000001";
const OPERATION_ID = "50000000-0000-4000-8000-000000000001";
const PAYMENT_KEY = "synthetic_payment_key_never_capture";
const CHECK_IN = "2026-07-10";
const CHECK_OUT = "2026-07-12";
const SERVER_TIME = "2026-07-01T03:00:00Z";
const HOLD_EXPIRES_AT = "2026-07-01T03:15:00Z";

const accommodation = {
  id: 7,
  name: "합정 테스트 숙소",
  description: "결제 특성화 테스트용 숙소입니다.",
  type: "ENTIRE_PLACE",
  base_price: 50_000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  time_zone_id: "Asia/Seoul",
  is_in_wishlist: false,
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo-gu",
  },
  coordinate: { latitude: 37.549, longitude: 126.914 },
  host: {
    id: 202,
    nickname: "테스트 호스트",
    thumbnail_image_url: null,
  },
  policy: { max_occupancy: 4, infant_occupancy: 1, pet_occupancy: 1 },
  amenities: [],
  images: [],
  review_summary: { total_count: 0, average_rating: 0 },
};

const accommodationAvailability = {
  booking_window_start_inclusive: "2026-01-01",
  booking_window_end_exclusive: "2027-01-01",
  unavailable_ranges: [],
};

type JournalPhase =
  | "quoted"
  | "checkout-prepared"
  | "checkout-submitting"
  | "complimentary-observed"
  | "reservation-ready"
  | "reservation-status-observed"
  | "attempt-requesting"
  | "attempt-ready"
  | "callback-received"
  | "confirm-submitting"
  | "hold-release-requesting"
  | "hold-released";

type OperationStatus =
  "PENDING" | "PROCESSING" | "REQUIRES_REVIEW" | "SUCCEEDED" | "FAILED";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const quoteWire = (amount = 100_000) => ({
  quote_uid: QUOTE_UID,
  accommodation_id: accommodation.id,
  order_name: "  합정 테스트 숙소 2박  ",
  check_in: CHECK_IN,
  check_out: CHECK_OUT,
  guest_count: 3,
  nightly_price: 50_000,
  nights: 2,
  subtotal: 100_000,
  discount_amount: 100_000 - amount,
  amount,
  currency: "KRW",
  payment_required: amount > 0,
  inventory_held: false,
  quote_expires_at: "2026-07-01T03:10:00Z",
  server_time: SERVER_TIME,
});

const readyWire = (amount = 100_000) => ({
  reservation_uid: RESERVATION_UID,
  order_name: "  서버가 다시 계산한 숙소 2박  ",
  check_in: CHECK_IN,
  check_out: CHECK_OUT,
  guest_count: 3,
  subtotal: 100_000,
  discount_amount: 100_000 - amount,
  amount,
  currency: "KRW",
  status: amount === 0 ? "CONFIRMED" : "PAYMENT_PENDING",
  payment_required: amount > 0,
  payment_allowed: amount > 0,
  hold_expires_at: amount > 0 ? HOLD_EXPIRES_AT : null,
  server_time: "2026-07-01T03:00:01Z",
  customer_email: null,
  customer_name: null,
});

const attemptWire = () => ({
  payment_attempt_id: ATTEMPT_ID,
  order_id: RESERVATION_UID,
  amount: 100_000,
  currency: "KRW",
  hold_expires_at: HOLD_EXPIRES_AT,
  remaining_seconds: 900,
  server_time: SERVER_TIME,
});

const operationWire = (
  status: OperationStatus,
  options: {
    readonly nextAction?:
      "POLL" | "CONTACT_SUPPORT" | "NONE" | "START_NEW_CHECKOUT";
    readonly retryAfterSeconds?: number | null;
    readonly sequence?: number;
  } = {},
) => {
  const sequence = options.sequence ?? 0;
  const unresolved = status === "PENDING" || status === "PROCESSING";
  const review = status === "REQUIRES_REVIEW";
  const failed = status === "FAILED";
  return {
    operation_id: OPERATION_ID,
    order_id: RESERVATION_UID,
    status,
    updated_at: `2026-07-01T03:00:${String(sequence).padStart(2, "0")}Z`,
    next_action:
      options.nextAction ??
      (unresolved ? "POLL" : review ? "CONTACT_SUPPORT" : "NONE"),
    retry_after_seconds:
      options.retryAfterSeconds ?? (unresolved || review ? 2 : null),
    user_failure_code: review
      ? "PAYMENT_REVIEW_REQUIRED"
      : failed
        ? "PAYMENT_DECLINED"
        : null,
    server_time: `2026-07-01T03:01:${String(sequence).padStart(2, "0")}Z`,
  };
};

const reservationDetailWire = (
  status: "PAYMENT_PROCESSING" | "CONFIRMED" | "EXPIRED" = "CONFIRMED",
) => ({
  reservation_uid: RESERVATION_UID,
  reservation_code: "SYNTHETIC-RESERVATION",
  status,
  payment_allowed: false,
  hold_expires_at: null,
  server_time: "2026-07-01T03:20:00Z",
  created_at: "2026-07-01T03:00:01Z",
  guest_count: 3,
  check_in_date_time: "2026-07-10T15:00:00",
  check_out_date_time: "2026-07-12T11:00:00",
  time_zone_id: "Asia/Seoul",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  request_message: null,
  can_write_review: false,
  accommodation: {
    id: accommodation.id,
    name: accommodation.name,
    thumbnail_url: null,
  },
  address: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo-gu",
    street: "Synthetic-ro 1",
    detail: null,
    postal_code: "00000",
  },
  coordinate: accommodation.coordinate,
  host: accommodation.host,
  payment: null,
});

const flowState = (flowId = FLOW_ID, reservationUid = RESERVATION_UID) => ({
  purpose: "booking-payment-flow-reference" as const,
  version: 2 as const,
  flowId,
  locator: { kind: "reservation" as const, reservationUid },
});

const operationState = (
  flowId = FLOW_ID,
  operationId = OPERATION_ID,
  reservationUid = RESERVATION_UID,
) => ({
  purpose: "booking-payment-operation-reference" as const,
  version: 2 as const,
  flowId,
  operationId,
  reservationUid,
});

const checkoutGroup = () => ({
  method: "POST",
  resource: "/api/v1/reservations",
  body: { quoteUid: QUOTE_UID, requestMessage: null },
  idempotencyKey: "60000000-0000-4000-8000-000000000001",
  requestFingerprint: "a".repeat(43),
});

const journalEnvelope = (
  phase: JournalPhase,
  options: {
    readonly owner?: string;
    readonly amount?: number;
    readonly flowId?: string;
  } = {},
) => {
  const amount = options.amount ?? 100_000;
  const flowId = options.flowId ?? FLOW_ID;
  const data: Record<string, unknown> = {
    phase,
    flowId,
    serverIntent: {
      accommodationId: accommodation.id,
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      guestCount: 3,
      couponId: null,
    },
    presentationIntent: {
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      petCount: 0,
    },
    recoveryExpiresAt: FIXED_NOW + 55 * 60 * 1_000,
    quote: {
      quoteUid: QUOTE_UID,
      accommodationId: accommodation.id,
      orderName: "  합정 테스트 숙소 2박  ",
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      guestCount: 3,
      nightlyPrice: 50_000,
      nights: 2,
      subtotal: 100_000,
      discountAmount: 100_000 - amount,
      amount,
      currency: "KRW",
      paymentRequired: amount > 0,
      inventoryHeld: false,
      quoteExpiresAt: "2026-07-01T03:10:00Z",
      serverTime: SERVER_TIME,
    },
  };
  if (phase !== "quoted") data.checkout = checkoutGroup();
  if (!["quoted", "checkout-prepared", "checkout-submitting"].includes(phase)) {
    data.ready = {
      reservationUid: RESERVATION_UID,
      orderName: "  서버가 다시 계산한 숙소 2박  ",
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      guestCount: 3,
      subtotal: 100_000,
      discountAmount: 100_000 - amount,
      amount,
      currency: "KRW",
      status:
        phase === "complimentary-observed"
          ? "CONFIRMED"
          : phase === "reservation-status-observed"
            ? "EXPIRED"
            : "PAYMENT_PENDING",
      paymentRequired: amount > 0,
      paymentAllowed: amount > 0 && phase !== "reservation-status-observed",
      holdExpiresAt:
        amount > 0 && phase !== "reservation-status-observed"
          ? HOLD_EXPIRES_AT
          : null,
      serverTime: "2026-07-01T03:00:01Z",
    };
  }
  if (
    ["attempt-ready", "callback-received", "confirm-submitting"].includes(phase)
  ) {
    data.attempt = {
      paymentAttemptId: ATTEMPT_ID,
      orderId: RESERVATION_UID,
      amount,
      currency: "KRW",
      holdExpiresAt: HOLD_EXPIRES_AT,
      remainingSeconds: 900,
      serverTime: SERVER_TIME,
    };
  }
  return {
    purpose: "booking-payment-journal",
    version: 2,
    privacyClass: "sensitive",
    containsPii: false,
    owner: options.owner ?? OWNER_A,
    createdAt: FIXED_NOW,
    hardExpiresAt: FIXED_NOW + 60 * 60 * 1_000,
    lease: {
      runtimeLeaseId: "70000000-0000-4000-8000-000000000001",
      sessionEpoch: 0,
    },
    data,
  };
};

const receiptEnvelope = (
  observation: ReturnType<typeof operationWire> | null = null,
  options: { readonly owner?: string; readonly flowId?: string } = {},
) => ({
  purpose: "booking-payment-operation-receipt",
  version: 2,
  privacyClass: "personal",
  containsPii: false,
  owner: options.owner ?? OWNER_A,
  createdAt: FIXED_NOW,
  hardExpiresAt: FIXED_NOW + 24 * 60 * 60 * 1_000,
  lease: {
    runtimeLeaseId: "80000000-0000-4000-8000-000000000001",
    sessionEpoch: 0,
  },
  data: {
    flowId: options.flowId ?? FLOW_ID,
    operation: {
      operationId: OPERATION_ID,
      reservationUid: RESERVATION_UID,
      orderId: RESERVATION_UID,
      paymentAttemptId: ATTEMPT_ID,
      amount: 100_000,
      currency: "KRW",
    },
    observation:
      observation === null
        ? null
        : {
            status: observation.status,
            updatedAt: observation.updated_at,
            nextAction: observation.next_action,
            retryAfterSeconds: observation.retry_after_seconds,
            userFailureCode: observation.user_failure_code,
            serverTime: observation.server_time,
          },
  },
});

const registerAccommodationReads = (api: ApiHarness): void => {
  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));
  api.register(
    "GET",
    "/api/v1/accommodations/7/availability",
    apiSuccess(accommodationAvailability),
  );
  api.register("GET", "/api/v1/coupons", apiSuccess({ infos: [] }));
  api.register(
    "POST",
    "/api/v1/members/recently-viewed/7",
    apiSuccess(null, 201),
  );
};

const registerReservationDetail = (
  api: ApiHarness,
  status: "PAYMENT_PROCESSING" | "CONFIRMED" | "EXPIRED" = "CONFIRMED",
): void => {
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${RESERVATION_UID}`,
    apiSuccess(reservationDetailWire(status)),
  );
};

const openSeedPage = async (page: Page): Promise<void> => {
  const sessionBootstrap = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/v1/auth/me"
    );
  });
  await Promise.all([page.goto("/login"), sessionBootstrap]);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
};

const pauseClockWhileOperationResponseIsHeld = async (
  page: Page,
): Promise<void> => {
  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 5_000);
};

const seedStorage = async (
  page: Page,
  entries: Readonly<Record<string, unknown>>,
): Promise<void> => {
  await page.evaluate((seed) => {
    Object.entries(seed).forEach(([key, value]) => {
      sessionStorage.setItem(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
    });
  }, entries);
};

const navigateWithRouterState = async (
  page: Page,
  path: string,
  state: unknown,
): Promise<void> => {
  await page.evaluate(
    ({ nextPath, nextState }) => {
      const current =
        typeof window.history.state === "object" &&
        window.history.state !== null
          ? window.history.state
          : {};
      const next = {
        ...current,
        idx: typeof current.idx === "number" ? current.idx + 1 : 1,
        key: `e2e-${crypto.randomUUID()}`,
        usr: nextState,
      };
      window.history.pushState(next, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate", { state: next }));
    },
    { nextPath: path, nextState: state },
  );
  await page.waitForURL(path);
};

const readV2Storage = async (page: Page): Promise<Record<string, string>> =>
  page.evaluate(
    (prefix) =>
      Object.fromEntries(
        Array.from({ length: sessionStorage.length }, (_, index) =>
          sessionStorage.key(index),
        )
          .filter((key): key is string => key?.startsWith(prefix) === true)
          .map((key) => [key, sessionStorage.getItem(key) ?? ""]),
      ),
    V2_PREFIX,
  );

const readJournal = async (page: Page): Promise<Record<string, unknown>> => {
  const raw = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    JOURNAL_KEY,
  );
  if (raw === null) throw new Error("Expected a v2 booking journal.");
  return JSON.parse(raw) as Record<string, unknown>;
};

const expectNoBrowserSecret = async (
  page: Page,
  secrets: readonly string[],
): Promise<void> => {
  const artifact = await page.evaluate(() => ({
    body: document.body.textContent ?? "",
    history: JSON.stringify(window.history.state),
    url: window.location.href,
  }));
  for (const secret of secrets) {
    expect(artifact.body).not.toContain(secret);
    expect(artifact.history).not.toContain(secret);
    expect(artifact.url).not.toContain(secret);
  }
};

const detailPath =
  "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12" +
  "&adultOccupancy=2&childOccupancy=1";
const successPath = `/reservations/${RESERVATION_UID}/success`;

test("quotes first and single-flights the explicit checkout transition", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installPaymentGatewayFixture(page);
  registerAccommodationReads(api);
  const pendingQuote = deferred<ApiResponseSpec>();
  const pendingCheckout = deferred<ApiResponseSpec>();
  api.register(
    "POST",
    "/api/v1/reservation-quotes",
    () => pendingQuote.promise,
  );
  api.register("POST", "/api/v1/reservations", () => pendingCheckout.promise);

  await page.goto(detailPath);
  const reserve = page.getByRole("button", { name: "예약하기" });
  await expect(reserve).toBeEnabled();
  await reserve.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect
    .poll(() => api.matching("POST", "/api/v1/reservation-quotes").length)
    .toBe(1);
  expect(api.matching("POST", "/api/v1/reservations")).toHaveLength(0);
  pendingQuote.resolve(apiSuccess(quoteWire(), 201));

  await expect(
    page.getByRole("region", { name: "확정된 예약 견적" }),
  ).toBeVisible();
  const continueButton = page.getByRole("button", {
    name: "예약 계속하기",
  });
  await continueButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect
    .poll(() => api.matching("POST", "/api/v1/reservations").length)
    .toBe(1);
  pendingCheckout.resolve(apiSuccess(readyWire()));

  await expect(page).toHaveURL("/accommodations/7/confirm");
  await expect(
    page.getByRole("heading", { name: "확인 및 결제" }),
  ).toBeVisible();
  const quoteRequest = requireApiRequest(
    api.matching("POST", "/api/v1/reservation-quotes"),
    0,
    "reservation quote",
  );
  expect(quoteRequest.body).toEqual({
    accommodation_id: 7,
    check_in_date: CHECK_IN,
    check_out_date: CHECK_OUT,
    guest_count: 3,
  });
  expect(quoteRequest.idempotencyKey).toBeNull();
  const checkoutRequest = requireApiRequest(
    api.matching("POST", "/api/v1/reservations"),
    0,
    "reservation checkout",
  );
  expect(checkoutRequest.body).toEqual({
    quote_uid: QUOTE_UID,
    request_message: null,
  });
  expect(checkoutRequest.idempotencyKey).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
  const rawJournal = JSON.stringify(await readJournal(page));
  expect(rawJournal).toContain('"phase":"reservation-ready"');
  expect(rawJournal).not.toContain(SYNTHETIC_USER_A.email);
  expect(rawJournal).not.toContain(SYNTHETIC_USER_A.nickname);
});

test("replays an exact checkout after response loss with the same key and body", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installPaymentGatewayFixture(page);
  registerAccommodationReads(api);
  api.register(
    "POST",
    "/api/v1/reservation-quotes",
    apiSuccess(quoteWire(), 201),
  );
  let attempts = 0;
  api.register("POST", "/api/v1/reservations", () => {
    attempts += 1;
    return attempts === 1 ? apiResponseLost() : apiSuccess(readyWire());
  });

  await page.goto(detailPath);
  await page.getByRole("button", { name: "예약하기" }).click();
  const continueButton = page.getByRole("button", {
    name: "예약 계속하기",
  });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect
    .poll(() => api.matching("POST", "/api/v1/reservations").length)
    .toBe(1);
  await expect(continueButton).toBeEnabled();
  expect(JSON.stringify(await readJournal(page))).toContain(
    '"phase":"checkout-submitting"',
  );
  await continueButton.click();
  await expect(page).toHaveURL("/accommodations/7/confirm");
  const requests = api.matching("POST", "/api/v1/reservations");
  expect(requests).toHaveLength(2);
  expect(requests[0]?.body).toEqual(requests[1]?.body);
  expect(requests[0]?.idempotencyKey).toBe(requests[1]?.idempotencyKey);
  expect(requests[0]?.idempotencyKey).not.toBeNull();
});

test("completes a zero-won reservation without attempt, Toss, or confirmation I/O", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installPaymentGatewayFixture(page);
  registerAccommodationReads(api);
  registerReservationDetail(api);
  api.register(
    "POST",
    "/api/v1/reservation-quotes",
    apiSuccess(quoteWire(0), 201),
  );
  api.register("POST", "/api/v1/reservations", apiSuccess(readyWire(0)));

  await page.goto(detailPath);
  await page.getByRole("button", { name: "예약하기" }).click();
  await page.getByRole("button", { name: "예약 계속하기" }).click();
  await expect(page).toHaveURL(`/reservations/${RESERVATION_UID}`);
  await expect(page.getByText("SYNTHETIC-RESERVATION")).toBeVisible();
  expect(
    api.matching(
      "POST",
      `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
    ),
  ).toHaveLength(0);
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
  expect(
    api.matching("GET", new RegExp("^/api/v1/payment-operations/")),
  ).toHaveLength(0);
  expect(
    (await readPaymentGatewayCalls(page)).filter(
      (call) => call.kind === "request-payment",
    ),
  ).toHaveLength(0);
  expect(await readV2Storage(page)).toEqual({});
});

test("replays a lost payment-attempt response and never auto-launches Toss after reload", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installPaymentGatewayFixture(page, {
    outcome: "resolve",
    deferPreparation: true,
  });
  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));
  let attemptRequests = 0;
  api.register(
    "POST",
    `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
    () => {
      attemptRequests += 1;
      return attemptRequests === 1
        ? apiResponseLost()
        : apiSuccess(attemptWire(), 201);
    },
  );

  await openSeedPage(page);
  await seedStorage(page, {
    [JOURNAL_KEY]: journalEnvelope("reservation-ready"),
  });
  await navigateWithRouterState(page, "/accommodations/7/confirm", flowState());
  const loadingPaymentButton = page.getByRole("button", {
    name: "결제 시스템 로딩 중...",
  });
  await expect(loadingPaymentButton).toBeDisabled();
  await releasePaymentGatewayPreparation(page);
  const paymentButton = page.getByRole("button", { name: "확인 및 결제" });
  await expect(paymentButton).toBeEnabled();
  await paymentButton.click();
  await expect
    .poll(
      () =>
        api.matching(
          "POST",
          `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
        ).length,
    )
    .toBe(1);
  await expect(paymentButton).toBeEnabled();
  expect(JSON.stringify(await readJournal(page))).toContain(
    '"phase":"attempt-requesting"',
  );

  await page.reload();
  await expect(
    page.getByRole("button", { name: "결제 시스템 로딩 중..." }),
  ).toBeDisabled();
  expect(
    api.matching(
      "POST",
      `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
    ),
  ).toHaveLength(1);
  expect(
    (await readPaymentGatewayCalls(page)).filter(
      (call) => call.kind === "request-payment",
    ),
  ).toHaveLength(0);

  await releasePaymentGatewayPreparation(page);
  const recoveredPaymentButton = page.getByRole("button", {
    name: "확인 및 결제",
  });
  await expect(recoveredPaymentButton).toBeEnabled();
  expect(
    api.matching(
      "POST",
      `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
    ),
  ).toHaveLength(1);
  expect(
    (await readPaymentGatewayCalls(page)).filter(
      (call) => call.kind === "request-payment",
    ),
  ).toHaveLength(0);
  await recoveredPaymentButton.click();
  await expect
    .poll(
      async () =>
        (await readPaymentGatewayCalls(page)).filter(
          (call) => call.kind === "request-payment",
        ).length,
    )
    .toBe(1);
  expect(
    api.matching(
      "POST",
      `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
    ),
  ).toHaveLength(2);
  expect(JSON.stringify(await readJournal(page))).toContain(
    '"phase":"attempt-ready"',
  );
  expect(JSON.stringify(await readJournal(page))).toContain(ATTEMPT_ID);
});

test("reuses one attempt after Toss cancellation and releases the hold explicitly", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installPaymentGatewayFixture(page, {
    outcome: "reject",
    code: "USER_CANCEL",
    message: "synthetic cancellation",
  });
  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));
  api.register(
    "POST",
    `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
    apiSuccess(attemptWire(), 201),
  );
  api.register(
    "DELETE",
    `/api/v1/reservations/${RESERVATION_UID}/hold`,
    apiSuccess({
      reservation_uid: RESERVATION_UID,
      status: "EXPIRED",
      released_now: true,
      server_time: "2026-07-01T03:02:00Z",
    }),
  );
  registerReservationDetail(api, "EXPIRED");

  await openSeedPage(page);
  await seedStorage(page, {
    [JOURNAL_KEY]: journalEnvelope("reservation-ready"),
  });
  await navigateWithRouterState(page, "/accommodations/7/confirm", flowState());
  const paymentButton = page.getByRole("button", { name: "확인 및 결제" });
  await expect(paymentButton).toBeEnabled();
  await paymentButton.click();
  await expect(page.getByRole("alert")).toContainText(
    "같은 결제 시도로 다시 진행할 수 있습니다",
  );
  const firstAttempt = JSON.stringify(await readJournal(page));
  await paymentButton.click();
  await expect
    .poll(
      async () =>
        (await readPaymentGatewayCalls(page)).filter(
          (call) => call.kind === "request-payment",
        ).length,
    )
    .toBe(2);
  expect(JSON.stringify(await readJournal(page))).toBe(firstAttempt);
  expect(
    api.matching(
      "POST",
      `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
    ),
  ).toHaveLength(1);

  await page.getByRole("button", { name: "예약을 취소하고 객실 해제" }).click();
  await expect(page).toHaveURL(`/reservations/${RESERVATION_UID}`);
  expect(
    api.matching("DELETE", `/api/v1/reservations/${RESERVATION_UID}/hold`),
  ).toHaveLength(1);
  expect(await readV2Storage(page)).toEqual({});
});

test("scrubs a fresh callback, survives a confirm response-loss reload, and cleans receipt last", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  let confirms = 0;
  api.register("POST", "/api/v1/payments/confirm", () => {
    confirms += 1;
    return confirms === 1
      ? apiResponseLost()
      : apiSuccess(
          {
            operation_id: OPERATION_ID,
            status: "PENDING",
            status_url: `/api/v1/payment-operations/${OPERATION_ID}`,
          },
          202,
        );
  });
  api.register(
    "GET",
    `/api/v1/payment-operations/${OPERATION_ID}`,
    apiSuccess(operationWire("SUCCEEDED", { sequence: 1 })),
  );
  registerReservationDetail(api);

  await openSeedPage(page);
  await seedStorage(page, { [JOURNAL_KEY]: journalEnvelope("attempt-ready") });
  const callbackUrl =
    `${successPath}?paymentKey=${PAYMENT_KEY}` +
    `&orderId=${RESERVATION_UID}&amount=100000`;
  await page.goto(callbackUrl);
  await expect(page).toHaveURL(successPath);
  await expect(
    page.getByRole("heading", { name: "결제 상태를 복구하지 못했습니다" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.history.state?.usr)).toEqual(
    flowState(),
  );
  await expectNoBrowserSecret(page, [PAYMENT_KEY, SYNTHETIC_USER_A.email]);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "결제가 완료되었습니다" }),
  ).toBeVisible();
  const confirmRequests = api.matching("POST", "/api/v1/payments/confirm");
  expect(confirmRequests).toHaveLength(2);
  expect(confirmRequests[0]?.body).toEqual(confirmRequests[1]?.body);
  expect(confirmRequests[1]?.body).toEqual({
    payment_key: PAYMENT_KEY,
    order_id: RESERVATION_UID,
    amount: 100_000,
    payment_attempt_id: ATTEMPT_ID,
  });
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(1);
  const beforeAcknowledgement = await readV2Storage(page);
  expect(Object.keys(beforeAcknowledgement)).toEqual([OPERATION_RECEIPT_KEY]);
  expect(beforeAcknowledgement[OPERATION_RECEIPT_KEY]).not.toContain(
    PAYMENT_KEY,
  );
  expect(beforeAcknowledgement[OPERATION_RECEIPT_KEY]).not.toContain(
    SYNTHETIC_USER_A.email,
  );
  expect(await page.evaluate(() => window.history.state?.usr)).toEqual(
    operationState(),
  );
  await expectNoBrowserSecret(page, [
    PAYMENT_KEY,
    SYNTHETIC_USER_A.email,
    accommodation.name,
  ]);

  await page.getByRole("button", { name: "확인하고 예약 보기" }).click();
  await expect(page).toHaveURL(`/reservations/${RESERVATION_UID}`);
  expect(await readV2Storage(page)).toEqual({});
});

test("keeps a same-subject callback private across the anonymous login detour", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  api.register(
    "POST",
    "/api/v1/payments/confirm",
    apiSuccess({ operation_id: OPERATION_ID, status: "PENDING" }, 202),
  );
  api.register(
    "GET",
    `/api/v1/payment-operations/${OPERATION_ID}`,
    apiSuccess(operationWire("SUCCEEDED", { sequence: 1 })),
  );
  await openSeedPage(page);
  await seedStorage(page, { [JOURNAL_KEY]: journalEnvelope("attempt-ready") });
  await page.goto(
    `${successPath}?paymentKey=${PAYMENT_KEY}&orderId=${RESERVATION_UID}&amount=100000`,
  );
  await expect(page).toHaveURL("/login");
  await expectNoBrowserSecret(page, [PAYMENT_KEY]);
  expect(JSON.stringify(await readJournal(page))).toContain(
    '"phase":"attempt-ready"',
  );

  await page.getByLabel("이메일").fill(SYNTHETIC_USER_A.email);
  await page.getByLabel("비밀번호").fill("synthetic-password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(successPath);
  await expect(
    page.getByRole("heading", { name: "결제가 완료되었습니다" }),
  ).toBeVisible();
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(1);
  await expectNoBrowserSecret(page, [PAYMENT_KEY, SYNTHETIC_USER_A.email]);
});

test("purges a callback journal when the login candidate is a different subject", async ({
  api,
  page,
  session,
}) => {
  session.clear();
  await openSeedPage(page);
  await seedStorage(page, { [JOURNAL_KEY]: journalEnvelope("attempt-ready") });
  await page.goto(
    `${successPath}?paymentKey=${PAYMENT_KEY}&orderId=${RESERVATION_UID}&amount=100000`,
  );
  await expect(page).toHaveURL("/login");
  // Publish the foreign server identity on a fresh document. The pending
  // callback is deliberately not portable across documents, while candidate
  // reconciliation must still purge the previous subject's journal.
  session.authenticate(SYNTHETIC_USER_B);
  await page.reload();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
  expect(await readV2Storage(page)).toEqual({});
  await expectNoBrowserSecret(page, [PAYMENT_KEY, SYNTHETIC_USER_B.email]);
  expect(OWNER_B).not.toBe(OWNER_A);
});

test("clamps operation polling, surfaces review identifiers, and retains the receipt until acknowledgement", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  const observations = [
    operationWire("PENDING", { retryAfterSeconds: 0, sequence: 1 }),
    operationWire("PROCESSING", { retryAfterSeconds: 99, sequence: 2 }),
    operationWire("REQUIRES_REVIEW", { retryAfterSeconds: 3, sequence: 3 }),
    operationWire("SUCCEEDED", { sequence: 4 }),
  ];
  const firstRead = deferred<ApiResponseSpec>();
  let reads = 0;
  api.register("GET", `/api/v1/payment-operations/${OPERATION_ID}`, () => {
    const observation =
      observations[Math.min(reads++, observations.length - 1)];
    return reads === 1 ? firstRead.promise : apiSuccess(observation);
  });
  registerReservationDetail(api);

  await openSeedPage(page);
  await seedStorage(page, { [OPERATION_RECEIPT_KEY]: receiptEnvelope() });
  await navigateWithRouterState(page, successPath, operationState());
  await expect
    .poll(
      () =>
        api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`)
          .length,
    )
    .toBe(1);
  await pauseClockWhileOperationResponseIsHeld(page);
  firstRead.resolve(apiSuccess(observations[0]));
  await expect(page.getByRole("status")).toContainText(
    "결제 승인 대기 중입니다",
  );
  await page.clock.runFor(1_999);
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(1);
  await page.clock.runFor(1);
  await expect
    .poll(
      () =>
        api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`)
          .length,
    )
    .toBe(2);
  await page.clock.runFor(29_999);
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(2);
  await page.clock.runFor(1);
  await expect(
    page.getByRole("heading", { name: "결제 확인이 필요합니다" }),
  ).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: RESERVATION_UID }),
  ).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: OPERATION_ID }),
  ).toBeVisible();
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(3);
  await page.clock.runFor(3_000);
  await expect(
    page.getByRole("heading", { name: "결제가 완료되었습니다" }),
  ).toBeVisible();
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(4);
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
  expect((await readV2Storage(page))[OPERATION_RECEIPT_KEY]).toContain(
    '"status":"SUCCEEDED"',
  );

  await page.clock.resume();
  await page.goto("/login");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "결제가 완료되었습니다" }),
  ).toBeVisible();
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(4);
  await page.goForward();
  await expect(page).toHaveURL("/login");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "결제가 완료되었습니다" }),
  ).toBeVisible();
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(4);
  await page.getByRole("button", { name: "확인하고 예약 보기" }).click();
  await expect(page).toHaveURL(`/reservations/${RESERVATION_UID}`);
  expect(await readV2Storage(page)).toEqual({});
});

test("retries an operation network error after the conservative two-second delay", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  const firstRead = deferred<ApiResponseSpec>();
  let reads = 0;
  api.register("GET", `/api/v1/payment-operations/${OPERATION_ID}`, () => {
    reads += 1;
    return reads === 1
      ? firstRead.promise
      : apiSuccess(
          operationWire("FAILED", { nextAction: "NONE", sequence: 1 }),
        );
  });
  await openSeedPage(page);
  await seedStorage(page, { [OPERATION_RECEIPT_KEY]: receiptEnvelope() });
  await navigateWithRouterState(page, successPath, operationState());
  await expect
    .poll(
      () =>
        api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`)
          .length,
    )
    .toBe(1);
  await pauseClockWhileOperationResponseIsHeld(page);
  firstRead.resolve(apiResponseLost());
  await expect(page.getByRole("status")).toContainText(
    "자동으로 다시 확인합니다",
  );
  await page.clock.runFor(1_999);
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(1);
  await page.clock.runFor(1);
  await expect(
    page.getByRole("heading", { name: "결제가 완료되지 않았습니다" }),
  ).toBeVisible();
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(2);
  expect((await readV2Storage(page))[OPERATION_RECEIPT_KEY]).toContain(
    '"nextAction":"NONE"',
  );
});

test("preserves the backend START_NEW_CHECKOUT failure action until explicit acknowledgement", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    `/api/v1/payment-operations/${OPERATION_ID}`,
    apiSuccess(
      operationWire("FAILED", {
        nextAction: "START_NEW_CHECKOUT",
        sequence: 1,
      }),
    ),
  );
  registerReservationDetail(api);
  await openSeedPage(page);
  await seedStorage(page, { [OPERATION_RECEIPT_KEY]: receiptEnvelope() });
  await navigateWithRouterState(page, successPath, operationState());
  await expect(
    page.getByRole("heading", { name: "결제가 완료되지 않았습니다" }),
  ).toBeVisible();
  expect((await readV2Storage(page))[OPERATION_RECEIPT_KEY]).toContain(
    '"nextAction":"START_NEW_CHECKOUT"',
  );
  await page.getByRole("button", { name: "확인하고 예약 보기" }).click();
  await expect(page).toHaveURL(`/reservations/${RESERVATION_UID}`);
  expect(await readV2Storage(page)).toEqual({});
});

test("treats the failure callback as presentation-only with zero payment authority", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await openSeedPage(page);
  await seedStorage(page, { [JOURNAL_KEY]: journalEnvelope("attempt-ready") });
  const before = JSON.stringify(await readJournal(page));
  const providerMessage = "provider-private-cancel-message";
  await page.goto(
    `/reservations/${RESERVATION_UID}/fail?code=USER_CANCEL` +
      `&message=${providerMessage}&paymentKey=${PAYMENT_KEY}` +
      `&orderId=${RESERVATION_UID}&amount=100000#provider-fragment`,
  );
  await expect(page).toHaveURL(`/reservations/${RESERVATION_UID}/fail`);
  await expect(
    page.getByRole("heading", { name: "결제가 완료되지 않았습니다" }),
  ).toBeVisible();
  expect(JSON.stringify(await readJournal(page))).toBe(before);
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
  expect(
    api.matching("GET", new RegExp("^/api/v1/payment-operations/")),
  ).toHaveLength(0);
  expect(api.matching("POST", new RegExp("/payment-attempts$"))).toHaveLength(
    0,
  );
  expect(api.matching("DELETE", new RegExp("/hold$"))).toHaveLength(0);
  await expectNoBrowserSecret(page, [PAYMENT_KEY, providerMessage]);
});

test("rejects callback hash and router-state contaminants before confirmation", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await openSeedPage(page);
  await seedStorage(page, { [JOURNAL_KEY]: journalEnvelope("attempt-ready") });
  await page.goto(
    `${successPath}?paymentKey=${PAYMENT_KEY}` +
      `&orderId=${RESERVATION_UID}&amount=100000#unexpected`,
  );
  await expect(page).toHaveURL(successPath);
  await expect(
    page.getByRole("heading", { name: "결제 상태를 복구하지 못했습니다" }),
  ).toBeVisible();
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
  await expectNoBrowserSecret(page, [PAYMENT_KEY]);

  await navigateWithRouterState(page, successPath, {
    paymentKey: PAYMENT_KEY,
    orderId: RESERVATION_UID,
  });
  await expect(page).toHaveURL(successPath);
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
  await expectNoBrowserSecret(page, [PAYMENT_KEY]);
});

test("performs no confirm or GET for missing and forged recovery references", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await openSeedPage(page);
  await page.goto(successPath);
  await expect(
    page.getByRole("heading", { name: "결제 상태를 복구하지 못했습니다" }),
  ).toBeVisible();

  await seedStorage(page, { [OPERATION_RECEIPT_KEY]: receiptEnvelope() });
  await navigateWithRouterState(
    page,
    successPath,
    operationState(FLOW_ID, "50000000-0000-4000-8000-000000000099"),
  );
  await expect(
    page.getByRole("heading", { name: "결제 상태를 복구하지 못했습니다" }),
  ).toBeVisible();
  await seedStorage(page, {
    [JOURNAL_KEY]: journalEnvelope("confirm-submitting"),
  });
  await navigateWithRouterState(
    page,
    successPath,
    flowState("10000000-0000-4000-8000-000000000099"),
  );
  await expect(
    page.getByRole("heading", { name: "결제 상태를 복구하지 못했습니다" }),
  ).toBeVisible();
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
  expect(
    api.matching("GET", new RegExp("^/api/v1/payment-operations/")),
  ).toHaveLength(0);
});

test("purges exact retired v1 keys while preserving near-collision application keys", async ({
  page,
  session,
}) => {
  session.authenticate();
  const retired = [
    "airbob:booking-payment-v1:checkout",
    "airbob:reservation-checkout:reservation-1",
    "airbob:reservation-checkout-index:reservation-1",
    "airbob:payment-confirmed:reservation-1",
  ];
  const nearCollisions = [
    "airbob:booking-payment-v1x:checkout",
    "airbob:reservation-checkoutx:reservation-1",
    "airbob:reservation-checkout-indexx:reservation-1",
    "airbob:payment-confirmedx:reservation-1",
  ];
  await page.addInitScript(
    ({ removeKeys, keepKeys, v2Key, v2Journal }) => {
      removeKeys.forEach((key) => sessionStorage.setItem(key, "retired"));
      keepKeys.forEach((key) => sessionStorage.setItem(key, "preserve"));
      sessionStorage.setItem(v2Key, JSON.stringify(v2Journal));
    },
    {
      removeKeys: retired,
      keepKeys: nearCollisions,
      v2Key: JOURNAL_KEY,
      v2Journal: journalEnvelope("attempt-ready"),
    },
  );
  await openSeedPage(page);
  const values = await page.evaluate(
    ({ removeKeys, keepKeys }) => ({
      removed: removeKeys.map((key) => sessionStorage.getItem(key)),
      preserved: keepKeys.map((key) => sessionStorage.getItem(key)),
    }),
    { removeKeys: retired, keepKeys: nearCollisions },
  );
  expect(values.removed).toEqual(retired.map(() => null));
  expect(values.preserved).toEqual(nearCollisions.map(() => "preserve"));
});

test("keeps cloned recovery copies credential-free and confirmation-free", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    `/api/v1/payment-operations/${OPERATION_ID}`,
    apiSuccess(operationWire("SUCCEEDED", { sequence: 1 })),
  );
  await openSeedPage(page);
  await seedStorage(page, { [OPERATION_RECEIPT_KEY]: receiptEnvelope() });
  await navigateWithRouterState(page, successPath, operationState());
  await expect(
    page.getByRole("heading", { name: "결제가 완료되었습니다" }),
  ).toBeVisible();

  const popup = page.waitForEvent("popup");
  await page.evaluate(() => window.open("/login", "_blank"));
  const clone = await popup;
  await clone.waitForLoadState("domcontentloaded");
  expect((await readV2Storage(clone))[OPERATION_RECEIPT_KEY]).toContain(
    '"status":"SUCCEEDED"',
  );
  await navigateWithRouterState(clone, successPath, operationState());
  await expect(
    clone.getByRole("heading", { name: "결제가 완료되었습니다" }),
  ).toBeVisible();
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(1);
  await expectNoBrowserSecret(page, [PAYMENT_KEY, SYNTHETIC_USER_A.email]);
  await expectNoBrowserSecret(clone, [PAYMENT_KEY, SYNTHETIC_USER_A.email]);
});

test("converges a cloned-tab confirm and release race without sharing callback credentials", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));
  const pendingConfirmation = deferred<ApiResponseSpec>();
  api.register(
    "POST",
    "/api/v1/payments/confirm",
    () => pendingConfirmation.promise,
  );
  api.register(
    "GET",
    `/api/v1/payment-operations/${OPERATION_ID}`,
    apiSuccess(operationWire("SUCCEEDED", { sequence: 1 })),
  );
  const releaseConflictMessage =
    "private backend state drift detail must not reach either page";
  api.register(
    "DELETE",
    `/api/v1/reservations/${RESERVATION_UID}/hold`,
    apiFailure(409, "R021", releaseConflictMessage),
  );
  registerReservationDetail(api, "PAYMENT_PROCESSING");

  await openSeedPage(page);
  await seedStorage(page, { [JOURNAL_KEY]: journalEnvelope("attempt-ready") });

  const popup = page.waitForEvent("popup");
  await page.evaluate(() => window.open("/robots.txt", "_blank"));
  const clone = await popup;
  await clone.waitForLoadState("domcontentloaded");
  const inheritedStorage = await readV2Storage(clone);
  expect(inheritedStorage[JOURNAL_KEY]).toContain('"phase":"attempt-ready"');
  expect(inheritedStorage[CALLBACK_CREDENTIAL_KEY]).toBeUndefined();
  expect(JSON.stringify(inheritedStorage)).not.toContain(PAYMENT_KEY);

  await clone.clock.install({ time: new Date("2026-07-01T12:00:00+09:00") });
  await installPaymentGatewayFixture(clone);
  await openSeedPage(clone);
  await navigateWithRouterState(
    clone,
    "/accommodations/7/confirm",
    flowState(),
  );
  const releaseButton = clone.getByRole("button", {
    name: "예약을 취소하고 객실 해제",
  });
  await expect(releaseButton).toBeEnabled();

  const callbackUrl =
    `${successPath}?paymentKey=${PAYMENT_KEY}` +
    `&orderId=${RESERVATION_UID}&amount=100000`;
  await page.goto(callbackUrl);
  await expect(page).toHaveURL(successPath);
  await expect
    .poll(() => api.matching("POST", "/api/v1/payments/confirm").length)
    .toBe(1);

  expect((await readV2Storage(clone))[CALLBACK_CREDENTIAL_KEY]).toBeUndefined();
  await releaseButton.click();
  await expect(clone).toHaveURL(`/reservations/${RESERVATION_UID}`);
  await expect(clone.getByText("SYNTHETIC-RESERVATION")).toBeVisible();
  expect(await readV2Storage(clone)).toEqual({});

  pendingConfirmation.resolve(
    apiSuccess(
      {
        operation_id: OPERATION_ID,
        status: "PENDING",
        status_url: `/api/v1/payment-operations/${OPERATION_ID}`,
      },
      202,
    ),
  );
  await expect(
    page.getByRole("heading", { name: "결제가 완료되었습니다" }),
  ).toBeVisible();

  const confirmRequests = api.matching("POST", "/api/v1/payments/confirm");
  expect(confirmRequests).toHaveLength(1);
  expect(confirmRequests[0]?.body).toEqual({
    payment_key: PAYMENT_KEY,
    order_id: RESERVATION_UID,
    amount: 100_000,
    payment_attempt_id: ATTEMPT_ID,
  });
  expect(
    api.matching("DELETE", `/api/v1/reservations/${RESERVATION_UID}/hold`),
  ).toHaveLength(1);
  expect(
    api.matching(
      "GET",
      `/api/v1/profile/guest/reservations/${RESERVATION_UID}`,
    ),
  ).toHaveLength(2);
  expect(
    api.matching(
      "POST",
      `/api/v1/reservations/${RESERVATION_UID}/payment-attempts`,
    ),
  ).toHaveLength(0);
  expect(api.matching("POST", "/api/v1/reservations")).toHaveLength(0);
  expect(
    api.matching("GET", `/api/v1/payment-operations/${OPERATION_ID}`),
  ).toHaveLength(1);
  expect(
    (await readPaymentGatewayCalls(clone)).filter(
      (call) => call.kind === "request-payment",
    ),
  ).toHaveLength(0);

  const parentStorage = await readV2Storage(page);
  expect(Object.keys(parentStorage)).toEqual([OPERATION_RECEIPT_KEY]);
  expect(parentStorage[OPERATION_RECEIPT_KEY]).not.toContain(PAYMENT_KEY);
  await expectNoBrowserSecret(page, [PAYMENT_KEY, releaseConflictMessage]);
  await expectNoBrowserSecret(clone, [PAYMENT_KEY, releaseConflictMessage]);
  await clone.close();
});

test("keeps detail readable while availability fails closed and retries", async ({
  api,
  page,
  session,
}) => {
  let availabilityAttempts = 0;
  session.clear();
  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));
  api.register("GET", "/api/v1/accommodations/7/availability", () => {
    availabilityAttempts += 1;
    return availabilityAttempts === 1
      ? apiFailure(503, "R026", "예약 가능 정보를 잠시 조회할 수 없습니다.")
      : apiSuccess(accommodationAvailability);
  });
  await page.goto(detailPath);
  await expect(
    page.getByRole("heading", { name: accommodation.name, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("예약 가능한 날짜를 불러오지 못했습니다."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /체크인/ })).toBeDisabled();
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByRole("button", { name: /체크인/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: "예약하기" })).toBeEnabled();
  expect(
    api.matching("GET", "/api/v1/accommodations/7/availability"),
  ).toHaveLength(2);
});
