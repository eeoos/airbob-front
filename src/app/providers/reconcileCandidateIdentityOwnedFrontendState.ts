import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import { bookingPaymentStorageDriver } from "../../platform/storage/bookingPaymentStorageDriver";
import { claimBookingPaymentCandidateCallbackCredential } from "../../workflows/booking-payment/journal/candidateCallbackCredential";
import { reconcileBookingPaymentCandidateOwner } from "../../workflows/booking-payment/journal/candidateReconciliation";
import type { BookingPaymentCandidateReconciliationResult } from "../../workflows/booking-payment/journal/types";

interface CandidateOwnerRepository {
  reconcileCandidateOwner(
    owner: string,
  ): BookingPaymentCandidateReconciliationResult;
}

interface CandidateCallbackRepository {
  readonly recoveryRecords: {
    claimCallbackCredential: typeof claimBookingPaymentCandidateCallbackCredential;
  };
}

const createCandidateCallbackRepository = (): CandidateCallbackRepository => ({
  recoveryRecords: {
    claimCallbackCredential: claimBookingPaymentCandidateCallbackCredential,
  },
});

const createCandidateOwnerRepository = (): CandidateOwnerRepository => ({
  reconcileCandidateOwner: (owner) =>
    reconcileBookingPaymentCandidateOwner({
      driver: bookingPaymentStorageDriver,
      now: Date.now,
      owner,
    }),
});

export interface CandidatePaymentCallbackCredential {
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly firstCapturedAt: number;
}

export type CandidatePaymentCallbackCredentialClaimStatus =
  "claimed" | "not-claimed" | "blocked";

export type CandidateIdentityOwnedFrontendStateReconciliationStatus =
  "ready" | "recovery-required" | "recovery-unavailable";

/**
 * Joins the memory-only Toss callback to the candidate identity before the
 * status-only reconciliation publishes that identity. No credential or
 * transaction payload is returned to the session layer.
 */
export const claimCandidatePaymentCallbackCredential = (
  scope: AuthenticatedSessionScope,
  callback: CandidatePaymentCallbackCredential,
  repository: CandidateCallbackRepository = createCandidateCallbackRepository(),
): CandidatePaymentCallbackCredentialClaimStatus => {
  try {
    const result = repository.recoveryRecords.claimCallbackCredential({
      owner: scope.subject,
      lease: {
        runtimeLeaseId: scope.runtimeLeaseId,
        sessionEpoch: scope.epoch,
      },
      reservationUid: callback.reservationUid,
      orderId: callback.orderId,
      paymentKey: callback.paymentKey,
      amount: callback.amount,
      firstCapturedAt: callback.firstCapturedAt,
      isCurrent: () => true,
    });
    return result.status === "claimed" ||
      result.status === "unchanged" ||
      result.status === "found"
      ? "claimed"
      : result.status === "storage-error"
        ? "blocked"
        : "not-claimed";
  } catch {
    return "blocked";
  }
};

/**
 * App composition joins candidate session publication to booking recovery
 * ownership without exposing transaction data to the session layer.
 */
export const reconcileCandidateIdentityOwnedFrontendState = (
  scope: AuthenticatedSessionScope,
  repository: CandidateOwnerRepository = createCandidateOwnerRepository(),
): CandidateIdentityOwnedFrontendStateReconciliationStatus => {
  try {
    const result = repository.reconcileCandidateOwner(scope.subject);
    if (
      result.status === "ready" ||
      result.status === "recovery-required" ||
      result.status === "recovery-unavailable"
    ) {
      return result.status;
    }
  } catch {
    // Session publication owns one redacted failure surface for storage faults.
  }

  throw new Error("Candidate identity-owned state could not be reconciled.");
};
