import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useApiError } from "../../hooks/useApiError";
import { useReservationConfirmAccommodation } from "../../features/reservations/hooks/useReservationConfirmAccommodation";
import { readReservationCheckoutState } from "../../features/reservations/lib/reservationCheckoutState";
import {
  ensureTossPaymentsScript,
  getTossClientKey,
  getTossPaymentsClient,
  shouldSilentlyResetPayment,
  toReservationPaymentError,
} from "../../features/reservations/lib/tossPayments";
import { ErrorToast } from "../../components/ErrorToast";
import { getImageUrl } from "../../utils/image";
import { routeTo } from "../../routes/paths";
import styles from "./ReservationConfirm.module.css";

const parseCheckoutDate = (dateString?: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString ?? "");
  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const ReservationConfirm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { error, handleError, clearError } = useApiError();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const checkoutState = id
    ? readReservationCheckoutState(id, location.state)
    : null;
  const reservationUid = checkoutState?.reservationUid ?? null;
  const orderName = checkoutState?.orderName ?? null;
  const amount = checkoutState?.amount ?? null;
  const customerEmail = checkoutState?.customerEmail ?? null;
  const customerName = checkoutState?.customerName ?? null;
  const couponName = checkoutState?.couponName ?? null;
  const couponDiscountParam = checkoutState?.couponDiscount ?? null;

  // 예약 박스에서 입력한 정보
  const checkIn = parseCheckoutDate(checkoutState?.checkIn);
  const checkOut = parseCheckoutDate(checkoutState?.checkOut);
  const adultCount = checkoutState?.adultOccupancy ?? 1;
  const childCount = checkoutState?.childOccupancy ?? 0;
  const infantCount = checkoutState?.infantOccupancy ?? 0;
  const petCount = checkoutState?.petOccupancy ?? 0;

  const { accommodation, isLoading } = useReservationConfirmAccommodation({
    accommodationId: id,
    reservationUid,
    navigate,
    handleError,
    clearError,
  });

  useEffect(() => {
    ensureTossPaymentsScript();
  }, []);

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

  const calculateNights = (): number => {
    if (!checkIn || !checkOut) return 0;
    const diffTime = checkOut.getTime() - checkIn.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const calculateTotalPrice = (): number => {
    if (!accommodation) return 0;
    const nights = calculateNights();
    return accommodation.base_price * nights;
  };

  const getGuestText = (): string => {
    const guestCount = adultCount + childCount;
    const parts: string[] = [];
    
    if (guestCount > 0) {
      parts.push(`성인 ${guestCount}명`);
    }
    if (infantCount > 0) {
      parts.push(`유아 ${infantCount}명`);
    }
    if (petCount > 0) {
      parts.push(`반려동물 ${petCount}마리`);
    }
    
    return parts.length > 0 ? parts.join(", ") : "성인 1명";
  };

  const handleReserve = async () => {
    if (!reservationUid || !orderName || amount == null || !customerEmail || !customerName) {
      handleError(new Error("결제 정보가 올바르지 않습니다."));
      return;
    }

    setIsProcessingPayment(true);
    clearError();

    try {
      const paymentWidget = getTossPaymentsClient(getTossClientKey());
      
      await paymentWidget.requestPayment({
        orderId: reservationUid,
        orderName: orderName,
        successUrl: `${window.location.origin}${routeTo.paymentSuccess(reservationUid)}`,
        failUrl: `${window.location.origin}${routeTo.paymentFail(reservationUid)}`,
        customerEmail: customerEmail,
        customerName: customerName,
        amount: amount,
      }).catch((paymentError: unknown) => {
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

  const nights = calculateNights();
  const totalPrice = calculateTotalPrice();
  const responseDiscount = amount == null ? 0 : Math.max(totalPrice - amount, 0);
  const couponDiscount = responseDiscount > 0 ? responseDiscount : couponDiscountParam ?? 0;
  const payableAmount = amount ?? totalPrice;

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
                  <span className={styles.reviewCount}>(후기 {accommodation.review_summary.total_count}개)</span>
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
                  {new Date(checkIn.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}까지 예약을 취소하면 요금 전액이 환불됩니다.
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
            <div className={styles.infoValue}>{getGuestText()}</div>
          </div>

          {/* 요금 세부 정보 */}
          <div className={styles.priceDetails}>
            <div className={styles.priceDetailsTitle}>요금 세부 정보</div>
            <div className={styles.priceRow}>
              <span>{nights}박 x ₩{accommodation.base_price.toLocaleString()}</span>
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
              <span className={styles.totalPrice}>₩{payableAmount.toLocaleString()}</span>
            </div>
          </div>

          <button
            className={styles.reserveButton}
            onClick={handleReserve}
            disabled={isProcessingPayment}
          >
            {isProcessingPayment
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

export default ReservationConfirm;
