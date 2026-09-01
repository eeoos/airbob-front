import { useLayoutEffect, useState, type ReactElement } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
import { testSessionRuntimeLeaseId } from "../../../test/sessionFixtures";
import {
  createBookingPaymentCallbackRepository,
  createBookingPaymentCheckoutRepository,
  type CallbackData,
  type CheckoutData,
} from "../../../workflows/booking-payment/checkout";
import {
  PaymentCallbackCredentialBoundary,
  type PaymentRecoveryFenceStatus,
  useMarkPaymentRecoveryFence,
} from "../PaymentCallbackCredentialBoundary";
import PaymentFailRoute from "./PaymentFailRoute";
import PaymentSuccessRoute from "./PaymentSuccessRoute";
import ReservationConfirmRoute from "./ReservationConfirmRoute";

const scope: AuthenticatedSessionScope = {
  epoch: 3,
  runtimeLeaseId: testSessionRuntimeLeaseId,
  subject: "subject:route_payment" as SessionSubject,
};
const mockPaymentControllerProps: Array<Record<string, unknown>> = [];
const mockConfirmControllerProps: Array<Record<string, unknown>> = [];
const mockGetCheckoutOwnership = vi.fn();

vi.mock("../../../features/reservations/payment/public", async () => {
  const actual = await vi.importActual<
    typeof import("../../../features/reservations/payment/public")
  >("../../../features/reservations/payment/public");

  return {
    ...actual,
    checkoutOwnershipApi: {
      getCheckoutOwnership: (...args: unknown[]) =>
        mockGetCheckoutOwnership(...args),
    },
  };
});

vi.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    getOrigin: () => "https://airbob.test",
    isCurrentHistoryEntry: () => true,
    openInNewTab: vi.fn(),
    replaceCurrentUrl: vi.fn(),
  },
}));

