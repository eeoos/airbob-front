import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type InitialEntry,
} from "react-router-dom";
import { RequireAuthenticatedRoute } from "./RequireAuthenticatedRoute";
import {
  PaymentCallbackCredentialBoundary,
  useMarkPaymentRecoveryFence,
  usePendingPaymentCallbackCredentialForCandidate,
  usePaymentCallbackCredentialClaim,
  usePaymentCallbackFailureClaim,
  usePaymentRecoveryFenceStatus,
} from "./PaymentCallbackCredentialBoundary";

const mockUseSession = vi.fn();
const mockAuthenticatedBoundaryRender = vi.fn();

vi.mock("../session/useSession", () => ({
  useSession: () => mockUseSession(),
}));

const callbackPath = "/reservations/reservation-1/success";
const callbackSearch =
  "?paymentKey=payment-key-1&orderId=reservation-1&amount=120000";
const failPath = "/reservations/reservation-1/fail";

function LocationProbe() {
  const location = useLocation();

  return (
    <output data-testid="location">
      {JSON.stringify({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        state: location.state,
      })}
    </output>
  );
}

function CredentialProbe() {
  const claim = usePaymentCallbackCredentialClaim();
  const failureClaim = usePaymentCallbackFailureClaim();

  return (
    <>
      <output data-testid="credential-claim">{JSON.stringify(claim)}</output>
      <output data-testid="failure-claim">
        {JSON.stringify(failureClaim)}
      </output>
    </>
  );
}

function PendingCredentialProbe() {
  const pending = usePendingPaymentCallbackCredentialForCandidate();
  return (
    <output data-testid="pending-candidate-credential">
      {JSON.stringify(pending.read())}
    </output>
  );
}

function AuthenticatedBoundaryProbe() {
  const location = useLocation();
  mockAuthenticatedBoundaryRender({
    hash: location.hash,
    search: location.search,
    state: location.state,
  });

  return (
    <RequireAuthenticatedRoute>
      <CredentialProbe />
    </RequireAuthenticatedRoute>
  );
}

const renderBoundary = (
  initialEntry: InitialEntry,
  now: () => number = Date.now,
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <PaymentCallbackCredentialBoundary now={now}>
        <Routes>
          <Route
            path="/reservations/:reservationUid/success"
            element={<AuthenticatedBoundaryProbe />}
          />
          <Route
            path="/reservations/:reservationUid/fail"
            element={<AuthenticatedBoundaryProbe />}
          />
          <Route
            path="/login"
            element={
              <>
                <div data-testid="login-route" />
                <PendingCredentialProbe />
              </>
            }
          />
        </Routes>
      </PaymentCallbackCredentialBoundary>
    </MemoryRouter>,
  );

const setBrowserCallbackEntry = ({
  hash = "",
  pathname = callbackPath,
  search,
}: {
  readonly hash?: string;
  readonly pathname?: string;
  readonly search: string;
}) => {
  window.history.replaceState(
    {
      idx: 0,
      key: "callback-entry",
      usr: { paymentKey: "payment-key-in-browser-history" },
    },
    "",
    `${pathname}${search}${hash}`,
  );
};

