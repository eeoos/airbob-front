import React from "react";
import styles from "./StateView.module.css";

export interface StateViewProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  action?: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
}

const cx = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(" ");

function StateView({
  action,
  className,
  description,
  role,
  title,
  ...stateProps
}: StateViewProps) {
  return (
    <div className={cx(styles.state, className)} role={role} {...stateProps}>
      <div className={styles.content}>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export function LoadingState({
  "aria-live": ariaLive = "polite",
  role = "status",
  ...props
}: StateViewProps) {
  return <StateView aria-live={ariaLive} role={role} {...props} />;
}

export function EmptyState(props: StateViewProps) {
  return <StateView {...props} />;
}

export function ErrorState({ role = "alert", ...props }: StateViewProps) {
  return <StateView role={role} {...props} />;
}
