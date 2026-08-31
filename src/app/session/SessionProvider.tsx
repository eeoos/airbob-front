import { QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType, ReactNode } from "react";
import { LogoutRevocationNotice } from "./LogoutRevocationNotice";
import { SessionContext, type SessionContextValue } from "./sessionContext";
import {
  useSessionController,
  type SessionControllerOptions,
} from "./useSessionController";

export type { SessionContextValue } from "./sessionContext";

export interface SessionProviderProps extends SessionControllerOptions {
  readonly children: ReactNode;
  readonly stableBoundary?: ComponentType<{ readonly children: ReactNode }>;
}

function DefaultStableBoundary({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}

const shouldShowRevocationNotice = (session: SessionContextValue) =>
  session.state.status === "anonymous" &&
  session.state.reason === "logout" &&
  session.state.revocation === "unverified" &&
  session.state.revocationError !== undefined;

export function SessionProvider({
  children,
  stableBoundary: StableBoundary = DefaultStableBoundary,
  ...controllerOptions
}: SessionProviderProps) {
  const { queryGeneration, session } = useSessionController(controllerOptions);

  return (
    <SessionContext.Provider value={session}>
      <StableBoundary>
        <QueryClientProvider
          key={queryGeneration.fenceId}
          client={queryGeneration.client}
        >
          {children}
        </QueryClientProvider>
      </StableBoundary>
      <LogoutRevocationNotice
        visible={shouldShowRevocationNotice(session)}
        onRetry={() => void session.retryServerLogout().catch(() => undefined)}
      />
    </SessionContext.Provider>
  );
}
