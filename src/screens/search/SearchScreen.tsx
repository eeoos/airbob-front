import { useId, type ComponentProps, type RefObject } from "react";
import { motion, type MotionStyle } from "framer-motion";
import { AuthModal } from "../../features/auth/components/AuthModal";
import type {
  SearchAccommodationCardViewModel,
  SearchAccommodationMapViewModel,
} from "../../features/search/lib/searchAccommodationViewModel";
import { SearchPagination } from "../../features/search/components/SearchPagination";
import { SearchResultsList } from "../../features/search/components/SearchResultsList";
import { Map } from "../../features/search/components/SearchMap";
import type {
  SearchMapBounds,
  SearchMapViewport,
} from "../../features/search/components/SearchMap/types";
import { WishlistModal } from "../../features/wishlist/components/WishlistModal";
import { ToastHost } from "../../shared/ui";
import styles from "./SearchScreen.module.css";

type MotionSectionProps = ComponentProps<typeof motion.section>;

export interface SearchScreenBottomSheetProps {
  readonly bottomSheetHandleRef: RefObject<HTMLButtonElement | null>;
  readonly bottomSheetRef: RefObject<HTMLElement | null>;
  readonly bottomSheetState: "collapsed" | "half" | "expanded";
  readonly handleBottomSheetKeyDown: NonNullable<
    ComponentProps<"button">["onKeyDown"]
  >;
  readonly handleBottomSheetScroll: NonNullable<
    ComponentProps<"div">["onScroll"]
  >;
  readonly handleBottomSheetToggle: () => void;
  readonly handleDrag: MotionSectionProps["onDrag"];
  readonly handleDragEnd: MotionSectionProps["onDragEnd"];
  readonly handleDragStart: MotionSectionProps["onDragStart"];
  readonly handleMapInteraction: () => void;
  readonly isMobileOrTablet: boolean;
  readonly snapPositions: Readonly<{
    collapsed: number;
    half: number;
    expanded: number;
  }>;
  readonly translateY: MotionStyle["y"];
}

export interface SearchScreenMapProps {
  readonly handleAccommodationSelect: (
    accommodation: SearchAccommodationMapViewModel | null,
  ) => void;
  readonly hoveredAccommodationId: number | null;
  readonly isMapDragMode: boolean;
  readonly isMapExpanded: boolean;
  readonly onMapBoundsUpdated: () => void;
  readonly requestBounds: (bounds: SearchMapBounds) => void;
  readonly selectedAccommodationId: number | null;
  readonly setHoveredAccommodationId: (accommodationId: number | null) => void;
  readonly shouldUpdateMapBounds: boolean;
  readonly toggleMapExpanded: () => void;
  readonly viewport: SearchMapViewport | null;
}

export interface SearchScreenResultsProps {
  readonly accommodationCards: SearchAccommodationCardViewModel[];
  readonly accommodationMapItems: SearchAccommodationMapViewModel[];
  readonly currentPage: number;
  readonly isLoading: boolean;
  readonly isPlaceholderData: boolean;
  readonly totalElements: number;
  readonly totalPages: number;
}

export interface SearchScreenProps {
  readonly authModal: ComponentProps<typeof AuthModal>;
  readonly bottomSheet: SearchScreenBottomSheetProps;
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly errorMessage: string | null;
  readonly getAccommodationHref: (accommodationId: number) => string;
  readonly map: SearchScreenMapProps;
  readonly onAccommodationOpen: (accommodationId: number) => void;
  readonly onClearError: () => void;
  readonly onPageChange: (page: number) => void;
  readonly onWishlistToggle?: (accommodationId: number) => void;
  readonly results: SearchScreenResultsProps;
  readonly wishlistModal:
    | Omit<ComponentProps<typeof WishlistModal>, "isOpen">
    | null;
}

const getBottomSheetMotionStyle = (y: MotionStyle["y"]): MotionStyle => ({
  y,
});

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
  status: styles.paginationStatus,
};

const bottomSheetStateLabels: Record<
  SearchScreenBottomSheetProps["bottomSheetState"],
  string
> = {
  collapsed: "접힘",
  half: "중간",
  expanded: "펼침",
};

