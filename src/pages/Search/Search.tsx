import React from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Map } from "../../components/Map";
import { WishlistModal } from "../../components/WishlistModal/WishlistModal";
import { AuthModal } from "../../features/auth/components/AuthModal";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import { SearchPagination } from "../../features/search/components/SearchPagination";
import { SearchResultsList } from "../../features/search/components/SearchResultsList";
import { getViewportFromSearchParams } from "../../features/search/lib/searchParams";
import { useSearchBottomSheet } from "../../features/search/hooks/useSearchBottomSheet";
import { useSearchMapState } from "../../features/search/hooks/useSearchMapState";
import { useSearchResults } from "../../features/search/hooks/useSearchResults";
import { useSearchWishlistModal } from "../../features/search/hooks/useSearchWishlistModal";
import { routeTo } from "../../routes/paths";
import styles from "./Search.module.css";

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();

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
    updateAccommodationWishlistStatus,
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

  const {
    authModalOpen,
    closeAuthModal,
    closeWishlistModal,
    openWishlistModal,
    selectedAccommodationForWishlist,
    wishlistModalOpen,
  } = useSearchWishlistModal({
    isAuthenticated,
    onWishlistStatusChange: updateAccommodationWishlistStatus,
  });

  const handleAccommodationCardClick = (accommodationId: number) => {
    // 새 탭에서 열기
    window.open(routeTo.accommodationDetail(accommodationId), '_blank');
    selectAccommodationId(accommodationId);
  };

  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const hasResults = accommodations.length > 0;

  const resultsListClassNames = {
    loading: styles.loading,
    empty: styles.empty,
    cardGrid: styles.cardGrid,
    cardWrapper: styles.cardWrapper,
    selected: styles.selected,
  };

  const paginationClassNames = {
    container: styles.paginationContainer,
    pagination: styles.pagination,
    button: styles.paginationButton,
    activeButton: styles.paginationButtonActive,
    ellipsis: styles.paginationEllipsis,
  };

  return (
    <>
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
                onWishlistToggle={openWishlistModal}
                checkIn={checkIn}
                checkOut={checkOut}
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
                <SearchResultsList
                  accommodations={accommodations}
                  isLoading={isLoading}
                  selectedAccommodationId={selectedAccommodationId}
                  onAccommodationClick={handleAccommodationCardClick}
                  onWishlistToggle={openWishlistModal}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  layout="bottomSheet"
                  classNames={resultsListClassNames}
                />
                {hasResults && (
                  <SearchPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    isLoading={isLoading}
                    onPageChange={handlePageChange}
                    classNames={paginationClassNames}
                  />
                )}
              </div>
            </motion.div>
          </>
        ) : (
          // Desktop: Original Side-by-Side Layout
          <div className={`${styles.main} ${isMapExpanded ? styles.mapExpanded : ''}`}>
            <div className={styles.results}>
                <h2 className={styles.title}>
                  {totalElements >= 1000 
                    ? "숙소 1,000개 이상" 
                    : `숙소 ${totalElements.toLocaleString()}개`}
                </h2>
                <SearchResultsList
                  accommodations={accommodations}
                  isLoading={isLoading}
                  selectedAccommodationId={selectedAccommodationId}
                  onAccommodationClick={handleAccommodationCardClick}
                  onWishlistToggle={openWishlistModal}
                  onHoveredAccommodationChange={setHoveredAccommodationId}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  layout="desktop"
                  classNames={resultsListClassNames}
                />
                {hasResults && (
                  <SearchPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    isLoading={isLoading}
                    onPageChange={handlePageChange}
                    classNames={paginationClassNames}
                  />
                )}
            </div>
            <div className={styles.mapSection}>
              <Map
                accommodations={accommodations}
                selectedAccommodationId={selectedAccommodationId}
                hoveredAccommodationId={hoveredAccommodationId}
                onAccommodationSelect={handleAccommodationSelect}
                onWishlistToggle={openWishlistModal}
                checkIn={checkIn}
                checkOut={checkOut}
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
          </div>
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
          onClose={closeWishlistModal}
          accommodationId={selectedAccommodationForWishlist}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        initialMode="login"
      />
    </>
  );
};

export default Search;
