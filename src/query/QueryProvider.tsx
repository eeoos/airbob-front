import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { createAppQueryClient } from "./queryClient";

const queryClient = createAppQueryClient();

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
