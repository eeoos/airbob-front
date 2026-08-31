import type { ReactNode } from "react";
import { OverlayProvider } from "../overlays/OverlayProvider";
import { PaymentCallbackCredentialBoundary } from "../router/PaymentCallbackCredentialBoundary";
import { SessionProvider } from "../session/SessionProvider";
import { AuthIntentStableBoundary } from "./AuthIntentStableBoundary";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly clearIdentityOwnedState?: () => void;
}

export function AppProviders({
  children,
  clearIdentityOwnedState,
}: AppProvidersProps) {
  return (
    <OverlayProvider>
      <PaymentCallbackCredentialBoundary>
        <SessionProvider
          stableBoundary={AuthIntentStableBoundary}
          {...(clearIdentityOwnedState === undefined
            ? {}
            : { clearIdentityOwnedState })}
        >
          {children}
        </SessionProvider>
      </PaymentCallbackCredentialBoundary>
    </OverlayProvider>
  );
}
