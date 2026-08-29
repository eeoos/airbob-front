import type { ReactNode } from "react";
import styles from "./ShellFrame.module.css";

export interface AppShellProps {
  children?: ReactNode;
  header?: ReactNode;
}

export function ShellFrame({ children, header }: AppShellProps) {
  return (
    <div className={styles.container}>
      {header}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
