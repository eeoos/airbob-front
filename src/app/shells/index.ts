import type { ComponentType } from "react";
import { BareShell } from "./BareShell";
import { BrowseShell } from "./BrowseShell";
import { EditorShell } from "./EditorShell";
import { FormShell } from "./FormShell";
import type { AppShellProps } from "./ShellFrame";
import { TransactionShell } from "./TransactionShell";

export type { AppShellProps } from "./ShellFrame";

export const appShellComponents = {
  browse: BrowseShell,
  form: FormShell,
  transaction: TransactionShell,
  editor: EditorShell,
  bare: BareShell,
} satisfies Record<string, ComponentType<AppShellProps>>;

export type AppShellId = keyof typeof appShellComponents;
