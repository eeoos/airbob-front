import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useOverlayPortalTarget } from "../overlayRuntime";
import styles from "./ToastHost.module.css";

export interface ToastHostProps {
  action?: {
    readonly label: string;
    readonly onClick: () => void;
  };
  closeLabel?: string;
  dismissible?: boolean;
  duration?: number;
  message: string;
  onClose: () => void;
}

export const ToastHost: React.FC<ToastHostProps> = ({
  action,
  closeLabel = "닫기",
  dismissible = true,
  duration = 5000,
  message,
  onClose,
}) => {
  const portalTarget = useOverlayPortalTarget();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!dismissible) return;

    const timer = window.setTimeout(() => {
      onCloseRef.current();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [dismissible, duration, message]);

  const content = (
    <div className={styles.host} data-testid="toast-host">
      <div className={styles.toast} role="alert" aria-live="assertive">
        <div className={styles.content}>
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={styles.icon}
            aria-hidden="true"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span className={styles.message}>{message}</span>
        </div>
        {action && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
        {dismissible && (
          <button
            type="button"
            className={styles.closeButton}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return portalTarget ? createPortal(content, portalTarget) : content;
};
