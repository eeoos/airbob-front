import type { ReactNode } from "react";
import { OverlayProvider } from "../overlays/OverlayProvider";
import { PaymentCallbackCredentialBoundary } from "../router/PaymentCallbackCredentialBoundary";
import { SessionProvider } from "../session/SessionProvider";
import { AuthIntentStableBoundary } from "./AuthIntentStableBoundary";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly clearIdentityOwnedState?: () => void;
  readonly clearRevokedIdentityOwnedState?: () => void;
}

export function AppProviders({
  children,
  clearIdentityOwnedState,
  clearRevokedIdentityOwnedState,
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
        >
          {children}
        </SessionProvider>
      </PaymentCallbackCredentialBoundary>
    </OverlayProvider>
  );
}
