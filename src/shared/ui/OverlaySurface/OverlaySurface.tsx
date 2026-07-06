import React from "react";
import styles from "./OverlaySurface.module.css";

export type OverlaySurfaceVariant = "popover" | "bottom-sheet" | "dialog";

type OverlaySurfaceAccessibleName =
  | {
      "aria-label": string;
      "aria-labelledby"?: string;
    }
  | {
      "aria-label"?: string;
      "aria-labelledby": string;
    };

type OverlaySurfaceBaseProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "aria-label" | "aria-labelledby" | "role"
> & {
  variant?: OverlaySurfaceVariant;
  children: React.ReactNode;
};

type OverlaySurfaceDialogProps = OverlaySurfaceBaseProps &
  OverlaySurfaceAccessibleName & {
    variant: "dialog";
    role?: "dialog";
  };

type OverlaySurfaceDialogRoleProps = OverlaySurfaceBaseProps &
  OverlaySurfaceAccessibleName & {
    variant?: OverlaySurfaceVariant;
    role: "dialog";
  };

type OverlaySurfaceNonDialogProps = OverlaySurfaceBaseProps & {
  variant?: Exclude<OverlaySurfaceVariant, "dialog">;
  role?: React.AriaRole;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export type OverlaySurfaceProps =
  | OverlaySurfaceDialogProps
  | OverlaySurfaceDialogRoleProps
  | OverlaySurfaceNonDialogProps;

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
  role,
  variant = "popover",
  ...surfaceProps
}: OverlaySurfaceProps) {
  const surfaceRole = role ?? (variant === "dialog" ? "dialog" : "group");
  const hasAccessibleName =
    Boolean(surfaceProps["aria-label"]) ||
    Boolean(surfaceProps["aria-labelledby"]);

  if (surfaceRole === "dialog" && !hasAccessibleName) {
    throw new Error("OverlaySurface dialog role requires an accessible name.");
  }

  return (
    <div
      role={surfaceRole}
      className={cx(styles.surface, variantClassNames[variant], className)}
      {...surfaceProps}
    >
      {children}
    </div>
  );
}
