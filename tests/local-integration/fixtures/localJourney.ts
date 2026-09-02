import {
  expect,
  type APIResponse,
  type Page,
  type Route,
} from "@playwright/test";

const BOOKING_STORAGE_PREFIX = "airbob:booking-payment-v2:";
const API_PREFIX = "/api/v1";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const RESERVATION_CHECKOUT_ROUTE = "**/api/v1/reservations";

export interface LocalCredentials {
  readonly email: string;
  readonly password: string;
}

export interface StayFixture {
  readonly accommodationId: number;
  readonly checkIn: string;
  readonly checkOut: string;
}

export interface CleanupStep {
  readonly label: string;
  readonly run: () => Promise<void>;
}

export interface CapturedReservationCheckout {
  readonly paymentRequired: boolean | null;
  readonly reservationUid: string;
}

export interface ReservationCheckoutRegistry {
  capture(
    response: APIResponse,
    label?: string,
  ): Promise<CapturedReservationCheckout>;
  entries(): readonly CapturedReservationCheckout[];
  requireSingle(
    paymentRequired: boolean,
    label?: string,
  ): CapturedReservationCheckout;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function assertInvariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export const runCleanupSteps = async (
  steps: readonly CleanupStep[],
  label = "Local integration cleanup",
): Promise<void> => {
  const failures: Error[] = [];

  for (const step of steps) {
    try {
      await step.run();
    } catch {
      failures.push(new Error(`${step.label} failed.`));
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, `${label} failed.`);
  }
};

export const createReservationCheckoutRegistry =
  (): ReservationCheckoutRegistry => {
    const entries = new Map<string, CapturedReservationCheckout>();

    return {
      async capture(response, label = "Reservation checkout") {
        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          throw new Error(`${label} returned unreadable JSON.`);
        }

        const data =
          isRecord(payload) && isRecord(payload.data) ? payload.data : null;
        const reservationUid = data?.reservation_uid;
        if (
          typeof reservationUid === "string" &&
          UUID_PATTERN.test(reservationUid)
        ) {
          const previous = entries.get(reservationUid);
          entries.set(
            reservationUid,
            previous ?? { paymentRequired: null, reservationUid },
          );
        }

        assertInvariant(response.ok(), `${label} request failed.`);
        assertInvariant(
          isRecord(payload) && payload.success === true && data !== null,
          `${label} returned an invalid envelope.`,
        );
        assertInvariant(
          typeof reservationUid === "string" &&
            UUID_PATTERN.test(reservationUid),
          `${label} returned no valid reservation identifier.`,
        );
        assertInvariant(
          typeof data.payment_required === "boolean",
          `${label} returned no payment requirement.`,
        );

        const previous = entries.get(reservationUid);
        assertInvariant(
          previous?.paymentRequired === null ||
            previous?.paymentRequired === data.payment_required,
          `${label} changed its payment requirement.`,
        );
        const captured = Object.freeze({
          paymentRequired: data.payment_required,
          reservationUid,
        });
        entries.set(reservationUid, captured);
        return captured;
      },
      entries: () => Object.freeze([...entries.values()]),
      requireSingle(paymentRequired, label = "Reservation checkout") {
        const captured = [...entries.values()];
        assertInvariant(
          captured.length === 1 &&
            captured[0]?.paymentRequired === paymentRequired,
          `${label} did not capture one matching reservation.`,
        );
        return captured[0];
      },
    };
  };

export const installReservationCheckoutCapture = async (
  page: Page,
  registry: ReservationCheckoutRegistry,
): Promise<CleanupStep> => {
  const handler = async (route: Route): Promise<void> => {
    const response = await route.fetch();
    await registry.capture(response);
    await route.fulfill({ response });
  };
  await page.route(RESERVATION_CHECKOUT_ROUTE, handler);

  return {
    label: "reservation checkout route teardown",
    run: () => page.unroute(RESERVATION_CHECKOUT_ROUTE, handler),
  };
};

