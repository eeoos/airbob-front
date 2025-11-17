import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { accommodationApi } from "../../../api";
import { MyAccommodationInfo } from "../../../types/accommodation";
import { AccommodationStatus } from "../../../types/enums";
import { useApiError } from "../../../hooks/useApiError";
import { ErrorToast } from "../../../components/ErrorToast";
import { AccommodationActionModal } from "../../../components/AccommodationActionModal";
import { getImageUrl } from "../../../utils/image";
import styles from "./HostListings.module.css";

interface HostListingsProps {
  statusType?: "PUBLISHED" | "DRAFT" | "UNPUBLISHED";
  onStatusChange: (statusType: "PUBLISHED" | "DRAFT" | "UNPUBLISHED") => void;
}

const HostListings: React.FC<HostListingsProps> = ({ statusType = "PUBLISHED", onStatusChange }) => {
  const navigate = useNavigate();
  const { error, handleError, clearError } = useApiError();
  const [accommodations, setAccommodations] = useState<MyAccommodationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [selectedAccommodation, setSelectedAccommodation] = useState<MyAccommodationInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const fetchAccommodations = useCallback(async () => {
    setIsLoading(true);
    clearError();
    setAccommodations([]);
    setCursor(null);
    setHasNext(false);

    try {
      const response = await accommodationApi.getMyAccommodations({ 
        size: 20, 
        status: statusType || "PUBLISHED" 
      });
      setAccommodations(response.accommodations);
      setCursor(response.page_info.next_cursor);
      setHasNext(response.page_info.has_next);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  }, [statusType, clearError, handleError]);

  useEffect(() => {
    fetchAccommodations();
  }, [fetchAccommodations]);

  const handleLoadMore = useCallback(async () => {
    if (!hasNext || isLoadingMore || !cursor) return;

    setIsLoadingMore(true);
    clearError();

    try {
      const response = await accommodationApi.getMyAccommodations({ 
        size: 20, 
        cursor, 
        status: statusType || "PUBLISHED" 
      });
      setAccommodations((prev) => [...prev, ...response.accommodations]);
      setCursor(response.page_info.next_cursor);
      setHasNext(response.page_info.has_next);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasNext, isLoadingMore, cursor, statusType, clearError, handleError]);

  // Intersection Observer를 사용한 무한 스크롤
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingMore) {
          handleLoadMore();
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
  }, [hasNext, isLoadingMore, handleLoadMore]);

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
    fetchAccommodations();
  };

  if (isLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
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
        <div className={styles.empty}>
          <p>아직 숙소가 없습니다.</p>
        </div>
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
                    {accommodation.location || "위치 정보 없음"}
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
