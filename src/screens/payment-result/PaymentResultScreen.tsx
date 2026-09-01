import { Button, PageContainer } from "../../shared/ui";
import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
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
  processing: {
    eyebrow: "결제 기록 동기화",
    title: "결제 상태를 확인하고 있습니다...",
    message: "이 화면을 닫지 말고 잠시만 기다려주세요.",
    stage: "승인 상태 확인",
    stageDetail: "결제 기록과 예약 상태를 안전하게 맞추고 있습니다.",
  },
  failure: {
    eyebrow: "결제 기록 확인 완료",
    title: "결제가 완료되지 않았습니다",
    message: "예약 상세에서 결제 상태를 다시 확인해주세요.",
    stage: "예약 상태 확인",
    stageDetail: "예약 상세에서 현재 결제 상태를 이어서 확인할 수 있습니다.",
  },
  success: {
    eyebrow: "예약 원장 반영 완료",
    title: "결제가 완료되었습니다",
    message: "확인하면 예약 상세로 이동합니다.",
    stage: "예약 내역 열기",
    stageDetail: "확인 후 최신 예약 내역으로 안전하게 이동합니다.",
  },
  review: {
    eyebrow: "추가 확인 진행 중",
    title: "결제 확인이 필요합니다",
    message:
      "결제 결과가 아직 확정되지 않았습니다. 아래 식별자를 보관하고 예약 상세에서 상태를 확인해주세요.",
    stage: "결제 결과 재확인",
    stageDetail: "결과가 확정될 때까지 안전한 결제 기록을 보존합니다.",
  },
  "recovery-unavailable": {
    eyebrow: "복구 정보 확인 필요",
    title: "결제 상태를 복구하지 못했습니다",
    message:
      "저장된 결제 정보를 안전하게 확인하지 못했습니다. 다시 확인하거나 예약 상세로 이동해주세요.",
    stage: "예약 상태로 돌아가기",
    stageDetail: "다시 확인하거나 예약 상세에서 현재 상태를 확인하세요.",
  },
} as const satisfies Record<
  PaymentResultScreenMode,
  {
    readonly eyebrow: string;
    readonly message: string;
    readonly stage: string;
    readonly stageDetail: string;
    readonly title: string;
  }
>;

const markClassByMode: Record<PaymentResultScreenMode, string> = {
  failure: requireCssModuleClass(styles.markFailure),
  processing: requireCssModuleClass(styles.markProcessing),
  "recovery-unavailable": requireCssModuleClass(styles.markRecovery),
  review: requireCssModuleClass(styles.markReview),
  success: requireCssModuleClass(styles.markSuccess),
};

const contentClassByMode: Record<PaymentResultScreenMode, string> = {
  failure: requireCssModuleClass(styles.contentFailure),
  processing: requireCssModuleClass(styles.contentProcessing),
  "recovery-unavailable": requireCssModuleClass(styles.contentRecovery),
  review: requireCssModuleClass(styles.contentReview),
  success: requireCssModuleClass(styles.contentSuccess),
};

