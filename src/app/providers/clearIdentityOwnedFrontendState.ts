import {
  clearIdentityOwnedBookingPaymentBrowserState,
  clearTerminalBookingPaymentBrowserState,
} from "../../workflows/booking-payment/journal";
import { clearIdentityOwnedTransactionRoute } from "../router/identityRouteBoundary";

type BookingPaymentCleanup =
  | typeof clearTerminalBookingPaymentBrowserState
  | typeof clearIdentityOwnedBookingPaymentBrowserState;

const clearFrontendState = (cleanup: BookingPaymentCleanup): void => {
  try {
    const result = cleanup();
    if (result.status !== "cleared") {
      throw new Error("Identity-owned booking state cleanup did not complete.");
    }
  } finally {
    clearIdentityOwnedTransactionRoute();
  }
};

/**
 * App composition is the only layer allowed to join session cleanup ports
 * owned by otherwise independent frontend slices.
 */
export const clearIdentityOwnedFrontendState = (): void => {
  clearFrontendState(clearTerminalBookingPaymentBrowserState);
};

export const clearRevokedIdentityOwnedFrontendState = (): void => {
  clearFrontendState(clearIdentityOwnedBookingPaymentBrowserState);
};
