import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
import {
  loadLocalIntegrationFixtureConfig,
  observeLocalApiRequests,
  type LocalApiRequestObservation,
} from "../fixtures/localIntegration";
import {
  assertInvariant,
  cleanupCapturedReservationHolds,
  createReservationCheckoutRegistry,
  detailPath,
  expectNoBookingStorage,
  expectStayAvailability,
  installReservationCheckoutCapture,
  login,
  logout,
  navigateSafely,
  readReservationUid,
  releaseHoldFromConfirmation,
  reloadSafely,
  RESERVATION_CHECKOUT_ROUTE,
  runCleanupSteps,
  type CleanupStep,
  type ReservationCheckoutRegistry,
  type StayFixture,
} from "../fixtures/localJourney";

const configuration = loadLocalIntegrationFixtureConfig();

const API_PREFIX = "/api/v1";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ screenshot: "off", trace: "off", video: "off" });

interface BrowserApiResult {
  readonly ok: boolean;
  readonly payload: unknown;
  readonly status: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requirePositiveInteger = (value: unknown, label: string): number => {
  assertInvariant(
    Number.isSafeInteger(value) && Number(value) > 0,
    `${label} did not return a positive identifier.`,
  );
  return Number(value);
};

const requireUuid = (value: unknown, label: string): string => {
  assertInvariant(
    typeof value === "string" && UUID_PATTERN.test(value),
    `${label} did not return a valid resource identifier.`,
  );
  return value;
};

const apiData = (result: BrowserApiResult, label: string): unknown => {
  assertInvariant(result.ok, `${label} request failed.`);
  assertInvariant(isRecord(result.payload), `${label} returned no envelope.`);
  assertInvariant(
    result.payload.success === true && "data" in result.payload,
    `${label} returned an invalid envelope.`,
  );
  return result.payload.data;
};

const apiErrorCode = (payload: unknown, label: string): string => {
  assertInvariant(
    isRecord(payload) && payload.success === false && isRecord(payload.error),
    `${label} returned no canonical failure envelope.`,
  );
  assertInvariant(
    typeof payload.error.code === "string",
    `${label} returned no error code.`,
  );
  return payload.error.code;
};

const browserApiRequest = async (
  page: Page,
  input: {
    readonly body?: unknown;
    readonly method: "DELETE" | "GET" | "POST";
    readonly path: string;
  },
): Promise<BrowserApiResult> =>
  page.evaluate(async ({ body, method, path }) => {
    const response = await fetch(path, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
          }),
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // The caller validates the status before using an optional empty body.
    }
    return { ok: response.ok, payload, status: response.status };
  }, input);

const cleanupDelete = async (page: Page, path: string): Promise<void> => {
  const result = await browserApiRequest(page, { method: "DELETE", path });
  if (result.status === 404) return;
  assertInvariant(
    result.ok && isRecord(result.payload) && result.payload.success === true,
    "Disposable resource cleanup failed.",
  );
};

const cleanupOwnedAccountResources = async (
  page: Page,
  input: {
    readonly authenticated: boolean;
    readonly recentlyViewedAccommodationId: number;
    readonly recentlyViewedNeedsCleanup: boolean;
    readonly wishlistAccommodationId: number | null;
    readonly wishlistId: number | null;
  },
): Promise<void> => {
  if (!input.authenticated) return;
  const cleanupSteps: CleanupStep[] = [];
  if (input.recentlyViewedNeedsCleanup) {
    cleanupSteps.push({
      label: "recently viewed cleanup",
      run: () =>
        cleanupDelete(
          page,
          `${API_PREFIX}/members/recently-viewed/${input.recentlyViewedAccommodationId}`,
        ),
    });
  }
  if (input.wishlistAccommodationId !== null) {
    cleanupSteps.push({
      label: "wishlist accommodation cleanup",
      run: () =>
        cleanupDelete(
          page,
          `${API_PREFIX}/members/wishlists/accommodations/${input.wishlistAccommodationId}`,
        ),
    });
  }
  if (input.wishlistId !== null) {
    cleanupSteps.push({
      label: "wishlist cleanup",
      run: () =>
        cleanupDelete(
          page,
          `${API_PREFIX}/members/wishlists/${input.wishlistId}`,
        ),
    });
  }
  await runCleanupSteps(cleanupSteps, "Owned account resource cleanup");
};

