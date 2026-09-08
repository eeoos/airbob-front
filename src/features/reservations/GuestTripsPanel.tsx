import type { MouseEvent, RefCallback } from "react";
import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import type { ReservationFilterType } from "./model/reservationRead";
import {
  Button,
  EmptyState,
  ImageWithFallback,
  NavigationCard,
  RetryableErrorState,
  Skeleton,
  ToastHost,
  stateViewRecipes,
} from "../../shared/ui";
import styles from "./GuestTripsPanel.module.css";

export type GuestTripsFilterType = ReservationFilterType;

interface GuestTripCardView {
  readonly reservationUid: string;
  readonly accommodationName: string;
  readonly thumbnailUrl: string | null;
  readonly dateRangeLabel: string;
}

interface GuestTripYearGroupView {
  readonly year: number;
  readonly trips: readonly GuestTripCardView[];
}

type GuestTripsPanelState =
  | { readonly status: "loading" }
  | {
      readonly status: "error";
      readonly isRetrying: boolean;
      readonly message: string;
      readonly onRetry: () => void;
    }
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

const getEmptyDescription = (filterType: GuestTripsFilterType) => {
  switch (filterType) {
    case "UPCOMING":
      return "새로운 여행을 예약하면 이곳에서 일정과 숙소를 확인할 수 있어요.";
    case "PAST":
      return "여행을 마치면 지난 숙소와 일정을 이곳에 차곡차곡 모아드려요.";
    case "CANCELLED":
      return "취소된 예약이 생기면 이곳에서 기록을 확인할 수 있어요.";
  }
};

function GuestTripsSkeleton() {
  return (
    <section className={styles.loadingState} {...stateViewRecipes.loading}>
      <span className={styles.srOnly}>여행 목록을 불러오는 중입니다.</span>
      <Skeleton className={styles.loadingEyebrow} />
      <Skeleton className={styles.loadingTitle} />
      <Skeleton className={styles.loadingIntro} />
      <div className={styles.loadingGrid}>
        {Array.from({ length: 2 }, (_, index) => (
          <div className={styles.loadingCard} key={index}>
            <Skeleton className={styles.loadingImage} />
            <div className={styles.loadingContent}>
              <Skeleton className={styles.loadingLineWide} />
              <Skeleton className={styles.loadingLine} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TripImageFallback({ name }: { readonly name: string }) {
  return (
    <div
      aria-label={`${name} 숙소 이미지 없음`}
      className={styles.placeholder}
      role="img"
    >
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <path d="M5 26V13.5L16 5l11 8.5V26a1 1 0 0 1-1 1h-7v-8h-6v8H6a1 1 0 0 1-1-1Z" />
      </svg>
      <span>사진 준비 중</span>
    </div>
  );
}

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
    return <GuestTripsSkeleton />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>{getTitle(filterType)}</h2>
        <p className={styles.intro}>
          예약 일정과 숙소 정보를 한눈에 확인하세요.
        </p>
      </header>

      {state.status === "error" ? (
        <RetryableErrorState
          title="여행을 불러오지 못했어요"
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
      ) : state.groups.length === 0 ? (
        <EmptyState
          title="아직 표시할 여행이 없어요"
          description={getEmptyDescription(filterType)}
        />
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
                      className={requireCssModuleClass(styles.reservationCard)}
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
                        <ImageWithFallback
                          alt={trip.accommodationName}
                          className={styles.thumbnail}
                          fallback={
                            <TripImageFallback name={trip.accommodationName} />
                          }
                          loading="lazy"
                          src={trip.thumbnailUrl}
                        />
                      </div>
                      <div className={styles.content}>
                        <h4 className={styles.location}>
                          {trip.accommodationName}
                        </h4>
                        <p className={styles.dateRange}>
                          {trip.dateRangeLabel}
                        </p>
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
                <div
                  aria-live="polite"
                  className={styles.loadingMore}
                  role="status"
                >
                  여행을 더 불러오는 중...
                </div>
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
