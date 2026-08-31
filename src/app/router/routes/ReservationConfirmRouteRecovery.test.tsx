import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import {
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
  type CallbackData,
  type CheckoutWriteData,
} from "../../../workflows/booking-payment/checkout";
import { ReservationConfirmRoute } from "./ReservationConfirmRoute";

const scope: AuthenticatedSessionScope = {
  epoch: 5,
  subject: "subject:confirm_recovery" as SessionSubject,
};
const mockConfirmControllerProps: Array<Record<string, unknown>> = [];

vi.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    getOrigin: () => "https://airbob.test",
    isCurrentHistoryEntry: () => true,
    openInNewTab: vi.fn(),
    replaceCurrentUrl: vi.fn(),
  },
}));

vi.mock(
  "../../../screens/reservation-confirm/ReservationConfirmController",
  () => ({
    ReservationConfirmController: (props: Record<string, unknown>) => {
      mockConfirmControllerProps.push(props);
      return <div data-testid="reservation-confirm-controller" />;
    },
  }),
);

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
    candidate.subject === scope.subject && candidate.epoch === scope.epoch,
  login: vi.fn(),
  logout: vi.fn(),
  revalidate: vi.fn(),
  retryServerLogout: vi.fn(),
};

vi.mock("../../session/useSession", () => ({
  useSession: () => mockSession,
}));

const checkoutData: CheckoutWriteData = {
  accommodationId: 42,
  reservationUid: "reservation-1",
  orderName: "테스트 숙소 예약",
  amount: 120_000,
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultOccupancy: 2,
  childOccupancy: 0,
  infantOccupancy: 0,
  petOccupancy: 0,
  couponName: null,
  couponDiscount: null,
};

const createRepositories = () => ({
  checkout: createBookingPaymentCheckoutRepository({
    getEpoch: () => scope.epoch,
    createOperationId: () => "confirm-recovery-operation",
  }),
  callback: createBookingPaymentCallbackRepository({
    getEpoch: () => scope.epoch,
  }),
});

const seedCheckout = (overrides: Partial<CheckoutWriteData> = {}) => {
  const repositories = createRepositories();
  const result = repositories.checkout.write({
    scope,
    data: { ...checkoutData, ...overrides },
    isCurrent: () => true,
  });
  if (result.status !== "written") throw new Error("checkout fixture failed");
  return { repositories, checkout: result.data };
};

const seedCallback = (
  checkout: ReturnType<typeof seedCheckout>["checkout"],
  phase: CallbackData["phase"],
) => {
  const result = createRepositories().callback.write({
    scope,
    data: {
      operationId: checkout.operationId,
      reservationUid: checkout.reservationUid,
      orderId: checkout.reservationUid,
      paymentKey: "payment-key-1",
      amount: checkout.amount,
      phase,
    },
    isCurrent: () => true,
  });
  if (result.status !== "written") throw new Error("callback fixture failed");
};

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {`${location.pathname}${location.search}`}
    </output>
  );
}

const renderConfirmRoute = (accommodationId = 42, state: unknown = null) =>
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: `/accommodations/${accommodationId}/confirm`,
          state,
        },
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
    </MemoryRouter>,
  );

