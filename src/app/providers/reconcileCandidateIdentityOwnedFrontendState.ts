import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import { createBookingPaymentJournalRepository } from "../../workflows/booking-payment/journal";

type CandidateOwnerRepository = Pick<
  ReturnType<typeof createBookingPaymentJournalRepository>,
  "reconcileCandidateOwner"
>;

/**
 * App composition joins candidate session publication to booking recovery
 * ownership without exposing transaction data to the session layer.
 */
export const reconcileCandidateIdentityOwnedFrontendState = (
  scope: AuthenticatedSessionScope,
  repository: CandidateOwnerRepository = createBookingPaymentJournalRepository(),
): void => {
  try {
    const result = repository.reconcileCandidateOwner(scope.subject);
    if (result.status === "ready" || result.status === "recovery-required") {
      return;
    }
  } catch {
    // Session publication owns one redacted failure surface for storage faults.
  }

  throw new Error("Candidate identity-owned state could not be reconciled.");
};
