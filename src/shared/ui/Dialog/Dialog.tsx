import React from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../useBodyScrollLock";
import {
  OverlayPortalTargetProvider,
  useOverlayRegistration,
} from "../overlayRuntime";
import styles from "./Dialog.module.css";

type DialogBodyPadding = "default" | "none";
type DialogSize = "sm" | "md" | "lg" | "xl" | "fullscreen" | "custom";

export interface DialogProps {
  children: React.ReactNode;
  bodyPadding?: DialogBodyPadding;
  bodyClassName?: string;
  className?: string;
  closeButtonLabel?: string;
  closeOnBackdrop?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  showHeader?: boolean;
  size?: DialogSize;
  title: string;
}

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
      focusableElement.getAttribute("aria-hidden") !== "true",
  );

const getAutofocusElement = (element: HTMLElement) =>
  getFocusableElements(element).find(
    (focusableElement) =>
      (focusableElement as HTMLInputElement).autofocus ||
      focusableElement.hasAttribute("autofocus"),
  ) ?? null;

const getInitialFocusElement = (
  dialog: HTMLElement,
  initialFocusRef?: React.RefObject<HTMLElement | null>,
) => {
  const requestedElement = initialFocusRef?.current;

  return requestedElement && dialog.contains(requestedElement)
    ? requestedElement
    : getAutofocusElement(dialog);
};

export function Dialog({
  bodyPadding = "default",
  bodyClassName,
  children,
  className,
  closeButtonLabel = "닫기",
  closeOnBackdrop = true,
  initialFocusRef,
  isOpen,
  onClose,
  showHeader = true,
  size = "md",
  title,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const initialFocusHandledRef = React.useRef(false);
  const previousFocusedElementRef = React.useRef<Element | null>(null);
  const wasOpenRef = React.useRef(false);
  const titleId = React.useId();

  const sizeClassName =
    size === "custom"
      ? undefined
      : {
          sm: styles.sizeSm,
          md: styles.sizeMd,
          lg: styles.sizeLg,
          xl: styles.sizeXl,
          fullscreen: styles.sizeFullscreen,
        }[size];

  const bodyPaddingClassName =
    bodyPadding === "none" ? styles.bodyPaddingNone : undefined;

  if (
    isOpen &&
    !wasOpenRef.current &&
    previousFocusedElementRef.current === null
  ) {
    previousFocusedElementRef.current = document.activeElement;
  }

  const overlay = useOverlayRegistration({
    elementRef: dialogRef,
    enabled: isOpen,
    layerRef: overlayRef,
    onClose,
    restoreFocusTo: previousFocusedElementRef.current,
  });

  React.useEffect(() => {
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useBodyScrollLock(isOpen && !overlay.hasRuntime);

  React.useEffect(() => {
    if (!isOpen) {
      initialFocusHandledRef.current = false;
      previousFocusedElementRef.current = null;
      return;
    }

    if (!overlay.hasRuntime && previousFocusedElementRef.current === null) {
      previousFocusedElementRef.current = document.activeElement;
    }

    if (overlay.hasRuntime && !overlay.isRegistered) {
      return;
    }

    if (initialFocusHandledRef.current) return;
    initialFocusHandledRef.current = true;

    if (overlay.hasRuntime && !overlay.isTopmostModal) return;

    if (
      !(document.activeElement instanceof HTMLElement) ||
      !dialogRef.current?.contains(document.activeElement)
    ) {
      const initialFocusElement = dialogRef.current
        ? getInitialFocusElement(dialogRef.current, initialFocusRef)
        : null;
      const firstFocusableElement = dialogRef.current
        ? (getFocusableElements(dialogRef.current)[0] ?? null)
        : null;
      if (initialFocusElement) {
        initialFocusElement.focus();
      } else {
        (
          closeButtonRef.current ??
          firstFocusableElement ??
          dialogRef.current
        )?.focus();
      }
    }

    return () => {
      if (overlay.hasRuntime) return;

      const previousFocusedElement = previousFocusedElementRef.current;
      previousFocusedElementRef.current = null;

      if (
        previousFocusedElement instanceof HTMLElement &&
        document.contains(previousFocusedElement)
      ) {
        previousFocusedElement.focus();
      }
    };
  }, [
    isOpen,
    initialFocusRef,
    overlay.hasRuntime,
    overlay.isRegistered,
    overlay.isTopmostModal,
    overlay.portalRoot,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;

    if (event.key === "Escape") {
      if (overlay.hasRuntime) return;

      event.preventDefault();
      onClose();
      return;
    }

    if (
      event.key !== "Tab" ||
      !dialogRef.current ||
      (overlay.hasRuntime && !overlay.isTopmostModal)
    ) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstFocusableElement = focusableElements.at(0);
    const lastFocusableElement = focusableElements.at(-1);
    if (!firstFocusableElement || !lastFocusableElement) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

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

  const isInactiveUnderOverlay = overlay.hasRuntime && !overlay.isTopmostModal;

  const content = (
    <div
      ref={overlayRef}
      aria-hidden={isInactiveUnderOverlay ? true : undefined}
      className={styles.overlay}
      inert={isInactiveUnderOverlay ? true : undefined}
      role="presentation"
      onMouseDown={
        closeOnBackdrop
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              if (!overlay.hasRuntime || overlay.isTopmostModal) onClose();
            }
          : undefined
      }
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Dialog delegates Escape and focus trapping from its descendants. */}
      <section
        ref={dialogRef}
        aria-modal="true"
        aria-label={showHeader ? undefined : title}
        aria-labelledby={showHeader ? titleId : undefined}
        className={cx(styles.dialog, sizeClassName, className)}
        role="dialog"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {showHeader && (
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              className={styles.closeButton}
              type="button"
              onClick={onClose}
            >
              {closeButtonLabel}
            </button>
          </header>
        )}
        <div className={cx(styles.body, bodyPaddingClassName, bodyClassName)}>
          <OverlayPortalTargetProvider value={null}>
            {children}
          </OverlayPortalTargetProvider>
        </div>
      </section>
    </div>
  );

  return overlay.portalRoot
    ? createPortal(content, overlay.portalRoot)
    : content;
}
