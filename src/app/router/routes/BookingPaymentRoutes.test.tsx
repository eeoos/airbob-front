import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type InitialEntry,
} from "react-router-dom";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import {
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
  type CallbackData,
  type CheckoutData,
} from "../../../workflows/booking-payment/checkout";
import { PaymentCallbackCredentialBoundary } from "../PaymentCallbackCredentialBoundary";
import { PaymentFailRoute } from "./PaymentFailRoute";
import { PaymentSuccessRoute } from "./PaymentSuccessRoute";
import { ReservationConfirmRoute } from "./ReservationConfirmRoute";

const scope: AuthenticatedSessionScope = {
  epoch: 3,
  subject: "subject:route_payment" as SessionSubject,
};
const mockPaymentControllerProps: Array<Record<string, unknown>> = [];
const mockConfirmControllerProps: Array<Record<string, unknown>> = [];
const mockGetCheckoutOwnership = jest.fn();
const mockGetPaymentByOrderId = jest.fn();

jest.mock("../../../features/reservations/payment/public", () => {
  const actual = jest.requireActual(
    "../../../features/reservations/payment/public",
  );

  return {
    ...actual,
    checkoutOwnershipApi: {
      getCheckoutOwnership: (...args: unknown[]) =>
        mockGetCheckoutOwnership(...args),
    },
    paymentApi: {
      ...actual.paymentApi,
      getByOrderId: (...args: unknown[]) =>
        mockGetPaymentByOrderId(...args),
    },
  };
});

jest.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    getOrigin: () => "https://airbob.test",
    isCurrentHistoryEntry: () => true,
    openInNewTab: jest.fn(),
    replaceCurrentUrl: jest.fn(),
  },
}));

jest.mock("../../../screens/payment-result/PaymentResultController", () => ({
  PaymentResultController: (props: Record<string, unknown>) => {
    mockPaymentControllerProps.push(props);
    return <div data-testid="payment-result-controller" />;
  },
}));

jest.mock(
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
  login: jest.fn(),
  logout: jest.fn(),
  revalidate: jest.fn(),
  retryServerLogout: jest.fn(),
};

jest.mock("../../session/useSession", () => ({
  useSession: () => mockSession,
}));

const checkoutWriteData = {
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
} as const;

const legacyCheckoutData = {
  reservationUid: "reservation-1",
  orderName: "테스트 숙소 예약",
  amount: 120_000,
  customerEmail: "legacy@example.com",
  customerName: "레거시 사용자",
  checkIn: "2026-09-10",
  checkOut: "2026-09-12",
  adultOccupancy: 2,
  childOccupancy: 0,
  infantOccupancy: 0,
  petOccupancy: 0,
  couponName: null,
  couponDiscount: null,
} as const;

const seedLegacyCheckout = () => {
  window.sessionStorage.setItem(
    "airbob:reservation-checkout:42",
    JSON.stringify(legacyCheckoutData),
  );
  window.sessionStorage.setItem(
    "airbob:reservation-checkout-index:reservation-1",
    "42",
  );
};

const createRepositories = () => ({
  checkout: createBookingPaymentCheckoutRepository({
    getEpoch: () => scope.epoch,
    createOperationId: () => "route-operation-1",
  }),
  callback: createBookingPaymentCallbackRepository({
    getEpoch: () => scope.epoch,
  }),
});

const seedCheckout = () => {
  const repositories = createRepositories();
  const written = repositories.checkout.write({
    scope,
    data: checkoutWriteData,
    isCurrent: () => true,
  });
  if (written.status !== "written") throw new Error("checkout fixture failed");
  return { repositories, written };
};

