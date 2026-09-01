import {
  Button,
  ImageWithFallback,
  PageContainer,
  Skeleton,
  TerminalErrorState,
  ToastHost,
} from "../../shared/ui";
import styles from "./ReservationConfirmScreen.module.css";

interface ReservationConfirmAccommodationView {
  readonly averageRating: number;
  readonly name: string;
  readonly nightlyPrice: number;
  readonly reviewCount: number;
  readonly thumbnailUrl: string | null;
}

interface ReservationConfirmCouponView {
  readonly discountAmount: number;
  readonly name: string | null;
}

export interface ReservationConfirmCheckoutView {
  readonly cancellationDeadlineLabel: string | null;
  readonly coupon: ReservationConfirmCouponView | null;
  readonly dateLabel: string;
  readonly guestLabel: string;
  readonly nights: number;
  readonly payableAmount: number;
  readonly totalPrice: number;
}

export type ReservationConfirmScreenState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly accommodation: ReservationConfirmAccommodationView;
      readonly checkout: ReservationConfirmCheckoutView;
    };

export type ReservationConfirmPaymentStatus =
  "loading" | "ready" | "processing";

export interface ReservationConfirmScreenProps {
  readonly canReleaseHold: boolean;
  readonly errorMessage: string | null;
  readonly isReleasing: boolean;
  readonly onClearError: () => void;
  readonly onConfirmPayment: () => void;
  readonly onReleaseHold: () => void;
  readonly onRetryLoad?: () => void;
  readonly paymentStatus: ReservationConfirmPaymentStatus;
  readonly state: ReservationConfirmScreenState;
}

const formatWon = (amount: number): string =>
  `₩${amount.toLocaleString("ko-KR")}`;

const paymentButtonCopy: Record<ReservationConfirmPaymentStatus, string> = {
  loading: "결제 시스템 로딩 중...",
  processing: "결제 진행 중...",
  ready: "확인 및 결제",
};

const paymentStatusCopy: Record<ReservationConfirmPaymentStatus, string> = {
  loading: "안전한 결제 시스템을 연결하고 있습니다.",
  processing: "결제창을 여는 중입니다. 잠시만 기다려주세요.",
  ready: "예약 조건과 최종 금액을 확인한 뒤 결제를 진행해주세요.",
};

function AccommodationFallback({ name }: { readonly name: string }) {
  return (
    <div
      className={styles.accommodationImageFallback}
      role="img"
      aria-label={`${name} 이미지 없음`}
    >
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <path d="M5 25V13.5L16 5l11 8.5V25a2 2 0 0 1-2 2h-6v-8h-6v8H7a2 2 0 0 1-2-2Z" />
      </svg>
    </div>
  );
}

function ReservationConfirmLoading() {
  return (
    <PageContainer
      as="section"
      className={styles.loadingContainer}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="예약 정보를 불러오는 중"
      variant="content"
    >
      <span className={styles.srOnly}>예약 정보를 불러오는 중입니다.</span>
      <div className={styles.loadingHeader}>
        <Skeleton className={styles.loadingEyebrow} />
        <Skeleton className={styles.loadingTitle} />
      </div>
      <div className={styles.loadingLayout}>
        <div className={styles.loadingMain}>
          <Skeleton className={styles.loadingPanel} />
          <Skeleton className={styles.loadingPanelSmall} />
        </div>
        <Skeleton className={styles.loadingSummary} />
      </div>
    </PageContainer>
  );
}

