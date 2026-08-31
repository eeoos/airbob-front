import type { ReactNode } from "react";
import { AuthFeatureCommandProvider } from "../../features/auth/ports/AuthCommandProvider";
import { AuthIntentProvider } from "../../workflows/auth-intent";
import { OverlayProvider } from "../overlays/OverlayProvider";
import { PaymentCallbackCredentialBoundary } from "../router/PaymentCallbackCredentialBoundary";
import { SessionProvider } from "../session/SessionProvider";
import { useSession } from "../session/useSession";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly clearIdentityOwnedState?: () => void;
}

export function AuthIntentStableBoundary({
  children,
}: {
  readonly children: ReactNode;
}) {
  const session = useSession();

  return (
    <AuthIntentProvider session={session}>
      <AuthFeatureCommandProvider
        login={session.login}
        shouldCompleteLoginInCurrentView={() =>
          session.captureAuthenticatedSession() === null
        }
      >
        {children}
      </AuthFeatureCommandProvider>
    </AuthIntentProvider>
  );
}

export function AppProviders({
  children,
  clearIdentityOwnedState,
}: AppProvidersProps) {
  return (
    <OverlayProvider>
      <PaymentCallbackCredentialBoundary>
        <SessionProvider
          clearIdentityOwnedState={clearIdentityOwnedState}
          stableBoundary={AuthIntentStableBoundary}
        >
          {children}
        </SessionProvider>
      </PaymentCallbackCredentialBoundary>
    </OverlayProvider>
  );
}
