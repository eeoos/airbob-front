import React from "react";
import styles from "./Skeleton.module.css";

type SkeletonProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "aria-hidden" | "children" | "role"
>;

const cx = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

/**
 * Domain-free loading geometry. Screen compositions own its dimensions and
 * pair it with one accessible loading announcement.
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...skeletonProps }, ref) => (
    <div
      {...skeletonProps}
      ref={ref}
      className={cx(styles.skeleton, className)}
      aria-hidden="true"
    />
  ),
);

Skeleton.displayName = "Skeleton";
