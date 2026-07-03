import React from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  children: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

let openDialogCount = 0;
let previousBodyOverflow = "";

const cx = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const getFocusableElements = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (focusableElement) =>
      !focusableElement.hasAttribute("disabled") &&
      focusableElement.getAttribute("aria-hidden") !== "true"
  );

const getAutofocusElement = (element: HTMLElement) =>
  getFocusableElements(element).find(
    (focusableElement) =>
      (focusableElement as HTMLInputElement).autofocus ||
      focusableElement.hasAttribute("autofocus")
  ) ?? null;

export function Dialog({
  bodyClassName,
  children,
  className,
  isOpen,
  onClose,
  title,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousFocusedElementRef = React.useRef<Element | null>(null);
  const wasOpenRef = React.useRef(false);

  if (isOpen && !wasOpenRef.current && previousFocusedElementRef.current === null) {
    previousFocusedElementRef.current = document.activeElement;
  }

  React.useEffect(() => {
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (openDialogCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    openDialogCount += 1;

    return () => {
      openDialogCount = Math.max(0, openDialogCount - 1);

      if (openDialogCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        previousBodyOverflow = "";
      }
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (previousFocusedElementRef.current === null) {
      previousFocusedElementRef.current = document.activeElement;
    }

    if (
      !(document.activeElement instanceof HTMLElement) ||
      !dialogRef.current?.contains(document.activeElement)
    ) {
      const autofocusElement = dialogRef.current
        ? getAutofocusElement(dialogRef.current)
        : null;
      if (autofocusElement) {
        autofocusElement.focus();
      } else {
        closeButtonRef.current?.focus();
      }
    }

    return () => {
      const previousFocusedElement = previousFocusedElementRef.current;
      previousFocusedElementRef.current = null;

      if (
        previousFocusedElement instanceof HTMLElement &&
        document.contains(previousFocusedElement)
      ) {
        previousFocusedElement.focus();
      }
    };
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstFocusableElement) {
      event.preventDefault();
      lastFocusableElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastFocusableElement) {
      event.preventDefault();
      firstFocusableElement.focus();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        aria-modal="true"
        aria-label={title}
        className={cx(styles.dialog, className)}
        role="dialog"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            ref={closeButtonRef}
            className={styles.closeButton}
            type="button"
            onClick={onClose}
          >
            닫기
          </button>
        </header>
        <div className={cx(styles.body, bodyClassName)}>{children}</div>
      </section>
    </div>
  );
}