export const releaseReservationHold = async (
  page: Page,
  reservationUid: string,
): Promise<void> => {
  const result = await page.evaluate(async (path) => {
    const response = await fetch(path, {
      credentials: "include",
      headers: { Accept: "application/json" },
      method: "DELETE",
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // The runner validates the canonical envelope without retaining it.
    }
    return { ok: response.ok, payload, status: response.status };
  }, `${API_PREFIX}/reservations/${reservationUid}/hold`);

  if (result.status === 404) return;
  assertInvariant(result.ok, "Reservation hold cleanup request failed.");
  assertInvariant(
    isRecord(result.payload) && result.payload.success === true,
    "Reservation hold cleanup returned an invalid envelope.",
  );
  const data = result.payload.data;
  assertInvariant(
    isRecord(data) &&
      data.reservation_uid === reservationUid &&
      data.status === "EXPIRED" &&
      typeof data.released_now === "boolean" &&
      typeof data.server_time === "string",
    "Reservation hold cleanup returned an invalid resource.",
  );
};

export const cleanupCapturedReservationHolds = async (
  page: Page,
  registry: ReservationCheckoutRegistry,
  skip = false,
): Promise<void> => {
  if (skip) return;
  const holds = registry
    .entries()
    .filter((entry) => entry.paymentRequired !== false);
  await runCleanupSteps(
    holds.map((entry, index) => ({
      label: `reservation hold cleanup ${index + 1}`,
      run: () => releaseReservationHold(page, entry.reservationUid),
    })),
    "Captured reservation hold cleanup",
  );
};

export const expectStayAvailability = async (
  page: Page,
  fixture: StayFixture,
  expectedAvailable: boolean,
): Promise<void> => {
  await expect
    .poll(
      async () =>
        page.evaluate(
          async ({ checkIn, checkOut, path }) => {
            const response = await fetch(path, {
              credentials: "include",
              headers: { Accept: "application/json" },
            });
            if (!response.ok) return null;

            let payload: unknown = null;
            try {
              payload = await response.json();
            } catch {
              return null;
            }
            if (
              typeof payload !== "object" ||
              payload === null ||
              !("success" in payload) ||
              payload.success !== true ||
              !("data" in payload) ||
              typeof payload.data !== "object" ||
              payload.data === null ||
              !("unavailable_ranges" in payload.data) ||
              !Array.isArray(payload.data.unavailable_ranges)
            ) {
              return null;
            }

            const stayIsUnavailable = payload.data.unavailable_ranges.some(
              (candidate) =>
                typeof candidate === "object" &&
                candidate !== null &&
                "start_date" in candidate &&
                "end_date_exclusive" in candidate &&
                typeof candidate.start_date === "string" &&
                typeof candidate.end_date_exclusive === "string" &&
                candidate.start_date < checkOut &&
                checkIn < candidate.end_date_exclusive,
            );
            return !stayIsUnavailable;
          },
          {
            checkIn: fixture.checkIn,
            checkOut: fixture.checkOut,
            path: `${API_PREFIX}/accommodations/${fixture.accommodationId}/availability`,
          },
        ),
      { timeout: 20_000 },
    )
    .toBe(expectedAvailable);
};

export const navigateSafely = async (
  page: Page,
  path: string,
  label: string,
): Promise<void> => {
  try {
    await page.goto(path);
  } catch {
    throw new Error(`${label} navigation failed.`);
  }
};

export const reloadSafely = async (
  page: Page,
  label: string,
): Promise<void> => {
  try {
    await page.reload();
  } catch {
    throw new Error(`${label} reload failed.`);
  }
};

export const login = async (
  page: Page,
  credentials: LocalCredentials,
): Promise<void> => {
  await navigateSafely(page, "/login", "Login");
  await page.getByLabel("이메일").fill(credentials.email);
  await page.getByLabel("비밀번호").fill(credentials.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("button", { name: "프로필" })).toBeVisible();
};

export const logout = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "사용자 메뉴" }).click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect(page.getByRole("button", { name: "프로필" })).toBeHidden();
};

export const detailPath = (fixture: StayFixture): string => {
  const query = new URLSearchParams({
    adultOccupancy: "2",
    checkIn: fixture.checkIn,
    checkOut: fixture.checkOut,
  });
  return `/accommodations/${fixture.accommodationId}?${query.toString()}`;
};

export const readReservationUid = async (
  page: Page,
  label = "Reservation checkout",
): Promise<string> => {
  const reservationUid = await page.evaluate((prefix) => {
    const raw = sessionStorage.getItem(`${prefix}journal`);
    if (raw === null) return null;
    try {
      const value = JSON.parse(raw) as unknown;
      if (typeof value !== "object" || value === null || !("data" in value)) {
        return null;
      }
      const data = (value as { data?: unknown }).data;
      if (typeof data !== "object" || data === null || !("ready" in data)) {
        return null;
      }
      const ready = (data as { ready?: unknown }).ready;
      return typeof ready === "object" &&
        ready !== null &&
        "reservationUid" in ready
        ? (ready as { reservationUid?: unknown }).reservationUid
        : null;
    } catch {
      return null;
    }
  }, BOOKING_STORAGE_PREFIX);
  assertInvariant(
    typeof reservationUid === "string" && UUID_PATTERN.test(reservationUid),
    `${label} did not publish a valid reservation identifier.`,
  );
  return reservationUid;
};

export const expectPath = async (
  page: Page,
  pathname: string,
): Promise<void> => {
  await expect
    .poll(() => new URL(page.url()).pathname === pathname, { timeout: 15_000 })
    .toBe(true);
};

export const expectNoBookingStorage = async (page: Page): Promise<void> => {
  const hasBookingStorage = await page.evaluate(
    (prefix) =>
      Array.from({ length: sessionStorage.length }, (_, index) =>
        sessionStorage.key(index),
      ).some((key) => key?.startsWith(prefix) === true),
    BOOKING_STORAGE_PREFIX,
  );
  expect(hasBookingStorage).toBe(false);
};

export const releaseHoldFromConfirmation = async (
  page: Page,
  reservationUid: string,
): Promise<void> => {
  const releaseButton = page.getByRole("button", {
    name: "예약을 취소하고 객실 해제",
  });
  await expect(releaseButton).toBeEnabled();
  await releaseButton.click();
  await expectPath(page, `/reservations/${reservationUid}`);
  await expectNoBookingStorage(page);
};
