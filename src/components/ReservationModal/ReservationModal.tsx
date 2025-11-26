import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { reservationApi, paymentApi } from "../../api";
import { AccommodationDetail } from "../../types/accommodation";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../ErrorToast";
import { getImageUrl } from "../../utils/image";
import styles from "./ReservationModal.module.css";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accommodation: AccommodationDetail;
  checkIn: Date | null;
  checkOut: Date | null;
  adultCount: number;
  childCount: number;
  infantCount: number;
  petCount: number;
  onDateChange?: () => void;
  onGuestChange?: () => void;
}

declare global {
  interface Window {
    TossPayments: any;
  }
}

const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  accommodation,
  checkIn: propCheckIn,
  checkOut: propCheckOut,
  adultCount: propAdultCount,
  childCount: propChildCount,
  infantCount: propInfantCount,
  petCount: propPetCount,
  onDateChange,
  onGuestChange,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    // Toss Payments SDK 로드
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const formatDateForDisplay = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  const formatDateRange = (): string => {
    if (!propCheckIn || !propCheckOut) return "";
    const start = formatDateForDisplay(propCheckIn);
    const end = formatDateForDisplay(propCheckOut);
    return `${start}~${end.split("일")[0]}일`;
  };

  const calculateNights = (): number => {
    if (!propCheckIn || !propCheckOut) return 0;
    const diffTime = propCheckOut.getTime() - propCheckIn.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const calculateTotalPrice = (): number => {
    const nights = calculateNights();
    return accommodation.base_price * nights;
  };

  const getGuestText = (): string => {
    const guestCount = propAdultCount + propChildCount;
    const parts: string[] = [];
    
    if (guestCount > 0) {
      parts.push(`성인 ${guestCount}명`);
    }
    if (propInfantCount > 0) {
      parts.push(`유아 ${propInfantCount}명`);
    }
    if (propPetCount > 0) {
      parts.push(`반려동물 ${propPetCount}마리`);
    }
    
    return parts.length > 0 ? parts.join(", ") : "성인 1명";
  };

  const validateDates = (): boolean => {
    if (!propCheckIn || !propCheckOut) {
      handleError(new Error("체크인/체크아웃 날짜를 선택해주세요."));
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(propCheckIn);
    checkInDate.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      handleError(new Error("체크인 날짜는 오늘 이후여야 합니다."));
      return false;
    }

    if (propCheckOut <= propCheckIn) {
      handleError(new Error("체크아웃 날짜는 체크인 날짜보다 이후여야 합니다."));
      return false;
    }

    return true;
  };

  const handleReserve = async () => {
    if (!isAuthenticated) {
      handleError(new Error("로그인이 필요합니다."));
      return;
    }

    if (!validateDates()) {
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      // 예약 생성
      const checkInStr = propCheckIn ? formatDateForUrl(propCheckIn) : "";
      const checkOutStr = propCheckOut ? formatDateForUrl(propCheckOut) : "";
      const guestCount = propAdultCount + propChildCount;
      
      const reservationResponse = await reservationApi.create({
        accommodation_id: accommodation.id,
        check_in_date: checkInStr,
        check_out_date: checkOutStr,
        guest_count: guestCount,
      });

      const { reservation_uid, order_name, amount, customer_email, customer_name } =
        reservationResponse;

      // Toss Payments 결제 진행
      if (!window.TossPayments) {
        throw new Error("결제 시스템을 불러올 수 없습니다.");
      }

      setIsProcessingPayment(true);

      const tossClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;
      if (!tossClientKey) {
        throw new Error("결제 설정이 올바르지 않습니다.");
      }

      const paymentWidget = window.TossPayments(tossClientKey);
      const paymentMethodsWidget = paymentWidget.widgets({
        customerKey: customer_email,
      });

      await paymentMethodsWidget.renderPaymentMethods(
        "#payment-widget",
        { value: amount },
        { variantKey: "DEFAULT" }
      );

      paymentWidget.requestPayment({
        orderId: reservation_uid,
        orderName: order_name,
        successUrl: `${window.location.origin}/reservations/${reservation_uid}/success`,
        failUrl: `${window.location.origin}/reservations/${reservation_uid}/fail`,
        customerEmail: customer_email,
        customerName: customer_name,
        amount,
      });
    } catch (err) {
      handleError(err);
      setIsLoading(false);
      setIsProcessingPayment(false);
    }
  };

  const formatDateForUrl = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (!isOpen) return null;

  const nights = calculateNights();
  const totalPrice = calculateTotalPrice();

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div className={styles.content}>
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
              {propCheckIn && (
                <>
                  {new Date(propCheckIn.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}까지 예약을 취소하면 요금 전액이 환불됩니다.
                </>
              )}
            </div>
            <button className={styles.policyLink}>환불 정책 전문</button>
            </div>

          {/* 날짜 */}
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>날짜</div>
            <div className={styles.infoValue}>{formatDateRange()}</div>
            {onDateChange && (
              <button className={styles.changeButton} onClick={onDateChange}>
                변경
                </button>
            )}
            </div>

          {/* 게스트 */}
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>게스트</div>
            <div className={styles.infoValue}>{getGuestText()}</div>
            {onGuestChange && (
              <button className={styles.changeButton} onClick={onGuestChange}>
                변경
              </button>
            )}
          </div>

          {/* 요금 세부 정보 */}
          <div className={styles.priceDetails}>
            <div className={styles.priceDetailsTitle}>요금 세부 정보</div>
            <div className={styles.priceRow}>
              <span>{nights}박 x ₩{accommodation.base_price.toLocaleString()}</span>
              <span>₩{totalPrice.toLocaleString()}</span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.totalLabel}>총액 KRW</span>
              <span className={styles.totalPrice}>₩{totalPrice.toLocaleString()}</span>
            </div>
            <button className={styles.priceDetailsLink}>요금 상세 내역</button>
          </div>

          {isProcessingPayment && (
            <div id="payment-widget" className={styles.paymentWidget}></div>
          )}

          <button
            className={styles.reserveButton}
            onClick={handleReserve}
            disabled={isLoading || isProcessingPayment || !propCheckIn || !propCheckOut}
          >
            {isProcessingPayment
              ? "결제 진행 중..."
              : isLoading
              ? "예약 생성 중..."
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

export default ReservationModal;


