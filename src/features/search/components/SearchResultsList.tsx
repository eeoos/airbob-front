import React from "react";
import {
  Button,
  EmptyState,
  ListContainer,
  RetryableErrorState,
  Skeleton,
  TerminalErrorState,
} from "../../../shared/ui";
import { stateViewRecipes } from "../../../shared/ui/StateView";
import type { SearchAccommodationCardViewModel } from "../lib/searchAccommodationViewModel";
import { SearchAccommodationCard } from "./SearchAccommodationCard";
import styles from "./SearchResultsList.module.css";

type SearchResultsLayout = "desktop" | "bottomSheet";

interface SearchResultsListClassNames {
  loading?: string;
  empty?: string;
  cardGrid?: string;
  cardWrapper?: string;
  selected?: string;
}

interface SearchResultsListProps {
  accommodations: SearchAccommodationCardViewModel[];
  errorMessage?: string | null | undefined;
  isErrorRetryable?: boolean | undefined;
  isLoading: boolean;
  isRefreshing?: boolean | undefined;
  selectedAccommodationId: number | null;
  onAccommodationClick: (accommodationId: number) => void;
  onWishlistToggle?: ((accommodationId: number) => void) | undefined;
  removingAccommodationIds?: ReadonlySet<number> | undefined;
  onHoveredAccommodationChange?:
    ((accommodationId: number | null) => void) | undefined;
  getAccommodationHref: (accommodationId: number) => string;
  checkIn?: string | null | undefined;
  checkOut?: string | null | undefined;
  layout?: SearchResultsLayout | undefined;
  classNames?: SearchResultsListClassNames | undefined;
  onRetry?: (() => void) | undefined;
}

const classNamesFor = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(" ");

const SKELETON_CARD_COUNT = 6;

function SearchResultsSkeleton({
  className,
  gridClassName,
  layout,
}: {
  readonly className?: string | undefined;
  readonly gridClassName?: string | undefined;
  readonly layout: SearchResultsLayout;
}) {
  return (
    <div
      className={classNamesFor(styles.loadingState, className)}
      {...stateViewRecipes.loading}
    >
      <span className={styles.statusText}>숙소를 찾는 중입니다.</span>
      <div
        className={classNamesFor(styles.skeletonGrid, gridClassName)}
        data-layout={layout}
      >
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
          <div className={styles.skeletonCard} key={index}>
            <Skeleton className={styles.skeletonImage} />
            <div className={styles.skeletonCopy}>
              <Skeleton className={styles.skeletonLineWide} />
              <Skeleton className={styles.skeletonLineMedium} />
              <Skeleton className={styles.skeletonLineShort} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  accommodations,
  errorMessage,
  isErrorRetryable = false,
  isLoading,
  isRefreshing = false,
  selectedAccommodationId,
  onAccommodationClick,
  onWishlistToggle,
  removingAccommodationIds,
  onHoveredAccommodationChange,
  getAccommodationHref,
  checkIn,
  checkOut,
  layout = "desktop",
  classNames,
  onRetry,
}) => {
  const stateOwnerRef = React.useRef<HTMLDivElement>(null);
  const handleRetry = () => {
    stateOwnerRef.current?.focus();
    onRetry?.();
  };
  const retryButton = (loading: boolean) =>
    isErrorRetryable && onRetry ? (
      <Button
        isLoading={loading}
        loadingLabel="다시 불러오는 중..."
        size="sm"
        variant="secondary"
        className={styles.retryButton}
        onClick={handleRetry}
      >
        다시 시도
      </Button>
    ) : undefined;

  let content: React.ReactNode;
  if (errorMessage && accommodations.length === 0) {
    const ErrorState = isErrorRetryable
      ? RetryableErrorState
      : TerminalErrorState;
    content = (
      <ErrorState
        className={styles.state}
        title={
          isErrorRetryable
            ? "숙소를 불러오지 못했어요"
            : "검색 결과를 확인할 수 없어요"
        }
        description={errorMessage}
        action={retryButton(isLoading)}
      />
    );
  } else if (isLoading && accommodations.length === 0) {
    content = (
      <SearchResultsSkeleton
        className={classNames?.loading}
        gridClassName={classNames?.cardGrid}
        layout={layout}
      />
    );
  } else if (accommodations.length === 0) {
    content = (
      <EmptyState
        className={classNamesFor(styles.state, classNames?.empty)}
        title="조건에 맞는 숙소가 없어요"
        description="여행지나 날짜, 인원 조건을 바꿔 다시 찾아보세요."
      />
    );
  } else {
    const cards = accommodations.map((accommodation) => (
      <div
        key={accommodation.id}
        id={`accommodation-${accommodation.id}`}
        role="listitem"
        onMouseEnter={() => onHoveredAccommodationChange?.(accommodation.id)}
        onMouseLeave={() => onHoveredAccommodationChange?.(null)}
        onFocus={() => onHoveredAccommodationChange?.(accommodation.id)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            onHoveredAccommodationChange?.(null);
          }
        }}
        className={classNamesFor(
          classNames?.cardWrapper,
          selectedAccommodationId === accommodation.id
            ? classNames?.selected
            : undefined,
        )}
      >
        <SearchAccommodationCard
          accommodation={accommodation}
          checkIn={checkIn}
          checkOut={checkOut}
          detailUrl={getAccommodationHref(accommodation.id)}
          isWishlistPending={
            removingAccommodationIds?.has(accommodation.id) ?? false
          }
          onClick={() => onAccommodationClick(accommodation.id)}
          onWishlistToggle={
            onWishlistToggle
              ? () => onWishlistToggle(accommodation.id)
              : undefined
          }
        />
      </div>
    ));

    content = (
      <>
        {errorMessage && (
          <div className={styles.refreshError} role="alert">
            <div className={styles.refreshErrorCopy}>
              <strong>새 결과를 불러오지 못했어요</strong>
              <span>{errorMessage}</span>
            </div>
            {retryButton(isRefreshing)}
          </div>
        )}
        {isRefreshing && !errorMessage && (
          <span className={styles.statusText} role="status" aria-live="polite">
            검색 결과를 업데이트하는 중입니다.
          </span>
        )}
        {layout === "bottomSheet" ? (
          <div
            aria-busy={isRefreshing || undefined}
            aria-label="숙소 검색 결과"
            className={classNames?.cardGrid}
            role="list"
          >
            {cards}
          </div>
        ) : (
          <ListContainer
            aria-busy={isRefreshing || undefined}
            aria-label="숙소 검색 결과"
            className={classNames?.cardGrid}
            columns={3}
            gap={24}
            role="list"
          >
            {cards}
          </ListContainer>
        )}
      </>
    );
  }

  return (
    <div
      ref={stateOwnerRef}
      aria-label="검색 결과 상태"
      className={styles.stateOwner}
      role="region"
      tabIndex={-1}
    >
      {content}
    </div>
  );
};
