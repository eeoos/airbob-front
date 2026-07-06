import React from "react";
import styles from "./OverlaySurface.module.css";

export type OverlaySurfaceVariant = "popover" | "bottom-sheet" | "dialog";

export interface OverlaySurfaceProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "role"> {
  variant?: OverlaySurfaceVariant;
  children: React.ReactNode;
  role?: React.AriaRole;
}

const cx = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const variantClassNames: Record<OverlaySurfaceVariant, string> = {
  "bottom-sheet": styles.bottomSheet,
  dialog: styles.dialog,
  popover: styles.popover,
};

export function OverlaySurface({
  children,
  className,
  role = "dialog",
  variant = "popover",
  ...surfaceProps
}: OverlaySurfaceProps) {
  return (
    <div
      role={role}
      className={cx(styles.surface, variantClassNames[variant], className)}
      {...surfaceProps}
    >
      {children}
    </div>
  );
}
