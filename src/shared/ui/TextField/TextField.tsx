import React from "react";
import styles from "./TextField.module.css";

export interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  error?: React.ReactNode;
  hint?: React.ReactNode;
}

const cx = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(" ");

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      className,
      error,
      hint,
      id,
      label,
      "aria-describedby": ariaDescribedBy,
      ...inputProps
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? `text-field-${generatedId}`;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [ariaDescribedBy, hintId, errorId]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cx(
            styles.input,
            Boolean(error) && styles.inputError,
            className
          )}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          {...inputProps}
        />
        {hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className={styles.error}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

TextField.displayName = "TextField";
