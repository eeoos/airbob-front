import type { RefCallback } from "react";
import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import type { ReservationFilterType } from "./model/reservationRead";
import type { HostReservationCheckInSortDirection } from "./lib/hostReservationSort";
import {
  Button,
  EmptyState,
  RetryableErrorState,
  Skeleton,
  StatusBadge,
  Tabs,
  ToastHost,
  stateViewRecipes,
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
      readonly status: "error";
      readonly isRetrying: boolean;
      readonly message: string;
      readonly onRetry: () => void;
    }
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

function HostReservationsSkeleton() {
  return (
    <section className={styles.loadingState} {...stateViewRecipes.loading}>
      <span className={styles.srOnly}>호스트 예약을 불러오는 중입니다.</span>
      <Skeleton className={styles.loadingEyebrow} />
      <Skeleton className={styles.loadingTitle} />
      <Skeleton className={styles.loadingIntro} />
      <Skeleton className={styles.loadingTabs} />
      <div className={styles.loadingRows}>
        {Array.from({ length: 3 }, (_, index) => (
          <div className={styles.loadingRow} key={index}>
            <Skeleton className={styles.loadingBadge} />
            <Skeleton className={styles.loadingLineWide} />
            <Skeleton className={styles.loadingLine} />
          </div>
        ))}
      </div>
    </section>
  );
}

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
    return <HostReservationsSkeleton />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>예약 관리</h2>
        <p className={styles.intro}>
          다가오는 체크인과 게스트 정보를 차분하게 확인하세요.
        </p>
      </header>

      <div className={styles.controls}>
        <Tabs
          ariaLabel="예약 상태 필터"
          className={requireCssModuleClass(styles.filterTabs)}
          items={filterItems}
          value={filterType}
          onValueChange={onFilterChange}
        />
        {state.status === "ready" && (
          <Button
            aria-label={`체크인 ${
              checkInSortDirection === "ascending"
                ? "빠른 날짜순"
                : "늦은 날짜순"
            } 정렬`}
            className={styles.sortButton}
            onClick={onCheckInSort}
            size="sm"
            variant="secondary"
          >
            체크인
            <span className={styles.sortIcon} aria-hidden="true">
              {checkInSortDirection === "ascending" ? "↑" : "↓"}
            </span>
          </Button>
        )}
      </div>

      {state.status === "ready" && state.rows.length > 0 && (
        <p className={styles.sortNotice}>
          현재 불러온 예약 {state.rows.length}건 안에서 체크인 날짜순으로
          정렬합니다.
        </p>
      )}

      {state.status === "error" ? (
        <RetryableErrorState
          title="예약을 불러오지 못했어요"
          description={state.message}
          action={
            <Button
              isLoading={state.isRetrying}
              loadingLabel="다시 불러오는 중..."
              onClick={state.onRetry}
              variant="secondary"
            >
              다시 시도
            </Button>
          }
        />
      ) : (
        <>
          {state.rows.length === 0 ? (
            <EmptyState
              title="이 상태의 예약이 없어요"
              description="다른 예약 상태를 선택하거나 새 예약이 들어오면 다시 확인해보세요."
            />
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th} scope="col">
                        상태
                      </th>
                      <th className={styles.th} scope="col">
                        게스트
                      </th>
                      <th
                        aria-sort={checkInSortDirection}
                        className={styles.th}
                        scope="col"
                      >
                        체크인
                      </th>
                      <th className={styles.th} scope="col">
                        체크아웃
                      </th>
                      <th className={styles.th} scope="col">
                        예약일
                      </th>
                      <th className={styles.th} scope="col">
                        숙소
                      </th>
                      <th className={styles.th} scope="col">
                        예약 코드
                      </th>
                      <th className={styles.th} scope="col">
                        총액
                      </th>
                      <th className={styles.th} scope="col">
                        <span className={styles.srOnly}>작업</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.map((reservation) => (
                      <tr
                        key={reservation.reservationUid}
                        className={styles.tableRow}
                      >
                        <td className={styles.td} data-label="상태">
                          <StatusBadge size="sm" tone={reservation.statusTone}>
                            {reservation.statusLabel}
                          </StatusBadge>
                        </td>
                        <td className={styles.td} data-label="게스트">
                          <div className={styles.guestInfo}>
                            <div className={styles.guestName}>
                              {reservation.guestName}
                            </div>
                            <div className={styles.guestCount}>
                              {reservation.guestCountLabel}
                            </div>
                          </div>
                        </td>
                        <td className={styles.td} data-label="체크인">
                          {reservation.checkInLabel}
                        </td>
                        <td className={styles.td} data-label="체크아웃">
                          {reservation.checkOutLabel}
                        </td>
                        <td className={styles.td} data-label="예약일">
                          {reservation.createdAtLabel}
                        </td>
                        <td className={styles.td} data-label="숙소">
                          {reservation.accommodationName}
                        </td>
                        <td className={styles.td} data-label="예약 코드">
                          {reservation.reservationCodeLabel}
                        </td>
                        <td className={styles.td} data-label="총액">
                          {reservation.totalPriceLabel}
                        </td>
                        <td className={styles.td} data-label="예약 상세">
                          <Button
                            aria-label={`${reservation.guestName} 예약 상세`}
                            className={styles.detailButton}
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
                    <div
                      aria-live="polite"
                      className={styles.loadingMore}
                      role="status"
                    >
                      예약을 더 불러오는 중...
                    </div>
                  )}
                </div>
              )}
            </>
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
