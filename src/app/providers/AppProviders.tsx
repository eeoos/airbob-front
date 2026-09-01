import { useCallback, type ReactNode } from "react";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import { OverlayProvider } from "../overlays/OverlayProvider";
import {
  PaymentCallbackCredentialBoundary,
  useMarkPaymentRecoveryFence,
} from "../router/PaymentCallbackCredentialBoundary";
import { SessionProvider } from "../session/SessionProvider";
import { AuthIntentStableBoundary } from "./AuthIntentStableBoundary";
import type { CandidateIdentityOwnedFrontendStateReconciliationStatus } from "./reconcileCandidateIdentityOwnedFrontendState";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly clearIdentityOwnedState?: () => void;
  readonly clearRevokedIdentityOwnedState?: () => void;
  readonly reconcileCandidateIdentityOwnedState?: (
    scope: AuthenticatedSessionScope,
  ) => CandidateIdentityOwnedFrontendStateReconciliationStatus;
}

function SessionWithPaymentRecoveryFence({
  children,
  clearIdentityOwnedState,
  clearRevokedIdentityOwnedState,
  reconcileCandidateIdentityOwnedState,
}: AppProvidersProps) {
  const markPaymentRecoveryFence = useMarkPaymentRecoveryFence();
  const reconcileCandidate = useCallback(
    (scope: AuthenticatedSessionScope) => {
      if (reconcileCandidateIdentityOwnedState === undefined) return;
      const result = reconcileCandidateIdentityOwnedState(scope);
      markPaymentRecoveryFence(result === "ready" ? "none" : result);
    },
    [markPaymentRecoveryFence, reconcileCandidateIdentityOwnedState],
  );

  return (
    <SessionProvider
      stableBoundary={AuthIntentStableBoundary}
      {...(clearIdentityOwnedState === undefined
        ? {}
        : { clearIdentityOwnedState })}
      {...(clearRevokedIdentityOwnedState === undefined
        ? {}
        : { clearRevokedIdentityOwnedState })}
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
  clearIdentityOwnedState,
  clearRevokedIdentityOwnedState,
  reconcileCandidateIdentityOwnedState,
}: AppProvidersProps) {
  return (
    <OverlayProvider>
      <PaymentCallbackCredentialBoundary>
        <SessionWithPaymentRecoveryFence
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
