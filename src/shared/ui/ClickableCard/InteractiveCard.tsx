import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import styles from "./ClickableCard.module.css";

interface InteractiveCardLayoutProps {
  readonly actions?: ReactNode;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export interface NavigationCardProps
  extends InteractiveCardLayoutProps,
    Omit<
      AnchorHTMLAttributes<HTMLAnchorElement>,
      "aria-label" | "children" | "className"
    > {
  readonly href: string;
}

export interface ActionCardProps
  extends InteractiveCardLayoutProps,
    Omit<
      ButtonHTMLAttributes<HTMLButtonElement>,
      "aria-label" | "children" | "className" | "type"
    > {}

const cardClassName = (className: string | undefined) =>
  className ? `${styles.card} ${className}` : styles.card;

const CardActions = ({ actions }: { readonly actions?: ReactNode }) =>
  actions ? <div className={styles.actions}>{actions}</div> : null;

export function NavigationCard({
  actions,
  ariaLabel,
  children,
  className,
  ...anchorProps
}: NavigationCardProps) {
  return (
    <article className={cardClassName(className)}>
      <a
        {...anchorProps}
        aria-label={ariaLabel}
        className={`${styles.primaryAction} ${styles.navigationAction}`}
      />
      {children}
      <CardActions actions={actions} />
    </article>
  );
}

export function ActionCard({
  actions,
  ariaLabel,
  children,
  className,
  ...buttonProps
}: ActionCardProps) {
  return (
    <article className={cardClassName(className)}>
      <button
        {...buttonProps}
        aria-label={ariaLabel}
        className={`${styles.primaryAction} ${styles.buttonAction}`}
        type="button"
      />
      {children}
      <CardActions actions={actions} />
    </article>
  );
}
