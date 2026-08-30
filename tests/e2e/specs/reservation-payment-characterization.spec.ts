import type { Page } from "@playwright/test";
import { apiSuccess, type ApiResponseSpec } from "../fixtures/api";
import {
  installPaymentGatewayFixture,
  readPaymentGatewayCalls,
} from "../fixtures/paymentGateway";
import { test, expect } from "../fixtures/test";

const CHECKOUT_STORAGE_KEY = "airbob:booking-payment-v1:checkout";
const CALLBACK_STORAGE_KEY = "airbob:booking-payment-v1:callback";
const AUTHENTICATED_OWNER = "subject:member_2t";
const CHECKOUT_TTL_MS = 60 * 60 * 1000;
const CALLBACK_TTL_MS = 15 * 60 * 1000;

const accommodation = {
  id: 7,
  name: "합정 테스트 숙소",
  description: "결제 특성화 테스트용 숙소입니다.",
  type: "ENTIRE_PLACE",
  base_price: 50_000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: [],
  is_in_wishlist: false,
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo-gu",
  },
  coordinate: {
    latitude: 37.549,
    longitude: 126.914,
  },
  host: {
    id: 202,
    nickname: "테스트 호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 1,
  },
  amenities: [],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

interface CheckoutDocument {
  operationId: string;
  accommodationId: number;
  reservationUid: string;
  orderName: string;
  amount: number;
  checkIn: string;
  checkOut: string;
  adultOccupancy: number;
  childOccupancy: number;
  infantOccupancy: number;
  petOccupancy: number;
  couponName: string | null;
  couponDiscount: number | null;
}

interface CallbackDocument {
  operationId: string;
  reservationUid: string;
  orderId: string;
  paymentKey: string;
  amount: number;
  phase: "received" | "confirming" | "reconciling";
}

interface PaymentWire {
  order_id: string;
  payment_key: string;
  total_amount: number;
  status:
    | "READY"
    | "IN_PROGRESS"
    | "WAITING_FOR_DEPOSIT"
    | "DONE"
    | "CANCELED"
    | "PARTIAL_CANCELED"
    | "ABORTED"
    | "EXPIRED";
  requested_at: string;
  approved_at?: string | null;
}

interface StorageEnvelope<T> {
  purpose: "reservation-checkout" | "payment-callback";
  version: 1;
  privacyClass: "personal" | "sensitive";
  containsPii: false;
  owner: string;
  createdAt: number;
  expiresAt: number;
  data: T;
}

const createCheckoutDocument = (
  reservationUid: string,
  amount = 100_000,
): CheckoutDocument => ({
  operationId: `operation-${reservationUid}`,
  accommodationId: accommodation.id,
  reservationUid,
  orderName: "합정 테스트 숙소 2박",
  amount,
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  adultOccupancy: 2,
  childOccupancy: 1,
  infantOccupancy: 0,
  petOccupancy: 0,
  couponName: null,
  couponDiscount: null,
});

const createCallbackDocument = (
  checkout: CheckoutDocument,
  paymentKey: string,
): CallbackDocument => ({
  operationId: checkout.operationId,
  reservationUid: checkout.reservationUid,
  orderId: checkout.reservationUid,
  paymentKey,
  amount: checkout.amount,
  phase: "reconciling",
});

const paymentWire = (
  checkout: CheckoutDocument,
  paymentKey: string,
  status: PaymentWire["status"],
): PaymentWire => ({
  order_id: checkout.reservationUid,
  payment_key: paymentKey,
  total_amount: checkout.amount,
  status,
  requested_at: "2026-07-01T00:00:00Z",
  approved_at: status === "DONE" ? "2026-07-01T00:00:01Z" : null,
});

const reservationDetail = (
  reservationUid: string,
  payment: PaymentWire | null = null,
) => ({
  reservation_uid: reservationUid,
  reservation_code: "SYNTHETIC-RESERVATION",
  status: "PAYMENT_COMPLETED",
  created_at: "2026-07-01T00:00:00Z",
  guest_count: 3,
  check_in_date_time: "2026-07-10T15:00:00",
  check_out_date_time: "2026-07-12T11:00:00",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
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
  payment,
});

