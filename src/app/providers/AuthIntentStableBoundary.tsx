import type { ReactNode } from "react";
import { AuthFeatureCommandProvider } from "../../features/auth/ports/AuthFeatureCommandProvider";
import { AuthIntentProvider } from "../../workflows/auth-intent";
import { useSession } from "../session/useSession";

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
