import { clearIdentityOwnedTransactionRoute } from "../router/identityRouteBoundary";
import { clearBookingPaymentBrowserState } from "../../workflows/booking-payment/checkout";
import { clearIdentityOwnedFrontendState } from "./clearIdentityOwnedFrontendState";

jest.mock("../router/identityRouteBoundary", () => ({
  clearIdentityOwnedTransactionRoute: jest.fn(),
}));

jest.mock("../../workflows/booking-payment/checkout", () => ({
  clearBookingPaymentBrowserState: jest.fn(),
}));

const mockClearBookingPaymentBrowserState = jest.mocked(
  clearBookingPaymentBrowserState,
);
const mockClearIdentityOwnedTransactionRoute = jest.mocked(
  clearIdentityOwnedTransactionRoute,
);

describe("clearIdentityOwnedFrontendState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearBookingPaymentBrowserState.mockReturnValue({
      status: "cleared",
      removed: 0,
    });
  });

  it("clears reservation persistence before the current transaction route", () => {
    clearIdentityOwnedFrontendState();

    expect(mockClearBookingPaymentBrowserState).toHaveBeenCalledTimes(1);
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
    expect(
      mockClearBookingPaymentBrowserState.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockClearIdentityOwnedTransactionRoute.mock.invocationCallOrder[0],
    );
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