const seedBookingPaymentDocuments = async (
  page: Page,
  checkout: CheckoutDocument,
  callback?: CallbackDocument,
): Promise<{
  checkout: StorageEnvelope<CheckoutDocument>;
  callback: StorageEnvelope<CallbackDocument> | null;
}> =>
  page.evaluate(
    ({ checkoutData, callbackData, checkoutKey, callbackKey, owner }) => {
      const createdAt = Date.now();
      const checkoutEnvelope = {
        purpose: "reservation-checkout" as const,
        version: 1 as const,
        privacyClass: "personal" as const,
        containsPii: false as const,
        owner,
        createdAt,
        expiresAt: createdAt + 60 * 60 * 1000,
        data: checkoutData,
      };
      const callbackEnvelope = callbackData
        ? {
            purpose: "payment-callback" as const,
            version: 1 as const,
            privacyClass: "sensitive" as const,
            containsPii: false as const,
            owner,
            createdAt,
            expiresAt: createdAt + 15 * 60 * 1000,
            data: callbackData,
          }
        : null;

      sessionStorage.setItem(checkoutKey, JSON.stringify(checkoutEnvelope));
      if (callbackEnvelope) {
        sessionStorage.setItem(callbackKey, JSON.stringify(callbackEnvelope));
      } else {
        sessionStorage.removeItem(callbackKey);
      }

      return { checkout: checkoutEnvelope, callback: callbackEnvelope };
    },
    {
      checkoutData: checkout,
      callbackData: callback ?? null,
      checkoutKey: CHECKOUT_STORAGE_KEY,
      callbackKey: CALLBACK_STORAGE_KEY,
      owner: AUTHENTICATED_OWNER,
    },
  );

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

test("submits one reservation and performs one PII-free checkout handoff on a double click", async ({
  api,
  page,
  session,
}) => {
  const checkout = createCheckoutDocument("res-checkout");

  session.authenticate();
  await installPaymentGatewayFixture(page);
  await page.addInitScript(() => {
    const pushes: string[] = [];
    const originalPushState = window.history.pushState.bind(window.history);
    const syntheticWindow = window as typeof window & {
      __AIRBOB_HISTORY_PUSHES__?: string[];
    };

    syntheticWindow.__AIRBOB_HISTORY_PUSHES__ = pushes;
    window.history.pushState = (data, unused, url) => {
      pushes.push(url === undefined ? "" : String(url));
      originalPushState(data, unused, url);
    };
  });

  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));
  api.register("GET", "/api/v1/coupons", apiSuccess({ infos: [] }));
  api.register(
    "POST",
    "/api/v1/members/recently-viewed/7",
    apiSuccess(null, 201),
  );
  let releaseReservation!: (response: ApiResponseSpec) => void;
  const pendingReservation = new Promise<ApiResponseSpec>((resolve) => {
    releaseReservation = resolve;
  });
  api.register("POST", "/api/v1/reservations", () => pendingReservation);

  await page.goto(
    "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1",
  );

  const reserveButton = page.getByRole("button", { name: "예약하기" });
  await expect(reserveButton).toBeEnabled();
  await reserveButton.evaluate((button) => {
    const reserve = button as HTMLButtonElement;
    reserve.click();
    reserve.click();
  });

  await expect
    .poll(() => api.matching("POST", "/api/v1/reservations").length)
    .toBe(1);
  releaseReservation(
    apiSuccess(
      {
        reservation_uid: checkout.reservationUid,
        order_name: checkout.orderName,
        amount: checkout.amount,
        customer_email: "person-a@example.invalid",
        customer_name: "테스트 사용자",
      },
      201,
    ),
  );

  await expect(page).toHaveURL(/\/accommodations\/7\/confirm$/);
  await expect(
    page.getByRole("heading", { name: "확인 및 결제" }),
  ).toBeVisible();

  const reservationRequests = api.matching("POST", "/api/v1/reservations");
  expect(reservationRequests).toHaveLength(1);
  expect(reservationRequests[0].body).toEqual({
    accommodation_id: 7,
    check_in_date: "2026-07-10",
    check_out_date: "2026-07-12",
    guest_count: 3,
  });

  const checkoutNavigations = await page.evaluate(() => {
    const syntheticWindow = window as typeof window & {
      __AIRBOB_HISTORY_PUSHES__?: string[];
    };

    return (syntheticWindow.__AIRBOB_HISTORY_PUSHES__ ?? []).filter((path) =>
      path.startsWith("/accommodations/7/confirm"),
    );
  });
  expect(checkoutNavigations).toEqual(["/accommodations/7/confirm"]);

  const rawCheckout = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    CHECKOUT_STORAGE_KEY,
  );
  expect(rawCheckout).not.toBeNull();
  expect(rawCheckout).not.toContain("person-a@example.invalid");
  expect(rawCheckout).not.toContain("customerEmail");
  expect(rawCheckout).not.toContain("customerName");
  const checkoutEnvelope = JSON.parse(
    rawCheckout as string,
  ) as StorageEnvelope<CheckoutDocument>;
  expect(checkoutEnvelope).toMatchObject({
    purpose: "reservation-checkout",
    version: 1,
    privacyClass: "personal",
    containsPii: false,
    owner: AUTHENTICATED_OWNER,
    data: expect.objectContaining({
      accommodationId: accommodation.id,
      reservationUid: checkout.reservationUid,
      amount: checkout.amount,
    }),
  });
  expect(checkoutEnvelope.expiresAt - checkoutEnvelope.createdAt).toBe(
    CHECKOUT_TTL_MS,
  );
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("airbob:reservation-checkout-index:res-checkout"),
    ),
  ).toBeNull();
});

