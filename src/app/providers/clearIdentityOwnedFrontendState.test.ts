import { clearIdentityOwnedTransactionRoute } from "../router/identityRouteBoundary";
import {
  clearIdentityOwnedBookingPaymentBrowserState,
  clearTerminalBookingPaymentBrowserState,
} from "../../workflows/booking-payment/journal/retiredState";
import {
  clearIdentityOwnedFrontendState,
  clearRevokedIdentityOwnedFrontendState,
} from "./clearIdentityOwnedFrontendState";

vi.mock("../router/identityRouteBoundary", () => ({
  clearIdentityOwnedTransactionRoute: vi.fn(),
}));

vi.mock("../../workflows/booking-payment/journal/retiredState", () => ({
  clearIdentityOwnedBookingPaymentBrowserState: vi.fn(),
  clearTerminalBookingPaymentBrowserState: vi.fn(),
}));

const mockClearIdentityOwnedBookingPaymentBrowserState = vi.mocked(
  clearIdentityOwnedBookingPaymentBrowserState,
);
const mockClearTerminalBookingPaymentBrowserState = vi.mocked(
  clearTerminalBookingPaymentBrowserState,
);
const mockClearIdentityOwnedTransactionRoute = vi.mocked(
  clearIdentityOwnedTransactionRoute,
);

describe("clearIdentityOwnedFrontendState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearIdentityOwnedBookingPaymentBrowserState.mockReturnValue({
      status: "cleared",
      removed: 0,
    });
    mockClearTerminalBookingPaymentBrowserState.mockReturnValue({
      status: "cleared",
      removed: 0,
    });
  });

  it("uses terminal cleanup before a generic checking boundary", () => {
    clearIdentityOwnedFrontendState();

    expect(mockClearTerminalBookingPaymentBrowserState).toHaveBeenCalledTimes(
      1,
    );
    expect(
      mockClearIdentityOwnedBookingPaymentBrowserState,
    ).not.toHaveBeenCalled();
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
    const bookingClearOrder =
      mockClearTerminalBookingPaymentBrowserState.mock.invocationCallOrder.at(
        0,
      );
    const routeClearOrder =
      mockClearIdentityOwnedTransactionRoute.mock.invocationCallOrder.at(0);
    if (bookingClearOrder === undefined || routeClearOrder === undefined) {
      throw new Error("Expected both identity cleanup commands to run");
    }
    expect(bookingClearOrder).toBeLessThan(routeClearOrder);
  });

  it("uses destructive cleanup before a revoked identity boundary", () => {
    clearRevokedIdentityOwnedFrontendState();

    expect(
      mockClearIdentityOwnedBookingPaymentBrowserState,
    ).toHaveBeenCalledTimes(1);
    expect(mockClearTerminalBookingPaymentBrowserState).not.toHaveBeenCalled();
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
  });

  it("still clears the current transaction route when reservation cleanup throws", () => {
    mockClearTerminalBookingPaymentBrowserState.mockImplementationOnce(() => {
      throw new Error("storage cleanup failed");
    });

    expect(() => clearIdentityOwnedFrontendState()).toThrow(
      "storage cleanup failed",
    );
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      status: "partial" as const,
      removed: 1,
      failed: 1,
    },
    {
      status: "storage-error" as const,
      error: {
        kind: "storage-unavailable" as const,
        operation: "remove" as const,
      },
    },
  ])("fails closed when booking cleanup returns $status", (result) => {
    mockClearTerminalBookingPaymentBrowserState.mockReturnValueOnce(result);

    expect(() => clearIdentityOwnedFrontendState()).toThrow(
      "Identity-owned booking state cleanup did not complete.",
    );
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
  });

  it("fails closed when revoked identity cleanup is incomplete", () => {
    mockClearIdentityOwnedBookingPaymentBrowserState.mockReturnValueOnce({
      status: "partial",
      removed: 1,
      failed: 1,
    });

    expect(() => clearRevokedIdentityOwnedFrontendState()).toThrow(
      "Identity-owned booking state cleanup did not complete.",
    );
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
  });
});