function PaymentStateMark({
  mode,
}: {
  readonly mode: PaymentResultScreenMode;
}) {
  const commonSvgProps = {
    "aria-hidden": true,
    focusable: false,
    viewBox: "0 0 48 48",
  } as const;

  let glyph;
  switch (mode) {
    case "processing":
      glyph = (
        <svg {...commonSvgProps}>
          <circle className={styles.markTrack} cx="24" cy="24" r="17" />
          <circle
            className={styles.processingArc}
            cx="24"
            cy="24"
            r="17"
            strokeDasharray="38 70"
          />
          <path d="M24 15v10l7 4" />
        </svg>
      );
      break;
    case "success":
      glyph = (
        <svg {...commonSvgProps}>
          <circle cx="24" cy="24" r="17" />
          <path d="m16.5 24.5 5 5 10-11" />
        </svg>
      );
      break;
    case "failure":
      glyph = (
        <svg {...commonSvgProps}>
          <circle cx="24" cy="24" r="17" />
          <path d="m18 18 12 12M30 18 18 30" />
        </svg>
      );
      break;
    case "review":
      glyph = (
        <svg {...commonSvgProps}>
          <circle cx="24" cy="24" r="17" />
          <path d="M24 15v12" />
          <circle className={styles.markDot} cx="24" cy="33" r="1" />
        </svg>
      );
      break;
    case "recovery-unavailable":
      glyph = (
        <svg {...commonSvgProps}>
          <path d="M34 19a12 12 0 1 0 1.5 11" />
          <path d="M34 12v7h-7" />
          <path d="M24 18v7" />
          <circle className={styles.markDot} cx="24" cy="31" r="1" />
        </svg>
      );
      break;
  }

  return (
    <div
      aria-hidden="true"
      className={`${styles.stateMark} ${markClassByMode[mode]}`}
      data-state={mode}
      data-testid="payment-state-mark"
    >
      {glyph}
    </div>
  );
}

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
  const content = contentByMode[mode];
  const isScreenBusy = mode === "processing" || isBusy;
  const hasPrimaryAction = Boolean(onAcknowledge || onRetry);
  const hasSecondaryAction = Boolean(onOpenReservation || onOpenProfile);

  return (
    <PageContainer
      as="section"
      className={styles.container}
      aria-busy={isScreenBusy || undefined}
      aria-describedby="payment-result-message"
      aria-labelledby="payment-result-title"
      variant="narrow"
    >
      <article
        className={`${styles.content} ${contentClassByMode[mode]}`}
        data-payment-result-mode={mode}
      >
        <div className={styles.ledgerHeader} aria-hidden="true">
          <span className={styles.ledgerBrand}>AIRBOB 예약 기록</span>
          <span className={styles.ledgerMeta}>결제 상태</span>
        </div>

        <div
          className={styles.announcement}
          role={mode === "failure" ? "alert" : "status"}
          aria-atomic="true"
          aria-live={mode === "failure" ? "assertive" : "polite"}
        >
          <PaymentStateMark mode={mode} />
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h1 id="payment-result-title" className={styles.title}>
            {content.title}
          </h1>
          <p id="payment-result-message" className={styles.message}>
            {content.message}
          </p>
          {statusMessage ? (
            <p className={styles.statusMessage}>{statusMessage}</p>
          ) : null}
        </div>

        <section
          className={styles.stage}
          aria-labelledby="payment-result-stage-title"
        >
          <span className={styles.stageMarker} aria-hidden="true" />
          <div>
            <h2 id="payment-result-stage-title" className={styles.stageLabel}>
              현재 단계
            </h2>
            <p className={styles.stageValue}>{content.stage}</p>
            <p className={styles.stageDetail}>{content.stageDetail}</p>
          </div>
        </section>

        {identifiers ? (
          <section
            className={styles.record}
            aria-labelledby="payment-result-record-title"
          >
            <div className={styles.recordHeader}>
              <h2
                id="payment-result-record-title"
                className={styles.recordTitle}
              >
                결제 확인 기록
              </h2>
              <span className={styles.recordSafety}>복구용 식별자</span>
            </div>
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
          </section>
        ) : null}

        {hasPrimaryAction || hasSecondaryAction ? (
          <div className={styles.actions}>
            {hasPrimaryAction ? (
              <div className={styles.primaryActions}>
                {onAcknowledge ? (
                  <Button
                    className={styles.primaryAction}
                    fullWidth
                    isLoading={isBusy}
                    loadingLabel="처리 중..."
                    onClick={onAcknowledge}
                    size="lg"
                  >
                    확인하고 예약 보기
                  </Button>
                ) : null}
                {onRetry ? (
                  <Button
                    className={styles.primaryAction}
                    fullWidth
                    isLoading={isBusy}
                    loadingLabel="결제 상태 확인 중..."
                    onClick={onRetry}
                    size="lg"
                  >
                    결제 상태 다시 확인
                  </Button>
                ) : null}
              </div>
            ) : null}

            {hasSecondaryAction ? (
              <div className={styles.secondaryActions}>
                {onOpenReservation ? (
                  <Button
                    className={styles.secondaryAction}
                    fullWidth
                    onClick={onOpenReservation}
                    variant="secondary"
                  >
                    예약 상세 보기
                  </Button>
                ) : null}
                {onOpenProfile ? (
                  <Button
                    className={styles.secondaryAction}
                    fullWidth
                    onClick={onOpenProfile}
                    variant="secondary"
                  >
                    프로필로 이동
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    </PageContainer>
  );
}
