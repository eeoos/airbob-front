import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../../test/sessionFixtures";
import {
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
} from "../../../workflows/booking-payment/checkout";
import type {
  ReservationCheckoutHandoffPort,
  ReservationStartIntent,
} from "../../../workflows/booking-payment/reservation-create";
import AccommodationDetailRoute from "./AccommodationDetailRoute";

const scope: AuthenticatedSessionScope = {
  epoch: 9,
  runtimeLeaseId: testSessionRuntimeLeaseId,
  subject: "subject:active_payment_guard" as SessionSubject,
};
let capturedHandoff: ReservationCheckoutHandoffPort | null = null;
let paymentRecoveryFenceStatus:
  "none" | "recovery-required" | "recovery-unavailable" = "none";

vi.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    getOrigin: () => "https://airbob.test",
    isCurrentHistoryEntry: () => true,
    openInNewTab: vi.fn(),
    replaceCurrentUrl: vi.fn(),
  },
}));

vi.mock("../../../screens/accommodation-detail/public", () => ({
  AccommodationDetailController: (props: {
    checkoutHandoff: ReservationCheckoutHandoffPort;
  }) => {
    capturedHandoff = props.checkoutHandoff;
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
  isCurrentSession: (candidate: AuthenticatedSessionScope) =>
    candidate.subject === scope.subject &&
    candidate.epoch === scope.epoch &&
    candidate.runtimeLeaseId === scope.runtimeLeaseId,
  login: vi.fn(),
  logout: vi.fn(),
  revalidate: vi.fn(),
  retryServerLogout: vi.fn(),
};

vi.mock("../../session/useSession", () => ({
  useSession: () => mockSession,
}));

vi.mock("../PaymentCallbackCredentialBoundary", async () => {
  const actual = await vi.importActual<
    typeof import("../PaymentCallbackCredentialBoundary")
  >("../PaymentCallbackCredentialBoundary");
  return {
    ...actual,
    usePaymentRecoveryFenceStatus: () => paymentRecoveryFenceStatus,
  };
});

const intent: ReservationStartIntent = {
  type: "reservation.start",
  accommodationId: 42,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultCount: 2,
  childCount: 0,
  infantCount: 0,
  petCount: 0,
  couponId: null,
};

const v2JournalKey = "airbob:booking-payment-v2:journal";

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {`${location.pathname}${location.search}`}
    </output>
  );
}

const seedActiveRecovery = () => {
  const checkout = createBookingPaymentCheckoutRepository({
    getEpoch: () => scope.epoch,
    createOperationId: () => "active-payment-operation",
  });
  const callback = createBookingPaymentCallbackRepository({
    getEpoch: () => scope.epoch,
  });
  const written = checkout.write({
    scope,
    isCurrent: () => true,
    data: {
      accommodationId: 41,
      reservationUid: "reservation-active",
      orderName: "진행 중인 예약",
      amount: 90_000,
      checkIn: "2026-09-01",
      checkOut: "2026-09-03",
      adultOccupancy: 2,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
      couponName: null,
      couponDiscount: null,
    },
  });
  if (written.status !== "written") throw new Error("checkout fixture failed");
  const callbackWrite = callback.write({
    scope,
    isCurrent: () => true,
    data: {
      operationId: written.data.operationId,
      reservationUid: written.data.reservationUid,
      orderId: written.data.reservationUid,
      paymentKey: "payment-key-active",
      amount: written.data.amount,
      phase: "reconciling",
    },
  });
  if (callbackWrite.status !== "written") {
    throw new Error("callback fixture failed");
  }
};

describe("AccommodationDetailRoute active payment guard", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    capturedHandoff = null;
    paymentRecoveryFenceStatus = "none";
  });

  it.each(["recovery-required", "recovery-unavailable"] as const)(
    "blocks a new legacy reservation while the in-memory %s fence survives cleaned storage",
    async (status) => {
      paymentRecoveryFenceStatus = status;

      render(
        <MemoryRouter initialEntries={["/accommodations/42"]}>
          <Routes>
            <Route
              path="/accommodations/:id"
              element={<AccommodationDetailRoute />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByTestId("accommodation-detail-controller");
      const handoff = capturedHandoff;
      if (handoff === null)
        throw new Error("checkout handoff was not captured");

      expect(handoff.preflight({ session: scope, intent })).toEqual({
        status: "blocked",
      });
      expect(handoff.assertNoNewerRecovery({ session: scope, intent })).toEqual(
        { status: "blocked" },
      );
      expect(window.sessionStorage.length).toBe(0);
    },
  );

  it("preserves active recovery and redirects before another reservation starts", async () => {
    seedActiveRecovery();
    const checkoutBefore = window.sessionStorage.getItem(
      "airbob:booking-payment-v1:checkout",
    );
    const callbackBefore = window.sessionStorage.getItem(
      "airbob:booking-payment-v1:callback",
    );

    render(
      <MemoryRouter initialEntries={["/accommodations/42"]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/accommodations/:id"
            element={<AccommodationDetailRoute />}
          />
          <Route path="*" element={<div data-testid="fallback-route" />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("accommodation-detail-controller");
    let result: ReturnType<ReservationCheckoutHandoffPort["preflight"]> | null =
      null;
    act(() => {
      result = capturedHandoff?.preflight({ session: scope, intent }) ?? null;
    });

    expect(result).toEqual({ status: "payment-recovery-required" });
    await screen.findByTestId("fallback-route");
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/reservations/reservation-active/fail?reason=confirm-failed",
      ),
    );
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toBe(checkoutBefore);
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toBe(callbackBefore);
  });

  it("blocks the legacy handoff without reading or deleting opaque v2 state", async () => {
    const opaqueV2State = "newer-state-must-remain-opaque";
    window.sessionStorage.setItem(v2JournalKey, opaqueV2State);

    render(
      <MemoryRouter initialEntries={["/accommodations/42"]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/accommodations/:id"
            element={<AccommodationDetailRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("accommodation-detail-controller");
    const handoff = capturedHandoff;
    if (handoff === null) throw new Error("checkout handoff was not captured");

    expect(handoff.preflight({ session: scope, intent })).toEqual({
      status: "blocked",
    });
    expect(handoff.assertNoNewerRecovery({ session: scope, intent })).toEqual({
      status: "blocked",
    });
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/accommodations/42",
    );
    expect(window.sessionStorage.getItem(v2JournalKey)).toBe(opaqueV2State);
  });

  it("does not mistake a near-collision namespace for v2 recovery", async () => {
    window.sessionStorage.setItem(
      "airbob:booking-payment-v20:journal",
      "unrelated-newer-major",
    );

    render(
      <MemoryRouter initialEntries={["/accommodations/42"]}>
        <Routes>
          <Route
            path="/accommodations/:id"
            element={<AccommodationDetailRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("accommodation-detail-controller");
    const handoff = capturedHandoff;
    if (handoff === null) throw new Error("checkout handoff was not captured");

    expect(handoff.preflight({ session: scope, intent })).toEqual({
      status: "ready",
    });
    expect(handoff.assertNoNewerRecovery({ session: scope, intent })).toEqual({
      status: "ready",
    });
  });

  it("does not overwrite recovery that appears after preflight but before commit", async () => {
    render(
      <MemoryRouter initialEntries={["/accommodations/42"]}>
        <Routes>
          <Route
            path="/accommodations/:id"
            element={<AccommodationDetailRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("accommodation-detail-controller");
    const handoff = capturedHandoff;
    if (handoff === null) throw new Error("checkout handoff was not captured");

    expect(handoff.preflight({ session: scope, intent })).toEqual({
      status: "ready",
    });

    seedActiveRecovery();
    const checkoutBefore = window.sessionStorage.getItem(
      "airbob:booking-payment-v1:checkout",
    );
    const callbackBefore = window.sessionStorage.getItem(
      "airbob:booking-payment-v1:callback",
    );

    expect(() =>
      handoff.commit({
        session: scope,
        intent,
        appliedCoupon: null,
        reservation: {
          reservationUid: "reservation-new",
          orderName: "새 예약",
          amount: 120_000,
          customerEmail: "viewer@example.com",
          customerName: "뷰어",
        },
      }),
    ).toThrow("An earlier payment still requires recovery.");

    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toBe(checkoutBefore);
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toBe(callbackBefore);
  });

  it("does not write a v1 handoff when v2 state appears after preflight", async () => {
    render(
      <MemoryRouter initialEntries={["/accommodations/42"]}>
        <Routes>
          <Route
            path="/accommodations/:id"
            element={<AccommodationDetailRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("accommodation-detail-controller");
    const handoff = capturedHandoff;
    if (handoff === null) throw new Error("checkout handoff was not captured");
    expect(handoff.preflight({ session: scope, intent })).toEqual({
      status: "ready",
    });

    window.sessionStorage.setItem(v2JournalKey, "opaque-late-v2-state");

    expect(() =>
      handoff.commit({
        session: scope,
        intent,
        appliedCoupon: null,
        reservation: {
          reservationUid: "reservation-new",
          orderName: "새 예약",
          amount: 120_000,
          customerEmail: "viewer@example.com",
          customerName: "뷰어",
        },
      }),
    ).toThrow("A newer payment recovery state is active.");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toBeNull();
    expect(window.sessionStorage.getItem(v2JournalKey)).toBe(
      "opaque-late-v2-state",
    );
  });
});
