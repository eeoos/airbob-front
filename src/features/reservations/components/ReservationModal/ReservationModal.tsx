import React from "react";
import type { ReservationModalAccommodationViewModel } from "../../lib/reservationModalViewModel";
import { useApiError } from "../../../../hooks/useApiError";
import { useAuth } from "../../../../hooks/useAuth";
import { useReservationPayment } from "../../hooks/useReservationPayment";
import { Button, Dialog } from "../../../../shared/ui";
import { ErrorToast } from "../../../../components/ErrorToast";
import { getImageUrl } from "../../../../utils/image";
import styles from "./ReservationModal.module.css";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accommodation: ReservationModalAccommodationViewModel;
  checkIn: Date | null;
  checkOut: Date | null;
  adultCount: number;
  childCount: number;
  infantCount: number;
  petCount: number;
  onDateChange?: () => void;
  onGuestChange?: () => void;
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
  const { isAuthenticated } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const {
    isLoading,
    startReservationPayment: startReservationCheckout,
  } = useReservationPayment({
    clearError,
    handleError,
  });

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
    return accommodation.basePrice * nights;
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

    if (!propCheckIn || !propCheckOut) {
      return;
    }

    await startReservationCheckout({
      accommodationId: accommodation.id,
      checkIn: propCheckIn,
      checkOut: propCheckOut,
      adultCount: propAdultCount,
      childCount: propChildCount,
      infantCount: propInfantCount,
      petCount: propPetCount,
    });
  };

  if (!isOpen) return null;

  const nights = calculateNights();
  const totalPrice = calculateTotalPrice();

  return (
    <Dialog
      isOpen={isOpen}
      title="예약 확인"
      onClose={onClose}
      className={styles.dialog}
      bodyClassName={styles.content}
    >
          {/* 숙소 정보 */}
          <div className={styles.accommodationInfo}>
            {accommodation.primaryImageUrl && (
              <img
                src={getImageUrl(accommodation.primaryImageUrl)}
                alt={accommodation.name}
                className={styles.accommodationImage}
              />
            )}
            <div className={styles.accommodationDetails}>
              <h3 className={styles.accommodationTitle}>{accommodation.name}</h3>
              {accommodation.rating.reviewCount > 0 && (
                <div className={styles.accommodationRating}>
                  <span className={styles.star}>★</span>
                  <span>{accommodation.rating.averageRating.toFixed(2)}</span>
                  <span className={styles.reviewCount}>(후기 {accommodation.rating.reviewCount}개)</span>
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
              <span>{nights}박 x ₩{accommodation.basePrice.toLocaleString()}</span>
              <span>₩{totalPrice.toLocaleString()}</span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.totalLabel}>총액 KRW</span>
              <span className={styles.totalPrice}>₩{totalPrice.toLocaleString()}</span>
            </div>
            <button className={styles.priceDetailsLink}>요금 상세 내역</button>
          </div>

          <Button
            className={styles.reserveButton}
            onClick={handleReserve}
            disabled={isLoading || !propCheckIn || !propCheckOut}
            isLoading={isLoading}
            loadingLabel="예약 생성 중..."
          >
            확인 및 결제
          </Button>
      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </Dialog>
  );
};

export default ReservationModal;
