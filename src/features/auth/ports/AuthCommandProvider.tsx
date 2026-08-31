import { createContext, useContext, type ReactNode } from "react";
import type { LoginCredentials, SignupCommand } from "../model/auth";

export interface AuthCommandPort {
  login(credentials: LoginCredentials): Promise<void>;
  signup(command: SignupCommand): Promise<void>;
  shouldCompleteLoginInCurrentView(): boolean;
}

const AuthCommandContext = createContext<AuthCommandPort | null>(null);

interface AuthCommandProviderProps {
  readonly children: ReactNode;
  readonly commands: AuthCommandPort;
}

export function AuthCommandProvider({
  children,
  commands,
}: AuthCommandProviderProps) {
  return (
    <AuthCommandContext.Provider value={commands}>
      {children}
    </AuthCommandContext.Provider>
  );
}

export const useAuthCommands = (): AuthCommandPort => {
  const commands = useContext(AuthCommandContext);

  if (!commands) {
    throw new Error(
      "useAuthCommands must be used within an AuthCommandProvider",
    );
  }

  return commands;
};