const seedCallback = (
  checkout: CheckoutData,
  phase: CallbackData["phase"] = "reconciling",
) => {
  const repositories = createRepositories();
  const callback: CallbackData = {
    operationId: checkout.operationId,
    reservationUid: checkout.reservationUid,
    orderId: checkout.reservationUid,
    paymentKey: "payment-key-1",
    amount: checkout.amount,
    phase,
  };
  const result = repositories.callback.write({
    scope,
    data: callback,
    isCurrent: () => true,
  });
  if (result.status !== "written") throw new Error("callback fixture failed");
  return callback;
};

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {JSON.stringify({
        pathname: location.pathname,
        search: location.search,
        state: location.state,
      })}
    </output>
  );
}

function FailureRouteTransitionControls() {
  const navigate = useNavigate();

  return (
    <>
      <button
        data-testid="navigate-failure-reservation-1"
        onClick={() =>
          navigate(
            "/reservations/reservation-1/fail?reason=confirm-failed",
          )
        }
        type="button"
      />
      <button
        data-testid="navigate-failure-reservation-2"
        onClick={() =>
          navigate(
            "/reservations/reservation-2/fail?reason=confirm-failed",
          )
        }
        type="button"
      />
      <button
        data-testid="navigate-failure-invalid-callback"
        onClick={() =>
          navigate(
            "/reservations/reservation-1/fail?reason=invalid-callback",
          )
        }
        type="button"
      />
    </>
  );
}

