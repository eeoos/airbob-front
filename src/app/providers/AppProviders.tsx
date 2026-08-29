import type { ReactNode } from "react";
import { AuthIntentProvider } from "../../workflows/auth-intent";
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
    <AuthIntentProvider session={session}>{children}</AuthIntentProvider>
  );
}

export function AppProviders({
  children,
  clearIdentityOwnedState,
}: AppProvidersProps) {
  return (
    <SessionProvider
      clearIdentityOwnedState={clearIdentityOwnedState}
      stableBoundary={AuthIntentStableBoundary}
    >
      {children}
    </SessionProvider>
  );
}
