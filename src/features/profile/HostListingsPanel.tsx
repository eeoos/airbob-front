import type { RefCallback } from "react";
import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import type { HostListingFilterStatus } from "./model/hostListing";
import {
  ActionCard,
  Button,
  EmptyState,
  ImageWithFallback,
  RetryableErrorState,
  Skeleton,
  StatusBadge,
  Tabs,
  ToastHost,
  stateViewRecipes,
} from "../../shared/ui";
import styles from "./HostListingsPanel.module.css";

interface HostListingCardView {
  readonly id: number;
  readonly imageAlt: string;
  readonly locationLabel: string;
  readonly managementLabel: string;
  readonly name: string;
  readonly statusLabel: string;
  readonly thumbnailUrl: string | null;
}

type HostListingsPanelState =
  | { readonly status: "loading" }
  | {
      readonly status: "error";
      readonly isRetrying: boolean;
      readonly message: string;
      readonly onRetry: () => void;
    }
  | {
      readonly status: "ready";
      readonly listings: readonly HostListingCardView[];
      readonly hasNext: boolean;
      readonly isLoadingMore: boolean;
    };

export interface HostListingsPanelProps {
  readonly errorMessage: string | null;
  readonly loadMoreRef: RefCallback<HTMLDivElement>;
  readonly onDismissError: () => void;
  readonly onOpenListingActions: (accommodationId: number) => void;
  readonly onStatusChange: (statusType: HostListingFilterStatus) => void;
  readonly state: HostListingsPanelState;
  readonly statusType: HostListingFilterStatus;
}

const statusFilterItems = [
  { value: "PUBLISHED", label: "공개" },
  { value: "DRAFT", label: "작성 중" },
  { value: "UNPUBLISHED", label: "비공개" },
] satisfies ReadonlyArray<{
  value: HostListingFilterStatus;
  label: string;
}>;

function HostListingsSkeleton() {
  return (
    <section className={styles.loadingState} {...stateViewRecipes.loading}>
      <span className={styles.srOnly}>호스트 숙소를 불러오는 중입니다.</span>
      <Skeleton className={styles.loadingTitle} />
      <Skeleton className={styles.loadingTabs} />
      <div className={styles.loadingGrid}>
        {Array.from({ length: 3 }, (_, index) => (
          <div className={styles.loadingCard} key={index}>
            <Skeleton className={styles.loadingImage} />
            <Skeleton className={styles.loadingLineWide} />
            <Skeleton className={styles.loadingLine} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ListingImageFallback({ name }: { readonly name: string }) {
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

export function HostListingsPanel({
  errorMessage,
  loadMoreRef,
  onDismissError,
  onOpenListingActions,
  onStatusChange,
  state,
  statusType,
}: HostListingsPanelProps) {
  if (state.status === "loading") {
    return <HostListingsSkeleton />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>숙소 관리</h2>
        <p className={styles.intro}>
          공개 상태를 확인하고 다음 관리 작업을 선택하세요.
        </p>
      </header>
      <Tabs
        ariaLabel="숙소 상태 필터"
        className={requireCssModuleClass(styles.filterTabs)}
        items={statusFilterItems}
        value={statusType}
        onValueChange={onStatusChange}
      />

      {state.status === "error" ? (
        <RetryableErrorState
          title="숙소를 불러오지 못했어요"
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
      ) : state.listings.length === 0 ? (
        <EmptyState
          title="이 상태의 숙소가 없어요"
          description="다른 공개 상태를 선택해 숙소를 확인해보세요."
        />
      ) : (
        <>
          <div className={styles.accommodationsGrid}>
            {state.listings.map((accommodation) => (
              <ActionCard
                key={accommodation.id}
                className={requireCssModuleClass(styles.accommodationCard)}
                ariaLabel={accommodation.managementLabel}
                onClick={() => onOpenListingActions(accommodation.id)}
              >
                <div className={styles.image}>
                  <ImageWithFallback
                    src={accommodation.thumbnailUrl}
                    alt={accommodation.imageAlt}
                    className={styles.thumbnail}
                    fallback={
                      <ListingImageFallback name={accommodation.name} />
                    }
                  />
                </div>
                <div className={styles.content}>
                  <h3 className={styles.name}>{accommodation.name}</h3>
                  <p className={styles.location}>
                    {accommodation.locationLabel}
                  </p>
                  <StatusBadge size="sm" tone="neutral">
                    {accommodation.statusLabel}
                  </StatusBadge>
                </div>
              </ActionCard>
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
        <ToastHost
          closeLabel="오류 닫기"
          message={errorMessage}
          onClose={onDismissError}
        />
      )}
    </div>
  );
}
