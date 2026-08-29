import { clearPaymentConfirmationAttemptRegistry } from "../lib/paymentConfirmationAttemptRegistry";
import { clearAllReservationCheckoutState } from "../lib/reservationCheckoutState";

export const clearReservationSessionState = () => {
  clearAllReservationCheckoutState();
  clearPaymentConfirmationAttemptRegistry();
};
