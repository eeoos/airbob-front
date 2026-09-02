import {
  expect,
  test,
  type Frame,
  type Locator,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";
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
  expectPath,
  installReservationCheckoutCapture,
  login,
  logout,
  navigateSafely,
  readReservationUid,
  releaseHoldFromConfirmation,
  reloadSafely,
  runCleanupSteps,
  type ReservationCheckoutRegistry,
  type StayFixture,
} from "../fixtures/localJourney";

const configuration = loadLocalIntegrationFixtureConfig({ requireToss: true });
const tossConfiguration = configuration.toss;

const API_PREFIX = "/api/v1";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ screenshot: "off", trace: "off", video: "off" });

assertInvariant(
  tossConfiguration?.runToss === true &&
    tossConfiguration.clientKeyPresent === true &&
    tossConfiguration.failureProfileConfigured === true &&
    tossConfiguration.provider.testOnly === true,
  "Toss sandbox execution was not explicitly enabled with test-only provider data.",
);

const expectScrubbedPath = async (
  page: Page,
  pathname: string,
): Promise<void> => {
  await expect
    .poll(
      () => {
        const url = new URL(page.url());
        return (
          url.pathname === pathname &&
          url.search.length === 0 &&
          url.hash.length === 0
        );
      },
      { timeout: 15_000 },
    )
    .toBe(true);
};

