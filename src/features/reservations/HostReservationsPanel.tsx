import type { RefCallback } from "react";
import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import type { ReservationFilterType } from "./model/reservationRead";
import type { HostReservationCheckInSortDirection } from "./lib/hostReservationSort";
import {
  Button,
  EmptyState,
  LoadingState,
  StatusBadge,
  Tabs,
  ToastHost,
  type StatusBadgeTone,
} from "../../shared/ui";
import styles from "./HostReservationsPanel.module.css";

type HostReservationFilterType = ReservationFilterType;
type CheckInSortDirection = HostReservationCheckInSortDirection;
type HostReservationStatusTone = StatusBadgeTone;

interface HostReservationRowView {
  readonly reservationUid: string;
  readonly statusLabel: string;
  readonly statusTone: HostReservationStatusTone;
  readonly guestName: string;
  readonly guestCountLabel: string;
  readonly checkInLabel: string;
  readonly checkOutLabel: string;
  readonly createdAtLabel: string;
  readonly accommodationName: string;
  readonly reservationCodeLabel: string;
  readonly totalPriceLabel: string;
}

type HostReservationsPanelState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly rows: readonly HostReservationRowView[];
      readonly hasNext: boolean;
      readonly isLoadingMore: boolean;
    };

export interface HostReservationsPanelProps {
  readonly checkInSortDirection: CheckInSortDirection;
  readonly errorMessage: string | null;
  readonly filterType: HostReservationFilterType;
  readonly loadMoreRef: RefCallback<HTMLDivElement>;
  readonly onCheckInSort: () => void;
  readonly onDismissError: () => void;
  readonly onFilterChange: (filterType: HostReservationFilterType) => void;
  readonly onOpenReservation: (reservationUid: string) => void;
  readonly state: HostReservationsPanelState;
}

const filterItems = [
  { value: "UPCOMING", label: "예정된 예약" },
  { value: "PAST", label: "완료된 예약" },
  { value: "CANCELLED", label: "취소된 예약" },
] satisfies ReadonlyArray<{
  value: HostReservationFilterType;
  label: string;
}>;

export function HostReservationsPanel({
  checkInSortDirection,
  errorMessage,
  filterType,
  loadMoreRef,
  onCheckInSort,
  onDismissError,
  onFilterChange,
  onOpenReservation,
  state,
}: HostReservationsPanelProps) {
  if (state.status === "loading") {
    return <LoadingState title="로딩 중..." />;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>예약 관리</h2>
      <Tabs
        ariaLabel="예약 상태 필터"
        className={requireCssModuleClass(styles.filterTabs)}
        items={filterItems}
        value={filterType}
        onValueChange={onFilterChange}
      />

      {state.rows.length === 0 ? (
        <EmptyState title="아직 예약이 없습니다." />
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>상태</th>
                  <th className={styles.th}>게스트</th>
                  <th aria-sort={checkInSortDirection} className={styles.th}>
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={onCheckInSort}
                    >
                      체크인
                      <span className={styles.sortIcon} aria-hidden="true">
                        {checkInSortDirection === "ascending" ? "↑" : "↓"}
                      </span>
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
                {state.rows.map((reservation) => (
                  <tr
                    key={reservation.reservationUid}
                    className={styles.tableRow}
                  >
                    <td className={styles.td}>
                      <StatusBadge size="sm" tone={reservation.statusTone}>
                        {reservation.statusLabel}
                      </StatusBadge>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.guestInfo}>
                        <div className={styles.guestName}>
                          {reservation.guestName}
                        </div>
                        <div className={styles.guestCount}>
                          {reservation.guestCountLabel}
                        </div>
                      </div>
                    </td>
                    <td className={styles.td}>{reservation.checkInLabel}</td>
                    <td className={styles.td}>{reservation.checkOutLabel}</td>
                    <td className={styles.td}>{reservation.createdAtLabel}</td>
                    <td className={styles.td}>
                      {reservation.accommodationName}
                    </td>
                    <td className={styles.td}>
                      {reservation.reservationCodeLabel}
                    </td>
                    <td className={styles.td}>{reservation.totalPriceLabel}</td>
                    <td className={styles.td}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          onOpenReservation(reservation.reservationUid)
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
        <ToastHost
          closeLabel="오류 닫기"
          message={errorMessage}
          onClose={onDismissError}
        />
      )}
    </div>
  );
}