describe("ReservationConfirmRoute payment recovery boundary", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockConfirmControllerProps.length = 0;
  });

  it.each<CallbackData["phase"]>(["received", "confirming", "reconciling"])(
    "routes a %s callback to reconciliation without requesting payment again",
    async (phase) => {
      const { checkout } = seedCheckout();
      seedCallback(checkout, phase);

      renderConfirmRoute();

      await screen.findByTestId("fallback-route");
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/reservations/reservation-1/fail?reason=confirm-failed",
      );
      expect(mockConfirmControllerProps).toHaveLength(0);
      expect(
        window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
      ).not.toBeNull();
      expect(
        window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
      ).not.toBeNull();
    },
  );

  it("keeps an owned checkout eligible when no callback exists", async () => {
    const { checkout } = seedCheckout();

    renderConfirmRoute();

    await screen.findByTestId("reservation-confirm-controller");
    expect(mockConfirmControllerProps.at(-1)).toMatchObject({ checkout });
  });

  it("fails closed and clears joined documents when callback data mismatches", async () => {
    const { checkout } = seedCheckout();
    seedCallback(checkout, "received");
    const callbackEnvelope = JSON.parse(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback") ??
        "{}",
    );
    callbackEnvelope.data.amount = checkout.amount - 1;
    window.sessionStorage.setItem(
      "airbob:booking-payment-v1:callback",
      JSON.stringify(callbackEnvelope),
    );

    renderConfirmRoute();

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/accommodations/42",
    );
    expect(mockConfirmControllerProps).toHaveLength(0);
    await waitFor(() => expect(window.sessionStorage.length).toBe(0));
  });

  it("rejects target-wins data for another accommodation without discarding it", async () => {
    seedCheckout({
      accommodationId: 41,
      reservationUid: "reservation-41",
    });

    renderConfirmRoute(42);

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/accommodations/42",
    );
    expect(mockConfirmControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain("reservation-41");
  });

  it("preserves current and legacy documents for a stale current-format handoff", async () => {
    const { checkout } = seedCheckout();
    const legacyPrimary = JSON.stringify({
      ...checkoutData,
      customerEmail: "legacy@example.invalid",
      customerName: "레거시 사용자",
    });
    window.sessionStorage.setItem(
      "airbob:reservation-checkout:42",
      legacyPrimary,
    );
    window.sessionStorage.setItem(
      "airbob:reservation-checkout-index:reservation-1",
      "42",
    );

    renderConfirmRoute(42, {
      checkoutHandoff: {
        purpose: "reservation-checkout",
        version: 1,
        operationId: "stale-route-operation",
      },
    });

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/accommodations/42",
    );
    expect(mockConfirmControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain(checkout.operationId);
    expect(
      window.sessionStorage.getItem("airbob:reservation-checkout:42"),
    ).toBe(legacyPrimary);
    expect(
      window.sessionStorage.getItem(
        "airbob:reservation-checkout-index:reservation-1",
      ),
    ).toBe("42");
  });

  it("never migrates a current-format handoff whose target is missing", async () => {
    const legacyPrimary = JSON.stringify({
      reservationUid: "reservation-1",
      orderName: checkoutData.orderName,
      amount: checkoutData.amount,
      customerEmail: "legacy@example.invalid",
      customerName: "레거시 사용자",
      checkIn: checkoutData.checkIn,
      checkOut: checkoutData.checkOut,
      adultOccupancy: checkoutData.adultOccupancy,
      childOccupancy: checkoutData.childOccupancy,
      infantOccupancy: checkoutData.infantOccupancy,
      petOccupancy: checkoutData.petOccupancy,
      couponName: null,
      couponDiscount: null,
    });
    window.sessionStorage.setItem(
      "airbob:reservation-checkout:42",
      legacyPrimary,
    );
    window.sessionStorage.setItem(
      "airbob:reservation-checkout-index:reservation-1",
      "42",
    );

    renderConfirmRoute(42, {
      checkoutHandoff: {
        purpose: "reservation-checkout",
        version: 1,
        operationId: "missing-route-operation",
      },
    });

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/accommodations/42",
    );
    expect(mockConfirmControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:reservation-checkout:42"),
    ).toBe(legacyPrimary);
    expect(
      window.sessionStorage.getItem(
        "airbob:reservation-checkout-index:reservation-1",
      ),
    ).toBe("42");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toBeNull();
  });

  it("preserves current and legacy documents for a malformed handoff-like state", async () => {
    const { checkout } = seedCheckout();
    const legacyPrimary = JSON.stringify({
      ...checkoutData,
      customerEmail: "legacy@example.invalid",
      customerName: "레거시 사용자",
    });
    window.sessionStorage.setItem(
      "airbob:reservation-checkout:42",
      legacyPrimary,
    );
    window.sessionStorage.setItem(
      "airbob:reservation-checkout-index:reservation-1",
      "42",
    );

    renderConfirmRoute(42, {
      checkoutHandoff: {
        purpose: "reservation-checkout",
        version: 999,
        operationId: "malformed-route-operation",
      },
    });

    await screen.findByTestId("fallback-route");
    expect(mockConfirmControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain(checkout.operationId);
    expect(
      window.sessionStorage.getItem("airbob:reservation-checkout:42"),
    ).toBe(legacyPrimary);
    expect(
      window.sessionStorage.getItem(
        "airbob:reservation-checkout-index:reservation-1",
      ),
    ).toBe("42");
  });
});
