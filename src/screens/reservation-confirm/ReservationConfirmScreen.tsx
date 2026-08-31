import { ToastHost } from "../../shared/ui";
import styles from "./ReservationConfirmScreen.module.css";

export interface ReservationConfirmAccommodationView {
  readonly averageRating: number;
  readonly name: string;
  readonly nightlyPrice: number;
  readonly reviewCount: number;
  readonly thumbnailUrl: string | null;
}

export interface ReservationConfirmCouponView {
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
  readonly errorMessage: string | null;
  readonly onClearError: () => void;
  readonly onConfirmPayment: () => void;
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

export function ReservationConfirmScreen({
  errorMessage,
  onClearError,
  onConfirmPayment,
  paymentStatus,
  state,
}: ReservationConfirmScreenProps) {
  if (state.status === "loading") {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        로딩 중...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.error} role="alert">
        {state.message}
      </div>
    );
  }

  const { accommodation, checkout } = state;
  const isPaymentDisabled = paymentStatus !== "ready";

  return (
    <>
      <section
        className={styles.container}
        aria-labelledby="reservation-confirm-title"
      >
        <div className={styles.content}>
          <h1 id="reservation-confirm-title" className={styles.title}>
            확인 및 결제
          </h1>

          <section
            className={styles.accommodationInfo}
            aria-labelledby="reservation-confirm-accommodation"
          >
            {accommodation.thumbnailUrl && (
              <img
                src={accommodation.thumbnailUrl}
                alt={accommodation.name}
                className={styles.accommodationImage}
              />
            )}
            <div className={styles.accommodationDetails}>
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

          <section className={styles.cancellationPolicy}>
            <h2 className={styles.policyTitle}>취소 수수료 없음</h2>
            {checkout.cancellationDeadlineLabel && (
              <p className={styles.policyText}>
                {checkout.cancellationDeadlineLabel}까지 예약을 취소하면 요금
                전액이 환불됩니다.
              </p>
            )}
          </section>

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

          <section
            className={styles.priceDetails}
            aria-labelledby="reservation-confirm-price-details"
          >
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
              <span className={styles.totalLabel}>총액 KRW</span>
              <span className={styles.totalPrice}>
                {formatWon(checkout.payableAmount)}
              </span>
            </div>
          </section>

          <button
            className={styles.reserveButton}
            type="button"
            onClick={onConfirmPayment}
            disabled={isPaymentDisabled}
            aria-busy={paymentStatus === "processing"}
          >
            {paymentButtonCopy[paymentStatus]}
          </button>
        </div>
      </section>

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
