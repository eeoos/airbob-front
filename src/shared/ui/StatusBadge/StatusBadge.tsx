import React from "react";
import styles from "./StatusBadge.module.css";

export type StatusBadgeTone = "success" | "warning" | "danger" | "neutral";
export type StatusBadgeSize = "sm" | "md";

export interface StatusBadgeProps {
  children: React.ReactNode;
  className?: string;
  size?: StatusBadgeSize;
  tone?: StatusBadgeTone;
}

const cx = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(" ");

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  children,
  className,
  size = "md",
  tone = "neutral",
}) => (
  <span className={cx(styles.badge, styles[size], styles[tone], className)}>
    {children}
  </span>
);