test("recovers a complete versioned checkout from session storage after a full reload", async ({
  api,
  page,
  session,
}) => {
  const checkout = createCheckoutDocument("res-reload");

  session.authenticate();
  await installPaymentGatewayFixture(page);
  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));

  await openSeedPage(page);
  const seeded = await seedBookingPaymentDocuments(page, checkout);

  await page.goto("/accommodations/7/confirm");
  await expect(
    page.getByRole("heading", { name: "확인 및 결제" }),
  ).toBeVisible();
  await expect(page.getByText("합정 테스트 숙소", { exact: true })).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "확인 및 결제" }),
  ).toBeVisible();
  await expect(page.getByText("2026년 7월 10일~2026년 7월 12일")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "확인 및 결제" }),
  ).toBeEnabled();
  expect(
    api.matching("GET", "/api/v1/accommodations/7").length,
  ).toBeGreaterThanOrEqual(2);
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      CHECKOUT_STORAGE_KEY,
    ),
  ).toBe(JSON.stringify(seeded.checkout));
  expect(seeded.checkout.owner).toBe(AUTHENTICATED_OWNER);
  expect(seeded.checkout.containsPii).toBe(false);
  expect(seeded.checkout.expiresAt - seeded.checkout.createdAt).toBe(
    CHECKOUT_TTL_MS,
  );
});

test("never re-enters payment request when a callback already exists", async ({
  page,
  session,
}) => {
  const checkout = createCheckoutDocument("res-recovery-only", 1_000);
  const callback = createCallbackDocument(checkout, "pk_recovery_only");

  session.authenticate();
  await installPaymentGatewayFixture(page);
  await openSeedPage(page);
  const seeded = await seedBookingPaymentDocuments(page, checkout, callback);

  await page.goto(`/accommodations/${checkout.accommodationId}/confirm`);

  await expect(page).toHaveURL(
    `/reservations/${checkout.reservationUid}/fail?reason=confirm-failed`,
  );
  expect(await readPaymentGatewayCalls(page)).toEqual([]);
  expect(
    await page.evaluate(
      ({ checkoutKey, callbackKey }) => ({
        checkout: sessionStorage.getItem(checkoutKey),
        callback: sessionStorage.getItem(callbackKey),
      }),
      {
        checkoutKey: CHECKOUT_STORAGE_KEY,
        callbackKey: CALLBACK_STORAGE_KEY,
      },
    ),
  ).toEqual({
    checkout: JSON.stringify(seeded.checkout),
    callback: JSON.stringify(seeded.callback),
  });
});

test("blocks a new reservation while an earlier payment needs recovery", async ({
  api,
  page,
  session,
}) => {
  const activeCheckout = createCheckoutDocument("res-active-recovery", 1_000);
  const activeCallback = createCallbackDocument(
    activeCheckout,
    "pk_active_recovery",
  );

  session.authenticate();
  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));
  api.register("GET", "/api/v1/coupons", apiSuccess({ infos: [] }));
  api.register(
    "POST",
    "/api/v1/members/recently-viewed/7",
    apiSuccess(null, 201),
  );
  await openSeedPage(page);
  const seeded = await seedBookingPaymentDocuments(
    page,
    activeCheckout,
    activeCallback,
  );

  await page.goto(
    "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1",
  );
  const reserveButton = page.getByRole("button", { name: "예약하기" });
  await expect(reserveButton).toBeEnabled();
  await reserveButton.click();

  await expect(page).toHaveURL(
    "/reservations/res-active-recovery/fail?reason=confirm-failed",
  );
  expect(api.matching("POST", "/api/v1/reservations")).toHaveLength(0);
  expect(
    await page.evaluate(
      ({ checkoutKey, callbackKey }) => ({
        checkout: sessionStorage.getItem(checkoutKey),
        callback: sessionStorage.getItem(callbackKey),
      }),
      {
        checkoutKey: CHECKOUT_STORAGE_KEY,
        callbackKey: CALLBACK_STORAGE_KEY,
      },
    ),
  ).toEqual({
    checkout: JSON.stringify(seeded.checkout),
    callback: JSON.stringify(seeded.callback),
  });
});

