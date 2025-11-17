import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { ListContainer } from "../../components/ListContainer";
import { AccommodationCardSearch } from "../../components/AccommodationCard";
import { Map } from "../../components/Map";
import { WishlistModal } from "../../components/WishlistModal/WishlistModal";
import { AuthModal } from "../../components/AuthModal/AuthModal";
import { accommodationApi, wishlistApi } from "../../api";
import { AccommodationSearchInfo, AccommodationSearchRequest } from "../../types/accommodation";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import styles from "./Search.module.css";

const Search: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const [accommodations, setAccommodations] = useState<AccommodationSearchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [selectedAccommodationId, setSelectedAccommodationId] = useState<number | null>(null);
  const [hoveredAccommodationId, setHoveredAccommodationId] = useState<number | null>(null);
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [selectedAccommodationForWishlist, setSelectedAccommodationForWishlist] = useState<number | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  useEffect(() => {
    const fetchAccommodations = async () => {
      setIsLoading(true);
      clearError();
      setCurrentPage(0);

      try {
        const params: AccommodationSearchRequest = {
          destination: searchParams.get("destination") || undefined,
          checkIn: searchParams.get("checkIn") || undefined,
          checkOut: searchParams.get("checkOut") || undefined,
          adultOccupancy: searchParams.get("adultOccupancy")
            ? parseInt(searchParams.get("adultOccupancy")!)
            : undefined,
          childOccupancy: searchParams.get("childOccupancy")
            ? parseInt(searchParams.get("childOccupancy")!)
            : undefined,
          infantOccupancy: searchParams.get("infantOccupancy")
            ? parseInt(searchParams.get("infantOccupancy")!)
            : undefined,
          petOccupancy: searchParams.get("petOccupancy")
            ? parseInt(searchParams.get("petOccupancy")!)
            : undefined,
          page: 0,
          size: 18,
        };

        const response = await accommodationApi.search(params);
        setAccommodations(response.stay_search_result_listing);
        setHasNext(response.page_info.has_next);
        setTotalElements(response.page_info.total_elements);
        setCurrentPage(0);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccommodations();
  }, [searchParams, handleError, clearError]);

  const handleLoadMore = async () => {
    if (!hasNext || isLoadingMore) return;

    setIsLoadingMore(true);
    clearError();

    try {
      const nextPage = currentPage + 1;
      const params: AccommodationSearchRequest = {
        destination: searchParams.get("destination") || undefined,
        checkIn: searchParams.get("checkIn") || undefined,
        checkOut: searchParams.get("checkOut") || undefined,
        adultOccupancy: searchParams.get("adultOccupancy")
          ? parseInt(searchParams.get("adultOccupancy")!)
          : undefined,
        childOccupancy: searchParams.get("childOccupancy")
          ? parseInt(searchParams.get("childOccupancy")!)
          : undefined,
        infantOccupancy: searchParams.get("infantOccupancy")
          ? parseInt(searchParams.get("infantOccupancy")!)
          : undefined,
        petOccupancy: searchParams.get("petOccupancy")
          ? parseInt(searchParams.get("petOccupancy")!)
          : undefined,
        page: nextPage,
        size: 18,
      };

      const response = await accommodationApi.search(params);
      setAccommodations((prev) => [...prev, ...response.stay_search_result_listing]);
      setHasNext(response.page_info.has_next);
      setTotalElements(response.page_info.total_elements);
      setCurrentPage(nextPage);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleWishlistToggle = async (accommodationId: number, isInWishlist: boolean) => {
    if (!isAuthenticated) {
      // 로그인 모달 표시
      setAuthModalOpen(true);
      return;
    }

    if (isInWishlist) {
      // 위시리스트 모달 열기 (삭제를 위해)
      setSelectedAccommodationForWishlist(accommodationId);
      setWishlistModalOpen(true);
    } else {
      // 위시리스트 모달 열기
      setSelectedAccommodationForWishlist(accommodationId);
      setWishlistModalOpen(true);
    }
  };

  const handleWishlistSuccess = () => {
    // onSuccess는 모달 내부에서 호출되지만, 모달이 닫힐 때 onClose에서 상태를 업데이트하므로
    // 여기서는 특별한 처리가 필요 없음
  };

  const handleAccommodationSelect = (accommodation: AccommodationSearchInfo | null) => {
    if (accommodation) {
      setSelectedAccommodationId(accommodation.id);
      // 해당 숙소로 스크롤 (선택사항)
      const element = document.getElementById(`accommodation-${accommodation.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      setSelectedAccommodationId(null);
    }
  };

  const handleAccommodationCardClick = (accommodationId: number) => {
    setSelectedAccommodationId(accommodationId);
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={`${styles.content} ${isMapExpanded ? styles.mapExpanded : ''}`}>
            <div className={styles.results}>
              <h2 className={styles.title}>
                {totalElements >= 1000 
                  ? "숙소 1,000개 이상" 
                  : `숙소 ${totalElements.toLocaleString()}개`}
              </h2>
              {isLoading && accommodations.length === 0 ? (
                <div className={styles.loading}>로딩 중...</div>
              ) : accommodations.length === 0 ? (
                <div className={styles.empty}>검색 결과가 없습니다.</div>
              ) : (
                <>
                  <ListContainer columns={3} gap={24}>
                    {accommodations.map((accommodation) => (
                      <div
                        key={accommodation.id}
                        id={`accommodation-${accommodation.id}`}
                        onClick={() => handleAccommodationCardClick(accommodation.id)}
                        onMouseEnter={() => setHoveredAccommodationId(accommodation.id)}
                        onMouseLeave={() => setHoveredAccommodationId(null)}
                        className={`${styles.cardWrapper} ${
                          selectedAccommodationId === accommodation.id ? styles.selected : ""
                        }`}
                      >
                        <AccommodationCardSearch
                          accommodation={accommodation}
                          onWishlistToggle={() =>
                            handleWishlistToggle(accommodation.id, accommodation.is_in_wishlist)
                          }
                          checkIn={searchParams.get("checkIn")}
                          checkOut={searchParams.get("checkOut")}
                        />
                      </div>
                    ))}
                  </ListContainer>
                  {hasNext && (
                    <div className={styles.loadMoreContainer}>
                      <button
                        className={styles.loadMoreButton}
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? "로딩 중..." : "더 보기"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={styles.mapSection}>
            <Map
              accommodations={accommodations}
              selectedAccommodationId={selectedAccommodationId}
              hoveredAccommodationId={hoveredAccommodationId}
              onAccommodationSelect={handleAccommodationSelect}
              onWishlistToggle={handleWishlistToggle}
              checkIn={searchParams.get("checkIn")}
              checkOut={searchParams.get("checkOut")}
              isExpanded={isMapExpanded}
              onExpandToggle={() => setIsMapExpanded(!isMapExpanded)}
            />
            </div>
          </div>
        </main>

        {error && (
          <div className={styles.toastContainer}>
            <ErrorToast message={error} onClose={clearError} />
          </div>
        )}
      </div>

      {selectedAccommodationForWishlist && (
        <WishlistModal
          isOpen={wishlistModalOpen}
          onClose={async () => {
            // 모달이 닫힐 때 위시리스트 상태 확인하여 검색 결과 업데이트
            try {
              const response = await wishlistApi.getWishlists({
                size: 20,
                accommodationId: selectedAccommodationForWishlist,
              });
              const isInAnyWishlist = response.data?.wishlists.some(w => w.is_contained) || false;
              
              // 검색 결과의 위시리스트 상태 업데이트
              setAccommodations((prev) =>
                prev.map((acc) =>
                  acc.id === selectedAccommodationForWishlist
                    ? { ...acc, is_in_wishlist: isInAnyWishlist }
                    : acc
                )
              );
            } catch (err) {
              // 에러가 발생해도 모달은 닫기
              console.error("위시리스트 상태 확인 실패:", err);
            }
            
            setWishlistModalOpen(false);
            setSelectedAccommodationForWishlist(null);
          }}
          accommodationId={selectedAccommodationForWishlist}
          onSuccess={handleWishlistSuccess}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
      />
    </MainLayout>
  );
};

export default Search;
