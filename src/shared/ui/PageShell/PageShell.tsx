import React from "react";
import styles from "./PageShell.module.css";

export interface PageShellProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  description?: React.ReactNode;
}

const cx = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

export function PageShell({
  actions,
  children,
  className,
  contentClassName,
  description,
  title,
  ...shellProps
}: PageShellProps) {
  return (
    <main
      aria-label={title}
      className={cx(styles.shell, className)}
      {...shellProps}
    >
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>{title}</h1>
          {description && <div className={styles.description}>{description}</div>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={cx(styles.content, contentClassName)}>{children}</div>
    </main>
  );
}
