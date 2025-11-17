import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { reservationApi } from "../../../api";
import { MyReservationInfo } from "../../../types/reservation";
import { useApiError } from "../../../hooks/useApiError";
import { ErrorToast } from "../../../components/ErrorToast";
import { getImageUrl } from "../../../utils/image";
import styles from "./GuestTrips.module.css";

interface GuestTripsProps {
  filterType: "UPCOMING" | "PAST" | "CANCELLED";
}

const GuestTrips: React.FC<GuestTripsProps> = ({ filterType }) => {
  const navigate = useNavigate();
  const { error, handleError, clearError } = useApiError();
  const [reservations, setReservations] = useState<MyReservationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReservations = async () => {
      setIsLoading(true);
      clearError();
      setReservations([]);
      setCursor(null);
      setHasNext(false);

      try {
        const response = await reservationApi.getMyReservations({ 
          size: 20, 
          filterType: filterType || "UPCOMING" 
        });
        if (response.success && response.data) {
          setReservations(response.data.reservations);
          setCursor(response.data.page_info.next_cursor);
          setHasNext(response.data.page_info.has_next);
        }
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleLoadMore = useCallback(async () => {
    if (!hasNext || isLoadingMore || !cursor) return;

    setIsLoadingMore(true);
    clearError();

    try {
      const response = await reservationApi.getMyReservations({ 
        size: 20, 
        cursor, 
        filterType: filterType || "UPCOMING" 
      });
      if (response.success && response.data) {
        setReservations((prev) => [...prev, ...response.data!.reservations]);
        setCursor(response.data!.page_info.next_cursor);
        setHasNext(response.data!.page_info.has_next);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasNext, isLoadingMore, cursor, filterType, clearError, handleError]);

  // Intersection Observer를 사용한 무한 스크롤
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNext, isLoadingMore, handleLoadMore]);

  const handleReviewClick = (reservationUid: string) => {
    navigate(`/reservations/${reservationUid}/review`);
  };

  const isCompleted = (checkOutDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(checkOutDate);
    checkout.setHours(0, 0, 0, 0);
    return checkout < today;
  };

  if (isLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  const getTitle = () => {
    switch (filterType) {
      case "UPCOMING":
        return "다가올 여행";
      case "PAST":
        return "이전 여행";
      case "CANCELLED":
        return "취소된 여행";
      default:
        return "이전 여행";
    }
  };

  // 연도별로 예약 그룹화
  const groupReservationsByYear = (reservations: MyReservationInfo[]) => {
    const grouped: { [year: number]: MyReservationInfo[] } = {};
    reservations.forEach((reservation) => {
      const year = new Date(reservation.check_in_date).getFullYear();
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(reservation);
    });
    // 연도 내림차순 정렬
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => b - a)
      .map((year) => ({ year, reservations: grouped[year] }));
  };

  const formatDateRange = (checkIn: string, checkOut: string): string => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    const checkInYear = checkInDate.getFullYear();
    const checkInMonth = checkInDate.getMonth() + 1;
    const checkInDay = checkInDate.getDate();
    
    const checkOutMonth = checkOutDate.getMonth() + 1;
    const checkOutDay = checkOutDate.getDate();
    
    // 같은 연도, 같은 월인 경우
    if (checkInYear === checkOutDate.getFullYear() && checkInMonth === checkOutMonth) {
      return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutDay}일`;
    }
    // 같은 연도, 다른 월인 경우
    if (checkInYear === checkOutDate.getFullYear()) {
      return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutMonth}월 ${checkOutDay}일`;
    }
    // 다른 연도인 경우
    return `${checkInYear}년 ${checkInMonth}월 ${checkInDay}일 ~ ${checkOutDate.getFullYear()}년 ${checkOutMonth}월 ${checkOutDay}일`;
  };

  const groupedReservations = groupReservationsByYear(reservations);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{getTitle()}</h2>

      {reservations.length === 0 ? (
        <div className={styles.empty}>
          <p>아직 예약한 여행이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className={styles.reservationsByYear}>
            {groupedReservations.map(({ year, reservations: yearReservations }) => (
              <div key={year} className={styles.yearSection}>
                <h3 className={styles.yearTitle}>{year}</h3>
                <div className={styles.reservationsGrid}>
                  {yearReservations.map((reservation) => {
                    const completed = isCompleted(reservation.check_out_date);
                    return (
                      <div
                        key={reservation.reservation_id}
                        className={styles.reservationCard}
                        onClick={() => navigate(`/reservations/${reservation.reservation_uid}`)}
                      >
                        <div className={styles.image}>
                          {reservation.accommodation_thumbnail_url ? (
                            <img
                              src={getImageUrl(reservation.accommodation_thumbnail_url)}
                              alt={reservation.accommodation_name}
                            />
                          ) : (
                            <div className={styles.placeholder}>🏠</div>
                          )}
                        </div>
                        <div className={styles.content}>
                          <div className={styles.location}>
                            {reservation.accommodation_location}
                          </div>
                          <div className={styles.dateRange}>
                            {formatDateRange(reservation.check_in_date, reservation.check_out_date)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hasNext && (
            <div ref={observerTarget} className={styles.loadMoreContainer}>
              {isLoadingMore && (
                <div className={styles.loadingMore}>로딩 중...</div>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}
    </div>
  );
};

export default GuestTrips;
