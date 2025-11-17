import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { accommodationApi } from "../../api";
import { AccommodationDetail } from "../../types/accommodation";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import { getImageUrl } from "../../utils/image";
import styles from "./ReservationConfirm.module.css";

declare global {
  interface Window {
    TossPayments: any;
  }
}

const ReservationConfirm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const [accommodation, setAccommodation] = useState<AccommodationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // URL 파라미터에서 예약 정보 가져오기
  const reservationUid = searchParams.get("reservationUid");
  const orderName = searchParams.get("orderName");
  const amount = searchParams.get("amount") ? parseInt(searchParams.get("amount")!) : null;
  const customerEmail = searchParams.get("customerEmail");
  const customerName = searchParams.get("customerName");
  
  // 예약 박스에서 입력한 정보
  const checkIn = searchParams.get("checkIn") ? new Date(searchParams.get("checkIn")!) : null;
  const checkOut = searchParams.get("checkOut") ? new Date(searchParams.get("checkOut")!) : null;
  const adultCount = searchParams.get("adultOccupancy") ? parseInt(searchParams.get("adultOccupancy")!) : 1;
  const childCount = searchParams.get("childOccupancy") ? parseInt(searchParams.get("childOccupancy")!) : 0;
  const infantCount = searchParams.get("infantOccupancy") ? parseInt(searchParams.get("infantOccupancy")!) : 0;
  const petCount = searchParams.get("petOccupancy") ? parseInt(searchParams.get("petOccupancy")!) : 0;

  useEffect(() => {
    const fetchAccommodation = async () => {
      if (!id) {
        navigate("/");
        return;
      }

      if (!reservationUid) {
        handleError(new Error("예약 정보가 없습니다."));
        navigate(`/accommodations/${id}`);
        return;
      }

      setIsLoading(true);
      clearError();

      try {
        const data = await accommodationApi.getDetail(parseInt(id));
        setAccommodation(data);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccommodation();
  }, [id, reservationUid, navigate, handleError, clearError]);

  useEffect(() => {
    // Toss Payments SDK 로드
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
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
    if (!isAuthenticated) {
      handleError(new Error("로그인이 필요합니다."));
      return;
    }

    if (!reservationUid || !orderName || !amount || !customerEmail || !customerName) {
      handleError(new Error("결제 정보가 올바르지 않습니다."));
      return;
    }

    setIsProcessingPayment(true);
    clearError();

    try {
      // Toss Payments 결제 진행
      if (!window.TossPayments) {
        throw new Error("결제 시스템을 불러올 수 없습니다. Toss Payments SDK가 로드되지 않았습니다.");
      }

      const tossClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;
      if (!tossClientKey) {
        throw new Error(
          "Toss Payments 클라이언트 키가 설정되지 않았습니다. " +
          ".env 파일에 REACT_APP_TOSS_CLIENT_KEY를 설정해주세요. " +
          "(예: REACT_APP_TOSS_CLIENT_KEY=test_ck_...)"
        );
      }

      const paymentWidget = window.TossPayments(tossClientKey);
      
      await paymentWidget.requestPayment({
        orderId: reservationUid,
        orderName: orderName,
        successUrl: `${window.location.origin}/reservations/${reservationUid}/success`,
        failUrl: `${window.location.origin}/reservations/${reservationUid}/fail`,
        customerEmail: customerEmail,
        customerName: customerName,
        amount: amount,
      }).catch((paymentError: any) => {
        // Toss Payments 에러 처리
        const errorCode = paymentError?.code || "";
        const errorMessage = paymentError?.message || "";
        
        // 사용자가 결제를 취소한 경우 - 에러 표시하지 않음
        if (errorCode === "USER_CANCEL" || errorMessage.includes("취소") || errorMessage.includes("USER_CANCEL")) {
          setIsProcessingPayment(false);
          return; // 에러를 throw하지 않고 조용히 종료
        }
        
        // 인증 관련 에러
        if (errorMessage.includes("인증") || errorMessage.includes("Unauthorized")) {
          throw new Error(
            "Toss Payments 클라이언트 키 인증에 실패했습니다. " +
            "클라이언트 키가 올바른지 확인해주세요. " +
            "샌드박스 환경에서는 'test_ck_'로 시작하는 키를 사용해야 합니다."
          );
        }
        
        // 결제 방법 선택 오류 (퀵계좌이체 등) - Toss Payments가 이미 모달로 표시하므로 에러 표시하지 않음
        if (errorCode === "BAD_REQUEST" || errorMessage.includes("계약 후 테스트")) {
          setIsProcessingPayment(false);
          return; // 에러를 throw하지 않고 조용히 종료
        }
        
        // 기타 에러는 표시
        throw paymentError;
      });
    } catch (err: any) {
      // catch 블록에 도달한 경우에만 에러 표시
      const errorMessage = err?.message || "결제 진행 중 오류가 발생했습니다.";
      handleError(new Error(errorMessage));
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className={styles.loading}>로딩 중...</div>
      </MainLayout>
    );
  }

  if (!accommodation) {
    return (
      <MainLayout>
        <div className={styles.error}>숙소 정보를 불러올 수 없습니다.</div>
      </MainLayout>
    );
  }

  const nights = calculateNights();
  const totalPrice = calculateTotalPrice();

  return (
    <MainLayout>
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>확인 및 결제</h1>

          {/* 숙소 정보 */}
          <div className={styles.accommodationInfo}>
            {accommodation.image_urls && accommodation.image_urls.length > 0 && (
              <img
                src={getImageUrl(accommodation.image_urls[0])}
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
            <div className={styles.priceRow}>
              <span className={styles.totalLabel}>총액 KRW</span>
              <span className={styles.totalPrice}>₩{totalPrice.toLocaleString()}</span>
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
    </MainLayout>
  );
};

export default ReservationConfirm;
