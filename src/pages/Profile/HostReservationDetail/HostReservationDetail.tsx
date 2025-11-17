import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "../../../layouts";
import { reservationApi } from "../../../api";
import { HostDetailInfo } from "../../../types/reservation";
import { ReservationStatus } from "../../../types/enums";
import { useApiError } from "../../../hooks/useApiError";
import { useAuth } from "../../../hooks/useAuth";
import { ErrorToast } from "../../../components/ErrorToast";
import { getImageUrl } from "../../../utils/image";
import styles from "./HostReservationDetail.module.css";

const HostReservationDetail: React.FC = () => {
  const { reservationUid } = useParams<{ reservationUid: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const [reservation, setReservation] = useState<HostDetailInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
        const response = await reservationApi.getHostReservationDetail(reservationUid);
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  };

  const formatStatus = (status: ReservationStatus): string => {
    switch (status) {
      case ReservationStatus.CONFIRMED:
        return "확정됨";
      case ReservationStatus.CANCELLED:
        return "취소됨";
      case ReservationStatus.PAYMENT_PENDING:
        return "결제 대기";
      case ReservationStatus.CANCELLATION_FAILED:
        return "취소 실패";
      case ReservationStatus.EXPIRED:
        return "만료됨";
      default:
        return status;
    }
  };

  const calculateNights = (checkIn: string, checkOut: string): number => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isAuthLoading || isLoading) {
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

  const nights = calculateNights(reservation.check_in_date_time, reservation.check_out_date_time);
  const totalAmount = reservation.payment_info?.total_amount || 0;
  const pricePerNight = nights > 0 ? Math.floor(totalAmount / nights) : 0;

  return (
    <MainLayout>
      <div className={styles.container}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ←
        </button>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.statusBadge}>{formatStatus(reservation.status)}</div>
            <div className={styles.guestName}>{reservation.guest_info.nickname}</div>
            <div className={styles.guestNights}>
              {reservation.guest_count}게스트 • {nights}박
              {reservation.payment_info && totalAmount > 0 && ` • ₩${totalAmount.toLocaleString()}`}
            </div>
          </div>
          {reservation.guest_info.profile_image_url ? (
            <img
              src={getImageUrl(reservation.guest_info.profile_image_url)}
              alt={reservation.guest_info.nickname}
              className={styles.profileImage}
            />
          ) : (
            <div className={styles.profileImagePlaceholder}>
              {reservation.guest_info.nickname.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Accommodation Info Section */}
        <section className={`${styles.section} ${styles.reservationSection}`}>
          <h3 className={styles.sectionTitle}>숙소 정보</h3>
          <div 
            className={styles.accommodationInfo}
            onClick={() => navigate(`/accommodations/${reservation.accommodation_id}`)}
          >
            {reservation.accommodation_thumbnail_url ? (
              <img
                src={getImageUrl(reservation.accommodation_thumbnail_url)}
                alt={reservation.accommodation_name}
                className={styles.accommodationThumbnail}
              />
            ) : (
              <div className={styles.accommodationThumbnailPlaceholder}>
                🏠
              </div>
            )}
            <div className={styles.accommodationDetails}>
              <div className={styles.accommodationInfoName}>{reservation.accommodation_name}</div>
              <div className={styles.accommodationInfoAddress}>{reservation.accommodation_address}</div>
            </div>
            <div className={styles.accommodationArrow}>→</div>
          </div>
        </section>

        {/* Reservation Details Section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>예약 정보</h3>
          <div className={styles.detailsList}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>게스트</span>
              <span className={styles.detailValue}>{reservation.guest_count}명</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>체크인</span>
              <span className={styles.detailValue}>{formatDate(reservation.check_in_date_time)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>체크아웃</span>
              <span className={styles.detailValue}>{formatDate(reservation.check_out_date_time)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>예약일</span>
              <span className={styles.detailValue}>{formatDate(reservation.created_at)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>예약 코드</span>
              <span className={styles.detailValue}>{reservation.reservation_code}</span>
            </div>
          </div>
        </section>

        {/* Fee Details Section */}
        {reservation.payment_info && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>요금 세부 정보</h3>
            <div className={styles.feeDetails}>
              <div className={styles.feeItem}>
                <span className={styles.feeLabel}>
                  {nights}박 x ₩{pricePerNight.toLocaleString()}
                </span>
                <span className={styles.feeValue}>₩{totalAmount.toLocaleString()}</span>
              </div>
              <div className={styles.feeSeparator}></div>
              <div className={styles.feeTotal}>
                <span className={styles.feeTotalLabel}>총액 KRW</span>
                <span className={styles.feeTotalValue}>₩{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </section>
        )}
      </div>

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </MainLayout>
  );
};

export default HostReservationDetail;

