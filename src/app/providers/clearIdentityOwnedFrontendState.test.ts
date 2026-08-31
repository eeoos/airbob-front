import { clearIdentityOwnedTransactionRoute } from "../router/identityRouteBoundary";
import { clearBookingPaymentBrowserState } from "../../workflows/booking-payment/checkout";
import { clearIdentityOwnedFrontendState } from "./clearIdentityOwnedFrontendState";

vi.mock("../router/identityRouteBoundary", () => ({
  clearIdentityOwnedTransactionRoute: vi.fn(),
}));

vi.mock("../../workflows/booking-payment/checkout", () => ({
  clearBookingPaymentBrowserState: vi.fn(),
}));

const mockClearBookingPaymentBrowserState = vi.mocked(
  clearBookingPaymentBrowserState,
);
const mockClearIdentityOwnedTransactionRoute = vi.mocked(
  clearIdentityOwnedTransactionRoute,
);

describe("clearIdentityOwnedFrontendState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearBookingPaymentBrowserState.mockReturnValue({
      status: "cleared",
      removed: 0,
    });
  });

  it("clears reservation persistence before the current transaction route", () => {
    clearIdentityOwnedFrontendState();

    expect(mockClearBookingPaymentBrowserState).toHaveBeenCalledTimes(1);
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
    const bookingClearOrder =
      mockClearBookingPaymentBrowserState.mock.invocationCallOrder.at(0);
    const routeClearOrder =
      mockClearIdentityOwnedTransactionRoute.mock.invocationCallOrder.at(0);
    if (bookingClearOrder === undefined || routeClearOrder === undefined) {
      throw new Error("Expected both identity cleanup commands to run");
    }
    expect(bookingClearOrder).toBeLessThan(routeClearOrder);
  });

  it("still clears the current transaction route when reservation cleanup throws", () => {
    mockClearBookingPaymentBrowserState.mockImplementationOnce(() => {
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
      error: { kind: "storage-unavailable" as const, operation: "remove" as const },
    },
  ])("fails closed when booking cleanup returns $status", (result) => {
    mockClearBookingPaymentBrowserState.mockReturnValueOnce(result);

    expect(() => clearIdentityOwnedFrontendState()).toThrow(
      "Identity-owned booking state cleanup did not complete.",
    );
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
  });
});
