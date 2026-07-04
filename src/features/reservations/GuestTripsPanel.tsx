import React from "react";
import { useNavigate } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { routeTo } from "../../routes/paths";
import { EmptyState, LoadingState } from "../../shared/ui";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
import { getImageUrl } from "../../utils/image";
import { useGuestTrips } from "./hooks";
import {
  formatGuestTripDateRange,
  groupGuestTripsByYear,
} from "./lib/guestTripGroups";
import styles from "./GuestTripsPanel.module.css";

export interface GuestTripsPanelProps {
  filterType: "UPCOMING" | "PAST" | "CANCELLED";
}

export const GuestTripsPanel: React.FC<GuestTripsPanelProps> = ({ filterType }) => {
  const navigate = useNavigate();
  const {
    clearError,
    error,
    hasNext,
    isLoading,
    isLoadingMore,
    loadMore,
    reservations,
  } = useGuestTrips(filterType);
  const observerTarget = useIntersectionLoadMore({
    hasNext,
    isLoading: isLoadingMore,
    onLoadMore: loadMore,
  });

  if (isLoading) {
    return <LoadingState title="로딩 중..." />;
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

  const groupedReservations = groupGuestTripsByYear(reservations);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{getTitle()}</h2>

      {reservations.length === 0 ? (
        <EmptyState title="아직 예약한 여행이 없습니다." />
      ) : (
        <>
          <div className={styles.reservationsByYear}>
            {groupedReservations.map(({ year, reservations: yearReservations }) => (
              <div key={year} className={styles.yearSection}>
                <h3 className={styles.yearTitle}>{year}</h3>
                <div className={styles.reservationsGrid}>
                  {yearReservations.map((reservation) => {
                    return (
                      <div
                        key={reservation.reservation_id}
                        className={styles.reservationCard}
                        onClick={() =>
                          navigate(routeTo.reservationDetail(reservation.reservation_uid))
                        }
                      >
                        <div className={styles.image}>
                          {reservation.accommodation.thumbnail_url ? (
                            <img
                              src={getImageUrl(reservation.accommodation.thumbnail_url)}
                              alt={reservation.accommodation.name}
                            />
                          ) : (
                            <div className={styles.placeholder}>🏠</div>
                          )}
                        </div>
                        <div className={styles.content}>
                          <div className={styles.location}>
                            {reservation.accommodation.name}
                          </div>
                          <div className={styles.dateRange}>
                            {formatGuestTripDateRange(
                              reservation.check_in_date,
                              reservation.check_out_date
                            )}
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
