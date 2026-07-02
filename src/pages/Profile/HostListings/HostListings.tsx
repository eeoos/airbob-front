import React, { useState, useEffect, useRef, useCallback } from "react";
import { MyAccommodationInfo } from "../../../types/accommodation";
import { AccommodationStatus } from "../../../types/enums";
import { ErrorToast } from "../../../components/ErrorToast";
import { AccommodationActionModal } from "../../../components/AccommodationActionModal";
import { useHostListings } from "../../../features/profile";
import { getImageUrl } from "../../../utils/image";
import { EmptyState, LoadingState } from "../../../shared/ui";
import styles from "./HostListings.module.css";

interface HostListingsProps {
  statusType?: "PUBLISHED" | "DRAFT" | "UNPUBLISHED";
  onStatusChange: (statusType: "PUBLISHED" | "DRAFT" | "UNPUBLISHED") => void;
}

const HostListings: React.FC<HostListingsProps> = ({ statusType = "PUBLISHED", onStatusChange }) => {
  const [selectedAccommodation, setSelectedAccommodation] = useState<MyAccommodationInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
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

  // Intersection Observer를 사용한 무한 스크롤
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNext, isLoadingMore, loadMore]);

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

  const handleCardClick = (accommodation: MyAccommodationInfo, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
      <div className={styles.filterTabs}>
        <button
          className={`${styles.filterTab} ${statusType === "PUBLISHED" ? styles.active : ""}`}
          onClick={() => onStatusChange("PUBLISHED")}
        >
          공개
        </button>
        <button
          className={`${styles.filterTab} ${statusType === "DRAFT" ? styles.active : ""}`}
          onClick={() => onStatusChange("DRAFT")}
        >
          작성 중
        </button>
        <button
          className={`${styles.filterTab} ${statusType === "UNPUBLISHED" ? styles.active : ""}`}
          onClick={() => onStatusChange("UNPUBLISHED")}
        >
          비공개
        </button>
      </div>

      {accommodations.length === 0 ? (
        <EmptyState title="아직 숙소가 없습니다." />
      ) : (
        <>
          <div className={styles.accommodationsGrid}>
            {accommodations.map((accommodation) => (
              <div
                key={accommodation.id}
                className={styles.accommodationCard}
                onClick={(e) => handleCardClick(accommodation, e)}
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
                  <div className={styles.status}>
                    {getStatusLabel(accommodation.status)}
                  </div>
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

      <AccommodationActionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        accommodation={selectedAccommodation}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default HostListings;