function StableRuntimeProbe({
  onLocationRender,
  onMount,
  onUnmount,
}: {
  readonly onLocationRender?: (location: string) => void;
  readonly onMount: () => void;
  readonly onUnmount: () => void;
}) {
  const claim = usePaymentCallbackCredentialClaim();
  const failureClaim = usePaymentCallbackFailureClaim();
  const recoveryFenceStatus = usePaymentRecoveryFenceStatus();
  const markRecoveryFence = useMarkPaymentRecoveryFence();
  const navigate = useNavigate();
  const location = useLocation();
  const renderedLocation = `${location.pathname}${location.search}${location.hash}:${JSON.stringify(location.state)}`;
  onLocationRender?.(renderedLocation);

  useEffect(() => {
    onMount();
    return onUnmount;
  }, [onMount, onUnmount]);

  return (
    <>
      <output data-testid="stable-claim">{JSON.stringify(claim)}</output>
      <output data-testid="stable-failure-claim">
        {JSON.stringify(failureClaim)}
      </output>
      <output data-testid="stable-location">{renderedLocation}</output>
      <output data-testid="recovery-fence">{recoveryFenceStatus}</output>
      <button
        type="button"
        onClick={() => navigate("/reservations/reservation-2/success")}
      >
        next success
      </button>
      <button
        type="button"
        onClick={() => navigate("/reservations/reservation-2/fail")}
      >
        payment fail
      </button>
      <button
        type="button"
        onClick={() =>
          navigate("/reservations/reservation-2/fail?reason=confirm-failed")
        }
      >
        internal failure callback
      </button>
      <button type="button" onClick={() => navigate("/")}>
        home
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
      <button
        type="button"
        onClick={() => markRecoveryFence("recovery-unavailable")}
      >
        fence recovery
      </button>
      <button type="button" onClick={() => markRecoveryFence("none")}>
        clear recovery fence
      </button>
      <button
        type="button"
        onClick={() =>
          navigate(
            "/reservations/reservation-3/success?paymentKey=payment-key-3&orderId=reservation-3&amount=130000",
          )
        }
      >
        new callback
      </button>
      <button
        type="button"
        onClick={() =>
          navigate(
            "/reservations/reservation-4/success?paymentKey=provider-secret-query&orderId=reservation-4&amount=140000#provider-secret-hash",
            { state: { code: "provider-secret-state" } },
          )
        }
      >
        sensitive callback
      </button>
    </>
  );
}

const expectCredentialsScrubbedFromHistory = (
  pathname = callbackPath,
  forbiddenValue = "payment-key",
) => {
  expect(window.location.pathname).toBe(pathname);
  expect(window.location.search).toBe("");
  expect(window.location.hash).toBe("");
  expect(JSON.stringify(window.history.state)).not.toContain(forbiddenValue);
  expect(window.history.state).toMatchObject({ usr: null });
};

