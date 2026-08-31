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
  usePaymentCallbackCredentialClaim,
} from "./PaymentCallbackCredentialBoundary";

const mockUseSession = vi.fn();
const mockAuthenticatedBoundaryRender = vi.fn();

vi.mock("../session/useSession", () => ({
  useSession: () => mockUseSession(),
}));

const callbackPath = "/reservations/reservation-1/success";
const callbackSearch =
  "?paymentKey=payment-key-1&orderId=reservation-1&amount=120000";

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

function CredentialProbe() {
  const claim = usePaymentCallbackCredentialClaim();

  return (
    <output data-testid="credential-claim">{JSON.stringify(claim)}</output>
  );
}

function AuthenticatedBoundaryProbe() {
  const location = useLocation();
  mockAuthenticatedBoundaryRender(location.search);

  return (
    <RequireAuthenticatedRoute>
      <CredentialProbe />
    </RequireAuthenticatedRoute>
  );
}

const renderBoundary = (initialEntry: InitialEntry) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/reservations/:reservationUid/success"
          element={
            <PaymentCallbackCredentialBoundary>
              <AuthenticatedBoundaryProbe />
            </PaymentCallbackCredentialBoundary>
          }
        />
        <Route path="/login" element={<div data-testid="login-route" />} />
      </Routes>
    </MemoryRouter>,
  );

const setBrowserCallbackEntry = (search: string) => {
  window.history.replaceState(
    {
      idx: 0,
      key: "callback-entry",
      usr: { paymentKey: "payment-key-in-browser-history" },
    },
    "",
    `${callbackPath}${search}`,
  );
};

function StableRuntimeProbe({
  onMount,
  onUnmount,
}: {
  readonly onMount: () => void;
  readonly onUnmount: () => void;
}) {
  const claim = usePaymentCallbackCredentialClaim();
  const navigate = useNavigate();

  useEffect(() => {
    onMount();
    return onUnmount;
  }, [onMount, onUnmount]);

  return (
    <>
      <output data-testid="stable-claim">{JSON.stringify(claim)}</output>
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
      <button type="button" onClick={() => navigate("/")}>
        home
      </button>
    </>
  );
}

const expectCredentialsScrubbedFromHistory = () => {
  expect(window.location.pathname).toBe(callbackPath);
  expect(window.location.search).toBe("");
  expect(JSON.stringify(window.history.state)).not.toContain("payment-key");
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
    setBrowserCallbackEntry(callbackSearch);

    renderBoundary({
      pathname: callbackPath,
      search: callbackSearch,
      state: { paymentKey: "payment-key-in-router-history" },
    });

    await screen.findByText("로그인 상태를 확인하는 중...");
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent('"search":""'),
    );

    expect(mockAuthenticatedBoundaryRender).toHaveBeenCalledWith("");
    expect(mockAuthenticatedBoundaryRender).not.toHaveBeenCalledWith(
      callbackSearch,
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
    setBrowserCallbackEntry(callbackSearch);

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

  it("keeps a valid callback tuple only in memory after authentication", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    setBrowserCallbackEntry(callbackSearch);

    renderBoundary({
      pathname: callbackPath,
      search: callbackSearch,
      state: { paymentKey: "payment-key-in-router-history" },
    });

    const claim = await screen.findByTestId("credential-claim");

    expect(claim).toHaveTextContent('"status":"fresh"');
    expect(claim).toHaveTextContent('"paymentKey":"payment-key-1"');
    expect(claim).toHaveTextContent('"amount":120000');
    expect(screen.getByTestId("location")).toHaveTextContent('"search":""');
    expect(screen.getByTestId("location")).toHaveTextContent('"state":null');
    expectCredentialsScrubbedFromHistory();
  });

  it("fails a partial callback closed after removing it from both histories", async () => {
    mockUseSession.mockReturnValue({
      state: { status: "authenticated" },
      revalidate: vi.fn(),
    });
    const partialSearch = "?paymentKey=partial-payment-key";
    setBrowserCallbackEntry(partialSearch);

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

  it("keeps the application runtime mounted while clean payment routes change", async () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    setBrowserCallbackEntry(callbackSearch);

    const view = render(
      <MemoryRouter initialEntries={[`${callbackPath}${callbackSearch}`]}>
        <PaymentCallbackCredentialBoundary>
          <StableRuntimeProbe onMount={onMount} onUnmount={onUnmount} />
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

    fireEvent.click(screen.getByRole("button", { name: "payment fail" }));
    fireEvent.click(screen.getByRole("button", { name: "home" }));

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();

    view.unmount();
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });
});