const isTossRequest = (request: { url(): string }): boolean => {
  const hostname = new URL(request.url()).hostname;
  return (
    hostname === "tosspayments.com" ||
    hostname.endsWith(".tosspayments.com") ||
    hostname === "toss.im" ||
    hostname.endsWith(".toss.im")
  );
};

const expectNoCredentialStorage = async (page: Page): Promise<void> => {
  const result = await page.evaluate(({ email, password }) => {
    const stores = [localStorage, sessionStorage];
    const entries = stores.flatMap((storage) =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? "";
        return [key, storage.getItem(key) ?? ""] as const;
      }),
    );
    const containsCredential = entries.some(([key, value]) => {
      const combined = `${key}\n${value}`;
      return combined.includes(email) || combined.includes(password);
    });
    const authKeyPattern =
      /(?:^|[-_:])(auth|token|jwt|cookie|credential|password)(?:$|[-_:])/i;
    const bearerPattern = /^Bearer\s+\S+$/i;
    const jwtPattern = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    return {
      containsCredential,
      hasAuthCredentialKey: entries.some(([key]) => authKeyPattern.test(key)),
      hasAuthCredentialValue: entries.some(([, value]) =>
        [bearerPattern, jwtPattern].some((pattern) =>
          pattern.test(value.trim()),
        ),
      ),
    };
  }, configuration.credentials);

  expect(result.containsCredential).toBe(false);
  expect(result.hasAuthCredentialKey).toBe(false);
  expect(result.hasAuthCredentialValue).toBe(false);
};

const waitForApiCount = async (
  observation: LocalApiRequestObservation,
  input: {
    readonly count?: number;
    readonly method: string;
    readonly pathname: string;
  },
): Promise<void> => {
  await expect
    .poll(
      async () => {
        await observation.settle();
        return observation.requests.filter(
          (request) =>
            request.method === input.method &&
            request.pathname === input.pathname,
        ).length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(input.count ?? 1);
};

const openBookableStay = async (
  page: Page,
  fixture: StayFixture,
): Promise<void> => {
  await navigateSafely(page, detailPath(fixture), "Accommodation detail");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "예약하기" })).toBeEnabled();
};

const quoteStay = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "예약하기" }).click();
  await expect(
    page.getByRole("region", { name: "확정된 예약 견적" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "예약 계속하기" }),
  ).toBeEnabled();
};

const fulfillOrLoseFirstResponse =
  (
    state: { count: number },
    registry: ReservationCheckoutRegistry,
    onSecondResponse?: () => void,
  ) =>
  async (route: Route): Promise<void> => {
    const response = await route.fetch();
    await registry.capture(response, "Paid checkout replay");
    state.count += 1;
    if (state.count === 1) {
      await route.abort("connectionreset");
      return;
    }
    onSecondResponse?.();
    await route.fulfill({ response });
  };