describe("PaymentCallbackCredentialBoundary", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
    mockAuthenticatedBoundaryRender.mockReset();
    window.history.replaceState(null, "", "/");
  });

  it("scrubs credentials before rendering a checking auth boundary", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "checking" },
      revalidate: vi.fn(),
    });
    setBrowserCallbackEntry({
      hash: "#paymentKey=payment-key-in-hash",
      search: callbackSearch,
    });

    renderBoundary({
      hash: "#paymentKey=payment-key-in-hash",
      pathname: callbackPath,
      search: callbackSearch,
      state: { paymentKey: "payment-key-in-router-history" },
    });

    await screen.findByText("로그인 상태를 확인하는 중...");
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent('"search":""'),
    );

    expect(mockAuthenticatedBoundaryRender).toHaveBeenCalledWith({
      hash: "",
      search: "",
      state: null,
    });
    expect(mockAuthenticatedBoundaryRender).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: callbackSearch }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent('"state":null');
    expect(screen.queryByTestId("credential-claim")).not.toBeInTheDocument();
    expectCredentialsScrubbedFromHistory();
  });

  it("sends an anonymous user to login with a credential-free return path", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "anonymous" },
      revalidate: vi.fn(),
    });
    setBrowserCallbackEntry({ search: callbackSearch });

    renderBoundary({
      pathname: callbackPath,
      search: callbackSearch,
      state: { paymentKey: "payment-key-in-router-history" },
    });

    await screen.findByTestId("login-route");
    const routerLocation = screen.getByTestId("location").textContent ?? "";

    expect(routerLocation).toContain('"pathname":"/login"');
    expect(routerLocation).toContain(
      `"from":{"pathname":"${callbackPath}","search":"","hash":""}`,
    );
    expect(routerLocation).not.toContain("payment-key");
    expectCredentialsScrubbedFromHistory();
  });

  it("keeps one valid callback private across the anonymous login detour", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "anonymous" },
      revalidate: vi.fn(),
    });
    window.history.replaceState(null, "", `${callbackPath}${callbackSearch}`);

    renderBoundary({ pathname: callbackPath, search: callbackSearch });

    await screen.findByTestId("login-route");
    expect(
      screen.getByTestId("pending-candidate-credential"),
    ).toHaveTextContent('"paymentKey":"payment-key-1"');
    expect(screen.queryByTestId("credential-claim")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      "payment-key-1",
    );
    expect(window.location.pathname).toBe(callbackPath);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(JSON.stringify(window.history.state)).not.toContain("payment-key");
  });

  it("passes an exact credential-free operation reference through without scrubbing", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    const reservationUid = "20000000-0000-4000-8000-000000000002";
    const pathname = `/reservations/${reservationUid}/success`;
    const operationReference = {
      purpose: "booking-payment-operation-reference",
      version: 2,
      flowId: "10000000-0000-4000-8000-000000000001",
      operationId: "30000000-0000-4000-8000-000000000003",
      reservationUid,
    } as const;
    window.history.replaceState(
      { idx: 0, key: "operation", usr: operationReference },
      "",
      pathname,
    );

    renderBoundary({ pathname, state: operationReference });

    expect(await screen.findByTestId("credential-claim")).toHaveTextContent(
      '{"status":"none"}',
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      JSON.stringify(operationReference),
    );
    expect(mockAuthenticatedBoundaryRender).toHaveBeenCalledWith({
      hash: "",
      search: "",
      state: operationReference,
    });
    expect(window.history.state).toMatchObject({ usr: operationReference });
  });

  it("passes an exact credential-free pre-Accepted flow reference through", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    const reservationUid = "20000000-0000-4000-8000-000000000002";
    const pathname = `/reservations/${reservationUid}/success`;
    const flowReference = {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId: "10000000-0000-4000-8000-000000000001",
      locator: { kind: "reservation", reservationUid },
    } as const;
    window.history.replaceState(
      { idx: 0, key: "flow", usr: flowReference },
      "",
      pathname,
    );

    renderBoundary({ pathname, state: flowReference });

    expect(await screen.findByTestId("credential-claim")).toHaveTextContent(
      '{"status":"none"}',
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      JSON.stringify(flowReference),
    );
    expect(mockAuthenticatedBoundaryRender).toHaveBeenCalledWith({
      hash: "",
      search: "",
      state: flowReference,
    });
    expect(window.history.state).toMatchObject({ usr: flowReference });
  });

  it("keeps a valid callback tuple only in memory after authentication", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    setBrowserCallbackEntry({ search: callbackSearch });

    renderBoundary({
      pathname: callbackPath,
      search: callbackSearch,
    });

    const claim = await screen.findByTestId("credential-claim");

    expect(claim).toHaveTextContent('"status":"fresh"');
    expect(claim).toHaveTextContent('"paymentKey":"payment-key-1"');
    expect(claim).toHaveTextContent('"amount":120000');
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
    expect(screen.getByTestId("location")).toHaveTextContent('"state":null');
    expectCredentialsScrubbedFromHistory();
  });

  it("keeps the first capture time stable across every scrub render", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    const now = vi.fn().mockReturnValueOnce(1_000).mockReturnValue(9_000);
    setBrowserCallbackEntry({ search: callbackSearch });

    renderBoundary({ pathname: callbackPath, search: callbackSearch }, now);

    expect(await screen.findByTestId("credential-claim")).toHaveTextContent(
      '"firstCapturedAt":1000',
    );
    expect(now.mock.calls.length).toBeGreaterThan(1);
    expect(screen.getByTestId("credential-claim")).not.toHaveTextContent(
      '"firstCapturedAt":9000',
    );
  });

  it("fails a partial callback closed after removing it from both histories", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    const partialSearch = "?paymentKey=partial-payment-key";
    setBrowserCallbackEntry({ search: partialSearch });

    renderBoundary({
      pathname: callbackPath,
      search: partialSearch,
      state: { paymentKey: "partial-payment-key" },
    });

    const claim = await screen.findByTestId("credential-claim");

    expect(claim).toHaveTextContent('{"status":"invalid"}');
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
    expect(screen.getByTestId("location")).toHaveTextContent('"state":null');
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      "partial-payment-key",
    );
    expectCredentialsScrubbedFromHistory();
  });

  it.each([
    {
      label: "an unknown query key",
      search: `${callbackSearch}&code=provider-secret-code`,
      hash: "",
      state: null,
    },
    {
      label: "a duplicate callback key",
      search: `${callbackSearch}&paymentKey=provider-secret-duplicate`,
      hash: "",
      state: null,
    },
    {
      label: "a callback hash",
      search: callbackSearch,
      hash: "#provider-secret-hash",
      state: null,
    },
    {
      label: "callback router state",
      search: callbackSearch,
      hash: "",
      state: { code: "provider-secret-state" },
    },
    {
      label: "an oversized payment key",
      search: `?paymentKey=${"x".repeat(201)}&orderId=reservation-1&amount=120000`,
      hash: "",
      state: null,
    },
    {
      label: "malformed URL encoding",
      search: "?paymentKey=%E0%A4%A&orderId=reservation-1&amount=120000",
      hash: "",
      state: null,
    },
  ])("fails $label closed after scrubbing it", async (entry) => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    setBrowserCallbackEntry({ hash: entry.hash, search: entry.search });

    renderBoundary({
      hash: entry.hash,
      pathname: callbackPath,
      search: entry.search,
      state: entry.state,
    });

    expect(await screen.findByTestId("credential-claim")).toHaveTextContent(
      '{"status":"invalid"}',
    );
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
    expect(screen.getByTestId("location")).toHaveTextContent('"hash":""');
    expect(screen.getByTestId("location")).toHaveTextContent('"state":null');
    expect(document.body).not.toHaveTextContent("provider-secret");
    expectCredentialsScrubbedFromHistory();
  });

  it.each(["confirm-failed", "invalid-callback"] as const)(
    "keeps only the data-less %s reason for an exact app-authored fail route",
    async (reason) => {
      mockUseSession.mockReturnValue({
        state: { status: "authenticated" },
        revalidate: vi.fn(),
      });
      const search = `?reason=${reason}`;
      setBrowserCallbackEntry({ pathname: failPath, search });

      renderBoundary({ pathname: failPath, search });

      expect(await screen.findByTestId("failure-claim")).toHaveTextContent(
        JSON.stringify({ status: "internal", reason }),
      );
      expect(screen.getByTestId("credential-claim")).toHaveTextContent(
        '{"status":"none"}',
      );
      expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
      expect(screen.getByTestId("location")).toHaveTextContent('"hash":""');
      expect(screen.getByTestId("location")).toHaveTextContent('"state":null');
      expect(mockAuthenticatedBoundaryRender).toHaveBeenCalledWith({
        hash: "",
        search: "",
        state: null,
      });
      expectCredentialsScrubbedFromHistory(failPath);
    },
  );

  it.each([
    {
      label: "provider fields",
      search:
        "?code=provider-secret-code&message=provider-secret-message&orderId=provider-secret-order",
      hash: "#paymentKey=provider-secret-key",
      state: null,
    },
    {
      label: "a partial internal-looking query",
      search: "?reason=confirm-failed&paymentKey=provider-secret",
      hash: "",
      state: null,
    },
    {
      label: "an unknown reason",
      search: "?reason=provider-secret",
      hash: "",
      state: null,
    },
    {
      label: "provider router state",
      search: "?reason=confirm-failed",
      hash: "",
      state: { message: "provider-secret" },
    },
  ])("reduces $label to an invalid data-less fail claim", async (entry) => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    setBrowserCallbackEntry({
      hash: entry.hash,
      pathname: failPath,
      search: entry.search,
    });

    renderBoundary({
      hash: entry.hash,
      pathname: failPath,
      search: entry.search,
      state: entry.state,
    });

    expect(await screen.findByTestId("failure-claim")).toHaveTextContent(
      '{"status":"invalid"}',
    );
    expect(screen.getByTestId("credential-claim")).toHaveTextContent(
      '{"status":"none"}',
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      "provider-secret",
    );
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
    expect(screen.getByTestId("location")).toHaveTextContent('"hash":""');
    expect(screen.getByTestId("location")).toHaveTextContent('"state":null');
    expect(document.body).not.toHaveTextContent("provider-secret");
    expect(JSON.stringify(window.history.state)).not.toContain(
      "provider-secret",
    );
    expectCredentialsScrubbedFromHistory(failPath);
  });

  it("does not revive an internal fail reason when navigating back to its scrubbed entry", async () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    const failSearch = "?reason=confirm-failed";
    setBrowserCallbackEntry({ pathname: failPath, search: failSearch });

    const view = render(
      <MemoryRouter initialEntries={[`${failPath}${failSearch}`]}>
        <PaymentCallbackCredentialBoundary>
          <StableRuntimeProbe onMount={onMount} onUnmount={onUnmount} />
        </PaymentCallbackCredentialBoundary>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("stable-failure-claim")).toHaveTextContent(
        '"reason":"confirm-failed"',
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "home" }));
    await waitFor(() =>
      expect(screen.getByTestId("stable-failure-claim")).toHaveTextContent(
        '{"status":"none"}',
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "back" }));

    await waitFor(() =>
      expect(screen.getByTestId("stable-failure-claim")).toHaveTextContent(
        '{"status":"invalid"}',
      ),
    );
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
    expectCredentialsScrubbedFromHistory(failPath);

    view.unmount();
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it("keeps the application runtime mounted while clean payment routes change", async () => {
    const onLocationRender = vi.fn();
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    setBrowserCallbackEntry({ search: callbackSearch });

    const view = render(
      <MemoryRouter initialEntries={[`${callbackPath}${callbackSearch}`]}>
        <PaymentCallbackCredentialBoundary>
          <StableRuntimeProbe
            onLocationRender={onLocationRender}
            onMount={onMount}
            onUnmount={onUnmount}
          />
        </PaymentCallbackCredentialBoundary>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("stable-claim")).toHaveTextContent(
        '"reservationUid":"reservation-1"',
      ),
    );
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "next success" }));
    await waitFor(() =>
      expect(screen.getByTestId("stable-claim")).toHaveTextContent(
        '{"status":"none"}',
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "new callback" }));
    await waitFor(() =>
      expect(screen.getByTestId("stable-claim")).toHaveTextContent(
        '"reservationUid":"reservation-3"',
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "sensitive callback" }));
    await waitFor(() =>
      expect(screen.getByTestId("stable-location")).toHaveTextContent(
        "/reservations/reservation-4/success:null",
      ),
    );
    expect(screen.getByTestId("stable-claim")).toHaveTextContent(
      '{"status":"invalid"}',
    );
    expect(onLocationRender.mock.calls.flat().join(" ")).not.toContain(
      "provider-secret",
    );

    fireEvent.click(screen.getByRole("button", { name: "payment fail" }));
    fireEvent.click(screen.getByRole("button", { name: "home" }));

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();

    view.unmount();
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it("carries an unavailable fence across clean and complete callback routes until the workflow clears it", async () => {
    const view = render(
      <MemoryRouter initialEntries={["/"]}>
        <PaymentCallbackCredentialBoundary>
          <StableRuntimeProbe onMount={vi.fn()} onUnmount={vi.fn()} />
        </PaymentCallbackCredentialBoundary>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "fence recovery" }));
    fireEvent.click(screen.getByRole("button", { name: "next success" }));

    await waitFor(() =>
      expect(screen.getByTestId("stable-claim")).toHaveTextContent(
        '{"status":"invalid"}',
      ),
    );
    expect(screen.getByTestId("recovery-fence")).toHaveTextContent(
      "recovery-unavailable",
    );

    fireEvent.click(screen.getByRole("button", { name: "new callback" }));

    await waitFor(() =>
      expect(screen.getByTestId("stable-claim")).toHaveTextContent(
        '{"status":"invalid"}',
      ),
    );
    expect(screen.getByTestId("recovery-fence")).toHaveTextContent(
      "recovery-unavailable",
    );
    expect(screen.getByTestId("stable-claim")).not.toHaveTextContent(
      "payment-key-3",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "internal failure callback" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("stable-failure-claim")).toHaveTextContent(
        '{"status":"invalid"}',
      ),
    );
    expect(screen.getByTestId("recovery-fence")).toHaveTextContent(
      "recovery-unavailable",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "clear recovery fence" }),
    );
    expect(screen.getByTestId("stable-claim")).toHaveTextContent(
      '{"status":"invalid"}',
    );
    expect(screen.getByTestId("recovery-fence")).toHaveTextContent("none");

    view.unmount();
  });
});
