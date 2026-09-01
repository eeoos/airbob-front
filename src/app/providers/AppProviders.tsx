import type { ReactNode } from "react";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import { OverlayProvider } from "../overlays/OverlayProvider";
import { PaymentCallbackCredentialBoundary } from "../router/PaymentCallbackCredentialBoundary";
import { SessionProvider } from "../session/SessionProvider";
import { AuthIntentStableBoundary } from "./AuthIntentStableBoundary";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly clearIdentityOwnedState?: () => void;
  readonly clearRevokedIdentityOwnedState?: () => void;
  readonly reconcileCandidateIdentityOwnedState?: (
    scope: AuthenticatedSessionScope,
  ) => void;
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
            : { reconcileCandidateIdentityOwnedState })}
        >
          {children}
        </SessionProvider>
      </PaymentCallbackCredentialBoundary>
    </OverlayProvider>
  );
}
