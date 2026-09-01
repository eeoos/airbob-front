import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../../test/sessionFixtures";
import { bookingPaymentStateCodec } from "../codecs/bookingPaymentStateCodec";
import AccommodationDetailRoute from "./AccommodationDetailRoute";

const flowId = "10000000-0000-4000-8000-000000000001";
const reservationUid = "20000000-0000-4000-8000-000000000002";
const accommodationHandle = {
  flowId,
  locator: { kind: "accommodation" as const, accommodationId: 42 },
};
const reservationHandle = {
  flowId,
  locator: { kind: "reservation" as const, reservationUid },
};
const paymentSnapshot = {
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
  orderName: "테스트 숙소",
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
  controllerProps: [] as Array<Record<string, unknown>>,
  acknowledgeTerminal: vi.fn(),
  replaceCurrentUserState: vi.fn(),
}));
let paymentRecoveryFenceStatus:
  "none" | "recovery-required" | "recovery-unavailable" = "none";

vi.mock("../../../workflows/booking-payment/transaction/booking", async () => {
  const actual = await vi.importActual<
    typeof import("../../../workflows/booking-payment/transaction/booking")
  >("../../../workflows/booking-payment/transaction/booking");
  return {
    ...actual,
    createBookingTransactionWorkflow: () => ({
      acknowledgeTerminal: (...args: unknown[]) =>
        mocks.acknowledgeTerminal(...args),
      dispose: vi.fn(),
    }),
  };
});

vi.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    isCurrentHistoryEntry: () => true,
    replaceCurrentUserState: (...args: unknown[]) =>
      mocks.replaceCurrentUserState(...args),
  },
}));

vi.mock("../../../screens/accommodation-detail/public", () => ({
  AccommodationDetailController: (props: Record<string, unknown>) => {
    mocks.controllerProps.push(props);
    return <div data-testid="accommodation-detail-controller" />;
  },
}));

vi.mock("../../../workflows/auth-intent", () => ({
  toAuthIntentLocalDate: (value: string) => value,
  useAuthIntent: () => ({
    pending: null,
    request: vi.fn(),
    cancel: vi.fn(),
    claim: vi.fn(),
  }),
}));

vi.mock("../../../workflows/wishlist-membership", () => ({
  useWishlistMembership: () => ({}),
}));

vi.mock("./WishlistMembershipRouteBoundary", () => ({
  WishlistMembershipRouteBoundary: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
}));

vi.mock("../PaymentCallbackCredentialBoundary", () => ({
  usePaymentRecoveryFenceStatus: () => paymentRecoveryFenceStatus,
}));

const scope: AuthenticatedSessionScope = {
  epoch: 9,
  runtimeLeaseId: testSessionRuntimeLeaseId,
  subject: "subject:active_payment_guard" as SessionSubject,
};
const mockSession = {
  state: {
    status: "authenticated" as const,
    epoch: scope.epoch,
    subject: scope.subject,
    viewer: {
      id: 1,
      email: "viewer@example.com",
      nickname: "뷰어",
      thumbnailImageUrl: null,
    },
    revalidation: { status: "idle" as const },
  },
  captureAuthenticatedSession: () => scope,
  isCurrentSession: () => true,
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

const renderDetailRoute = (state: unknown = null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter
        initialEntries={[{ pathname: "/accommodations/42", state }]}
      >
        <LocationProbe />
        <Routes>
          <Route
            path="/accommodations/:id"
            element={<AccommodationDetailRoute />}
          />
          <Route path="*" element={<div data-testid="fallback-route" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const latestControllerProps = () => {
  const props = mocks.controllerProps.at(-1);
  if (!props) throw new Error("Expected detail controller props");
  return props;
};

describe("AccommodationDetailRoute v2 booking boundary", () => {
  beforeEach(() => {
    paymentRecoveryFenceStatus = "none";
    mocks.controllerProps.length = 0;
    mocks.acknowledgeTerminal.mockReset();
    mocks.acknowledgeTerminal.mockReturnValue({ status: "acknowledged" });
    mocks.replaceCurrentUserState.mockReset();
    mocks.replaceCurrentUserState.mockReturnValue(true);
  });

  it.each(["recovery-required", "recovery-unavailable"] as const)(
    "blocks a new command while the %s fence is active",
    async (status) => {
      paymentRecoveryFenceStatus = status;
      renderDetailRoute();
      await screen.findByTestId("accommodation-detail-controller");

      expect(latestControllerProps().isPaymentRecoveryBlocked).toBe(true);
      expect(latestControllerProps().bookingFlowHandle).toBeNull();
    },
  );

  it("restores an exact direct flow reference even when recovery is fenced", async () => {
    paymentRecoveryFenceStatus = "recovery-required";
    const state = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      accommodationHandle.locator,
    );
    renderDetailRoute(state);
    await screen.findByTestId("accommodation-detail-controller");

    expect(latestControllerProps()).toMatchObject({
      bookingFlowHandle: accommodationHandle,
      isPaymentRecoveryBlocked: false,
    });
  });

  it("persists the quote locator as direct history state", async () => {
    renderDetailRoute();
    await screen.findByTestId("accommodation-detail-controller");
    const callback = latestControllerProps().onBookingFlowHandleChange;
    if (typeof callback !== "function") throw new Error("missing callback");

    expect(callback(accommodationHandle)).toBe(true);

    expect(mocks.replaceCurrentUserState).toHaveBeenCalledWith(
      bookingPaymentStateCodec.serializeFlowReference(
        flowId,
        accommodationHandle.locator,
      ),
    );
  });

  it("opens confirm with the exact reservation flow reference", async () => {
    renderDetailRoute();
    await screen.findByTestId("accommodation-detail-controller");
    const callback = latestControllerProps().onOpenPayment;
    if (typeof callback !== "function") throw new Error("missing callback");

    act(() => callback(reservationHandle, paymentSnapshot));

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"pathname":"/accommodations/42/confirm"',
    );
    expect(screen.getByTestId("location")).toHaveTextContent(reservationUid);
  });

  it("acknowledges a published terminal reservation before opening detail", async () => {
    renderDetailRoute();
    await screen.findByTestId("accommodation-detail-controller");
    const callback = latestControllerProps().onTerminalReservation;
    if (typeof callback !== "function") throw new Error("missing callback");
    const terminalSnapshot = {
      ...paymentSnapshot,
      phase: "complimentary-observed" as const,
      amount: 0,
      paymentRequired: false,
      paymentAllowed: false,
      holdExpiresAt: null,
      reservationStatus: "CONFIRMED" as const,
      canPay: false,
      canReleaseHold: false,
    };

    await act(async () => {
      await callback(reservationHandle, terminalSnapshot, {
        isCurrent: () => true,
      });
    });

    expect(mocks.acknowledgeTerminal).toHaveBeenCalledWith({
      handle: reservationHandle,
      routeLease: expect.any(Object),
    });
    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      `"pathname":"/reservations/${reservationUid}"`,
    );
  });
});
