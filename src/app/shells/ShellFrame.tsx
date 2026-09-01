import type { ReactNode } from "react";
import styles from "./ShellFrame.module.css";

export interface AppShellProps {
  children?: ReactNode;
  header?: ReactNode;
}

type RouteSurface = "browse" | "form" | "transaction" | "editor" | "bare";

interface ShellFrameProps extends AppShellProps {
  readonly routeSurface: RouteSurface;
}

/** The route shell is the single owner of the document's main landmark. */
export function ShellFrame({
  children,
  header,
  routeSurface,
}: ShellFrameProps) {
  return (
    <div className={styles.container}>
      {header}
      <main className={styles.main} data-route-surface={routeSurface}>
        {children}
      </main>
    </div>
  );
}
