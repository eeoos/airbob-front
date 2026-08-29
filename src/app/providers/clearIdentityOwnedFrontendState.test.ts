import { clearIdentityOwnedTransactionRoute } from "../router/identityRouteBoundary";
import { clearReservationSessionState } from "../../features/reservations/ports/sessionCleanup";
import { clearIdentityOwnedFrontendState } from "./clearIdentityOwnedFrontendState";

jest.mock("../router/identityRouteBoundary", () => ({
  clearIdentityOwnedTransactionRoute: jest.fn(),
}));

jest.mock("../../features/reservations/ports/sessionCleanup", () => ({
  clearReservationSessionState: jest.fn(),
}));

const mockClearReservationSessionState = jest.mocked(
  clearReservationSessionState,
);
const mockClearIdentityOwnedTransactionRoute = jest.mocked(
  clearIdentityOwnedTransactionRoute,
);

describe("clearIdentityOwnedFrontendState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears reservation persistence before the current transaction route", () => {
    clearIdentityOwnedFrontendState();

    expect(mockClearReservationSessionState).toHaveBeenCalledTimes(1);
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
    expect(
      mockClearReservationSessionState.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockClearIdentityOwnedTransactionRoute.mock.invocationCallOrder[0],
    );
  });

  it("still clears the current transaction route when reservation cleanup throws", () => {
    mockClearReservationSessionState.mockImplementationOnce(() => {
      throw new Error("storage cleanup failed");
    });

    expect(() => clearIdentityOwnedFrontendState()).toThrow(
      "storage cleanup failed",
    );
    expect(mockClearIdentityOwnedTransactionRoute).toHaveBeenCalledTimes(1);
  });
});
