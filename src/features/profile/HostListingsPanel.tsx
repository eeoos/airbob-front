import React from "react";
import { MyAccommodationInfo } from "../../types/accommodation";
import { AccommodationStatus } from "../../types/enums";
import { ErrorToast } from "../../components/ErrorToast";
import { AccommodationActionModal } from "../accommodations/appShell";
import { useHostListings } from "./hooks";
import { getImageUrl } from "../../utils/image";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
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
    React.useState<MyAccommodationInfo | null>(null);
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

  const getTitle = () => {
    return "숙소 관리";
  };

  const getStatusLabel = (status: AccommodationStatus): string => {
    switch (status) {
      case AccommodationStatus.PUBLISHED:
        return "공개";
      case AccommodationStatus.DRAFT:
        return "작성 중";
      case AccommodationStatus.UNPUBLISHED:
        return "비공개";
      default:
        return status;
    }
  };

  const handleCardClick = (accommodation: MyAccommodationInfo) => {
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

      {accommodations.length === 0 ? (
        <EmptyState title="아직 숙소가 없습니다." />
      ) : (
        <>
          <div className={styles.accommodationsGrid}>
            {accommodations.map((accommodation) => (
              <ClickableCard
                key={accommodation.id}
                className={styles.accommodationCard}
                ariaLabel={`${accommodation.name || "이름 없음"} 숙소 관리 열기`}
                onClick={() => handleCardClick(accommodation)}
              >
                <div className={styles.image}>
                  {accommodation.thumbnail_url ? (
                    <img
                      src={getImageUrl(accommodation.thumbnail_url)}
                      alt={accommodation.name || "숙소"}
                    />
                  ) : (
                    <div className={styles.placeholder}>🏠</div>
                  )}
                </div>
                <div className={styles.content}>
                  <div className={styles.name}>
                    {accommodation.name || "이름 없음"}
                  </div>
                  <div className={styles.location}>
                    {accommodation.address_summary 
                      ? [accommodation.address_summary.city, accommodation.address_summary.district].filter(Boolean).join(", ") || accommodation.address_summary.country 
                      : "위치 정보 없음"}
                  </div>
                  <StatusBadge size="sm" tone="neutral">
                    {getStatusLabel(accommodation.status)}
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
