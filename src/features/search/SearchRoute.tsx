import React from "react";
import {
  useSearchParams,
  type SetURLSearchParams,
} from "react-router-dom";
import { motion } from "framer-motion";
import type { MotionStyle } from "framer-motion";
import { AuthModal } from "../auth/appShell";
import { WishlistModal } from "../wishlist/appShell";
import { ErrorToast } from "../../components/ErrorToast";
import { SearchPagination } from "./components/SearchPagination";
import { SearchResultsList } from "./components/SearchResultsList";
import { Map } from "./components/SearchMap";
import { useSearchRouteController } from "./hooks/useSearchRouteController";
import { getViewportFromSearchParams } from "./lib/searchParams";
import styles from "./SearchRoute.module.css";

const getBottomSheetMotionStyle = (y: MotionStyle["y"]): MotionStyle => ({
  y,
});

export interface SearchRouteProps {
  searchParams?: URLSearchParams;
  setSearchParams?: SetURLSearchParams;
}

type SearchRouteContentProps = Required<SearchRouteProps>;

const SearchRouteContent: React.FC<SearchRouteContentProps> = ({
  searchParams,
  setSearchParams,
}) => {
  const {
    bottomSheet,
    checkIn,
    checkOut,
    clearError,
    error,
    hasResults,
    mapState,
    openAccommodationDetail,
    searchResults,
    wishlist,
  } = useSearchRouteController({ searchParams, setSearchParams });

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
        {bottomSheet.isMobileOrTablet ? (
          // Mobile/Tablet: Bottom Sheet Layout
          <>
            {/* Map Layer - Fixed Base */}
            <div className={styles.mapLayer}>
              <Map
                accommodations={searchResults.accommodationMapItems}
                selectedAccommodationId={mapState.selectedAccommodationId}
                hoveredAccommodationId={mapState.hoveredAccommodationId}
                onAccommodationSelect={mapState.handleAccommodationSelect}
                onWishlistToggle={wishlist.openWishlistModal}
                detailSearchParams={searchParams}
                checkIn={checkIn}
                checkOut={checkOut}
                isExpanded={false}
                onExpandToggle={() => {}}
                onBoundsChange={searchResults.handleMapBoundsChange}
                isMapDragMode={mapState.isMapDragMode}
                shouldUpdateMapBounds={mapState.shouldUpdateMapBounds}
                onMapBoundsUpdated={mapState.onMapBoundsUpdated}
                onMapInteraction={bottomSheet.handleMapInteraction}
                viewport={getViewportFromSearchParams(searchParams)}
              />
            </div>

            {/* Bottom Sheet - Overlay */}
            <motion.div
              ref={bottomSheet.bottomSheetRef}
              className={`${styles.bottomSheet} ${styles[bottomSheet.bottomSheetState]} ${
                searchResults.accommodationCards.length === 0 ? styles.emptyResults : ""
              }`}
              style={getBottomSheetMotionStyle(bottomSheet.translateY)}
              drag={bottomSheet.isMobileOrTablet ? "y" : false}
              dragElastic={0}
              dragMomentum={false}
              dragConstraints={
                bottomSheet.isMobileOrTablet
                  ? {
                      top: -bottomSheet.snapPositions.expanded,
                      bottom: -bottomSheet.snapPositions.collapsed,
                    }
                  : undefined
              }
              onDragStart={bottomSheet.handleDragStart}
              onDrag={bottomSheet.handleDrag}
              onDragEnd={bottomSheet.handleDragEnd}
            >
              {/* Header Section - Always Visible */}
              <div className={styles.bottomSheetHeader}>
                {/* Drag Handle */}
                <div className={styles.dragHandle}>
                  <div className={styles.dragHandleBar} />
                </div>

                {/* Title - Always visible in collapsed state */}
                <h2 className={styles.title}>
                  {searchResults.totalElements >= 1000
                    ? "숙소 1,000개 이상"
                    : `숙소 ${searchResults.totalElements.toLocaleString()}개`}
                </h2>
              </div>

              {/* Content Section - Hidden in collapsed state */}
              <div
                className={`${styles.bottomSheetContent} ${
                  bottomSheet.bottomSheetState === "collapsed" ? styles.hidden : ""
                }`}
                onScroll={bottomSheet.handleBottomSheetScroll}
              >
                <SearchResultsList
                  accommodations={searchResults.accommodationCards}
                  isLoading={searchResults.isLoading}
                  selectedAccommodationId={mapState.selectedAccommodationId}
                  onAccommodationClick={openAccommodationDetail}
                  onWishlistToggle={wishlist.openWishlistModal}
                  detailSearchParams={searchParams}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  layout="bottomSheet"
                  classNames={resultsListClassNames}
                />
                {hasResults && (
                  <SearchPagination
                    currentPage={searchResults.currentPage}
                    totalPages={searchResults.totalPages}
                    isLoading={searchResults.isLoading}
                    onPageChange={searchResults.handlePageChange}
                    classNames={paginationClassNames}
                  />
                )}
              </div>
            </motion.div>
          </>
        ) : (
          // Desktop: Original Side-by-Side Layout
          <div
            className={`${styles.main} ${mapState.isMapExpanded ? styles.mapExpanded : ""}`}
          >
            <div className={styles.results}>
              <h2 className={styles.title}>
                {searchResults.totalElements >= 1000
                  ? "숙소 1,000개 이상"
                  : `숙소 ${searchResults.totalElements.toLocaleString()}개`}
              </h2>
              <SearchResultsList
                accommodations={searchResults.accommodationCards}
                isLoading={searchResults.isLoading}
                selectedAccommodationId={mapState.selectedAccommodationId}
                onAccommodationClick={openAccommodationDetail}
                onWishlistToggle={wishlist.openWishlistModal}
                onHoveredAccommodationChange={mapState.setHoveredAccommodationId}
                detailSearchParams={searchParams}
                checkIn={checkIn}
                checkOut={checkOut}
                layout="desktop"
                classNames={resultsListClassNames}
              />
              {hasResults && (
                <SearchPagination
                  currentPage={searchResults.currentPage}
                  totalPages={searchResults.totalPages}
                  isLoading={searchResults.isLoading}
                  onPageChange={searchResults.handlePageChange}
                  classNames={paginationClassNames}
                />
              )}
            </div>
            <div className={styles.mapSection}>
              <Map
                accommodations={searchResults.accommodationMapItems}
                selectedAccommodationId={mapState.selectedAccommodationId}
                hoveredAccommodationId={mapState.hoveredAccommodationId}
                onAccommodationSelect={mapState.handleAccommodationSelect}
                onWishlistToggle={wishlist.openWishlistModal}
                detailSearchParams={searchParams}
                checkIn={checkIn}
                checkOut={checkOut}
                isExpanded={mapState.isMapExpanded}
                onExpandToggle={mapState.toggleMapExpanded}
                onBoundsChange={searchResults.handleMapBoundsChange}
                isMapDragMode={mapState.isMapDragMode}
                shouldUpdateMapBounds={mapState.shouldUpdateMapBounds}
                onMapBoundsUpdated={mapState.onMapBoundsUpdated}
                viewport={getViewportFromSearchParams(searchParams)}
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

      {wishlist.selectedAccommodationForWishlist !== null && (
        <WishlistModal
          isOpen={wishlist.wishlistModalOpen}
          onClose={wishlist.closeWishlistModal}
          accommodationId={wishlist.selectedAccommodationForWishlist}
        />
      )}

      <AuthModal
        isOpen={wishlist.authModalOpen}
        onClose={wishlist.closeAuthModal}
        onSuccess={wishlist.handleAuthSuccess}
        initialMode="login"
      />
    </>
  );
};

const SearchRouteWithRouter: React.FC<SearchRouteProps> = (props) => {
  const [routeSearchParams, routeSetSearchParams] = useSearchParams();

  return (
    <SearchRouteContent
      searchParams={props.searchParams ?? routeSearchParams}
      setSearchParams={props.setSearchParams ?? routeSetSearchParams}
    />
  );
};

export const SearchRoute: React.FC<SearchRouteProps> = (props) => {
  if (props.searchParams && props.setSearchParams) {
    return (
      <SearchRouteContent
        searchParams={props.searchParams}
        setSearchParams={props.setSearchParams}
      />
    );
  }

  return <SearchRouteWithRouter {...props} />;
};