export function ReservationConfirmScreen({
  canReleaseHold,
  errorMessage,
  isReleasing,
  onClearError,
  onConfirmPayment,
  onReleaseHold,
  onRetryLoad,
  paymentStatus,
  state,
}: ReservationConfirmScreenProps) {
  if (state.status === "loading") return <ReservationConfirmLoading />;

  if (state.status === "error") {
    return (
      <PageContainer className={styles.stateContainer} variant="content">
        <TerminalErrorState
          title="예약 정보를 불러오지 못했습니다"
          description={state.message}
          action={
            onRetryLoad ? (
              <Button variant="secondary" onClick={onRetryLoad}>
                다시 시도
              </Button>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  const { accommodation, checkout } = state;
  const isPaymentDisabled = paymentStatus !== "ready";

  return (
    <>
      <PageContainer
        as="section"
        className={styles.container}
        aria-labelledby="reservation-confirm-title"
        variant="content"
      >
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>예약 2단계 · 결제</p>
          <h1 id="reservation-confirm-title" className={styles.title}>
            확인 및 결제
          </h1>
          <p className={styles.intro}>
            숙박 일정과 결제 예정 금액을 마지막으로 확인해주세요.
          </p>
        </header>

        <div className={styles.checkoutLayout}>
          <div className={styles.mainColumn}>
            <section
              className={styles.panel}
              aria-labelledby="reservation-confirm-stay-details"
            >
              <div className={styles.panelHeading}>
                <p className={styles.stepLabel}>01</p>
                <h2
                  id="reservation-confirm-stay-details"
                  className={styles.panelTitle}
                >
                  예약 조건
                </h2>
              </div>

              <dl className={styles.infoList}>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>날짜</dt>
                  <dd className={styles.infoValue}>{checkout.dateLabel}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt className={styles.infoLabel}>게스트</dt>
                  <dd className={styles.infoValue}>{checkout.guestLabel}</dd>
                </div>
              </dl>
            </section>

            <section
              className={`${styles.panel} ${styles.cancellationPolicy}`}
              aria-labelledby="reservation-confirm-cancellation"
            >
              <div className={styles.policyMark} aria-hidden="true" />
              <div>
                <h2
                  id="reservation-confirm-cancellation"
                  className={styles.policyTitle}
                >
                  취소 수수료 없음
                </h2>
                {checkout.cancellationDeadlineLabel ? (
                  <p className={styles.policyText}>
                    {checkout.cancellationDeadlineLabel}까지 예약을 취소하면
                    요금 전액이 환불됩니다.
                  </p>
                ) : (
                  <p className={styles.policyText}>
                    결제 전 예약 조건을 다시 확인해주세요.
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside
            className={styles.summaryCard}
            aria-labelledby="reservation-confirm-price-details"
          >
            <section
              className={styles.accommodationInfo}
              aria-labelledby="reservation-confirm-accommodation"
            >
              <ImageWithFallback
                src={accommodation.thumbnailUrl}
                alt={accommodation.name}
                className={styles.accommodationImage}
                fallback={<AccommodationFallback name={accommodation.name} />}
              />
              <div className={styles.accommodationDetails}>
                <p className={styles.summaryEyebrow}>이번 여행</p>
                <h2
                  id="reservation-confirm-accommodation"
                  className={styles.accommodationTitle}
                >
                  {accommodation.name}
                </h2>
                {accommodation.reviewCount > 0 && (
                  <div
                    className={styles.accommodationRating}
                    aria-label={`평점 ${accommodation.averageRating.toFixed(2)}, 후기 ${accommodation.reviewCount}개`}
                  >
                    <span className={styles.star} aria-hidden="true">
                      ★
                    </span>
                    <span>{accommodation.averageRating.toFixed(2)}</span>
                    <span className={styles.reviewCount}>
                      (후기 {accommodation.reviewCount}개)
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section className={styles.priceDetails}>
              <h2
                id="reservation-confirm-price-details"
                className={styles.priceDetailsTitle}
              >
                요금 세부 정보
              </h2>
              <div className={styles.priceRow}>
                <span>
                  {checkout.nights}박 x {formatWon(accommodation.nightlyPrice)}
                </span>
                <span>{formatWon(checkout.totalPrice)}</span>
              </div>
              {checkout.coupon && checkout.coupon.discountAmount > 0 && (
                <div className={styles.priceRow}>
                  <span>{checkout.coupon.name || "쿠폰 할인"}</span>
                  <span>-{formatWon(checkout.coupon.discountAmount)}</span>
                </div>
              )}
              <div className={styles.priceRow}>
                <span className={styles.totalLabel}>결제 예정 금액 (KRW)</span>
                <span className={styles.totalPrice}>
                  {formatWon(checkout.payableAmount)}
                </span>
              </div>
            </section>

            <div
              className={styles.paymentReadiness}
              role="status"
              aria-live="polite"
            >
              <span
                className={styles.paymentReadinessMark}
                aria-hidden="true"
              />
              <span>{paymentStatusCopy[paymentStatus]}</span>
            </div>

            <Button
              fullWidth
              size="lg"
              className={styles.reserveButton}
              onClick={onConfirmPayment}
              disabled={isPaymentDisabled}
              isLoading={paymentStatus === "processing"}
              loadingLabel={paymentButtonCopy.processing}
            >
              {paymentButtonCopy[paymentStatus]}
            </Button>
            <p className={styles.paymentNote}>
              결제 버튼을 누르기 전에는 요금이 청구되지 않습니다.
            </p>
            {canReleaseHold && (
              <Button
                fullWidth
                variant="ghost"
                className={styles.releaseButton}
                onClick={onReleaseHold}
                disabled={isReleasing || paymentStatus === "processing"}
                isLoading={isReleasing}
                loadingLabel="예약 해제 확인 중..."
              >
                예약을 취소하고 객실 해제
              </Button>
            )}
          </aside>
        </div>
      </PageContainer>

      {errorMessage && (
        <ToastHost
          closeLabel="오류 닫기"
          message={errorMessage}
          onClose={onClearError}
        />
      )}
    </>
  );
}
