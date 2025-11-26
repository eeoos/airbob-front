import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { reservationApi } from "../../../api";
import { HostReservationInfo } from "../../../types/reservation";
import { ReservationStatus } from "../../../types/enums";
import { useApiError } from "../../../hooks/useApiError";
import { ErrorToast } from "../../../components/ErrorToast";
import styles from "./HostReservations.module.css";

interface HostReservationsProps {
  filterType: "UPCOMING" | "PAST" | "CANCELLED";
  onFilterChange: (filterType: "UPCOMING" | "PAST" | "CANCELLED") => void;
}

const HostReservations: React.FC<HostReservationsProps> = ({ filterType, onFilterChange }) => {
  const navigate = useNavigate();
  const { error, handleError, clearError } = useApiError();
  const [reservations, setReservations] = useState<HostReservationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [sortBy, setSortBy] = useState<"check_in" | "check_out" | "created_at">("check_in");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReservations = async () => {
      setIsLoading(true);
      clearError();
      setReservations([]);
      setCursor(null);
      setHasNext(false);

      try {
        const response = await reservationApi.getHostReservations({ 
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
      const response = await reservationApi.getHostReservations({ 
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
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

  const getStatusClass = (status: ReservationStatus): string => {
    switch (status) {
      case ReservationStatus.CONFIRMED:
        return styles.statusConfirmed;
      case ReservationStatus.CANCELLED:
        return styles.statusCancelled;
      default:
        return styles.statusDefault;
    }
  };

  const formatPrice = (price: number | null): string => {
    if (price === null) return "-";
    return `₩${price.toLocaleString()}`;
  };

  const handleSort = (column: "check_in" | "check_out" | "created_at") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const sortedReservations = [...reservations].sort((a, b) => {
    let aValue: string;
    let bValue: string;
    
    if (sortBy === "check_in") {
      aValue = a.check_in_date;
      bValue = b.check_in_date;
    } else if (sortBy === "check_out") {
      aValue = a.check_out_date;
      bValue = b.check_out_date;
    } else {
      aValue = a.created_at;
      bValue = b.created_at;
    }
    
    if (sortOrder === "asc") {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  if (isLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>예약 관리</h2>
      <div className={styles.filterTabs}>
        <button
          className={`${styles.filterTab} ${filterType === "UPCOMING" ? styles.active : ""}`}
          onClick={() => onFilterChange("UPCOMING")}
        >
          예정된 예약
        </button>
        <button
          className={`${styles.filterTab} ${filterType === "PAST" ? styles.active : ""}`}
          onClick={() => onFilterChange("PAST")}
        >
          완료된 예약
        </button>
        <button
          className={`${styles.filterTab} ${filterType === "CANCELLED" ? styles.active : ""}`}
          onClick={() => onFilterChange("CANCELLED")}
        >
          취소된 예약
        </button>
      </div>

      {reservations.length === 0 ? (
        <div className={styles.empty}>
          <p>아직 예약이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>상태</th>
                  <th className={styles.th}>게스트</th>
                  <th 
                    className={`${styles.th} ${styles.sortable}`}
                    onClick={() => handleSort("check_in")}
                  >
                    체크인
                    {sortBy === "check_in" && (
                      <span className={styles.sortIcon}>
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </th>
                  <th className={styles.th}>체크아웃</th>
                  <th className={styles.th}>예약일</th>
                  <th className={styles.th}>숙소</th>
                  <th className={styles.th}>예약 코드</th>
                  <th className={styles.th}>총액</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {sortedReservations.map((reservation) => (
                  <tr key={reservation.reservation_uid} className={styles.tableRow}>
                    <td className={styles.td}>
                      <span className={`${styles.status} ${getStatusClass(reservation.status)}`}>
                        {formatStatus(reservation.status)}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.guestInfo}>
                        <div className={styles.guestName}>{reservation.guest.nickname}</div>
                        <div className={styles.guestCount}>{reservation.guest_count}명</div>
                      </div>
                    </td>
                    <td className={styles.td}>{formatDate(reservation.check_in_date)}</td>
                    <td className={styles.td}>{formatDate(reservation.check_out_date)}</td>
                    <td className={styles.td}>{formatDate(reservation.created_at)}</td>
                    <td className={styles.td}>{reservation.accommodation.name}</td>
                    <td className={styles.td}>
                      {reservation.reservation_code || "-"}
                    </td>
                    <td className={styles.td}>{formatPrice(reservation.total_price)}</td>
                    <td className={styles.td}>
                      <button
                        className={styles.detailsButton}
                        onClick={() => navigate(`/profile/host/reservations/${reservation.reservation_uid}`)}
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

export default HostReservations;
