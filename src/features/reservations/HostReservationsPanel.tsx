import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { routeTo } from "../../routes/paths";
import {
  Button,
  EmptyState,
  LoadingState,
  StatusBadge,
  Tabs,
} from "../../shared/ui";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
import { useHostReservations } from "./hooks";
import {
  getNextHostReservationSort,
  HostReservationSortColumn,
  HostReservationSortOrder,
  sortHostReservations,
} from "./lib/hostReservationSort";
import { toHostReservationRowViewModel } from "./lib/reservationListViewModel";
import styles from "./HostReservationsPanel.module.css";

export interface HostReservationsPanelProps {
  filterType: "UPCOMING" | "PAST" | "CANCELLED";
  onFilterChange: (filterType: "UPCOMING" | "PAST" | "CANCELLED") => void;
}

type HostReservationFilterType = HostReservationsPanelProps["filterType"];

const filterItems = [
  { value: "UPCOMING", label: "예정된 예약" },
  { value: "PAST", label: "완료된 예약" },
  { value: "CANCELLED", label: "취소된 예약" },
] satisfies ReadonlyArray<{ value: HostReservationFilterType; label: string }>;

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
  const reservationRows = sortedReservations.map(toHostReservationRowViewModel);
  const checkInSortDirection: "ascending" | "descending" | "none" =
    sortBy === "check_in"
      ? sortOrder === "asc"
        ? "ascending"
        : "descending"
      : "none";

  if (isLoading) {
    return <LoadingState title="로딩 중..." />;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>예약 관리</h2>
      <Tabs
        ariaLabel="예약 상태 필터"
        className={styles.filterTabs}
        items={filterItems}
        value={filterType}
        onValueChange={onFilterChange}
      />

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
                    aria-sort={checkInSortDirection}
                    className={styles.th}
                  >
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => handleSort("check_in")}
                    >
                      체크인
                      {sortBy === "check_in" && (
                        <span className={styles.sortIcon} aria-hidden="true">
                          {sortOrder === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
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
                {reservationRows.map((reservation) => (
                  <tr key={reservation.reservationUid} className={styles.tableRow}>
                    <td className={styles.td}>
                      <StatusBadge size="sm" tone={reservation.statusTone}>
                        {reservation.statusLabel}
                      </StatusBadge>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.guestInfo}>
                        <div className={styles.guestName}>{reservation.guestName}</div>
                        <div className={styles.guestCount}>{reservation.guestCountLabel}</div>
                      </div>
                    </td>
                    <td className={styles.td}>{reservation.checkInLabel}</td>
                    <td className={styles.td}>{reservation.checkOutLabel}</td>
                    <td className={styles.td}>{reservation.createdAtLabel}</td>
                    <td className={styles.td}>{reservation.accommodationName}</td>
                    <td className={styles.td}>{reservation.reservationCodeLabel}</td>
                    <td className={styles.td}>{reservation.totalPriceLabel}</td>
                    <td className={styles.td}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          navigate(routeTo.hostReservationDetail(reservation.reservationUid))
                        }
                      >
                        상세
                      </Button>
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

      {error && <ErrorToast message={error} onClose={clearError} />}
    </div>
  );
};
