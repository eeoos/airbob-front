import React from "react";
import { Button } from "../../shared/ui";
import styles from "./PaymentResultScreen.module.css";

export interface PaymentResultScreenProps {
  mode: "processing" | "failure";
  isReconciling?: boolean;
  statusMessage?: string | null;
  onOpenProfile?: () => void;
  onOpenReservation?: () => void;
  onReconcile?: () => void;
}

export function PaymentResultScreen({
  mode,
  isReconciling = false,
  statusMessage = null,
  onOpenProfile,
  onOpenReservation,
  onReconcile,
}: PaymentResultScreenProps) {
  if (mode === "processing") {
    return (
      <section className={styles.container} aria-live="polite">
        <div className={styles.content}>
          <div className={styles.spinner} aria-hidden="true" />
          <h1 className={styles.title}>결제를 처리하고 있습니다...</h1>
          <p className={styles.message}>예약 상세 페이지로 이동합니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <div className={styles.content}>
        <div className={styles.errorIcon} aria-hidden="true">
          ❌
        </div>
        <h1 className={styles.title}>결제에 실패했습니다</h1>
        <p className={styles.message}>
          결제 처리 중 문제가 발생했습니다. 다시 시도해주세요.
        </p>
        {statusMessage ? (
          <p className={styles.statusMessage} role="status">
            {statusMessage}
          </p>
        ) : null}
        <div className={styles.actions}>
          {onReconcile ? (
            <Button
              isLoading={isReconciling}
              loadingLabel="결제 상태 확인 중..."
              onClick={onReconcile}
            >
              결제 상태 확인
            </Button>
          ) : null}
          {onOpenProfile ? (
            <Button onClick={onOpenProfile}>프로필로 이동</Button>
          ) : null}
          {onOpenReservation ? (
            <Button variant="secondary" onClick={onOpenReservation}>
              예약 상세 보기
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
