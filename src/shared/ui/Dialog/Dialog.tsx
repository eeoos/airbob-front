import React from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function Dialog({ children, isOpen, onClose, title }: DialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        aria-label={title}
        className={styles.dialog}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} type="button" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}
