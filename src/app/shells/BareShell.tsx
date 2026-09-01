import { ShellFrame, type AppShellProps } from "./ShellFrame";

export function BareShell(props: AppShellProps) {
  return <ShellFrame {...props} routeSurface="bare" />;
}
