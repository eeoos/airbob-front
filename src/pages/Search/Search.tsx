import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MainLayout } from "../../layouts";
import { ListContainer } from "../../components/ListContainer";
import { AccommodationCardSearch } from "../../components/AccommodationCard";
import { Map } from "../../components/Map";
import { WishlistModal } from "../../components/WishlistModal/WishlistModal";
import { AuthModal } from "../../components/AuthModal/AuthModal";
import { wishlistApi } from "../../api";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import {
  getLimitedTotalPages,
  getPaginationItems,
} from "../../features/search/lib/pagination";
import { getViewportFromSearchParams } from "../../features/search/lib/searchParams";
import { useSearchBottomSheet } from "../../features/search/hooks/useSearchBottomSheet";
import { useSearchMapState } from "../../features/search/hooks/useSearchMapState";
import { useSearchResults } from "../../features/search/hooks/useSearchResults";
import styles from "./Search.module.css";

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [selectedAccommodationForWishlist, setSelectedAccommodationForWishlist] = useState<number | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const {
    selectedAccommodationId,
    hoveredAccommodationId,
    isMapExpanded,
    isMapDragMode,
    shouldUpdateMapBounds,
    setHoveredAccommodationId,
    setIsMapDragMode,
    handleAccommodationSelect,
    selectAccommodationId,
    toggleMapExpanded,
    requestMapBoundsUpdate,
    onMapBoundsUpdated,
  } = useSearchMapState();

  const {
    accommodations,
    setAccommodations,
    isLoading,
    currentPage,
    totalPages,
    totalElements,
    handleMapBoundsChange,
    handlePageChange,
  } = useSearchResults({
    searchParams,
    setSearchParams,
    handleError,
    clearError,
    setIsMapDragMode,
    requestMapBoundsUpdate,
  });

  const {
    bottomSheetState,
    isMobileOrTablet,
    bottomSheetRef,
    snapPositions,
    translateY,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    handleMapInteraction,
    handleBottomSheetScroll,
  } = useSearchBottomSheet();

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

  const handleAccommodationCardClick = (accommodationId: number) => {
    // 새 탭에서 열기
    window.open(`/accommodations/${accommodationId}`, '_blank');
    selectAccommodationId(accommodationId);
  };


  return (
    <MainLayout>
      <div className={styles.container}>
        {isMobileOrTablet ? (
          // Mobile/Tablet: Bottom Sheet Layout
          <>
            {/* Map Layer - Fixed Base */}
            <div className={styles.mapLayer}>
              <Map
                accommodations={accommodations}
                selectedAccommodationId={selectedAccommodationId}
                hoveredAccommodationId={hoveredAccommodationId}
                onAccommodationSelect={handleAccommodationSelect}
                onWishlistToggle={handleWishlistToggle}
                checkIn={searchParams.get("checkIn")}
                checkOut={searchParams.get("checkOut")}
                isExpanded={false}
                onExpandToggle={() => {}}
                onBoundsChange={handleMapBoundsChange}
                isMapDragMode={isMapDragMode}
                shouldUpdateMapBounds={shouldUpdateMapBounds}
                onMapBoundsUpdated={onMapBoundsUpdated}
                onMapInteraction={handleMapInteraction}
                viewport={
                  getViewportFromSearchParams(searchParams)
                }
              />
            </div>

            {/* Bottom Sheet - Overlay */}
            <motion.div
              ref={bottomSheetRef}
              className={`${styles.bottomSheet} ${styles[bottomSheetState]} ${
                accommodations.length === 0 ? styles.emptyResults : ""
              }`}
              style={
                isMobileOrTablet
                  ? {
                      y: translateY,
                      touchAction: "pan-y",
                    }
                  : undefined
              }
              drag={isMobileOrTablet ? "y" : false}
              dragElastic={0}
              dragMomentum={false}
              dragConstraints={
                isMobileOrTablet
                  ? {
                      top: -snapPositions.expanded,
                      bottom: -snapPositions.collapsed,
                    }
                  : undefined
              }
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
            >
              {/* Header Section - Always Visible */}
              <div className={styles.bottomSheetHeader}>
                {/* Drag Handle */}
                <div className={styles.dragHandle}>
                  <div className={styles.dragHandleBar} />
                </div>
                
                {/* Title - Always visible in collapsed state */}
                <h2 className={styles.title}>
                  {totalElements >= 1000 
                    ? "숙소 1,000개 이상" 
                    : `숙소 ${totalElements.toLocaleString()}개`}
                </h2>
              </div>

              {/* Content Section - Hidden in collapsed state */}
              <div 
                className={`${styles.bottomSheetContent} ${
                  bottomSheetState === "collapsed" ? styles.hidden : ""
                }`}
                onScroll={handleBottomSheetScroll}
              >
                {isLoading && accommodations.length === 0 ? (
                  <div className={styles.loading}>로딩 중...</div>
                ) : accommodations.length === 0 ? (
                  <div className={styles.empty}>검색 결과가 없습니다.</div>
                ) : (
                  <>
                    <div className={styles.cardGrid}>
                      {accommodations.map((accommodation) => (
                        <div
                          key={accommodation.id}
                          id={`accommodation-${accommodation.id}`}
                          className={`${styles.cardWrapper} ${
                            selectedAccommodationId === accommodation.id ? styles.selected : ""
                          }`}
                        >
                          <AccommodationCardSearch
                            accommodation={accommodation}
                            onClick={() => handleAccommodationCardClick(accommodation.id)}
                            onWishlistToggle={() =>
                              handleWishlistToggle(accommodation.id, accommodation.is_in_wishlist)
                            }
                            checkIn={searchParams.get("checkIn")}
                            checkOut={searchParams.get("checkOut")}
                          />
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className={styles.paginationContainer}>
                        <div className={styles.pagination}>
                          <button
                            className={styles.paginationButton}
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 0 || isLoading}
                          >
                            이전
                          </button>
                          {getPaginationItems({ currentPage, totalPages }).map((page, index) => {
                              if (page === "ellipsis") {
                                return (
                                  <span key={`ellipsis-${index}`} className={styles.paginationEllipsis}>
                                    ...
                                  </span>
                                );
                              }
                              const pageNum = page as number;
                              return (
                                <button
                                  key={pageNum}
                                  className={`${styles.paginationButton} ${
                                    pageNum === currentPage ? styles.paginationButtonActive : ""
                                  }`}
                                  onClick={() => handlePageChange(pageNum)}
                                  disabled={isLoading}
                                >
                                  {pageNum + 1}
                                </button>
                              );
                            })}
                          <button
                            className={styles.paginationButton}
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= getLimitedTotalPages(totalPages) - 1 || isLoading}
                          >
                            다음
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        ) : (
          // Desktop: Original Side-by-Side Layout
          <main className={`${styles.main} ${isMapExpanded ? styles.mapExpanded : ''}`}>
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
                    <ListContainer columns={3} gap={10}>
                      {accommodations.map((accommodation) => (
                        <div
                          key={accommodation.id}
                          id={`accommodation-${accommodation.id}`}
                          onMouseEnter={() => setHoveredAccommodationId(accommodation.id)}
                          onMouseLeave={() => setHoveredAccommodationId(null)}
                          className={`${styles.cardWrapper} ${
                            selectedAccommodationId === accommodation.id ? styles.selected : ""
                          }`}
                        >
                          <AccommodationCardSearch
                            accommodation={accommodation}
                            onClick={() => handleAccommodationCardClick(accommodation.id)}
                            onWishlistToggle={() =>
                              handleWishlistToggle(accommodation.id, accommodation.is_in_wishlist)
                            }
                            checkIn={searchParams.get("checkIn")}
                            checkOut={searchParams.get("checkOut")}
                          />
                        </div>
                      ))}
                    </ListContainer>
                    {totalPages > 1 && (
                      <div className={styles.paginationContainer}>
                        <div className={styles.pagination}>
                          <button
                            className={styles.paginationButton}
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 0 || isLoading}
                          >
                            이전
                          </button>
                          {getPaginationItems({ currentPage, totalPages }).map((page, index) => {
                              if (page === "ellipsis") {
                                return (
                                  <span key={`ellipsis-${index}`} className={styles.paginationEllipsis}>
                                    ...
                                  </span>
                                );
                              }
                              const pageNum = page as number;
                              return (
                                <button
                                  key={pageNum}
                                  className={`${styles.paginationButton} ${
                                    pageNum === currentPage ? styles.paginationButtonActive : ""
                                  }`}
                                  onClick={() => handlePageChange(pageNum)}
                                  disabled={isLoading}
                                >
                                  {pageNum + 1}
                                </button>
                              );
                            })}
                          <button
                            className={styles.paginationButton}
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= getLimitedTotalPages(totalPages) - 1 || isLoading}
                          >
                            다음
                          </button>
                        </div>
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
                onExpandToggle={toggleMapExpanded}
                onBoundsChange={handleMapBoundsChange}
                isMapDragMode={isMapDragMode}
                shouldUpdateMapBounds={shouldUpdateMapBounds}
                onMapBoundsUpdated={onMapBoundsUpdated}
                viewport={
                  getViewportFromSearchParams(searchParams)
                }
              />
            </div>
          </main>
        )}

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
              const isInAnyWishlist = response?.wishlists?.some((w) => w.is_contained) || false;
              
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
