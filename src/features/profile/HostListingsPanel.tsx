import React from "react";
import { ErrorToast } from "../../components/ErrorToast";
import { AccommodationActionModal } from "../accommodations/appShell";
import { useHostListings } from "./hooks";
import { getImageUrl } from "../../utils/image";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
import {
  toHostListingViewModels,
  type HostListingViewModel,
} from "./lib/hostListingViewModel";
import {
  ClickableCard,
  EmptyState,
  LoadingState,
  StatusBadge,
  Tabs,
} from "../../shared/ui";
import styles from "./HostListingsPanel.module.css";

type HostListingStatusType = "PUBLISHED" | "DRAFT" | "UNPUBLISHED";

export interface HostListingsPanelProps {
  statusType?: HostListingStatusType;
  onStatusChange: (statusType: HostListingStatusType) => void;
}

const statusFilterItems = [
  { value: "PUBLISHED", label: "공개" },
  { value: "DRAFT", label: "작성 중" },
  { value: "UNPUBLISHED", label: "비공개" },
] satisfies ReadonlyArray<{ value: HostListingStatusType; label: string }>;

export const HostListingsPanel: React.FC<HostListingsPanelProps> = ({
  statusType = "PUBLISHED",
  onStatusChange,
}) => {
  const [selectedAccommodation, setSelectedAccommodation] =
    React.useState<HostListingViewModel | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const {
    accommodations,
    clearError,
    error,
    hasNext,
    isLoading,
    isLoadingMore,
    loadMore,
    reload,
  } = useHostListings(statusType);
  const observerTarget = useIntersectionLoadMore({
    hasNext,
    isLoading: isLoadingMore,
    onLoadMore: loadMore,
  });
  const listingViews = React.useMemo(
    () => toHostListingViewModels(accommodations),
    [accommodations],
  );

  const getTitle = () => {
    return "숙소 관리";
  };

  const handleCardClick = (accommodation: HostListingViewModel) => {
    setSelectedAccommodation(accommodation);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedAccommodation(null);
  };

  const handleModalSuccess = () => {
    reload();
  };

  if (isLoading) {
    return <LoadingState title="로딩 중..." />;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{getTitle()}</h2>
      <Tabs
        ariaLabel="숙소 상태 필터"
        className={styles.filterTabs}
        items={statusFilterItems}
        value={statusType}
        onValueChange={onStatusChange}
      />

      {listingViews.length === 0 ? (
        <EmptyState title="아직 숙소가 없습니다." />
      ) : (
        <>
          <div className={styles.accommodationsGrid}>
            {listingViews.map((accommodation) => (
              <ClickableCard
                key={accommodation.id}
                className={styles.accommodationCard}
                ariaLabel={accommodation.managementLabel}
                onClick={() => handleCardClick(accommodation)}
              >
                <div className={styles.image}>
                  {accommodation.thumbnailUrl ? (
                    <img
                      src={getImageUrl(accommodation.thumbnailUrl)}
                      alt={accommodation.imageAlt}
                    />
                  ) : (
                    <div className={styles.placeholder}>🏠</div>
                  )}
                </div>
                <div className={styles.content}>
                  <div className={styles.name}>
                    {accommodation.name}
                  </div>
                  <div className={styles.location}>
                    {accommodation.locationLabel}
                  </div>
                  <StatusBadge size="sm" tone="neutral">
                    {accommodation.statusLabel}
                  </StatusBadge>
                </div>
              </ClickableCard>
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

      {error && <ErrorToast message={error} onClose={clearError} />}

      <AccommodationActionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        accommodation={selectedAccommodation}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};