const createPaidCheckout = async (
  page: Page,
  fixture: StayFixture,
  registry: ReservationCheckoutRegistry,
): Promise<string> => {
  await navigateSafely(page, detailPath(fixture), "Accommodation detail");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const reserve = page.getByRole("button", { name: "예약하기" });
  await expect(reserve).toBeEnabled();
  await reserve.click();
  await expect(
    page.getByRole("region", { name: "확정된 예약 견적" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "예약 계속하기" }).click();
  const captured = registry.requireSingle(true, "Sandbox checkout");
  await expect(
    page.getByRole("heading", { name: "확인 및 결제" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "확인 및 결제" })).toBeEnabled({
    timeout: 15_000,
  });
  const journalReservationUid = await readReservationUid(
    page,
    "Sandbox checkout",
  );
  assertInvariant(
    journalReservationUid === captured.reservationUid,
    "Sandbox journal did not retain the captured reservation.",
  );
  return captured.reservationUid;
};

const isTossHostname = (hostname: string): boolean =>
  hostname === "tosspayments.com" ||
  hostname.endsWith(".tosspayments.com") ||
  hostname === "toss.im" ||
  hostname.endsWith(".toss.im");

const isInteractiveTossFrame = async (frame: Frame): Promise<boolean> =>
  frame
    .locator("button:visible, input:visible")
    .count()
    .then((count) => count > 0)
    .catch(() => false);

const findTossFrame = async (page: Page): Promise<Frame | null> => {
  for (const frame of page.frames()) {
    try {
      const isProviderFrame =
        frame !== page.mainFrame() &&
        isTossHostname(new URL(frame.url()).hostname);
      if (isProviderFrame && (await isInteractiveTossFrame(frame)))
        return frame;
    } catch {
      // A navigating provider frame is not ready for interaction yet.
    }
  }
  return null;
};

const waitForTossFrame = async (page: Page): Promise<Frame> => {
  await expect
    .poll(async () => (await findTossFrame(page)) !== null, {
      timeout: 15_000,
    })
    .toBe(true);
  const frame = await findTossFrame(page);
  assertInvariant(
    frame !== null,
    "Toss sandbox frame did not become available.",
  );
  return frame;
};

const waitForTossFrameClosed = async (page: Page): Promise<void> => {
  await expect
    .poll(async () => (await findTossFrame(page)) === null, {
      timeout: 15_000,
    })
    .toBe(true);
};

const firstVisible = async (
  candidates: readonly Locator[],
  timeout = 8_000,
): Promise<Locator | null> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      if (
        await candidate
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        return candidate.first();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
};

const requireVisible = async (
  candidates: readonly Locator[],
  label: string,
): Promise<Locator> => {
  const locator = await firstVisible(candidates);
  assertInvariant(
    locator !== null,
    `${label} was not available in the sandbox.`,
  );
  return locator;
};

const selectCardMethodIfPresent = async (frame: Frame): Promise<void> => {
  const cardMethod = await firstVisible(
    [
      frame.getByRole("button", { name: /^카드$/ }),
      frame.getByRole("button", { name: /신용.*체크.*카드/ }),
      frame.getByText(/^카드$/, { exact: true }),
    ],
    2_000,
  );
  if (cardMethod !== null) await cardMethod.click();
};

const fillSandboxCard = async (frame: Frame): Promise<void> => {
  await selectCardMethodIfPresent(frame);
  const provider = tossConfiguration.provider;
  const cardNumber = await requireVisible(
    [
      frame.getByLabel(/카드번호/),
      frame.locator('input[autocomplete="cc-number"]'),
      frame.locator('input[name*="card" i]'),
    ],
    "Sandbox card-number input",
  );
  await cardNumber.fill("");
  await cardNumber.pressSequentially(provider.cardNumber);

  const expiry = await requireVisible(
    [
      frame.getByLabel(/유효기간/),
      frame.locator('input[autocomplete="cc-exp"]'),
      frame.locator('input[name*="expir" i]'),
    ],
    "Sandbox card-expiry input",
  );
  await expiry.fill("");
  await expiry.pressSequentially(provider.expiry.replace("/", ""));

  const cvc = await requireVisible(
    [
      frame.getByLabel(/CVC|보안.?코드/i),
      frame.locator('input[autocomplete="cc-csc"]'),
      frame.locator('input[name*="cvc" i]'),
    ],
    "Sandbox card CVC input",
  );
  await cvc.fill(provider.cvc);

  const password = await requireVisible(
    [frame.getByLabel(/비밀번호/), frame.locator('input[name*="password" i]')],
    "Sandbox card-password input",
  );
  await password.fill(provider.password);
};

const cancelSandboxPayment = async (frame: Frame): Promise<void> => {
  const cancel = await requireVisible(
    [
      frame.getByRole("button", { name: /^취소$/ }),
      frame.getByRole("button", { name: /결제.*취소/ }),
      frame.getByRole("button", { name: /닫기/ }),
    ],
    "Sandbox cancel control",
  );
  await cancel.click();
};

const prepareSandboxSuccess = async (frame: Frame): Promise<Locator> => {
  await fillSandboxCard(frame);
  return requireVisible(
    [
      frame.getByRole("button", { name: /결제하기/ }),
      frame.getByRole("button", { name: /결제.*요청/ }),
      frame.getByRole("button", { name: /^다음$/ }),
    ],
    "Sandbox payment submit control",
  );
};

const observeCallbackNames = (
  page: Page,
  pathname: string,
): { readonly sawCredentialCallback: () => boolean; stop(): void } => {
  let sawCredentialCallback = false;
  const onRequest = (request: Request): void => {
    if (
      !request.isNavigationRequest() ||
      request.frame() !== page.mainFrame()
    ) {
      return;
    }
    try {
      const url = new URL(request.url());
      const names = [...url.searchParams.keys()];
      if (
        url.pathname === pathname &&
        names.includes("paymentKey") &&
        names.includes("orderId") &&
        names.includes("amount")
      ) {
        sawCredentialCallback = true;
      }
    } catch {
      // A malformed navigation target cannot establish callback evidence.
    }
  };
  page.on("request", onRequest);
  return {
    sawCredentialCallback: () => sawCredentialCallback,
    stop: () => page.off("request", onRequest),
  };
};

const observeExpectedFailureCode = (
  page: Page,
  expectedFailureCode: string,
): {
  readonly sawExpectedFailure: () => boolean;
  settle(): Promise<void>;
  stop(): Promise<void>;
} => {
  let sawExpectedFailure = false;
  const pending: Promise<void>[] = [];
  const onResponse = (response: Response): void => {
    const request = response.request();
    const pathname = new URL(response.url()).pathname;
    if (
      request.method() !== "GET" ||
      !/^\/api\/v1\/payment-operations\/[^/]+$/.test(pathname)
    ) {
      return;
    }

    pending.push(
      response
        .json()
        .then((payload: unknown) => {
          const data =
            isRecord(payload) && isRecord(payload.data) ? payload.data : null;
          if (
            response.ok() &&
            isRecord(payload) &&
            payload.success === true &&
            data?.failure_code === expectedFailureCode
          ) {
            sawExpectedFailure = true;
          }
        })
        .catch(() => undefined),
    );
  };
  const settle = async (): Promise<void> => {
    while (pending.length > 0) {
      await Promise.all(pending.splice(0));
    }
  };
  page.on("response", onResponse);

  return {
    sawExpectedFailure: () => sawExpectedFailure,
    settle,
    async stop() {
      page.off("response", onResponse);
      await settle();
    },
  };
};

const countRequests = async (
  observation: LocalApiRequestObservation,
  method: string,
  pathname: string,
): Promise<number> => {
  await observation.settle();
  return observation.requests.filter(
    (request) => request.method === method && request.pathname === pathname,
  ).length;
};

test("cancels the guarded Toss sandbox window and releases the first paid hold", async ({
  page,
}) => {
  const observation = observeLocalApiRequests(page);
  const checkoutRegistry = createReservationCheckoutRegistry();
  const checkoutRouteCleanup = await installReservationCheckoutCapture(
    page,
    checkoutRegistry,
  );
  let reservationUid: string | null = null;
  let released = false;

  try {
    await login(page, configuration.credentials);
    reservationUid = await createPaidCheckout(
      page,
      configuration.fixtures.paid[0],
      checkoutRegistry,
    );
    await page.getByRole("button", { name: "확인 및 결제" }).click();
    const frame = await waitForTossFrame(page);
    await cancelSandboxPayment(frame);
    await expect(page.getByRole("alert")).toContainText(
      "같은 결제 시도로 다시 진행할 수 있습니다",
    );
    await waitForTossFrameClosed(page);
    await reloadSafely(page, "Reservation confirmation");
    await expect(
      page.getByRole("heading", { name: "확인 및 결제" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "확인 및 결제" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "확인 및 결제" }).click();
    const replayFrame = await waitForTossFrame(page);
    await cancelSandboxPayment(replayFrame);
    await expect(page.getByRole("alert")).toContainText(
      "같은 결제 시도로 다시 진행할 수 있습니다",
    );
    await waitForTossFrameClosed(page);
    assertInvariant(
      (await countRequests(
        observation,
        "POST",
        `${API_PREFIX}/reservations/:id/payment-attempts`,
      )) === 1,
      "Sandbox cancellation created more than one payment attempt.",
    );

    await releaseHoldFromConfirmation(page, reservationUid);
    released = true;
    assertInvariant(
      (await countRequests(
        observation,
        "DELETE",
        `${API_PREFIX}/reservations/:id/hold`,
      )) === 1,
      "Sandbox cancellation did not release its hold exactly once.",
    );
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
      "Sandbox cancellation cleanup",
    );
  }
});

test("surfaces the configured sandbox confirm failure after a scrubbed callback", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const observation = observeLocalApiRequests(page);
  const checkoutRegistry = createReservationCheckoutRegistry();
  const checkoutRouteCleanup = await installReservationCheckoutCapture(
    page,
    checkoutRegistry,
  );
  const failureCodeObservation = observeExpectedFailureCode(
    page,
    tossConfiguration.expectedFailureCode,
  );
  let reservationUid: string | null = null;
  let providerSubmissionStarted = false;
  let callbackObservation: ReturnType<typeof observeCallbackNames> | null =
    null;

  try {
    await login(page, configuration.credentials);
    reservationUid = await createPaidCheckout(
      page,
      configuration.fixtures.paid[1],
      checkoutRegistry,
    );
    const successPath = `/reservations/${reservationUid}/success`;
    callbackObservation = observeCallbackNames(page, successPath);
    await page.getByRole("button", { name: "확인 및 결제" }).click();
    const frame = await waitForTossFrame(page);
    const submit = await prepareSandboxSuccess(frame);
    // From provider submission onward, callback/confirm may be in flight. The
    // disposable backend reset owns cleanup; never race it with hold release.
    providerSubmissionStarted = true;
    await submit.click();

    await expectScrubbedPath(page, successPath);
    expect(callbackObservation.sawCredentialCallback()).toBe(true);
    await expect
      .poll(
        () =>
          countRequests(observation, "POST", `${API_PREFIX}/payments/confirm`),
        { timeout: 15_000 },
      )
      .toBe(1);
    await expect(
      page.getByRole("heading", { name: "결제가 완료되지 않았습니다" }),
    ).toBeVisible({ timeout: 45_000 });
    expect(
      (await countRequests(
        observation,
        "GET",
        `${API_PREFIX}/payment-operations/:id`,
      )) >= 1,
    ).toBe(true);
    await expect
      .poll(async () => {
        await failureCodeObservation.settle();
        return failureCodeObservation.sawExpectedFailure();
      })
      .toBe(true);
    await page.getByRole("button", { name: "확인하고 예약 보기" }).click();
    await expectPath(page, `/reservations/${reservationUid}`);
    await expectNoBookingStorage(page);
    test.info().annotations.push({
      type: "failure-profile",
      description:
        "The backend-owned sandbox profile injects the official confirm test code without exposing it to Playwright or Vite.",
    });
    await logout(page);
  } finally {
    await runCleanupSteps(
      [
        {
          label: "callback observation teardown",
          run: async () => callbackObservation?.stop(),
        },
        {
          label: "failure response observation teardown",
          run: () => failureCodeObservation.stop(),
        },
        {
          label: "reservation hold cleanup",
          run: () =>
            cleanupCapturedReservationHolds(
              page,
              checkoutRegistry,
              providerSubmissionStarted,
            ),
        },
        checkoutRouteCleanup,
        {
          label: "request observation teardown",
          run: () => observation.stop(),
        },
      ],
      "Sandbox failure cleanup",
    );
  }
});

