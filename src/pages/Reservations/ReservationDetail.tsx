import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { reservationApi } from "../../api";
import { ReservationDetailInfo } from "../../types/reservation";
import { ReservationStatus, PaymentStatus } from "../../types/enums";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import { getImageUrl } from "../../utils/image";
import { GOOGLE_MAPS_API_KEY } from "../../utils/constants";
import styles from "./ReservationDetail.module.css";

const ReservationDetail: React.FC = () => {
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const [reservation, setReservation] = useState<ReservationDetailInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    // 인증 상태가 로드될 때까지 대기
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    if (!reservationUid) {
      navigate("/profile");
      return;
    }

    const fetchReservation = async () => {
      setIsLoading(true);
      clearError();

      try {
        const response = await reservationApi.getMyReservationDetail(reservationUid);
        if (response.success && response.data) {
          setReservation(response.data);
        } else {
          navigate("/profile");
        }
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservation();
  }, [reservationUid, isAuthenticated, isAuthLoading, navigate, handleError, clearError]);

  const isCompleted = (checkOutDateTime: string, checkOutTime: string): boolean => {
    const now = new Date();
    const checkout = new Date(checkOutDateTime);
    
    // 체크아웃 날짜 추출 (시간 제외)
    const checkoutDate = new Date(checkout.getFullYear(), checkout.getMonth(), checkout.getDate());
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 체크아웃 날짜가 지났으면 true
    if (checkoutDate < todayDate) {
      return true;
    }
    
    // 체크아웃 날짜가 오늘이면, 체크아웃 시간이 지났는지 확인
    if (checkoutDate.getTime() === todayDate.getTime()) {
      const [hours, minutes] = checkOutTime.split(':').map(Number);
      const checkoutTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      return checkoutTime < now;
    }
    
    // 체크아웃 날짜가 미래면 false
    return false;
  };

  const canCancel = (status: ReservationStatus): boolean => {
    return status === ReservationStatus.CONFIRMED || status === ReservationStatus.PAYMENT_PENDING;
  };

  const handleReviewClick = () => {
    if (reservation) {
      navigate(`/reservations/${reservation.reservation_uid}/review`);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateWithWeekday = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = date.toLocaleDateString("ko-KR", { weekday: "short" });
    return `${month}월 ${day}일 (${weekday})`;
  };

  const formatTime = (timeString: string): string => {
    // timeString은 "HH:mm" 형식
    const [hours, minutes] = timeString.split(':').map(Number);
    const hour12 = hours % 12 || 12;
    const ampm = hours < 12 ? '오전' : '오후';
    return `${ampm} ${hour12}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBankName = (bankCode: string): string => {
    const bankMap: { [key: string]: string } = {
      "20": "우리은행",
      "88": "신한은행",
      "04": "KB국민은행",
      "03": "기업은행",
      "11": "NH농협은행",
      "23": "SC제일은행",
      "27": "한국씨티은행",
      "07": "수협은행",
      "37": "전북은행",
      "39": "경남은행",
      "34": "광주은행",
      "32": "부산은행",
      "45": "새마을금고",
      "48": "신협",
      "50": "저축은행",
      "71": "우체국",
      "81": "하나은행",
      "89": "케이뱅크",
      "90": "카카오뱅크",
      "92": "토스뱅크",
    };
    return bankMap[bankCode] || `은행코드 ${bankCode}`;
  };

  // 인증 상태가 로드 중이거나 인증되지 않은 경우
  if (isAuthLoading || !isAuthenticated) {
    if (isAuthLoading) {
      return (
        <MainLayout>
          <div className={styles.loading}>로딩 중...</div>
        </MainLayout>
      );
    }
    return null;
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className={styles.loading}>로딩 중...</div>
      </MainLayout>
    );
  }

  if (!reservation) {
    return (
      <MainLayout>
        <div className={styles.error}>예약을 찾을 수 없습니다.</div>
      </MainLayout>
    );
  }

  const completed = isCompleted(reservation.check_out_date_time, reservation.check_out_time);
  const canReview = completed && reservation.status === ReservationStatus.CONFIRMED && reservation.can_write_review;
  const isVirtualAccountPending = 
    reservation.payment?.virtual_account && 
    reservation.payment.status === PaymentStatus.WAITING_FOR_DEPOSIT;
  const isPaymentCompleted = reservation.payment?.status === PaymentStatus.DONE;

  return (
    <MainLayout>
      <div className={styles.container}>
        <button className={styles.backButton} onClick={() => navigate("/profile")}>
          ← 돌아가기
        </button>

        <div className={styles.content}>
          <div className={styles.mainContent}>
            {/* 숙소 정보 섹션 */}
            <section className={styles.section}>
              <button 
                className={styles.backButtonOnImage}
                onClick={() => navigate(-1)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <div className={styles.accommodationCard}>
                {reservation.accommodation.thumbnail_url && (
                  <img
                    src={getImageUrl(reservation.accommodation.thumbnail_url)}
                    alt={reservation.accommodation.name}
                    className={styles.accommodationImage}
                  />
                )}
                <div className={styles.accommodationInfo}>
                  <p className={styles.accommodationAddress}>
                    {[
                      reservation.address.country,
                      reservation.address.state,
                      reservation.address.city,
                      reservation.address.district,
                      reservation.address.street,
                      reservation.address.detail,
                    ].filter(Boolean).join(" ")}
                  </p>
                  <div className={styles.hostInfo}>
                    <span className={styles.hostLabel}>호스트:</span>
                    <span className={styles.hostName}>{reservation.host.nickname} 님</span>
                  </div>
                  <div className={styles.dateInfo}>
                    <div className={styles.dateItem}>
                      <span className={styles.dateLabel}>체크인</span>
                      <div className={styles.dateValue}>
                        <span>{formatDateWithWeekday(reservation.check_in_date_time)}</span>
                        <span className={styles.timeValue}>{formatTime(reservation.check_in_time)}</span>
                      </div>
                    </div>
                    <div className={styles.dateItem}>
                      <span className={styles.dateLabel}>체크아웃</span>
                      <div className={styles.dateValue}>
                        <span>{formatDateWithWeekday(reservation.check_out_date_time)}</span>
                        <span className={styles.timeValue}>{formatTime(reservation.check_out_time)}</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={styles.accommodationBox}
                    onClick={() => navigate(`/accommodations/${reservation.accommodation.id}`)}
                  >
                    <div className={styles.accommodationBoxContent}>
                      <span>숙소로 이동하기</span>
                      <span className={styles.accommodationBoxArrow}> &gt; </span>
                    </div>
                  </div>
                  {canReview && (
                    <div
                      className={styles.accommodationBox}
                      onClick={() => navigate(`/reservations/${reservation.reservation_uid}/review`)}
                    >
                      <div className={styles.accommodationBoxContent}>
                        <span>리뷰 작성하기</span>
                        <span className={styles.accommodationBoxArrow}> &gt; </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 예약 정보 섹션 */}
            <section className={styles.section}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>예약 세부정보</h2>
                <span className={`${styles.status} ${styles[reservation.status.toLowerCase()]}`}>
                  {reservation.status === ReservationStatus.CONFIRMED && "확정됨"}
                  {reservation.status === ReservationStatus.PAYMENT_PENDING && "결제 대기"}
                  {reservation.status === ReservationStatus.CANCELLED && "취소됨"}
                  {reservation.status === ReservationStatus.CANCELLATION_FAILED && "취소 실패"}
                  {reservation.status === ReservationStatus.EXPIRED && "만료됨"}
                </span>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>게스트</span>
                  <span className={styles.infoValue}>게스트 {reservation.guest_count}명</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>예약 코드</span>
                  <span className={styles.infoValue}>{reservation.reservation_code}</span>
                </div>
              </div>
            </section>

            {/* 호스트 정보 섹션 */}
            <section className={styles.section}>
              <div className={styles.hostSection}>
                <div className={styles.hostAvatar}>
                  {reservation.host.thumbnail_image_url ? (
                    <img
                      src={getImageUrl(reservation.host.thumbnail_image_url)}
                      alt={reservation.host.nickname}
                      className={styles.hostAvatarImage}
                    />
                  ) : (
                    <span className={styles.hostAvatarInitial}>
                      {reservation.host.nickname.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className={styles.hostText}>
                  호스트: {reservation.host.nickname} 님
                </div>
              </div>
            </section>

            {/* 결제 정보 섹션 */}
            {reservation.payment && (
              <section className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <h2 className={styles.sectionTitle}>결제 정보</h2>
                  <span
                    className={`${styles.paymentStatus} ${
                      isPaymentCompleted
                        ? styles.paid
                        : isVirtualAccountPending
                        ? styles.waiting
                        : styles.pending
                    }`}
                  >
                    {isPaymentCompleted && "결제 완료"}
                    {isVirtualAccountPending && "입금 대기"}
                    {reservation.payment.status === PaymentStatus.READY && "결제 대기"}
                    {reservation.payment.status === PaymentStatus.IN_PROGRESS && "결제 진행 중"}
                    {reservation.payment.status === PaymentStatus.CANCELED && "결제 취소"}
                    {reservation.payment.status === PaymentStatus.EXPIRED && "결제 만료"}
                  </span>
                </div>
                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>결제 방법</span>
                    <span className={styles.infoValue}>{reservation.payment.method}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>결제 금액</span>
                    <span className={styles.infoValue}>
                      ₩{reservation.payment.total_amount.toLocaleString()}
                    </span>
                  </div>
                  {reservation.payment.approved_at && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>결제 일시</span>
                      <span className={styles.infoValue}>
                        {formatDateTime(reservation.payment.approved_at)}
                      </span>
                    </div>
                  )}
                  
                  {/* 가상계좌 정보 (미입금 상태일 때만 표시) */}
                  {isVirtualAccountPending && reservation.payment.virtual_account && (
                    <div className={styles.virtualAccountSection}>
                      <h3 className={styles.virtualAccountTitle}>가상계좌 입금 정보</h3>
                      <div className={styles.virtualAccountInfo}>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>은행</span>
                          <span className={styles.virtualAccountValue}>
                            {getBankName(reservation.payment.virtual_account.bank_code)}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>계좌번호</span>
                          <span className={styles.virtualAccountValue}>
                            {reservation.payment.virtual_account.account_number}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>예금주</span>
                          <span className={styles.virtualAccountValue}>
                            {reservation.payment.virtual_account.customer_name}
                          </span>
                        </div>
                        <div className={styles.virtualAccountItem}>
                          <span className={styles.virtualAccountLabel}>입금 기한</span>
                          <span className={styles.virtualAccountValue}>
                            {formatDateTime(reservation.payment.virtual_account.due_date)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.virtualAccountNotice}>
                        <p>위 가상계좌로 입금 기한 내에 입금해주세요.</p>
                        <p>입금이 확인되면 예약이 확정됩니다.</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* 오른쪽 섹션 - 지도 */}
          <div className={styles.rightSection}>
            <div className={styles.mapContainer}>
              {GOOGLE_MAPS_API_KEY && reservation.coordinate.latitude && reservation.coordinate.longitude ? (
                <iframe
                  className={styles.map}
                  title="숙소 위치"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${reservation.coordinate.latitude},${reservation.coordinate.longitude}&zoom=15`}
                />
              ) : (
                <div className={styles.mapPlaceholder}>
                  지도를 불러올 수 없습니다.
                </div>
              )}
            </div>
          </div>
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

export default ReservationDetail;
