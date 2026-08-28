import { apiSuccess, type ApiResponseSpec } from "../fixtures/api";
import {
  installPaymentGatewayFixture,
  readPaymentGatewayCalls,
} from "../fixtures/paymentGateway";
import { test, expect } from "../fixtures/test";

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

const checkoutState = {
  reservationUid: "res-checkout",
  orderName: "합정 테스트 숙소 2박",
  amount: 100_000,
  customerEmail: "person-a@example.invalid",
  customerName: "테스트 사용자",
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  adultOccupancy: 2,
  childOccupancy: 1,
  infantOccupancy: 0,
  petOccupancy: 0,
  couponName: null,
  couponDiscount: null,
};

const reservationDetail = (reservationUid: string) => ({
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
  payment: null,
});

test("submits one reservation and performs one checkout handoff on a double click", async ({
  api,
  page,
  session,
}) => {
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
        reservation_uid: checkoutState.reservationUid,
        order_name: checkoutState.orderName,
        amount: checkoutState.amount,
        customer_email: checkoutState.customerEmail,
        customer_name: checkoutState.customerName,
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
});

test("recovers a complete checkout from session storage after a full reload", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installPaymentGatewayFixture(page);
  api.register("GET", "/api/v1/accommodations/7", apiSuccess(accommodation));

  await page.goto("/login");
  await page.evaluate((state) => {
    sessionStorage.setItem(
      "airbob:reservation-checkout:7",
      JSON.stringify(state),
    );
    sessionStorage.setItem(
      `airbob:reservation-checkout-index:${state.reservationUid}`,
      "7",
    );
  }, checkoutState);

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
    await page.evaluate(() =>
      sessionStorage.getItem("airbob:reservation-checkout:7"),
    ),
  ).toBe(JSON.stringify(checkoutState));
});

test("confirms a valid callback only once across a full route remount", async ({
  api,
  page,
  session,
}) => {
  const reservationUid = "res-confirmed";
  const callbackPath =
    `/reservations/${reservationUid}/success` +
    `?paymentKey=pk_confirmed&orderId=${reservationUid}&amount=1000`;

  session.authenticate();
  api.register("POST", "/api/v1/payments/confirm", apiSuccess(null, 202));
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${reservationUid}`,
    apiSuccess(reservationDetail(reservationUid)),
  );

  await page.goto(callbackPath);
  await expect(page).toHaveURL(new RegExp(`/reservations/${reservationUid}$`));
  await expect(page.getByText("SYNTHETIC-RESERVATION")).toBeVisible();

  await page.goto(callbackPath);
  await expect(page).toHaveURL(new RegExp(`/reservations/${reservationUid}$`));
  await expect(page.getByText("SYNTHETIC-RESERVATION")).toBeVisible();

  const confirmRequests = api.matching("POST", "/api/v1/payments/confirm");
  expect(confirmRequests).toHaveLength(1);
  expect(confirmRequests[0].body).toEqual({
    payment_key: "pk_confirmed",
    order_id: reservationUid,
    amount: 1000,
  });
});

test("rejects a mismatched callback without sending payment confirmation", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();

  await page.goto(
    "/reservations/res-expected/success?paymentKey=pk_invalid&orderId=res-other&amount=1000",
  );

  await expect(page).toHaveURL(
    /\/reservations\/res-expected\/fail\?reason=invalid-callback$/,
  );
  await expect(
    page.getByRole("heading", { name: "결제에 실패했습니다" }),
  ).toBeVisible();
  expect(api.matching("POST", "/api/v1/payments/confirm")).toHaveLength(0);
});

test("reconciles a failed callback with a pending server payment", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  await installPaymentGatewayFixture(page);
  api.register(
    "GET",
    "/api/v1/payments/pk_pending",
    apiSuccess({
      order_id: "res-pending",
      payment_key: "pk_pending",
      total_amount: 1000,
      status: "IN_PROGRESS",
      requested_at: "2026-07-01T00:00:00Z",
    }),
  );

  await page.goto(
    "/reservations/res-pending/fail?reason=confirm-failed&paymentKey=pk_pending&orderId=res-pending&amount=1000",
  );

  await expect(
    page.getByRole("heading", { name: "결제에 실패했습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "결제 상태 확인" }).click();

  await expect(page.getByRole("status")).toContainText(
    "결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.",
  );
  expect(api.matching("GET", "/api/v1/payments/pk_pending")).toHaveLength(1);
  expect(await readPaymentGatewayCalls(page)).toEqual([]);
});

test("reconciles a terminal paid status, clears checkout state, and opens the reservation", async ({
  api,
  page,
  session,
}) => {
  const reservationUid = "res-done";
  const terminalCheckoutState = {
    ...checkoutState,
    reservationUid,
  };

  session.authenticate();
  await page.addInitScript((state) => {
    sessionStorage.setItem(
      "airbob:reservation-checkout:7",
      JSON.stringify(state),
    );
    sessionStorage.setItem(
      `airbob:reservation-checkout-index:${state.reservationUid}`,
      "7",
    );
  }, terminalCheckoutState);
  api.register(
    "GET",
    "/api/v1/payments/pk_done",
    apiSuccess({
      order_id: reservationUid,
      payment_key: "pk_done",
      total_amount: 1000,
      status: "DONE",
      requested_at: "2026-07-01T00:00:00Z",
      approved_at: "2026-07-01T00:00:01Z",
    }),
  );
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${reservationUid}`,
    apiSuccess(reservationDetail(reservationUid)),
  );

  await page.goto(
    `/reservations/${reservationUid}/fail?reason=confirm-failed&paymentKey=pk_done&orderId=${reservationUid}&amount=1000`,
  );
  await page.getByRole("button", { name: "결제 상태 확인" }).click();

  await expect(page).toHaveURL(new RegExp(`/reservations/${reservationUid}$`));
  await expect(page.getByText("SYNTHETIC-RESERVATION")).toBeVisible();
  expect(api.matching("GET", "/api/v1/payments/pk_done")).toHaveLength(1);
  expect(
    await page.evaluate(() => ({
      checkout: sessionStorage.getItem("airbob:reservation-checkout:7"),
      index: sessionStorage.getItem(
        "airbob:reservation-checkout-index:res-done",
      ),
    })),
  ).toEqual({ checkout: null, index: null });
});
