import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

/**
 * Legacy compatibility wrapper. Production session ownership now supplies a
 * generation-scoped client from src/app/session instead of a module singleton.
 */
export function QueryProvider({
  children,
  client,
}: {
  children: ReactNode;
  client: QueryClient;
}) {
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
