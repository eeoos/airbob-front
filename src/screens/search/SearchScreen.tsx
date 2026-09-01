import { useId, type ComponentProps, type RefObject } from "react";
import { motion, type MotionStyle } from "framer-motion";
import {
  DeferredAuthModal,
  type AuthModalProps,
} from "../../features/auth/public";
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
import { requireCssModuleClass } from "../../shared/styles/requireCssModuleClass";
import styles from "./SearchScreen.module.css";

type MotionSectionProps = ComponentProps<typeof motion.section>;

interface SearchScreenBottomSheetProps {
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
  readonly handleDrag: NonNullable<MotionSectionProps["onDrag"]>;
  readonly handleDragEnd: NonNullable<MotionSectionProps["onDragEnd"]>;
  readonly handleDragStart: NonNullable<MotionSectionProps["onDragStart"]>;
  readonly handleMapInteraction: () => void;
  readonly isMobileOrTablet: boolean;
  readonly snapPositions: Readonly<{
    collapsed: number;
    half: number;
    expanded: number;
  }>;
  readonly translateY: NonNullable<MotionStyle["y"]>;
}

interface SearchScreenMapProps {
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

interface SearchScreenResultsProps {
  readonly accommodationCards: SearchAccommodationCardViewModel[];
  readonly accommodationMapItems: SearchAccommodationMapViewModel[];
  readonly currentPage: number;
  readonly isLoading: boolean;
  readonly isPlaceholderData: boolean;
  readonly isRefreshing: boolean;
  readonly totalElements: number;
  readonly totalPages: number;
}

export interface SearchScreenProps {
  readonly authModal: AuthModalProps;
  readonly bottomSheet: SearchScreenBottomSheetProps;
  readonly checkIn?: string | undefined;
  readonly checkOut?: string | undefined;
  readonly errorMessage: string | null;
  readonly getAccommodationHref: (accommodationId: number) => string;
  readonly isErrorRetryable: boolean;
  readonly map: SearchScreenMapProps;
  readonly onAccommodationOpen: (accommodationId: number) => void;
  readonly onPageChange: (page: number) => void;
  readonly onRetry: () => void;
  readonly onWishlistToggle?: ((accommodationId: number) => void) | undefined;
  readonly results: SearchScreenResultsProps;
  readonly wishlistModal: Omit<
    ComponentProps<typeof WishlistModal>,
    "isOpen"
  > | null;
}

const getBottomSheetMotionStyle = (
  y: NonNullable<MotionStyle["y"]>,
): MotionStyle => ({
  y,
});

const resultsListClassNames = {
  loading: requireCssModuleClass(styles.loading),
  empty: requireCssModuleClass(styles.empty),
  cardGrid: requireCssModuleClass(styles.cardGrid),
  cardWrapper: requireCssModuleClass(styles.cardWrapper),
  selected: requireCssModuleClass(styles.selected),
};

const paginationClassNames = {
  container: requireCssModuleClass(styles.paginationContainer),
  pagination: requireCssModuleClass(styles.pagination),
  button: requireCssModuleClass(styles.paginationButton),
  activeButton: requireCssModuleClass(styles.paginationButtonActive),
  ellipsis: requireCssModuleClass(styles.paginationEllipsis),
  status: requireCssModuleClass(styles.paginationStatus),
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
  isErrorRetryable,
  map,
  onAccommodationOpen,
  onPageChange,
  onRetry,
  onWishlistToggle,
  results,
  wishlistModal,
}: SearchScreenProps) {
  const hasResults = results.accommodationCards.length > 0;
  const bottomSheetContentId = useId();
  const bottomSheetTitleId = useId();
  const bottomSheetStateLabel =
    bottomSheetStateLabels[bottomSheet.bottomSheetState];
  const resultCountLabel =
    results.isLoading && !hasResults
      ? "숙소를 찾는 중"
      : errorMessage && !hasResults
        ? "검색 결과"
        : results.totalElements >= 1000
          ? "숙소 1,000개 이상"
          : `숙소 ${results.totalElements.toLocaleString()}개`;
  const isPaginationBusy =
    results.isLoading || results.isPlaceholderData || results.isRefreshing;
  const renderMap = (
    isExpanded: boolean,
    onExpandToggle: () => void,
    onMapInteraction?: () => void,
  ) => (
    <Map
      accommodations={results.accommodationMapItems}
      selectedAccommodationId={map.selectedAccommodationId}
      hoveredAccommodationId={map.hoveredAccommodationId}
      onAccommodationSelect={map.handleAccommodationSelect}
      getAccommodationHref={getAccommodationHref}
      isExpanded={isExpanded}
      onExpandToggle={onExpandToggle}
      onBoundsChange={map.requestBounds}
      isMapDragMode={map.isMapDragMode}
      shouldUpdateMapBounds={map.shouldUpdateMapBounds}
      onMapBoundsUpdated={map.onMapBoundsUpdated}
      viewport={map.viewport}
      checkIn={checkIn}
      checkOut={checkOut}
      onWishlistToggle={onWishlistToggle}
      onMapInteraction={onMapInteraction}
    />
  );
  const renderResults = (
    layout: "desktop" | "bottomSheet",
    variant: "compact" | "full",
  ) => (
    <>
      <SearchResultsList
        accommodations={results.accommodationCards}
        errorMessage={errorMessage}
        isErrorRetryable={isErrorRetryable}
        isLoading={results.isLoading}
        isRefreshing={results.isRefreshing}
        selectedAccommodationId={map.selectedAccommodationId}
        onAccommodationClick={onAccommodationOpen}
        onHoveredAccommodationChange={map.setHoveredAccommodationId}
        getAccommodationHref={getAccommodationHref}
        layout={layout}
        classNames={resultsListClassNames}
        checkIn={checkIn}
        checkOut={checkOut}
        onWishlistToggle={onWishlistToggle}
        onRetry={onRetry}
      />
      {hasResults && (
        <SearchPagination
          currentPage={results.currentPage}
          totalPages={results.totalPages}
          isLoading={isPaginationBusy}
          onPageChange={onPageChange}
          classNames={paginationClassNames}
          variant={variant}
        />
      )}
    </>
  );
  return (
    <>
      <div className={styles.container}>
        {bottomSheet.isMobileOrTablet ? (
          <>
            <div className={styles.mapLayer}>
              {renderMap(false, () => {}, bottomSheet.handleMapInteraction)}
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
              {...(bottomSheet.isMobileOrTablet
                ? {
                    dragConstraints: {
                      top: -bottomSheet.snapPositions.expanded,
                      bottom: -bottomSheet.snapPositions.collapsed,
                    },
                  }
                : {})}
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
                  {resultCountLabel}
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
                {renderResults("bottomSheet", "compact")}
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
              <h2 className={styles.title}>{resultCountLabel}</h2>
              {renderResults("desktop", "full")}
            </div>
            <div className={styles.mapSection}>
              {renderMap(map.isMapExpanded, map.toggleMapExpanded)}
            </div>
          </div>
        )}
      </div>

      {wishlistModal && !results.isPlaceholderData && (
        <WishlistModal {...wishlistModal} isOpen />
      )}

      {authModal.isOpen && <DeferredAuthModal {...authModal} />}
    </>
  );
}
