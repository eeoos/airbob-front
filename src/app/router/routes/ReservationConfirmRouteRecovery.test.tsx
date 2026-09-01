import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../../test/sessionFixtures";
import { bookingPaymentStateCodec } from "../codecs/bookingPaymentStateCodec";
import ReservationConfirmRoute from "./ReservationConfirmRoute";

const reservationUid = "20000000-0000-4000-8000-000000000002";
const flowId = "10000000-0000-4000-8000-000000000001";
const handle = {
  flowId,
  locator: { kind: "reservation" as const, reservationUid },
};
const snapshot = {
  phase: "reservation-ready" as const,
  flowId,
  accommodationId: 42,
  reservationUid,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultCount: 2,
  childCount: 0,
  infantCount: 0,
  petCount: 0,
  orderName: "테스트 숙소 예약",
  nightlyPrice: 60_000,
  nights: 2,
  subtotal: 120_000,
  discountAmount: 0,
  amount: 120_000,
  currency: "KRW",
  couponDisplayName: null,
  quoteExpiresAt: "2026-09-01T10:10:00Z",
  serverTime: "2026-09-01T10:00:00Z",
  paymentRequired: true,
  reservationStatus: "PAYMENT_PENDING" as const,
  paymentAllowed: true,
  holdExpiresAt: "2026-09-01T10:15:00Z",
  canCheckout: false,
  canPay: true,
  canRetryPayment: false,
  canReleaseHold: true,
};

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  acknowledgeTerminal: vi.fn(),
  acknowledgeReservationStatusDrift: vi.fn(),
  getGuestDetail: vi.fn(),
  controllerProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../workflows/booking-payment/transaction/booking", async () => {
  const actual = await vi.importActual<
    typeof import("../../../workflows/booking-payment/transaction/booking")
  >("../../../workflows/booking-payment/transaction/booking");
  return {
    ...actual,
    createBookingTransactionWorkflow: () => ({
      load: (...args: unknown[]) => mocks.load(...args),
      acknowledgeTerminal: (...args: unknown[]) =>
        mocks.acknowledgeTerminal(...args),
      acknowledgeReservationStatusDrift: (...args: unknown[]) =>
        mocks.acknowledgeReservationStatusDrift(...args),
      dispose: vi.fn(),
    }),
  };
});

vi.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    getOrigin: () => "https://airbob.test",
    isCurrentHistoryEntry: () => true,
  },
}));

vi.mock("../../../features/reservations/public", async () => ({
  ...(await vi.importActual<
    typeof import("../../../features/reservations/public")
  >("../../../features/reservations/public")),
  reservationReadApi: {
    getDetail: (...args: unknown[]) => mocks.getGuestDetail(...args),
  },
}));

vi.mock(
  "../../../screens/reservation-confirm/ReservationConfirmController",
  () => ({
    ReservationConfirmController: (props: Record<string, unknown>) => {
      mocks.controllerProps.push(props);
      return <div data-testid="reservation-confirm-controller" />;
    },
  }),
);

const scope: AuthenticatedSessionScope = {
  epoch: 5,
  runtimeLeaseId: testSessionRuntimeLeaseId,
  subject: "subject:confirm_recovery" as SessionSubject,
};
const mockSession = {
  state: {
    status: "authenticated" as const,
    epoch: scope.epoch,
    subject: scope.subject,
    viewer: {
      id: 7,
      email: "viewer@example.com",
      nickname: "뷰어",
      thumbnailImageUrl: null,
    },
    revalidation: { status: "idle" as const },
  },
  captureAuthenticatedSession: () => scope,
  isCurrentSession: () => true,
  login: vi.fn(),
  logout: vi.fn(),
  revalidate: vi.fn(),
  retryServerLogout: vi.fn(),
};

vi.mock("../../session/useSession", () => ({ useSession: () => mockSession }));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {JSON.stringify({ pathname: location.pathname, state: location.state })}
    </output>
  );
}