test("scrubs a real sandbox success callback and reaches one bounded terminal operation", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const observation = observeLocalApiRequests(page);
  const checkoutRegistry = createReservationCheckoutRegistry();
  const checkoutRouteCleanup = await installReservationCheckoutCapture(
    page,
    checkoutRegistry,
  );
  let reservationUid: string | null = null;
  let providerSubmissionStarted = false;
  let callbackObservation: ReturnType<typeof observeCallbackNames> | null =
    null;

  try {
    await login(page, configuration.credentials);
    reservationUid = await createPaidCheckout(
      page,
      configuration.fixtures.paid[2],
      checkoutRegistry,
    );
    const successPath = `/reservations/${reservationUid}/success`;
    callbackObservation = observeCallbackNames(page, successPath);
    await page.getByRole("button", { name: "확인 및 결제" }).click();
    const frame = await waitForTossFrame(page);
    const submit = await prepareSandboxSuccess(frame);
    providerSubmissionStarted = true;
    await submit.click();

    await expectScrubbedPath(page, successPath);
    expect(callbackObservation.sawCredentialCallback()).toBe(true);
    await expect
      .poll(
        () =>
          countRequests(observation, "POST", `${API_PREFIX}/payments/confirm`),
        { timeout: 15_000 },
      )
      .toBe(1);
    await expect
      .poll(
        async () =>
          (await countRequests(
            observation,
            "GET",
            `${API_PREFIX}/payment-operations/:id`,
          )) >= 1,
        { timeout: 45_000 },
      )
      .toBe(true);
    await expect(
      page.getByRole("heading", { name: "결제가 완료되었습니다" }),
    ).toBeVisible({ timeout: 45_000 });

    await observation.settle();
    const confirmRequests = observation.requests.filter(
      (request) =>
        request.method === "POST" &&
        request.pathname === `${API_PREFIX}/payments/confirm`,
    );
    assertInvariant(
      confirmRequests.length === 1 &&
        confirmRequests[0]?.postDataFingerprint !== null &&
        confirmRequests[0]?.hasCookie === true &&
        confirmRequests[0]?.hasAuthorization === false,
      "Sandbox success did not issue one credentialed exact confirm request.",
    );

    await page.getByRole("button", { name: "확인하고 예약 보기" }).click();
    await expectPath(page, `/reservations/${reservationUid}`);
    await expectNoBookingStorage(page);
    test.info().annotations.push({
      type: "cleanup-owner",
      description:
        "The succeeded sandbox reservation and operation have no public delete API and are owned by the exact disposable local profile reset.",
    });
    await logout(page);
  } finally {
    await runCleanupSteps(
      [
        {
          label: "callback observation teardown",
          run: async () => callbackObservation?.stop(),
        },
        {
          label: "reservation hold cleanup",
          run: () =>
            cleanupCapturedReservationHolds(
              page,
              checkoutRegistry,
              providerSubmissionStarted,
            ),
        },
        checkoutRouteCleanup,
        {
          label: "request observation teardown",
          run: () => observation.stop(),
        },
      ],
      "Sandbox success cleanup",
    );
  }
});