const renderRoute = (
  initialEntry: InitialEntry,
  routePath: string,
  element: ReactElement,
  controls?: ReactElement,
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        {controls}
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="*" element={<div data-testid="fallback-route" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const paymentSuccessRoute = () => (
  <PaymentCallbackCredentialBoundary>
    <PaymentSuccessRoute />
  </PaymentCallbackCredentialBoundary>
);

describe("booking payment app routes", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockPaymentControllerProps.length = 0;
    mockConfirmControllerProps.length = 0;
    mockGetCheckoutOwnership.mockReset();
    mockGetPaymentByOrderId.mockReset();
  });

  it("consumes the checkout handle before mounting the confirm controller", async () => {
    const { written } = seedCheckout();

    renderRoute(
      {
        pathname: "/accommodations/42/confirm",
        state: written.handle,
      },
      "/accommodations/:id/confirm",
      <ReservationConfirmRoute />,
    );

    await screen.findByTestId("reservation-confirm-controller");
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent('"state":null'),
    );
    expect(mockConfirmControllerProps.at(-1)).toMatchObject({
      checkout: written.data,
      customer: { email: "viewer@example.com", name: "뷰어" },
    });
    expect(window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"))
      .not.toContain("viewer@example.com");
  });

  it("purges a legacy checkout when server dates or guest count do not match", async () => {
    seedLegacyCheckout();
    mockGetCheckoutOwnership.mockResolvedValue({
      reservationUid: "reservation-1",
      accommodationId: 42,
      checkIn: "2026-09-11",
      checkOut: "2026-09-13",
      guestCount: 2,
      payment: null,
    });

    renderRoute(
      "/accommodations/42/confirm",
      "/accommodations/:id/confirm",
      <ReservationConfirmRoute />,
    );

    await screen.findByTestId("fallback-route");
    expect(mockConfirmControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:reservation-checkout:42"),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem(
        "airbob:reservation-checkout-index:reservation-1",
      ),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toBeNull();
  });

  it("preserves a legacy checkout when ownership verification is retryable", async () => {
    seedLegacyCheckout();
    const rawPrimary = window.sessionStorage.getItem(
      "airbob:reservation-checkout:42",
    );
    mockGetCheckoutOwnership.mockRejectedValue(new Error("network unavailable"));

    renderRoute(
      "/accommodations/42/confirm",
      "/accommodations/:id/confirm",
      <ReservationConfirmRoute />,
    );

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"pathname":"/accommodations/42"',
    );
    expect(mockConfirmControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:reservation-checkout:42"),
    ).toBe(rawPrimary);
    expect(
      window.sessionStorage.getItem(
        "airbob:reservation-checkout-index:reservation-1",
      ),
    ).toBe("42");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toBeNull();
  });

  it("migrates a server-verified legacy checkout without retaining customer fields", async () => {
    seedLegacyCheckout();
    mockGetCheckoutOwnership.mockResolvedValue({
      reservationUid: "reservation-1",
      accommodationId: 42,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guestCount: 2,
      payment: {
        orderId: "reservation-1",
        paymentKey: null,
        totalAmount: 120_000,
        status: "READY",
      },
    });

    renderRoute(
      "/accommodations/42/confirm",
      "/accommodations/:id/confirm",
      <ReservationConfirmRoute />,
    );

    await screen.findByTestId("reservation-confirm-controller");
    expect(mockGetCheckoutOwnership).toHaveBeenCalledWith(
      "reservation-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockConfirmControllerProps.at(-1)).toMatchObject({
      checkout: expect.objectContaining({
        accommodationId: 42,
        reservationUid: "reservation-1",
        amount: 120_000,
      }),
    });
    expect(
      window.sessionStorage.getItem("airbob:reservation-checkout:42"),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem(
        "airbob:reservation-checkout-index:reservation-1",
      ),
    ).toBeNull();
    const migrated = window.sessionStorage.getItem(
      "airbob:booking-payment-v1:checkout",
    );
    expect(migrated).toContain('"owner":"subject:route_payment"');
    expect(migrated).not.toContain("legacy@example.com");
    expect(migrated).not.toContain("customerEmail");
    expect(migrated).not.toContain("customerName");
  });

  it("uses the payment order fallback to verify a legacy checkout", async () => {
    seedLegacyCheckout();
    mockGetCheckoutOwnership.mockResolvedValue({
      reservationUid: "reservation-1",
      accommodationId: 42,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guestCount: 2,
      payment: null,
    });
    mockGetPaymentByOrderId.mockResolvedValue({
      orderId: "reservation-1",
      paymentKey: null,
      totalAmount: 120_000,
      status: "READY",
    });

    renderRoute(
      "/accommodations/42/confirm",
      "/accommodations/:id/confirm",
      <ReservationConfirmRoute />,
    );

    await screen.findByTestId("reservation-confirm-controller");
    expect(mockGetPaymentByOrderId).toHaveBeenCalledWith(
      "reservation-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      window.sessionStorage.getItem("airbob:reservation-checkout:42"),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).not.toContain("legacy@example.com");
  });

  it("moves a fresh callback into owned storage and scrubs paymentKey from the URL", async () => {
    const { written } = seedCheckout();

    renderRoute(
      "/reservations/reservation-1/success?paymentKey=payment-key-1&orderId=reservation-1&amount=120000",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    await screen.findByTestId("payment-result-controller");
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent('"search":""'),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("payment-key-1");
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      document: {
        operationId: written.data.operationId,
        reservationUid: written.data.reservationUid,
        amount: written.data.amount,
        accommodationId: written.data.accommodationId,
        checkIn: written.data.checkIn,
        checkOut: written.data.checkOut,
        guestCount: 2,
      },
      mode: "success",
      shouldConfirm: true,
    });
    expect(
      createRepositories().callback.read({
        scope,
        operationId: written.data.operationId,
      }),
    ).toEqual(
      expect.objectContaining({
        status: "found",
        data: expect.objectContaining({ paymentKey: "payment-key-1" }),
      }),
    );
  });

  it("restores a persisted callback from a blank success URL without confirming twice", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data);

    renderRoute(
      "/reservations/reservation-1/success",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    await screen.findByTestId("payment-result-controller");
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      callback: {
        operationId: written.data.operationId,
        paymentKey: "payment-key-1",
      },
      mode: "success",
      shouldConfirm: false,
    });
  });

  it("keeps a persisted received success callback eligible for its first confirm", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data, "received");

    renderRoute(
      "/reservations/reservation-1/success",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    await screen.findByTestId("payment-result-controller");
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      callback: { phase: "received" },
      mode: "success",
      shouldConfirm: true,
    });
  });

  it("turns a legacy confirmed marker into reconciliation only", async () => {
    seedCheckout();
    const markerTuple = ["reservation-1", "payment-key-1", "120000"]
      .map(encodeURIComponent)
      .join("|");
    const markerKey = `airbob:payment-confirmed:${markerTuple}`;
    window.sessionStorage.setItem(markerKey, "1");

    renderRoute(
      "/reservations/reservation-1/success?paymentKey=payment-key-1&orderId=reservation-1&amount=120000",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    await screen.findByTestId("payment-result-controller");
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      callback: { phase: "reconciling" },
      shouldConfirm: false,
    });
    expect(window.sessionStorage.getItem(markerKey)).toBeNull();
  });

  it("re-enters a cleared callback through server reconciliation without recreating browser documents", async () => {
    mockGetCheckoutOwnership.mockResolvedValue({
      reservationUid: "reservation-1",
      accommodationId: 42,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      guestCount: 2,
      payment: {
        orderId: "reservation-1",
        paymentKey: "payment-key-1",
        totalAmount: 120_000,
        status: "DONE",
      },
    });

    renderRoute(
      "/reservations/reservation-1/success?paymentKey=payment-key-1&orderId=reservation-1&amount=120000",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    await screen.findByTestId("payment-result-controller");
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent('"search":""'),
    );
    expect(mockGetCheckoutOwnership).toHaveBeenCalledWith(
      "reservation-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      document: {
        operationId: "server_replay",
        reservationUid: "reservation-1",
        amount: 120_000,
        accommodationId: 42,
        checkIn: "2026-09-10",
        checkOut: "2026-09-12",
        guestCount: 2,
      },
      mode: "success",
      shouldConfirm: false,
    });
    expect(window.sessionStorage.length).toBe(0);

    const onRecoverable = mockPaymentControllerProps.at(-1)?.onRecoverable;
    if (typeof onRecoverable !== "function") {
      throw new Error("replay recovery callback fixture is missing");
    }
    act(() => onRecoverable());

    await waitFor(() =>
      expect(mockPaymentControllerProps.at(-1)).toMatchObject({
        mode: "failure",
        shouldConfirm: false,
      }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"pathname":"/reservations/reservation-1/success"',
    );
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
    expect(window.sessionStorage.length).toBe(0);
  });

  it("retries a transient server replay preflight in place with the scrubbed tuple", async () => {
    mockGetCheckoutOwnership
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        reservationUid: "reservation-1",
        accommodationId: 42,
        checkIn: "2026-09-10",
        checkOut: "2026-09-12",
        guestCount: 2,
        payment: {
          orderId: "reservation-1",
          paymentKey: "payment-key-1",
          totalAmount: 120_000,
          status: "DONE",
        },
      });

    renderRoute(
      "/reservations/reservation-1/success?paymentKey=payment-key-1&orderId=reservation-1&amount=120000",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    expect(
      await screen.findByText(
        "결제 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      ),
    ).toBeVisible();
    expect(mockGetCheckoutOwnership).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      "payment-key-1",
    );
    expect(mockPaymentControllerProps).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "결제 상태 확인" }));

    await screen.findByTestId("payment-result-controller");
    expect(mockGetCheckoutOwnership).toHaveBeenCalledTimes(2);
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      callback: {
        operationId: "server_replay",
        reservationUid: "reservation-1",
        orderId: "reservation-1",
        paymentKey: "payment-key-1",
        amount: 120_000,
      },
      mode: "success",
      shouldConfirm: false,
    });
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
    expect(window.sessionStorage.length).toBe(0);
  });

  it("rejects a mismatched callback without mounting payment confirmation", async () => {
    seedCheckout();

    renderRoute(
      "/reservations/reservation-1/success?paymentKey=payment-key-1&orderId=reservation-1&amount=1",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/reservations/reservation-1/fail",
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("payment-key-1");
    expect(mockPaymentControllerProps).toHaveLength(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("rejects a partial callback after the credential boundary scrubs it", async () => {
    seedCheckout();

    renderRoute(
      "/reservations/reservation-1/success?paymentKey=partial-payment-key",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/reservations/reservation-1/fail",
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      "partial-payment-key",
    );
    expect(mockPaymentControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain("reservation-1");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toBeNull();
  });

  it("preserves checkout B when a foreign reservation callback is rejected", async () => {
    seedCheckout();

    renderRoute(
      "/reservations/reservation-foreign/success?paymentKey=foreign-payment-key&orderId=reservation-foreign&amount=120000",
      "/reservations/:reservationUid/success",
      paymentSuccessRoute(),
    );

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/reservations/reservation-foreign/fail",
    );
    expect(mockPaymentControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain("reservation-1");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toBeNull();
  });

  it("restores retryable fail state from owned documents and drops URL credentials", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data);

    renderRoute(
      "/reservations/reservation-1/fail?reason=confirm-failed&paymentKey=payment-key-1&orderId=reservation-1&amount=120000",
      "/reservations/:reservationUid/fail",
      <PaymentFailRoute />,
    );

    await screen.findByTestId("payment-result-controller");
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        '"search":"?reason=confirm-failed"',
      ),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("payment-key-1");
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      mode: "failure",
      shouldConfirm: false,
    });
  });

  it("restores a received failure callback as confirm-capable", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data, "received");

    renderRoute(
      "/reservations/reservation-1/fail?reason=confirm-failed",
      "/reservations/:reservationUid/fail",
      <PaymentFailRoute />,
    );

    await screen.findByTestId("payment-result-controller");
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      callback: { phase: "received" },
      mode: "failure",
      shouldConfirm: true,
    });
  });

  it("preserves a callback-less checkout on an invalid callback route", () => {
    seedCheckout();

    renderRoute(
      "/reservations/reservation-1/fail?reason=invalid-callback",
      "/reservations/:reservationUid/fail",
      <PaymentFailRoute />,
    );

    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain("reservation-1");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toBeNull();
    expect(mockPaymentControllerProps).toHaveLength(0);
  });

  it("clears an exactly joined terminal callback tuple", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data);

    renderRoute(
      "/reservations/reservation-1/fail?reason=invalid-callback",
      "/reservations/:reservationUid/fail",
      <PaymentFailRoute />,
    );

    await waitFor(() =>
      expect(
        window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
      ).toBeNull(),
    );
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toBeNull();
  });

  it("leases a ready failure resolution to the current reservation and reason", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data);

    renderRoute(
      "/reservations/reservation-1/fail?reason=confirm-failed",
      "/reservations/:reservationUid/fail",
      <PaymentFailRoute />,
      <FailureRouteTransitionControls />,
    );

    await screen.findByTestId("payment-result-controller");
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      callback: { reservationUid: "reservation-1" },
    });
    const reservationAController = mockPaymentControllerProps.at(-1);

    fireEvent.click(
      screen.getByTestId("navigate-failure-reservation-2"),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("payment-result-controller"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"pathname":"/reservations/reservation-2/fail"',
    );
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain("reservation-1");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toContain("reservation-1");

    const staleTerminalFailure =
      reservationAController?.onTerminalFailure;
    const staleConfirmed = reservationAController?.onConfirmed;
    if (
      typeof staleTerminalFailure !== "function" ||
      typeof staleConfirmed !== "function"
    ) {
      throw new Error("failure controller callback fixture is missing");
    }
    act(() => staleTerminalFailure());
    await act(async () => staleConfirmed());
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"pathname":"/reservations/reservation-2/fail"',
    );
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain("reservation-1");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toContain("reservation-1");

    fireEvent.click(
      screen.getByTestId("navigate-failure-reservation-1"),
    );
    await screen.findByTestId("payment-result-controller");

    fireEvent.click(
      screen.getByTestId("navigate-failure-invalid-callback"),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("payment-result-controller"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"search":"?reason=invalid-callback"',
    );
  });
});
