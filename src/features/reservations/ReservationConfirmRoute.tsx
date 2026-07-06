import React, { useEffect, useState } from "react";
import type { Location, NavigateFunction } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { useApiError } from "../../hooks/useApiError";
import { routeTo } from "../../routes/paths";
import { getImageUrl } from "../../utils/image";
import { useReservationConfirmAccommodation } from "./hooks/useReservationConfirmAccommodation";
import {
  getReservationPaymentRequestState,
  parseCheckoutDateParam,
} from "./lib/paymentRouteState";
import { readReservationCheckoutState } from "./lib/reservationCheckoutState";
import {
  calculateCheckoutNights,
  calculatePayableAmount,
  formatGuestSummary,
} from "./lib/reservationCheckoutSummary";
import {
  ensureTossPaymentsScript,
  getTossClientKey,
  getTossPaymentsClient,
  shouldSilentlyResetPayment,
  toReservationPaymentError,
} from "./lib/tossPayments";
import styles from "./ReservationConfirmRoute.module.css";

interface ReservationConfirmRouteProps {
  accommodationId?: string;
  locationState: Location["state"];
  navigate: NavigateFunction;
}

export const ReservationConfirmRoute: React.FC<ReservationConfirmRouteProps> = ({
  accommodationId,
  locationState,
  navigate,
}) => {
  const { error, handleError, clearError } = useApiError();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isTossReady, setIsTossReady] = useState(false);

  const checkoutState = accommodationId
    ? readReservationCheckoutState(accommodationId, locationState)
    : null;
  const reservationUid = checkoutState?.reservationUid ?? null;
  const couponName = checkoutState?.couponName ?? null;
  const couponDiscountParam = checkoutState?.couponDiscount ?? null;

  // 예약 박스에서 입력한 정보
  const checkIn = parseCheckoutDateParam(checkoutState?.checkIn);
  const checkOut = parseCheckoutDateParam(checkoutState?.checkOut);
  const adultCount = checkoutState?.adultOccupancy ?? 1;
  const childCount = checkoutState?.childOccupancy ?? 0;
  const infantCount = checkoutState?.infantOccupancy ?? 0;
  const petCount = checkoutState?.petOccupancy ?? 0;

  const { accommodation, isLoading } = useReservationConfirmAccommodation({
    accommodationId,
    reservationUid,
    navigate,
    handleError,
    clearError,
  });

  useEffect(() => {
    let isCancelled = false;

    setIsTossReady(false);
    ensureTossPaymentsScript()
      .then(() => {
        if (!isCancelled) {
          setIsTossReady(true);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          handleError(toReservationPaymentError(error));
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [handleError]);

  const formatDateForDisplay = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  const formatDateRange = (): string => {
    if (!checkIn || !checkOut) return "";
    const start = formatDateForDisplay(checkIn);
    const end = formatDateForDisplay(checkOut);
    return `${start}~${end.split("일")[0]}일`;
  };

  const nights =
    checkIn && checkOut
      ? calculateCheckoutNights(
          checkoutState?.checkIn ?? "",
          checkoutState?.checkOut ?? "",
        )
      : 0;
  const totalPrice = accommodation ? accommodation.base_price * nights : 0;
  const paymentRequestState = getReservationPaymentRequestState(checkoutState);

  const handleReserve = async () => {
    if (paymentRequestState.status === "missing") {
      handleError(new Error("결제 정보가 올바르지 않습니다."));
      return;
    }

    setIsProcessingPayment(true);
    clearError();

    try {
      await ensureTossPaymentsScript();
      setIsTossReady(true);
      const paymentWidget = getTossPaymentsClient(getTossClientKey());

      await paymentWidget
        .requestPayment({
          orderId: paymentRequestState.reservationUid,
          orderName: paymentRequestState.orderName,
          successUrl: `${window.location.origin}${routeTo.paymentSuccess(paymentRequestState.reservationUid)}`,
          failUrl: `${window.location.origin}${routeTo.paymentFail(paymentRequestState.reservationUid)}`,
          customerEmail: paymentRequestState.customerEmail,
          customerName: paymentRequestState.customerName,
          amount: paymentRequestState.amount,
        })
        .catch((paymentError: unknown) => {
          if (shouldSilentlyResetPayment(paymentError)) {
            setIsProcessingPayment(false);
            return;
          }

          throw toReservationPaymentError(paymentError);
        });
    } catch (err) {
      handleError(toReservationPaymentError(err));
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <div className={styles.loading}>로딩 중...</div>
      </>
    );
  }

  if (!accommodation) {
    return (
      <>
        <div className={styles.error}>숙소 정보를 불러올 수 없습니다.</div>
      </>
    );
  }

  const amount =
    paymentRequestState.status === "valid" ? paymentRequestState.amount : null;
  const responseDiscount = amount == null ? 0 : Math.max(totalPrice - amount, 0);
  const couponDiscount =
    responseDiscount > 0 ? responseDiscount : couponDiscountParam ?? 0;
  const payableAmount = amount ?? calculatePayableAmount(totalPrice);

  return (
    <>
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>확인 및 결제</h1>

          {/* 숙소 정보 */}
          <div className={styles.accommodationInfo}>
            {accommodation.images && accommodation.images.length > 0 && (
              <img
                src={getImageUrl(accommodation.images[0].image_url)}
                alt={accommodation.name}
                className={styles.accommodationImage}
              />
            )}
            <div className={styles.accommodationDetails}>
              <h3 className={styles.accommodationTitle}>{accommodation.name}</h3>
              {accommodation.review_summary.total_count > 0 && (
                <div className={styles.accommodationRating}>
                  <span className={styles.star}>★</span>
                  <span>{accommodation.review_summary.average_rating.toFixed(2)}</span>
                  <span className={styles.reviewCount}>
                    (후기 {accommodation.review_summary.total_count}개)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 취소 정책 */}
          <div className={styles.cancellationPolicy}>
            <div className={styles.policyTitle}>취소 수수료 없음</div>
            <div className={styles.policyText}>
              {checkIn && (
                <>
                  {new Date(checkIn.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString(
                    "ko-KR",
                    { month: "long", day: "numeric" },
                  )}
                  까지 예약을 취소하면 요금 전액이 환불됩니다.
                </>
              )}
            </div>
          </div>

          {/* 날짜 */}
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>날짜</div>
            <div className={styles.infoValue}>{formatDateRange()}</div>
          </div>

          {/* 게스트 */}
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>게스트</div>
            <div className={styles.infoValue}>
              {formatGuestSummary({
                adultOccupancy: adultCount,
                childOccupancy: childCount,
                infantOccupancy: infantCount,
                petOccupancy: petCount,
              })}
            </div>
          </div>

          {/* 요금 세부 정보 */}
          <div className={styles.priceDetails}>
            <div className={styles.priceDetailsTitle}>요금 세부 정보</div>
            <div className={styles.priceRow}>
              <span>
                {nights}박 x ₩{accommodation.base_price.toLocaleString()}
              </span>
              <span>₩{totalPrice.toLocaleString()}</span>
            </div>
            {couponDiscount > 0 && (
              <div className={styles.priceRow}>
                <span>{couponName || "쿠폰 할인"}</span>
                <span>-₩{couponDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className={styles.priceRow}>
              <span className={styles.totalLabel}>총액 KRW</span>
              <span className={styles.totalPrice}>
                ₩{payableAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            className={styles.reserveButton}
            onClick={handleReserve}
            disabled={!isTossReady || isProcessingPayment}
          >
            {!isTossReady
              ? "결제 시스템 로딩 중..."
              : isProcessingPayment
                ? "결제 진행 중..."
                : "확인 및 결제"}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </>
  );
};
