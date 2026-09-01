import { Button, PageContainer } from "../../shared/ui";
import styles from "./PaymentResultScreen.module.css";

type PaymentResultScreenMode =
  "processing" | "failure" | "success" | "review" | "recovery-unavailable";

interface PaymentResultIdentifiers {
  readonly operationId: string;
  readonly reservationUid: string;
}

export interface PaymentResultScreenProps {
  readonly mode: PaymentResultScreenMode;
  readonly isBusy?: boolean;
  readonly statusMessage?: string | null;
  readonly identifiers?: PaymentResultIdentifiers;
  readonly onAcknowledge?: () => void;
  readonly onOpenProfile?: () => void;
  readonly onOpenReservation?: () => void;
  readonly onRetry?: () => void;
}

const contentByMode = {
  failure: {
    icon: "❌",
    title: "결제가 완료되지 않았습니다",
    message: "예약 상세에서 결제 상태를 다시 확인해주세요.",
  },
  success: {
    icon: "✅",
    title: "결제가 완료되었습니다",
    message: "확인하면 예약 상세로 이동합니다.",
  },
  review: {
    icon: "⚠️",
    title: "결제 확인이 필요합니다",
    message:
      "결제 결과가 아직 확정되지 않았습니다. 아래 식별자를 보관하고 예약 상세에서 상태를 확인해주세요.",
  },
  "recovery-unavailable": {
    icon: "⚠️",
    title: "결제 상태를 복구하지 못했습니다",
    message:
      "저장된 결제 정보를 안전하게 확인하지 못했습니다. 다시 확인하거나 예약 상세로 이동해주세요.",
  },
} as const;

export function PaymentResultScreen({
  mode,
  isBusy = false,
  statusMessage = null,
  identifiers,
  onAcknowledge,
  onOpenProfile,
  onOpenReservation,
  onRetry,
}: PaymentResultScreenProps) {
  if (mode === "processing") {
    return (
      <PageContainer
        as="section"
        className={styles.container}
        aria-live="polite"
        variant="narrow"
      >
        <div className={styles.content}>
          <div className={styles.spinner} aria-hidden="true" />
          <h1 className={styles.title}>결제 상태를 확인하고 있습니다...</h1>
          <p className={styles.message}>
            이 화면을 닫지 말고 잠시만 기다려주세요.
          </p>
          {statusMessage ? (
            <p className={styles.statusMessage} role="status">
              {statusMessage}
            </p>
          ) : null}
        </div>
      </PageContainer>
    );
  }

  const content = contentByMode[mode];

  return (
    <PageContainer as="section" className={styles.container} variant="narrow">
      <div className={styles.content}>
        <div className={styles.resultIcon} aria-hidden="true">
          {content.icon}
        </div>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.message}>{content.message}</p>
        {statusMessage ? (
          <p className={styles.statusMessage} role="status">
            {statusMessage}
          </p>
        ) : null}
        {identifiers ? (
          <dl className={styles.identifiers} aria-label="결제 복구 식별자">
            <div className={styles.identifier}>
              <dt className={styles.identifierLabel}>예약 번호</dt>
              <dd className={styles.identifierValue}>
                {identifiers.reservationUid}
              </dd>
            </div>
            <div className={styles.identifier}>
              <dt className={styles.identifierLabel}>처리 번호</dt>
              <dd className={styles.identifierValue}>
                {identifiers.operationId}
              </dd>
            </div>
          </dl>
        ) : null}
        <div className={styles.actions}>
          {onAcknowledge ? (
            <Button
              isLoading={isBusy}
              loadingLabel="처리 중..."
              onClick={onAcknowledge}
            >
              확인하고 예약 보기
            </Button>
          ) : null}
          {onRetry ? (
            <Button
              isLoading={isBusy}
              loadingLabel="결제 상태 확인 중..."
              onClick={onRetry}
            >
              결제 상태 다시 확인
            </Button>
          ) : null}
          {onOpenReservation ? (
            <Button variant="secondary" onClick={onOpenReservation}>
              예약 상세 보기
            </Button>
          ) : null}
          {onOpenProfile ? (
            <Button variant="secondary" onClick={onOpenProfile}>
              프로필로 이동
            </Button>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
