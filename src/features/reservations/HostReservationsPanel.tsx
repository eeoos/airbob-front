import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { routeTo } from "../../routes/paths";
import { EmptyState, LoadingState } from "../../shared/ui";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
import { useHostReservations } from "./hooks";
import {
  formatReservationStatus,
  getReservationStatusTone,
} from "./lib/reservationStatusDisplay";
import { formatKoreanDate, formatNullablePrice } from "./lib/reservationDateDisplay";
import {
  getNextHostReservationSort,
  HostReservationSortColumn,
  HostReservationSortOrder,
  sortHostReservations,
} from "./lib/hostReservationSort";
import styles from "./HostReservationsPanel.module.css";

export interface HostReservationsPanelProps {
  filterType: "UPCOMING" | "PAST" | "CANCELLED";
  onFilterChange: (filterType: "UPCOMING" | "PAST" | "CANCELLED") => void;
}

const statusClassByTone = {
  success: styles.statusConfirmed,
  warning: styles.statusDefault,
  danger: styles.statusCancelled,
  neutral: styles.statusDefault,
} as const;

export const HostReservationsPanel: React.FC<HostReservationsPanelProps> = ({
  filterType,
  onFilterChange,
}) => {
  const navigate = useNavigate();
  const {
    clearError,
    error,
    hasNext,
    isLoading,
    isLoadingMore,
    loadMore,
    reservations,
  } = useHostReservations(filterType);
  const [sortBy, setSortBy] = useState<HostReservationSortColumn>("check_in");
  const [sortOrder, setSortOrder] = useState<HostReservationSortOrder>("desc");
  const observerTarget = useIntersectionLoadMore({
    hasNext,
    isLoading: isLoadingMore,
    onLoadMore: loadMore,
  });

  const handleSort = (column: HostReservationSortColumn) => {
    const nextSort = getNextHostReservationSort(sortBy, sortOrder, column);
    setSortBy(nextSort.column);
    setSortOrder(nextSort.order);
  };

  const sortedReservations = sortHostReservations(reservations, sortBy, sortOrder);

  if (isLoading) {
    return <LoadingState title="로딩 중..." />;
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
        <EmptyState title="아직 예약이 없습니다." />
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
                      <span
                        className={`${styles.status} ${
                          statusClassByTone[getReservationStatusTone(reservation.status)]
                        }`}
                      >
                        {formatReservationStatus(reservation.status)}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.guestInfo}>
                        <div className={styles.guestName}>{reservation.guest.nickname}</div>
                        <div className={styles.guestCount}>{reservation.guest_count}명</div>
                      </div>
                    </td>
                    <td className={styles.td}>{formatKoreanDate(reservation.check_in_date)}</td>
                    <td className={styles.td}>{formatKoreanDate(reservation.check_out_date)}</td>
                    <td className={styles.td}>{formatKoreanDate(reservation.created_at)}</td>
                    <td className={styles.td}>{reservation.accommodation.name}</td>
                    <td className={styles.td}>
                      {reservation.reservation_code || "-"}
                    </td>
                    <td className={styles.td}>{formatNullablePrice(reservation.total_price)}</td>
                    <td className={styles.td}>
                      <button
                        className={styles.detailsButton}
                        onClick={() =>
                          navigate(routeTo.hostReservationDetail(reservation.reservation_uid))
                        }
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
