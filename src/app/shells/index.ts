import type { ComponentType } from "react";
import { BareShell } from "./BareShell";
import { BrowseShell } from "./BrowseShell";
import { EditorShell } from "./EditorShell";
import { FormShell } from "./FormShell";
import type { AppShellProps } from "./ShellFrame";
import { TransactionShell } from "./TransactionShell";

export { BareShell } from "./BareShell";
export { BrowseShell } from "./BrowseShell";
export { EditorShell } from "./EditorShell";
export { FormShell } from "./FormShell";
export type { AppShellProps } from "./ShellFrame";
export { TransactionShell } from "./TransactionShell";

export const appShellComponents = {
  browse: BrowseShell,
  form: FormShell,
  transaction: TransactionShell,
  editor: EditorShell,
  bare: BareShell,
} satisfies Record<string, ComponentType<AppShellProps>>;

export type AppShellId = keyof typeof appShellComponents;