export function SearchScreen({
  authModal,
  bottomSheet,
  checkIn,
  checkOut,
  errorMessage,
  getAccommodationHref,
  map,
  onAccommodationOpen,
  onClearError,
  onPageChange,
  onWishlistToggle,
  results,
  wishlistModal,
}: SearchScreenProps) {
  const hasResults = results.accommodationCards.length > 0;
  const bottomSheetContentId = useId();
  const bottomSheetTitleId = useId();
  const bottomSheetStateLabel =
    bottomSheetStateLabels[bottomSheet.bottomSheetState];

  return (
    <>
      <div className={styles.container}>
        {bottomSheet.isMobileOrTablet ? (
          <>
            <div className={styles.mapLayer}>
              <Map
                accommodations={results.accommodationMapItems}
                selectedAccommodationId={map.selectedAccommodationId}
                hoveredAccommodationId={map.hoveredAccommodationId}
                onAccommodationSelect={map.handleAccommodationSelect}
                onWishlistToggle={onWishlistToggle}
                getAccommodationHref={getAccommodationHref}
                checkIn={checkIn}
                checkOut={checkOut}
                isExpanded={false}
                onExpandToggle={() => {}}
                onBoundsChange={map.requestBounds}
                isMapDragMode={map.isMapDragMode}
                shouldUpdateMapBounds={map.shouldUpdateMapBounds}
                onMapBoundsUpdated={map.onMapBoundsUpdated}
                onMapInteraction={bottomSheet.handleMapInteraction}
                viewport={map.viewport}
              />
            </div>

            <motion.section
              ref={bottomSheet.bottomSheetRef}
              aria-labelledby={bottomSheetTitleId}
              className={`${styles.bottomSheet} ${
                styles[bottomSheet.bottomSheetState]
              } ${
                results.accommodationCards.length === 0
                  ? styles.emptyResults
                  : ""
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
              <div className={styles.bottomSheetHeader}>
                <button
                  ref={bottomSheet.bottomSheetHandleRef}
                  type="button"
                  className={styles.dragHandle}
                  aria-controls={bottomSheetContentId}
                  aria-expanded={bottomSheet.bottomSheetState !== "collapsed"}
                  aria-keyshortcuts="ArrowUp ArrowDown Home End"
                  aria-label={`검색 결과 패널 조절, 현재 ${bottomSheetStateLabel}`}
                  data-state={bottomSheet.bottomSheetState}
                  onClick={bottomSheet.handleBottomSheetToggle}
                  onKeyDown={bottomSheet.handleBottomSheetKeyDown}
                >
                  <span className={styles.dragHandleBar} aria-hidden="true" />
                </button>

                <h2 id={bottomSheetTitleId} className={styles.title}>
                  {results.totalElements >= 1000
                    ? "숙소 1,000개 이상"
                    : `숙소 ${results.totalElements.toLocaleString()}개`}
                </h2>
              </div>

              <div
                id={bottomSheetContentId}
                role="group"
                aria-label="검색 결과 목록"
                className={`${styles.bottomSheetContent} ${
                  bottomSheet.bottomSheetState === "collapsed"
                    ? styles.hidden
                    : ""
                }`}
                hidden={bottomSheet.bottomSheetState === "collapsed"}
                onScroll={bottomSheet.handleBottomSheetScroll}
              >
                <SearchResultsList
                  accommodations={results.accommodationCards}
                  isLoading={results.isLoading}
                  selectedAccommodationId={map.selectedAccommodationId}
                  onAccommodationClick={onAccommodationOpen}
                  onWishlistToggle={onWishlistToggle}
                  getAccommodationHref={getAccommodationHref}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  layout="bottomSheet"
                  classNames={resultsListClassNames}
                />
                {hasResults && (
                  <SearchPagination
                    currentPage={results.currentPage}
                    totalPages={results.totalPages}
                    isLoading={results.isLoading}
                    onPageChange={onPageChange}
                    classNames={paginationClassNames}
                    variant="compact"
                  />
                )}
              </div>
            </motion.section>
          </>
        ) : (
          <div
            className={`${styles.main} ${
              map.isMapExpanded ? styles.mapExpanded : ""
            }`}
          >
            <div className={styles.results}>
              <h2 className={styles.title}>
                {results.totalElements >= 1000
                  ? "숙소 1,000개 이상"
                  : `숙소 ${results.totalElements.toLocaleString()}개`}
              </h2>
              <SearchResultsList
                accommodations={results.accommodationCards}
                isLoading={results.isLoading}
                selectedAccommodationId={map.selectedAccommodationId}
                onAccommodationClick={onAccommodationOpen}
                onWishlistToggle={onWishlistToggle}
                onHoveredAccommodationChange={map.setHoveredAccommodationId}
                getAccommodationHref={getAccommodationHref}
                checkIn={checkIn}
                checkOut={checkOut}
                layout="desktop"
                classNames={resultsListClassNames}
              />
              {hasResults && (
                <SearchPagination
                  currentPage={results.currentPage}
                  totalPages={results.totalPages}
                  isLoading={results.isLoading}
                  onPageChange={onPageChange}
                  classNames={paginationClassNames}
                />
              )}
            </div>
            <div className={styles.mapSection}>
              <Map
                accommodations={results.accommodationMapItems}
                selectedAccommodationId={map.selectedAccommodationId}
                hoveredAccommodationId={map.hoveredAccommodationId}
                onAccommodationSelect={map.handleAccommodationSelect}
                onWishlistToggle={onWishlistToggle}
                getAccommodationHref={getAccommodationHref}
                checkIn={checkIn}
                checkOut={checkOut}
                isExpanded={map.isMapExpanded}
                onExpandToggle={map.toggleMapExpanded}
                onBoundsChange={map.requestBounds}
                isMapDragMode={map.isMapDragMode}
                shouldUpdateMapBounds={map.shouldUpdateMapBounds}
                onMapBoundsUpdated={map.onMapBoundsUpdated}
                viewport={map.viewport}
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className={styles.toastContainer}>
            <ToastHost
              closeLabel="오류 닫기"
              message={errorMessage}
              onClose={onClearError}
            />
          </div>
        )}
      </div>

      {wishlistModal &&
        !results.isPlaceholderData &&
        <WishlistModal {...wishlistModal} isOpen />}

      <AuthModal {...authModal} />
    </>
  );
}
