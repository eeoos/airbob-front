import React from "react";
import styles from "./Card.module.css";

export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardElement = "section" | "article" | "div" | "li";

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "onClick"> {
  as?: CardElement;
  /**
   * Visual hover treatment only. Use a real button or link inside the card for actions.
   */
  interactive?: boolean;
  padding?: CardPadding;
}

const cx = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(" ");

export function Card({
  as: Component = "section",
  children,
  className,
  interactive = false,
  padding = "md",
  ...cardProps
}: CardProps) {
  return (
    <Component
      className={cx(
        styles.card,
        styles[padding],
        interactive && styles.interactive,
        className
      )}
      {...cardProps}
    >
      {children}
    </Component>
  );
}
