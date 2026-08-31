import type { MouseEvent, RefCallback } from "react";
import type { ReservationFilterType } from "./model/reservationRead";
import {
  EmptyState,
  LoadingState,
  NavigationCard,
  ToastHost,
} from "../../shared/ui";
import styles from "./GuestTripsPanel.module.css";

export type GuestTripsFilterType = ReservationFilterType;

export interface GuestTripCardView {
  readonly reservationUid: string;
  readonly accommodationName: string;
  readonly thumbnailUrl: string | null;
  readonly dateRangeLabel: string;
}

export interface GuestTripYearGroupView {
  readonly year: number;
  readonly trips: readonly GuestTripCardView[];
}

export type GuestTripsPanelState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly groups: readonly GuestTripYearGroupView[];
      readonly hasNext: boolean;
      readonly isLoadingMore: boolean;
    };

export interface GuestTripsPanelProps {
  readonly errorMessage: string | null;
  readonly filterType: GuestTripsFilterType;
  readonly getReservationHref: (reservationUid: string) => string;
  readonly loadMoreRef: RefCallback<HTMLDivElement>;
  readonly onDismissError: () => void;
  readonly onOpenReservation: (reservationUid: string) => void;
  readonly state: GuestTripsPanelState;
}

const isPlainPrimaryClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey;

const getTitle = (filterType: GuestTripsFilterType) => {
  switch (filterType) {
    case "UPCOMING":
      return "다가올 여행";
    case "PAST":
      return "이전 여행";
    case "CANCELLED":
      return "취소된 여행";
  }
};

export function GuestTripsPanel({
  errorMessage,
  filterType,
  getReservationHref,
  loadMoreRef,
  onDismissError,
  onOpenReservation,
  state,
}: GuestTripsPanelProps) {
  if (state.status === "loading") {
    return <LoadingState title="로딩 중..." />;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{getTitle(filterType)}</h2>

      {state.groups.length === 0 ? (
        <EmptyState title="아직 예약한 여행이 없습니다." />
      ) : (
        <>
          <div className={styles.reservationsByYear}>
            {state.groups.map(({ year, trips }) => (
              <div key={year} className={styles.yearSection}>
                <h3 className={styles.yearTitle}>{year}</h3>
                <div className={styles.reservationsGrid}>
                  {trips.map((trip) => (
                    <NavigationCard
                      key={trip.reservationUid}
                      className={styles.reservationCard}
                      ariaLabel={`${trip.accommodationName} 예약 상세 보기`}
                      href={getReservationHref(trip.reservationUid)}
                      onClick={(event) => {
                        if (
                          event.defaultPrevented ||
                          !isPlainPrimaryClick(event)
                        ) {
                          return;
                        }

                        event.preventDefault();
                        onOpenReservation(trip.reservationUid);
                      }}
                    >
                      <div className={styles.image}>
                        {trip.thumbnailUrl ? (
                          <img
                            src={trip.thumbnailUrl}
                            alt={trip.accommodationName}
                          />
                        ) : (
                          <div className={styles.placeholder}>🏠</div>
                        )}
                      </div>
                      <div className={styles.content}>
                        <div className={styles.location}>
                          {trip.accommodationName}
                        </div>
                        <div className={styles.dateRange}>
                          {trip.dateRangeLabel}
                        </div>
                      </div>
                    </NavigationCard>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {state.hasNext && (
            <div ref={loadMoreRef} className={styles.loadMoreContainer}>
              {state.isLoadingMore && (
                <div className={styles.loadingMore}>로딩 중...</div>
              )}
            </div>
          )}
        </>
      )}

      {errorMessage && (
        <div className={styles.toastContainer}>
          <ToastHost
            closeLabel="오류 닫기"
            message={errorMessage}
            onClose={onDismissError}
          />
        </div>
      )}
    </div>
  );
}