const renderConfirmRoute = (state: unknown, accommodationId = 42) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          { pathname: `/accommodations/${accommodationId}/confirm`, state },
        ]}
      >
        <LocationProbe />
        <Routes>
          <Route
            path="/accommodations/:id/confirm"
            element={<ReservationConfirmRoute />}
          />
          <Route path="*" element={<div data-testid="fallback-route" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("ReservationConfirmRoute v2 authority", () => {
  beforeEach(() => {
    mocks.load.mockReset();
    mocks.load.mockReturnValue({ status: "ready", handle, snapshot });
    mocks.acknowledgeTerminal.mockReset();
    mocks.acknowledgeTerminal.mockReturnValue({ status: "acknowledged" });
    mocks.acknowledgeReservationStatusDrift.mockReset();
    mocks.acknowledgeReservationStatusDrift.mockReturnValue({
      status: "acknowledged",
    });
    mocks.getGuestDetail.mockReset();
    mocks.getGuestDetail.mockResolvedValue({
      audience: "guest",
      reservationUid,
      status: "PAYMENT_PROCESSING",
      paymentAllowed: false,
      holdExpiresAt: null,
      serverTime: "2026-09-01T10:01:00Z",
    });
    mocks.controllerProps.length = 0;
  });

  it("mounts payment only after exact route state joins the exact journal", async () => {
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      handle.locator,
    );
    renderConfirmRoute(state);

    await screen.findByTestId("reservation-confirm-controller");
    expect(mocks.load).toHaveBeenCalledWith({
      handle,
      routeLease: expect.any(Object),
    });
    expect(mocks.controllerProps.at(-1)).toMatchObject({
      customer: { email: "viewer@example.com", name: "뷰어" },
      handle,
      snapshot,
      successUrl: `https://airbob.test/reservations/${reservationUid}/success`,
      failUrl: `https://airbob.test/reservations/${reservationUid}/fail`,
    });
    expect(screen.getByTestId("location")).toHaveTextContent(flowId);
  });

  it.each([
    null,
    {
      purpose: "reservation-checkout",
      version: 1,
      operationId: "legacy-operation",
    },
    {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId,
      locator: { kind: "reservation", reservationUid: "not-a-uuid" },
    },
  ])(
    "rejects missing, retired, or malformed route authority",
    async (state) => {
      renderConfirmRoute(state);

      await screen.findByTestId("fallback-route");
      expect(screen.getByTestId("location")).toHaveTextContent(
        '"pathname":"/profile"',
      );
      expect(mocks.load).not.toHaveBeenCalled();
      expect(mocks.controllerProps).toHaveLength(0);
    },
  );

  it("preserves the journal but routes a path mismatch to reservation status", async () => {
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      handle.locator,
    );
    renderConfirmRoute(state, 41);

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      `"pathname":"/reservations/${reservationUid}"`,
    );
    expect(mocks.controllerProps).toHaveLength(0);
  });

  it("publishes a released reservation before acknowledging and navigating", async () => {
    const releasedSnapshot = {
      ...snapshot,
      phase: "hold-released" as const,
      reservationStatus: "EXPIRED" as const,
      paymentAllowed: false,
      holdExpiresAt: null,
      canPay: false,
      canReleaseHold: false,
    };
    mocks.load.mockReturnValue({
      status: "ready",
      handle,
      snapshot: releasedSnapshot,
    });
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      handle.locator,
    );
    renderConfirmRoute(state);
    await screen.findByTestId("reservation-confirm-controller");
    const props = mocks.controllerProps.at(-1);
    const onReleased = props?.onReleased;
    if (typeof onReleased !== "function") {
      throw new Error("Expected release completion adapter");
    }

    await act(async () => {
      await onReleased(handle, releasedSnapshot, {
        isCurrent: () => true,
      });
    });

    expect(mocks.acknowledgeTerminal).toHaveBeenCalledWith({
      handle,
      routeLease: expect.any(Object),
    });
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `"pathname":"/reservations/${reservationUid}"`,
      ),
    );
  });

  it("closes verified server state drift before discarding the direct flow reference", async () => {
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      handle.locator,
    );
    renderConfirmRoute(state);
    await screen.findByTestId("reservation-confirm-controller");
    const props = mocks.controllerProps.at(-1);
    const onReservationStatusDrift = props?.onReservationStatusDrift;
    if (typeof onReservationStatusDrift !== "function") {
      throw new Error("Expected status-drift adapter");
    }

    await act(async () => {
      await onReservationStatusDrift(handle, snapshot, {
        isCurrent: () => true,
      });
    });

    expect(mocks.getGuestDetail).toHaveBeenCalledWith("guest", reservationUid);
    expect(mocks.acknowledgeReservationStatusDrift).toHaveBeenCalledWith({
      handle,
      routeLease: expect.any(Object),
      observation: {
        reservationUid,
        status: "PAYMENT_PROCESSING",
        paymentAllowed: false,
        holdExpiresAt: null,
        serverTime: "2026-09-01T10:01:00Z",
      },
    });
    expect(mocks.acknowledgeTerminal).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `"pathname":"/reservations/${reservationUid}"`,
      ),
    );
  });

  it("retains the exact confirm reference when status drift is not verified", async () => {
    mocks.acknowledgeReservationStatusDrift.mockReturnValue({
      status: "not-converged",
    });
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      handle.locator,
    );
    renderConfirmRoute(state);
    await screen.findByTestId("reservation-confirm-controller");
    const callback = mocks.controllerProps.at(-1)?.onReservationStatusDrift;
    if (typeof callback !== "function") throw new Error("missing callback");

    await expect(
      callback(handle, snapshot, { isCurrent: () => true }),
    ).resolves.toBe(false);
    expect(screen.queryByTestId("fallback-route")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(flowId);
  });

  it("retains the exact confirm reference when authoritative status cannot be read", async () => {
    mocks.getGuestDetail.mockRejectedValue(new Error("detail unavailable"));
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      handle.locator,
    );
    renderConfirmRoute(state);
    await screen.findByTestId("reservation-confirm-controller");
    const callback = mocks.controllerProps.at(-1)?.onReservationStatusDrift;
    if (typeof callback !== "function") throw new Error("missing callback");

    await expect(
      callback(handle, snapshot, { isCurrent: () => true }),
    ).resolves.toBe(false);
    expect(mocks.acknowledgeReservationStatusDrift).not.toHaveBeenCalled();
    expect(screen.queryByTestId("fallback-route")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(flowId);
  });

  it("rejects a status observation for any other reservation", async () => {
    mocks.getGuestDetail.mockResolvedValue({
      audience: "guest",
      reservationUid: "30000000-0000-4000-8000-000000000003",
      status: "PAYMENT_PROCESSING",
      paymentAllowed: false,
      holdExpiresAt: null,
      serverTime: "2026-09-01T10:01:00Z",
    });
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      handle.locator,
    );
    renderConfirmRoute(state);
    await screen.findByTestId("reservation-confirm-controller");
    const callback = mocks.controllerProps.at(-1)?.onReservationStatusDrift;
    if (typeof callback !== "function") throw new Error("missing callback");

    await expect(
      callback(handle, snapshot, { isCurrent: () => true }),
    ).resolves.toBe(false);
    expect(mocks.acknowledgeReservationStatusDrift).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent(flowId);
  });

  it("retains the exact confirm reference when journal acknowledgement throws", async () => {
    mocks.acknowledgeReservationStatusDrift.mockImplementation(() => {
      throw new Error("journal unavailable");
    });
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      handle.locator,
    );
    renderConfirmRoute(state);
    await screen.findByTestId("reservation-confirm-controller");
    const callback = mocks.controllerProps.at(-1)?.onReservationStatusDrift;
    if (typeof callback !== "function") throw new Error("missing callback");

    await expect(
      callback(handle, snapshot, { isCurrent: () => true }),
    ).resolves.toBe(false);
    expect(screen.queryByTestId("fallback-route")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(flowId);
  });
});
