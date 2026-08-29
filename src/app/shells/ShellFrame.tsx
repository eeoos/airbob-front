import type { ReactNode } from "react";
import styles from "./ShellFrame.module.css";

export interface AppShellProps {
  children?: ReactNode;
  header?: ReactNode;
}

/** The route shell is the single owner of the document's main landmark. */
export function ShellFrame({ children, header }: AppShellProps) {
  return (
    <div className={styles.container}>
      {header}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
