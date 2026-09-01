import { useCallback, type ReactNode } from "react";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import { OverlayProvider } from "../overlays/OverlayProvider";
import {
  PaymentCallbackCredentialBoundary,
  useMarkPaymentRecoveryFence,
  usePendingPaymentCallbackCredentialForCandidate,
} from "../router/PaymentCallbackCredentialBoundary";
import { SessionProvider } from "../session/SessionProvider";
import type { RevokedIdentityCleanupReason } from "../session/useSessionController";
import { AuthIntentStableBoundary } from "./AuthIntentStableBoundary";
import type {
  CandidateIdentityOwnedFrontendStateReconciliationStatus,
  CandidatePaymentCallbackCredential,
  CandidatePaymentCallbackCredentialClaimStatus,
} from "./reconcileCandidateIdentityOwnedFrontendState";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly claimCandidatePaymentCallbackCredential?: (
    scope: AuthenticatedSessionScope,
    callback: CandidatePaymentCallbackCredential,
  ) => CandidatePaymentCallbackCredentialClaimStatus;
  readonly clearIdentityOwnedState?: () => void;
  readonly clearRevokedIdentityOwnedState?: () => void;
  readonly reconcileCandidateIdentityOwnedState?: (
    scope: AuthenticatedSessionScope,
  ) => CandidateIdentityOwnedFrontendStateReconciliationStatus;
}

function SessionWithPaymentRecoveryFence({
  children,
  claimCandidatePaymentCallbackCredential,
  clearIdentityOwnedState,
  clearRevokedIdentityOwnedState,
  reconcileCandidateIdentityOwnedState,
}: AppProvidersProps) {
  const markPaymentRecoveryFence = useMarkPaymentRecoveryFence();
  const pendingCallback = usePendingPaymentCallbackCredentialForCandidate();
  const clearRevokedIdentity = useCallback(
    (reason: RevokedIdentityCleanupReason) => {
      const pending = pendingCallback.read();
      if (reason === "authentication-rejected" && pending.status === "fresh") {
        // The callback URL is already credential-free, but its exact path and
        // v2 journal must survive the anonymous login detour. Candidate
        // reconciliation will clear retired/foreign state before publication.
        return;
      }
      if (pending.status !== "none") pendingCallback.discard();
      clearRevokedIdentityOwnedState?.();
    },
    [clearRevokedIdentityOwnedState, pendingCallback],
  );
  const reconcileCandidate = useCallback(
    (scope: AuthenticatedSessionScope) => {
      if (reconcileCandidateIdentityOwnedState === undefined) return;
      const pending = pendingCallback.read();
      const callbackClaimStatus =
        pending.status === "fresh" &&
        claimCandidatePaymentCallbackCredential !== undefined
          ? claimCandidatePaymentCallbackCredential(scope, pending.fresh)
          : "not-claimed";
      if (callbackClaimStatus === "blocked") {
        throw new Error("Candidate payment callback could not be reconciled.");
      }
      const result = reconcileCandidateIdentityOwnedState(scope);
      const callbackCanResume =
        pending.status === "fresh" &&
        callbackClaimStatus === "claimed" &&
        result === "recovery-required";
      if (pending.status !== "none" && !callbackCanResume) {
        pendingCallback.discard();
      }
      markPaymentRecoveryFence(
        callbackCanResume || result === "ready" ? "none" : result,
      );
    },
    [
      claimCandidatePaymentCallbackCredential,
      markPaymentRecoveryFence,
      pendingCallback,
      reconcileCandidateIdentityOwnedState,
    ],
  );

  return (
    <SessionProvider
      stableBoundary={AuthIntentStableBoundary}
      {...(clearIdentityOwnedState === undefined
        ? {}
        : { clearIdentityOwnedState })}
      {...(clearRevokedIdentityOwnedState === undefined
        ? {}
        : { clearRevokedIdentityOwnedState: clearRevokedIdentity })}
      {...(reconcileCandidateIdentityOwnedState === undefined
        ? {}
        : { reconcileCandidateIdentityOwnedState: reconcileCandidate })}
    >
      {children}
    </SessionProvider>
  );
}

export function AppProviders({
  children,
  claimCandidatePaymentCallbackCredential,
  clearIdentityOwnedState,
  clearRevokedIdentityOwnedState,
  reconcileCandidateIdentityOwnedState,
}: AppProvidersProps) {
  return (
    <OverlayProvider>
      <PaymentCallbackCredentialBoundary>
        <SessionWithPaymentRecoveryFence
          {...(claimCandidatePaymentCallbackCredential === undefined
            ? {}
            : { claimCandidatePaymentCallbackCredential })}
          {...(clearIdentityOwnedState === undefined
            ? {}
            : { clearIdentityOwnedState })}
          {...(clearRevokedIdentityOwnedState === undefined
            ? {}
            : { clearRevokedIdentityOwnedState })}
          {...(reconcileCandidateIdentityOwnedState === undefined
            ? {}
            : { reconcileCandidateIdentityOwnedState })}
        >
          {children}
        </SessionWithPaymentRecoveryFence>
      </PaymentCallbackCredentialBoundary>
    </OverlayProvider>
  );
}
