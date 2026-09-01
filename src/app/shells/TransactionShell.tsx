import { ShellFrame, type AppShellProps } from "./ShellFrame";

export function TransactionShell(props: AppShellProps) {
  return <ShellFrame {...props} routeSurface="transaction" />;
}
