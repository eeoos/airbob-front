import React from "react";
import styles from "./IconButton.module.css";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
}

const cx = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(" ");

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      className,
      label,
      size = "md",
      title,
      type = "button",
      variant = "ghost",
      ...buttonProps
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={cx(
        styles.iconButton,
        styles[size],
        styles[variant],
        className
      )}
      title={title ?? label}
      {...buttonProps}
      aria-label={label}
    >
      {children}
    </button>
  )
);

IconButton.displayName = "IconButton";