test("scrubs callback credentials before an anonymous auth redirect", async ({
  page,
}) => {
  const callbackPath =
    "/reservations/res-anonymous/success" +
    "?paymentKey=pk_anonymous&orderId=res-anonymous&amount=1000";

  await page.goto(callbackPath);

  await expect(page).toHaveURL(/\/login$/);
  expect(page.url()).not.toContain("paymentKey");
  const historyState = await page.evaluate(() => window.history.state);
  const serializedHistory = JSON.stringify(historyState);
  expect(serializedHistory).not.toContain("pk_anonymous");
  expect(serializedHistory).not.toContain("1000");
  expect(historyState).toMatchObject({
    usr: {
      from: {
        pathname: "/reservations/res-anonymous/success",
        search: "",
        hash: "",
      },
    },
  });
  expect(
    await page.evaluate(
      ({ checkoutKey, callbackKey }) => ({
        checkout: sessionStorage.getItem(checkoutKey),
        callback: sessionStorage.getItem(callbackKey),
      }),
      {
        checkoutKey: CHECKOUT_STORAGE_KEY,
        callbackKey: CALLBACK_STORAGE_KEY,
      },
    ),
  ).toEqual({ checkout: null, callback: null });
});

test("confirms once, clears owned documents, and server-reconciles a replay without another POST", async ({
  api,
  page,
  session,
}) => {
  const checkout = createCheckoutDocument("res-confirmed", 1_000);
  const paymentKey = "pk_confirmed";
  const callbackPath =
    `/reservations/${checkout.reservationUid}/success` +
    `?paymentKey=${paymentKey}&orderId=${checkout.reservationUid}&amount=${checkout.amount}`;
  let ownershipReads = 0;

  session.authenticate();
  await openSeedPage(page);
  await seedBookingPaymentDocuments(page, checkout);
  api.register("POST", "/api/v1/payments/confirm", apiSuccess(null, 202));
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${checkout.reservationUid}`,
    () => {
      ownershipReads += 1;
      return apiSuccess(
        reservationDetail(
          checkout.reservationUid,
          ownershipReads === 1
            ? null
            : paymentWire(checkout, paymentKey, "DONE"),
        ),
      );
    },
  );

  await page.goto(callbackPath);
  await page.waitForURL((url) =>
    url.pathname === `/reservations/${checkout.reservationUid}` ||
    url.pathname.endsWith("/fail"),
  );
  await expect(page).toHaveURL(
    new RegExp(`/reservations/${checkout.reservationUid}$`),
  );
  await expect(page.getByText("SYNTHETIC-RESERVATION")).toBeVisible();
  expect(page.url()).not.toContain("paymentKey");
  expect(
    await page.evaluate(
      ({ checkoutKey, callbackKey }) => ({
        checkout: sessionStorage.getItem(checkoutKey),
        callback: sessionStorage.getItem(callbackKey),
      }),
      {
        checkoutKey: CHECKOUT_STORAGE_KEY,
        callbackKey: CALLBACK_STORAGE_KEY,
      },
    ),
  ).toEqual({ checkout: null, callback: null });

  await page.goto(callbackPath);
  await page.waitForURL((url) =>
    url.pathname === `/reservations/${checkout.reservationUid}` ||
    url.pathname.endsWith("/fail"),
  );
  await expect(page).toHaveURL(
    new RegExp(`/reservations/${checkout.reservationUid}$`),
  );
  await expect(page.getByText("SYNTHETIC-RESERVATION")).toBeVisible();
  expect(page.url()).not.toContain("paymentKey");

  const confirmRequests = api.matching("POST", "/api/v1/payments/confirm");
  expect(confirmRequests).toHaveLength(1);
  expect(confirmRequests[0].body).toEqual({
    payment_key: paymentKey,
    order_id: checkout.reservationUid,
    amount: checkout.amount,
  });
  expect(ownershipReads).toBeGreaterThanOrEqual(3);
});

test("rejects a mismatched callback without sending payment confirmation", async ({
  api,
  page,
  session,
}) => {
  const checkout = createCheckoutDocument("res-expected", 1_000);

  session.authenticate();
  await openSeedPage(page);
  await seedBookingPaymentDocuments(page, checkout);

  await page.goto(
    "/reservations/res-expected/success?paymentKey=pk_invalid&orderId=res-other&amount=1000",
  );

  await expect(page).toHaveURL(
    /\/reservations\/res-expected\/fail\?reason=invalid-callback$/,
  );
  await expect(
    page.getByRole("heading", { name: "결제에 실패했습니다" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("paymentKey");
  expect(page.url()).not.toContain("orderId");
  expect(page.url()).not.toContain("amount");
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
});

test("reconciles owned failure documents with a pending server payment", async ({
  api,
  page,
  session,
}) => {
  const checkout = createCheckoutDocument("res-pending", 1_000);
  const paymentKey = "pk_pending";
  const callback = createCallbackDocument(checkout, paymentKey);

  session.authenticate();
  await installPaymentGatewayFixture(page);
  await openSeedPage(page);
  const seeded = await seedBookingPaymentDocuments(page, checkout, callback);
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${checkout.reservationUid}`,
    apiSuccess(
      reservationDetail(
        checkout.reservationUid,
        paymentWire(checkout, paymentKey, "IN_PROGRESS"),
      ),
    ),
  );
  api.register(
    "GET",
    `/api/v1/payments/${paymentKey}`,
    apiSuccess(paymentWire(checkout, paymentKey, "IN_PROGRESS")),
  );

  await page.goto(
    `/reservations/${checkout.reservationUid}/fail?reason=confirm-failed`,
  );

  await expect(page).toHaveURL(
    `/reservations/${checkout.reservationUid}/fail?reason=confirm-failed`,
  );
  await expect(
    page.getByRole("heading", { name: "결제에 실패했습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "결제 상태 확인" }).click();

  await expect(page.getByRole("status")).toContainText(
    "결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.",
  );
  expect(
    api.matching(
      "GET",
      `/api/v1/profile/guest/reservations/${checkout.reservationUid}`,
    ),
  ).toHaveLength(1);
  expect(api.matching("GET", `/api/v1/payments/${paymentKey}`)).toHaveLength(1);
  expect(await readPaymentGatewayCalls(page)).toEqual([]);
  expect(page.url()).not.toContain("paymentKey");
  expect(seeded.callback?.owner).toBe(AUTHENTICATED_OWNER);
  expect(seeded.callback?.containsPii).toBe(false);
  expect(
    (seeded.callback?.expiresAt ?? 0) - (seeded.callback?.createdAt ?? 0),
  ).toBe(CALLBACK_TTL_MS);
});

test("reconciles a terminal paid status, clears owned documents, and opens the reservation", async ({
  api,
  page,
  session,
}) => {
  const checkout = createCheckoutDocument("res-done", 1_000);
  const paymentKey = "pk_done";
  const callback = createCallbackDocument(checkout, paymentKey);

  session.authenticate();
  await openSeedPage(page);
  await seedBookingPaymentDocuments(page, checkout, callback);
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${checkout.reservationUid}`,
    apiSuccess(
      reservationDetail(
        checkout.reservationUid,
        paymentWire(checkout, paymentKey, "IN_PROGRESS"),
      ),
    ),
  );
  api.register(
    "GET",
    `/api/v1/payments/${paymentKey}`,
    apiSuccess(paymentWire(checkout, paymentKey, "DONE")),
  );

  await page.goto(
    `/reservations/${checkout.reservationUid}/fail?reason=confirm-failed`,
  );
  await expect(page).toHaveURL(
    `/reservations/${checkout.reservationUid}/fail?reason=confirm-failed`,
  );
  await page.getByRole("button", { name: "결제 상태 확인" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/reservations/${checkout.reservationUid}$`),
  );
  await expect(page.getByText("SYNTHETIC-RESERVATION")).toBeVisible();
  expect(api.matching("GET", `/api/v1/payments/${paymentKey}`)).toHaveLength(1);
  expect(
    await page.evaluate(
      ({ checkoutKey, callbackKey }) => ({
        checkout: sessionStorage.getItem(checkoutKey),
        callback: sessionStorage.getItem(callbackKey),
      }),
      {
        checkoutKey: CHECKOUT_STORAGE_KEY,
        callbackKey: CALLBACK_STORAGE_KEY,
      },
    ),
  ).toEqual({ checkout: null, callback: null });
});
