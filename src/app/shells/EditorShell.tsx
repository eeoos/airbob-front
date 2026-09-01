import { ShellFrame, type AppShellProps } from "./ShellFrame";

export function EditorShell(props: AppShellProps) {
  return <ShellFrame {...props} routeSurface="editor" />;
}