vi.mock("../../../screens/payment-result/PaymentResultController", () => ({
  PaymentResultController: (props: Record<string, unknown>) => {
    mockPaymentControllerProps.push(props);
    return <div data-testid="payment-result-controller" />;
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
          navigate("/reservations/reservation-1/fail?reason=confirm-failed")
        }
        type="button"
      />
      <button
        data-testid="navigate-failure-reservation-2"
        onClick={() =>
          navigate("/reservations/reservation-2/fail?reason=confirm-failed")
        }
        type="button"
      />
      <button
        data-testid="navigate-failure-invalid-callback"
        onClick={() =>
          navigate("/reservations/reservation-1/fail?reason=invalid-callback")
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

const paymentFailRoute = () => (
  <PaymentCallbackCredentialBoundary>
    <PaymentFailRoute />
  </PaymentCallbackCredentialBoundary>
);

function PaymentRecoveryFenceBeforeCommands({
  children,
  status,
}: {
  readonly children: ReactElement;
  readonly status: Exclude<PaymentRecoveryFenceStatus, "none">;
}) {
  const markRecoveryFence = useMarkPaymentRecoveryFence();
  const [commandsReleased, setCommandsReleased] = useState(false);

  useLayoutEffect(() => {
    markRecoveryFence(status);
    setCommandsReleased(true);
  }, [markRecoveryFence, status]);

  return commandsReleased ? children : null;
}

const recoveryFencedRoute = (
  element: ReactElement,
  status: Exclude<PaymentRecoveryFenceStatus, "none">,
) => (
  <PaymentCallbackCredentialBoundary>
    <PaymentRecoveryFenceBeforeCommands status={status}>
      {element}
    </PaymentRecoveryFenceBeforeCommands>
  </PaymentCallbackCredentialBoundary>
);

describe("booking payment app routes", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockPaymentControllerProps.length = 0;
    mockConfirmControllerProps.length = 0;
    mockGetCheckoutOwnership.mockReset();
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
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).not.toContain("viewer@example.com");
  });

  it("purges retired checkout documents and opens trips without backend recovery", async () => {
    window.sessionStorage.setItem(
      "airbob:reservation-checkout:42",
      "retired-checkout-document",
    );
    window.sessionStorage.setItem(
      "airbob:reservation-checkout-index:reservation-1",
      "42",
    );

    renderRoute(
      "/accommodations/42/confirm",
      "/accommodations/:id/confirm",
      <ReservationConfirmRoute />,
    );

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"pathname":"/profile"',
    );
    expect(mockConfirmControllerProps).toHaveLength(0);
    expect(mockGetCheckoutOwnership).not.toHaveBeenCalled();
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
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      "payment-key-1",
    );
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

  it.each(["recovery-required", "recovery-unavailable"] as const)(
    "routes %s success callbacks to reservation detail without reviving a confirm-capable legacy tuple",
    async (status) => {
      const { written } = seedCheckout();
      seedCallback(written.data, "received");

      renderRoute(
        "/reservations/reservation-1/success",
        "/reservations/:reservationUid/success",
        recoveryFencedRoute(<PaymentSuccessRoute />, status),
      );

      await screen.findByTestId("fallback-route");
      expect(screen.getByTestId("location")).toHaveTextContent(
        '"pathname":"/reservations/reservation-1"',
      );
      expect(mockPaymentControllerProps).toHaveLength(0);
      expect(mockGetCheckoutOwnership).not.toHaveBeenCalled();
    },
  );

  it("routes a recovery-fenced failure callback to reservation detail before reading a confirm-capable legacy tuple", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data, "received");

    renderRoute(
      "/reservations/reservation-1/fail?reason=confirm-failed",
      "/reservations/:reservationUid/fail",
      recoveryFencedRoute(<PaymentFailRoute />, "recovery-required"),
    );

    await screen.findByTestId("fallback-route");
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"pathname":"/reservations/reservation-1"',
    );
    expect(mockPaymentControllerProps).toHaveLength(0);
    expect(mockGetCheckoutOwnership).not.toHaveBeenCalled();
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

  it("ignores a retired marker and starts a fresh callback at received", async () => {
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
      callback: { phase: "received" },
      shouldConfirm: true,
    });
    expect(window.sessionStorage.getItem(markerKey)).toBe("1");
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
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      "payment-key-1",
    );
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

  it("rejects an internal-looking fail query that also carries provider credentials", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data);

    renderRoute(
      "/reservations/reservation-1/fail?reason=confirm-failed&paymentKey=payment-key-1&orderId=reservation-1&amount=120000",
      "/reservations/:reservationUid/fail",
      paymentFailRoute(),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent('"search":""'),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      "payment-key-1",
    );
    expect(mockPaymentControllerProps).toHaveLength(0);
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:checkout"),
    ).toContain("reservation-1");
    expect(
      window.sessionStorage.getItem("airbob:booking-payment-v1:callback"),
    ).toContain("reservation-1");
  });

  it("restores a received failure callback as confirm-capable", async () => {
    const { written } = seedCheckout();
    seedCallback(written.data, "received");

    renderRoute(
      "/reservations/reservation-1/fail?reason=confirm-failed",
      "/reservations/:reservationUid/fail",
      paymentFailRoute(),
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
      paymentFailRoute(),
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
      paymentFailRoute(),
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
      paymentFailRoute(),
      <FailureRouteTransitionControls />,
    );

    await screen.findByTestId("payment-result-controller");
    expect(mockPaymentControllerProps.at(-1)).toMatchObject({
      callback: { reservationUid: "reservation-1" },
    });
    const reservationAController = mockPaymentControllerProps.at(-1);

    fireEvent.click(screen.getByTestId("navigate-failure-reservation-2"));

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

    const staleTerminalFailure = reservationAController?.onTerminalFailure;
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

    fireEvent.click(screen.getByTestId("navigate-failure-reservation-1"));
    await screen.findByTestId("payment-result-controller");

    fireEvent.click(screen.getByTestId("navigate-failure-invalid-callback"));

    await waitFor(() =>
      expect(
        screen.queryByTestId("payment-result-controller"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
  });
});
