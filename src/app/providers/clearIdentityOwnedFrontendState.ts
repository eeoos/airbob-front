import { clearBookingPaymentBrowserState } from "../../workflows/booking-payment/checkout";
import { clearIdentityOwnedTransactionRoute } from "../router/identityRouteBoundary";

/**
 * App composition is the only layer allowed to join session cleanup ports
 * owned by otherwise independent frontend slices.
 */
export const clearIdentityOwnedFrontendState = (): void => {
  try {
    const result = clearBookingPaymentBrowserState();
    if (result.status !== "cleared") {
      throw new Error(
        "Identity-owned booking state cleanup did not complete.",
      );
    }
  } finally {
    clearIdentityOwnedTransactionRoute();
  }
};