test("uses the Vite proxy for cookie session, search, wishlist, detail, and owned cleanup", async ({
  page,
}) => {
  const observation = observeLocalApiRequests(page);
  let authenticated = false;
  let recentlyViewedNeedsCleanup = false;
  let wishlistId: number | null = null;
  let wishlistAccommodationId: number | null = null;
  const recentlyViewedId = configuration.fixtures.paid[0].accommodationId;

  try {
    await login(page, configuration.credentials);
    authenticated = true;
    await expectNoCredentialStorage(page);

    const authenticatedMe = await browserApiRequest(page, {
      method: "GET",
      path: `${API_PREFIX}/auth/me`,
    });
    assertInvariant(
      authenticatedMe.ok,
      "Authenticated session was not reusable.",
    );
    await waitForApiCount(observation, {
      method: "GET",
      pathname: `${API_PREFIX}/auth/me`,
    });
    await observation.settle();
    const authenticatedReads = observation.requests.filter(
      (request) =>
        request.method === "GET" &&
        request.pathname === `${API_PREFIX}/auth/me`,
    );
    assertInvariant(
      authenticatedReads.some((request) => request.hasCookie),
      "Authenticated API read did not carry the cookie session.",
    );
    assertInvariant(
      authenticatedReads.every((request) => !request.hasAuthorization),
      "Browser session unexpectedly used an authorization header.",
    );

    const searchQuery = new URLSearchParams({
      adultOccupancy: "2",
      destination: configuration.fixtures.searchDestination,
    });
    await navigateSafely(page, `/search?${searchQuery.toString()}`, "Search");
    const searchResultHeading = page.getByRole("heading", {
      level: 2,
      name: /^숙소 [\d,]+개(?: 이상)?$/,
    });
    await expect(searchResultHeading).toBeVisible();
    await expect
      .poll(async () => {
        const text = (await searchResultHeading.textContent())?.replaceAll(
          ",",
          "",
        );
        const match = /^숙소 (\d+)개(?: 이상)?$/.exec(text ?? "");
        return match !== null && Number(match[1]) > 0;
      })
      .toBe(true);
    await waitForApiCount(observation, {
      method: "GET",
      pathname: `${API_PREFIX}/search/accommodations`,
    });
    await observation.settle();
    const expectedSearchQueryNames = [
      "adultOccupancy",
      "childOccupancy",
      "destination",
      "infantOccupancy",
      "page",
      "petOccupancy",
      "size",
    ];
    assertInvariant(
      observation.requests.some(
        (request) =>
          request.method === "GET" &&
          request.pathname === `${API_PREFIX}/search/accommodations` &&
          expectedSearchQueryNames.every((name) =>
            request.queryNames.includes(name),
          ),
      ),
      "Search did not preserve its canonical query names.",
    );

    await navigateSafely(page, "/wishlist", "Wishlist");
    await expect(
      page.getByRole("heading", { name: "위시리스트" }),
    ).toBeVisible();
    await waitForApiCount(observation, {
      method: "GET",
      pathname: `${API_PREFIX}/members/wishlists`,
    });

    const uniqueName = `u12-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const createdWishlist = apiData(
      await browserApiRequest(page, {
        method: "POST",
        path: `${API_PREFIX}/members/wishlists`,
        body: { name: uniqueName },
      }),
      "Wishlist creation",
    );
    assertInvariant(
      isRecord(createdWishlist),
      "Wishlist creation returned no data.",
    );
    wishlistId = requirePositiveInteger(
      createdWishlist.id,
      "Wishlist creation",
    );

    const addedAccommodation = apiData(
      await browserApiRequest(page, {
        method: "POST",
        path: `${API_PREFIX}/members/wishlists/accommodations/${wishlistId}`,
        body: {
          accommodation_id: configuration.fixtures.wishlistAccommodationId,
        },
      }),
      "Wishlist accommodation creation",
    );
    assertInvariant(
      isRecord(addedAccommodation),
      "Wishlist accommodation creation returned no data.",
    );
    wishlistAccommodationId = requirePositiveInteger(
      addedAccommodation.id,
      "Wishlist accommodation creation",
    );

    await reloadSafely(page, "Wishlist");
    await expect
      .poll(() =>
        page
          .locator("body")
          .evaluate(
            (body, expectedName) =>
              body.textContent?.includes(expectedName) === true,
            uniqueName,
          ),
      )
      .toBe(true);

    const paidFixture = configuration.fixtures.paid[0];
    recentlyViewedNeedsCleanup = true;
    await navigateSafely(page, detailPath(paidFixture), "Accommodation detail");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await waitForApiCount(observation, {
      method: "GET",
      pathname: `${API_PREFIX}/accommodations/:id`,
    });
    await waitForApiCount(observation, {
      method: "GET",
      pathname: `${API_PREFIX}/accommodations/:id/availability`,
    });
    await waitForApiCount(observation, {
      method: "POST",
      pathname: `${API_PREFIX}/members/recently-viewed/:id`,
    });

    await cleanupDelete(
      page,
      `${API_PREFIX}/members/recently-viewed/${recentlyViewedId}`,
    );
    recentlyViewedNeedsCleanup = false;
    await cleanupDelete(
      page,
      `${API_PREFIX}/members/wishlists/accommodations/${wishlistAccommodationId}`,
    );
    wishlistAccommodationId = null;
    await cleanupDelete(page, `${API_PREFIX}/members/wishlists/${wishlistId}`);
    wishlistId = null;

    await logout(page);
    authenticated = false;
    const anonymousMe = await browserApiRequest(page, {
      method: "GET",
      path: `${API_PREFIX}/auth/me`,
    });
    expect([401, 403]).toContain(anonymousMe.status);
    await expectNoCredentialStorage(page);
    await expectNoBookingStorage(page);
  } finally {
    await runCleanupSteps(
      [
        {
          label: "owned account resource cleanup",
          run: () =>
            cleanupOwnedAccountResources(page, {
              authenticated,
              recentlyViewedAccommodationId: recentlyViewedId,
              recentlyViewedNeedsCleanup,
              wishlistAccommodationId,
              wishlistId,
            }),
        },
        {
          label: "request observation teardown",
          run: () => observation.stop(),
        },
      ],
      "Proxy journey cleanup",
    );
  }
});

test("revokes an authenticated checkout generation without payment or credential storage", async ({
  page,
}) => {
  const observation = observeLocalApiRequests(page);

  try {
    await login(page, configuration.credentials);
    await openBookableStay(page, configuration.fixtures.paid[2]);
    await quoteStay(page);
    const detailUrl = new URL(page.url());
    await expectNoCredentialStorage(page);
    void apiData(
      await browserApiRequest(page, {
        method: "POST",
        path: `${API_PREFIX}/auth/logout`,
      }),
      "Server session revocation",
    );
    await expect(page.getByRole("button", { name: "프로필" })).toBeVisible();

    const checkoutResponse = page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === "POST" &&
        new URL(response.url()).pathname === `${API_PREFIX}/reservations`
      );
    });
    await page.getByRole("button", { name: "예약 계속하기" }).click();
    const rejectedCheckout = await checkoutResponse;
    const rejectedPayload = (await rejectedCheckout.json()) as unknown;
    const rejectedCode = apiErrorCode(rejectedPayload, "Revoked checkout");
    expect([401, 403]).toContain(rejectedCheckout.status());
    expect(rejectedCode).toBe("M004");
    await waitForApiCount(observation, {
      method: "POST",
      pathname: `${API_PREFIX}/reservations`,
    });
    await waitForApiCount(observation, {
      method: "GET",
      pathname: `${API_PREFIX}/auth/me`,
    });
    await expect(page.getByRole("button", { name: "프로필" })).toBeHidden();
    await observation.settle();
    const checkoutRequests = observation.requests.filter(
      (request) =>
        request.method === "POST" &&
        request.pathname === `${API_PREFIX}/reservations`,
    );
    assertInvariant(
      checkoutRequests.length === 1 &&
        checkoutRequests[0]?.postDataFingerprint !== null &&
        checkoutRequests[0]?.idempotencyKeyFingerprint !== null &&
        checkoutRequests[0]?.hasAuthorization === false,
      "Revoked generation did not issue one bounded cookie-session checkout.",
    );
    const paymentTraffic = observation.requests.filter(
      (request) =>
        request.method === "POST" &&
        (request.pathname.endsWith("/payment-attempts") ||
          request.pathname === `${API_PREFIX}/payments/confirm`),
    ).length;
    expect(paymentTraffic).toBe(0);
    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe(detailUrl.pathname);
    expect(currentUrl.search).toBe(detailUrl.search);
    await expect(page.getByRole("dialog", { name: "로그인" })).toHaveCount(0);
    await page.getByRole("button", { name: "사용자 메뉴" }).click();
    await expect(page.getByRole("menuitem", { name: "로그인" })).toBeVisible();
    await expectNoBookingStorage(page);
    await expectNoCredentialStorage(page);
  } finally {
    await runCleanupSteps(
      [
        {
          label: "request observation teardown",
          run: () => observation.stop(),
        },
      ],
      "Session revocation cleanup",
    );
  }
});

test("replays the exact paid checkout after response loss and releases its hold", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const observation = observeLocalApiRequests(page);
  const routeState = { count: 0 };
  const checkoutPath = `${API_PREFIX}/reservations`;
  const checkoutRegistry = createReservationCheckoutRegistry();
  const checkoutRouteHandler = fulfillOrLoseFirstResponse(
    routeState,
    checkoutRegistry,
  );
  let released = false;
  await page.route(RESERVATION_CHECKOUT_ROUTE, checkoutRouteHandler);

  try {
    await login(page, configuration.credentials);
    await openBookableStay(page, configuration.fixtures.paid[0]);
    await quoteStay(page);

    const continueButton = page.getByRole("button", {
      name: "예약 계속하기",
    });
    await continueButton.click();
    await expect.poll(() => routeState.count).toBe(1);
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect.poll(() => routeState.count).toBe(2);
    await expect(
      page.getByRole("heading", { name: "확인 및 결제" }),
    ).toBeVisible();

    await observation.settle();
    const checkoutRequests = observation.requests.filter(
      (request) =>
        request.method === "POST" && request.pathname === checkoutPath,
    );
    assertInvariant(
      checkoutRequests.length === 2,
      "Checkout replay count diverged.",
    );
    const [first, second] = checkoutRequests;
    assertInvariant(
      first !== undefined && second !== undefined,
      "Checkout replay was incomplete.",
    );
    assertInvariant(
      first.postDataFingerprint !== null &&
        first.postDataFingerprint === second.postDataFingerprint,
      "Checkout replay changed its exact request body.",
    );
    assertInvariant(
      first.idempotencyKeyFingerprint !== null &&
        first.idempotencyKeyFingerprint === second.idempotencyKeyFingerprint,
      "Checkout replay changed its idempotency identity.",
    );

    const captured = checkoutRegistry.requireSingle(
      true,
      "Paid checkout replay",
    );
    const reservationUid = await readReservationUid(page);
    assertInvariant(
      reservationUid === captured.reservationUid,
      "Checkout journal did not retain the captured reservation.",
    );
    await expectStayAvailability(page, configuration.fixtures.paid[0], false);
    await releaseHoldFromConfirmation(page, reservationUid);
    released = true;
    await waitForApiCount(observation, {
      method: "DELETE",
      pathname: `${API_PREFIX}/reservations/:id/hold`,
    });
    await expectStayAvailability(page, configuration.fixtures.paid[0], true);
    await logout(page);
  } finally {
    await runCleanupSteps(
      [
        {
          label: "reservation hold cleanup",
          run: () =>
            cleanupCapturedReservationHolds(page, checkoutRegistry, released),
        },
        {
          label: "reservation checkout route teardown",
          run: () =>
            page.unroute(RESERVATION_CHECKOUT_ROUTE, checkoutRouteHandler),
        },
        {
          label: "request observation teardown",
          run: () => observation.stop(),
        },
      ],
      "Paid checkout replay cleanup",
    );
  }
});

test("reuses one paid payment attempt and explicitly releases the independent hold", async ({
  page,
}) => {
  const observation = observeLocalApiRequests(page);
  const checkoutRegistry = createReservationCheckoutRegistry();
  const checkoutRouteCleanup = await installReservationCheckoutCapture(
    page,
    checkoutRegistry,
  );
  let released = false;

  try {
    await login(page, configuration.credentials);
    await openBookableStay(page, configuration.fixtures.paid[1]);
    await quoteStay(page);
    await page.getByRole("button", { name: "예약 계속하기" }).click();
    const captured = checkoutRegistry.requireSingle(
      true,
      "Payment-attempt checkout",
    );
    await expect(
      page.getByRole("heading", { name: "확인 및 결제" }),
    ).toBeVisible();
    const reservationUid = await readReservationUid(page);
    assertInvariant(
      reservationUid === captured.reservationUid,
      "Payment-attempt journal did not retain the captured reservation.",
    );
    const attemptPath = `${API_PREFIX}/reservations/${reservationUid}/payment-attempts`;
    const observedAttemptPath = `${API_PREFIX}/reservations/:id/payment-attempts`;

    const firstAttempt = apiData(
      await browserApiRequest(page, { method: "POST", path: attemptPath }),
      "First payment attempt",
    );
    const secondAttempt = apiData(
      await browserApiRequest(page, { method: "POST", path: attemptPath }),
      "Payment-attempt replay",
    );
    assertInvariant(
      isRecord(firstAttempt) && isRecord(secondAttempt),
      "Payment-attempt replay returned no data.",
    );
    const firstAttemptId = requireUuid(
      firstAttempt.payment_attempt_id,
      "First payment attempt",
    );
    const secondAttemptId = requireUuid(
      secondAttempt.payment_attempt_id,
      "Payment-attempt replay",
    );
    assertInvariant(
      firstAttemptId === secondAttemptId,
      "Payment-attempt replay created a different attempt.",
    );
    assertInvariant(
      firstAttempt.order_id === reservationUid &&
        secondAttempt.order_id === reservationUid,
      "Payment-attempt replay changed reservation identity.",
    );
    await waitForApiCount(observation, {
      count: 2,
      method: "POST",
      pathname: observedAttemptPath,
    });
    await observation.settle();
    assertInvariant(
      observation.requests.filter(
        (request) =>
          request.method === "POST" && request.pathname === observedAttemptPath,
      ).length === 2,
      "Payment-attempt replay count diverged.",
    );

    await releaseHoldFromConfirmation(page, reservationUid);
    released = true;
    await waitForApiCount(observation, {
      method: "DELETE",
      pathname: `${API_PREFIX}/reservations/:id/hold`,
    });
    await logout(page);
  } finally {
    await runCleanupSteps(
      [
        {
          label: "reservation hold cleanup",
          run: () =>
            cleanupCapturedReservationHolds(page, checkoutRegistry, released),
        },
        checkoutRouteCleanup,
        {
          label: "request observation teardown",
          run: () => observation.stop(),
        },
      ],
      "Payment-attempt replay cleanup",
    );
  }
});

test("completes the disposable zero-won branch without attempt, Toss, or confirm", async ({
  page,
}) => {
  const observation = observeLocalApiRequests(page);
  const checkoutRegistry = createReservationCheckoutRegistry();
  const checkoutRouteCleanup = await installReservationCheckoutCapture(
    page,
    checkoutRegistry,
  );
  let providerRequestCount = 0;
  const countProviderRequest = (request: { url(): string }): void => {
    providerRequestCount += Number(isTossRequest(request));
  };
  page.on("request", countProviderRequest);

  try {
    await login(page, configuration.credentials);
    const fixture = configuration.fixtures.complimentary;
    await openBookableStay(page, fixture);

    const couponCollection = apiData(
      await browserApiRequest(page, {
        method: "GET",
        path: `${API_PREFIX}/coupons`,
      }),
      "Coupon collection",
    );
    assertInvariant(
      isRecord(couponCollection),
      "Coupon collection returned no data.",
    );
    assertInvariant(
      Array.isArray(couponCollection.infos),
      "Coupon collection was invalid.",
    );
    const couponFixture = couponCollection.infos.find(
      (candidate) => isRecord(candidate) && candidate.id === fixture.couponId,
    );
    assertInvariant(
      isRecord(couponFixture) && typeof couponFixture.name === "string",
      "Complimentary coupon fixture was not available.",
    );

    const couponAction = page
      .getByRole("group", { name: String(couponFixture.name), exact: true })
      .getByRole("button", { name: /^(발급받기|적용하기)$/ });
    await expect(couponAction).toBeEnabled();
    await couponAction.click();
    await expect(page.getByRole("button", { name: "적용 중" })).toBeDisabled();

    await quoteStay(page);
    const quote = page.getByRole("region", { name: "확정된 예약 견적" });
    await expect(quote.getByText("₩0", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "예약 계속하기" }).click();
    const captured = checkoutRegistry.requireSingle(
      false,
      "Complimentary checkout",
    );
    await expect
      .poll(
        () =>
          new URL(page.url()).pathname ===
          `/reservations/${captured.reservationUid}`,
        {
          timeout: 15_000,
        },
      )
      .toBe(true);

    await observation.settle();
    const forbiddenLocalTraffic = observation.requests.filter(
      (request) =>
        request.pathname === `${API_PREFIX}/payments/confirm` ||
        request.pathname.startsWith(`${API_PREFIX}/payment-operations/`) ||
        request.pathname.endsWith("/payment-attempts"),
    ).length;
    expect(forbiddenLocalTraffic).toBe(0);
    expect(providerRequestCount).toBe(0);
    await expectNoBookingStorage(page);
    test.info().annotations.push({
      type: "cleanup-owner",
      description:
        "The complimentary reservation has no public delete API and is owned by the exact disposable local profile reset.",
    });
    await logout(page);
  } finally {
    await runCleanupSteps(
      [
        {
          label: "provider observation teardown",
          run: async () => {
            page.off("request", countProviderRequest);
          },
        },
        {
          label: "unexpected reservation hold cleanup",
          run: () => cleanupCapturedReservationHolds(page, checkoutRegistry),
        },
        checkoutRouteCleanup,
        {
          label: "request observation teardown",
          run: () => observation.stop(),
        },
      ],
      "Complimentary checkout cleanup",
    );
  }
});
