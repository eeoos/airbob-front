import type { RefCallback } from "react";
import type { HostListingFilterStatus } from "./model/hostListing";
import {
  ActionCard,
  EmptyState,
  LoadingState,
  StatusBadge,
  Tabs,
  ToastHost,
} from "../../shared/ui";
import styles from "./HostListingsPanel.module.css";

export type HostListingStatusType = HostListingFilterStatus;

export interface HostListingCardView {
  readonly id: number;
  readonly imageAlt: string;
  readonly locationLabel: string;
  readonly managementLabel: string;
  readonly name: string;
  readonly statusLabel: string;
  readonly thumbnailUrl: string | null;
}

export type HostListingsPanelState =
  | { readonly status: "loading" }
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
  readonly onStatusChange: (statusType: HostListingStatusType) => void;
  readonly state: HostListingsPanelState;
  readonly statusType: HostListingStatusType;
}

const statusFilterItems = [
  { value: "PUBLISHED", label: "공개" },
  { value: "DRAFT", label: "작성 중" },
  { value: "UNPUBLISHED", label: "비공개" },
] satisfies ReadonlyArray<{
  value: HostListingStatusType;
  label: string;
}>;

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
    return <LoadingState title="로딩 중..." />;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>숙소 관리</h2>
      <Tabs
        ariaLabel="숙소 상태 필터"
        className={styles.filterTabs}
        items={statusFilterItems}
        value={statusType}
        onValueChange={onStatusChange}
      />

      {state.listings.length === 0 ? (
        <EmptyState title="아직 숙소가 없습니다." />
      ) : (
        <>
          <div className={styles.accommodationsGrid}>
            {state.listings.map((accommodation) => (
              <ActionCard
                key={accommodation.id}
                className={styles.accommodationCard}
                ariaLabel={accommodation.managementLabel}
                onClick={() => onOpenListingActions(accommodation.id)}
              >
                <div className={styles.image}>
                  {accommodation.thumbnailUrl ? (
                    <img
                      src={accommodation.thumbnailUrl}
                      alt={accommodation.imageAlt}
                    />
                  ) : (
                    <div className={styles.placeholder}>🏠</div>
                  )}
                </div>
                <div className={styles.content}>
                  <div className={styles.name}>{accommodation.name}</div>
                  <div className={styles.location}>
                    {accommodation.locationLabel}
                  </div>
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
