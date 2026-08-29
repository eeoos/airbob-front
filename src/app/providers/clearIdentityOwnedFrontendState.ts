import { clearReservationSessionState } from "../../features/reservations/ports/sessionCleanup";
import { clearIdentityOwnedTransactionRoute } from "../router/identityRouteBoundary";

/**
 * App composition is the only layer allowed to join session cleanup ports
 * owned by otherwise independent frontend slices.
 */
export const clearIdentityOwnedFrontendState = (): void => {
  try {
    clearReservationSessionState();
  } finally {
    clearIdentityOwnedTransactionRoute();
  }
};
