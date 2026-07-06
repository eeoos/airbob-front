import React from "react";
import styles from "./ClickableCard.module.css";

const INTERACTIVE_TARGET_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface ClickableCardProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-label" | "children"
  > {
  ariaLabel: string;
  children: React.ReactNode;
}

const hasNestedInteractiveTarget = (
  event: React.MouseEvent<HTMLButtonElement>
) => {
  if (!(event.target instanceof Element)) {
    return false;
  }

  const interactiveTarget = event.target.closest(INTERACTIVE_TARGET_SELECTOR);

  return (
    interactiveTarget !== null &&
    interactiveTarget !== event.currentTarget &&
    event.currentTarget.contains(interactiveTarget)
  );
};

export const ClickableCard = React.forwardRef<
  HTMLButtonElement,
  ClickableCardProps
>(
  (
    {
      ariaLabel,
      children,
      className,
      onClick,
      style,
      type = "button",
      ...buttonProps
    },
    ref
  ) => {
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (hasNestedInteractiveTarget(event)) {
        event.stopPropagation();
        return;
      }

      onClick?.(event);
    };

    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={className ? `${styles.button} ${className}` : styles.button}
        style={style}
        onClick={handleClick}
      >
        {children}
      </button>
    );
  }
);

ClickableCard.displayName = "ClickableCard";
