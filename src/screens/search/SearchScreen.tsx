import {
  useId,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type RefObject,
} from "react";
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
  readonly bottomSheetContentRef: RefObject<HTMLDivElement | null>;
  readonly bottomSheetHeaderRef: RefObject<HTMLDivElement | null>;
  readonly bottomSheetRef: RefObject<HTMLElement | null>;
  readonly bottomSheetState: "collapsed" | "half" | "expanded";
  readonly handleBottomSheetKeyDown: NonNullable<
    ComponentProps<"button">["onKeyDown"]
  >;
  readonly handleBottomSheetPointerDown: NonNullable<
    ComponentProps<"div">["onPointerDown"]
  >;
  readonly handleBottomSheetPointerEnd: NonNullable<
    ComponentProps<"div">["onPointerUp"]
  >;
  readonly handleBottomSheetToggle: () => void;
  readonly handleDrag: NonNullable<MotionSectionProps["onDrag"]>;
  readonly handleDragEnd: NonNullable<MotionSectionProps["onDragEnd"]>;
  readonly handleDragStart: NonNullable<MotionSectionProps["onDragStart"]>;
  readonly handleMapInteraction: () => void;
  readonly handleMapReturn: () => void;
  readonly isDragging: boolean;
  readonly isMobileOrTablet: boolean;
  readonly dragControls: NonNullable<MotionSectionProps["dragControls"]>;
  readonly snapPositions: Readonly<{
    collapsed: number;
    half: number;
    expanded: number;
  }>;
  readonly translateY: NonNullable<MotionStyle["y"]>;
  readonly visibleSheetHeight: number;
}

interface SearchScreenMapProps {
  readonly autoFitAccommodations?: boolean;
  readonly boundsRequestKey: string;
  readonly handleAccommodationSelect: (
    accommodation: SearchAccommodationMapViewModel | null,
  ) => void;
  readonly hoveredAccommodationId: number | null;
  readonly isMapDragMode: boolean;
  readonly isMapExpanded: boolean;
  readonly onBoundsDragCancel: () => void;
  readonly onBoundsDragStart: () => void;
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
  visibleSheetHeight: number,
): MotionStyle & { "--search-bottom-sheet-visible-height": string } => ({
  y,
  "--search-bottom-sheet-visible-height": `${visibleSheetHeight}px`,
});

const resultsListClassNames = {
  loading: requireCssModuleClass(styles.loading),
  empty: requireCssModuleClass(styles.empty),
  cardGrid: requireCssModuleClass(styles.cardGrid),
  cardWrapper: requireCssModuleClass(styles.cardWrapper),
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
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const mobileResultsScrollRef = bottomSheet.bottomSheetContentRef;
  const isMobileOrTablet = bottomSheet.isMobileOrTablet;
  useLayoutEffect(() => {
    const scrollArea = isMobileOrTablet
      ? mobileResultsScrollRef.current
      : resultsScrollRef.current;
    if (scrollArea) scrollArea.scrollTop = 0;
  }, [results.currentPage, isMobileOrTablet, mobileResultsScrollRef]);

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
    onExpandToggle?: () => void,
    onMapInteraction?: () => void,
  ) => (
    <Map
      autoFitAccommodations={map.autoFitAccommodations}
      isWaitingForResults={
        results.isLoading || results.isPlaceholderData || results.isRefreshing
      }
      accommodations={results.accommodationMapItems}
      boundsRequestKey={map.boundsRequestKey}
      selectedAccommodationId={map.selectedAccommodationId}
      hoveredAccommodationId={map.hoveredAccommodationId}
      onAccommodationSelect={map.handleAccommodationSelect}
      getAccommodationHref={getAccommodationHref}
      onAccommodationOpen={onAccommodationOpen}
      isExpanded={isExpanded}
      onBoundsChange={map.requestBounds}
      onBoundsDragCancel={map.onBoundsDragCancel}
      onBoundsDragStart={map.onBoundsDragStart}
      isMapDragMode={map.isMapDragMode}
      shouldUpdateMapBounds={map.shouldUpdateMapBounds}
      onMapBoundsUpdated={map.onMapBoundsUpdated}
      viewport={map.viewport}
      checkIn={checkIn}
      checkOut={checkOut}
      onWishlistToggle={onWishlistToggle}
      onMapInteraction={onMapInteraction}
      {...(onExpandToggle === undefined ? {} : { onExpandToggle })}
    />
  );
  const renderResults = (layout: "desktop" | "bottomSheet") => (
    <SearchResultsList
      accommodations={results.accommodationCards}
      errorMessage={errorMessage}
      isErrorRetryable={isErrorRetryable}
      isLoading={results.isLoading}
      isRefreshing={results.isRefreshing}
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
  );
  const renderPagination = (variant: "compact" | "full") =>
    hasResults && (
      <SearchPagination
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        isLoading={isPaginationBusy}
        onPageChange={onPageChange}
        classNames={paginationClassNames}
        variant={variant}
      />
    );
  return (
    <>
      <div className={styles.container}>
        {bottomSheet.isMobileOrTablet ? (
          <>
            <motion.div
              aria-hidden={
                bottomSheet.bottomSheetState === "expanded" || undefined
              }
              className={styles.mapLayer}
              data-search-mobile-map=""
              data-testid="search-mobile-map-layer"
              inert={bottomSheet.bottomSheetState === "expanded"}
              style={{
                height: bottomSheet.translateY,
                // Keep a usable canvas under the expanded list for camera updates.
                minHeight: bottomSheet.snapPositions.half,
              }}
            >
              {renderMap(false, undefined, bottomSheet.handleMapInteraction)}
            </motion.div>

            <motion.section
              ref={bottomSheet.bottomSheetRef}
              aria-labelledby={bottomSheetTitleId}
              className={`${styles.bottomSheet} ${
                styles[bottomSheet.bottomSheetState]
              } ${bottomSheet.isDragging ? styles.dragging : ""}`}
              style={getBottomSheetMotionStyle(
                bottomSheet.translateY,
                bottomSheet.visibleSheetHeight,
              )}
              data-bottom-sheet="search-results"
              data-state={bottomSheet.bottomSheetState}
              drag={bottomSheet.isMobileOrTablet ? "y" : false}
              dragControls={bottomSheet.dragControls}
              dragElastic={0}
              dragListener={false}
              dragMomentum={false}
              {...(bottomSheet.isMobileOrTablet
                ? {
                    dragConstraints: {
                      top: bottomSheet.snapPositions.expanded,
                      bottom: bottomSheet.snapPositions.collapsed,
                    },
                  }
                : {})}
              onDragStart={bottomSheet.handleDragStart}
              onDrag={bottomSheet.handleDrag}
              onDragEnd={bottomSheet.handleDragEnd}
            >
              <div
                ref={bottomSheet.bottomSheetContentRef}
                className={styles.bottomSheetViewport}
                role="region"
                aria-label="숙소 목록 스크롤"
                data-search-sheet-scroll=""
              >
                <div
                  ref={bottomSheet.bottomSheetHeaderRef}
                  className={styles.bottomSheetHeader}
                  data-search-sheet-header=""
                  onPointerCancel={bottomSheet.handleBottomSheetPointerEnd}
                  onPointerDown={bottomSheet.handleBottomSheetPointerDown}
                  onPointerUp={bottomSheet.handleBottomSheetPointerEnd}
                >
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
                    bottomSheet.bottomSheetState === "collapsed" &&
                    !bottomSheet.isDragging
                      ? styles.hidden
                      : ""
                  }`}
                  aria-hidden={
                    bottomSheet.bottomSheetState === "collapsed" || undefined
                  }
                  inert={bottomSheet.bottomSheetState === "collapsed"}
                  hidden={
                    bottomSheet.bottomSheetState === "collapsed" &&
                    !bottomSheet.isDragging
                  }
                >
                  {renderResults("bottomSheet")}
                  {renderPagination("compact")}
                </div>
              </div>
              {bottomSheet.bottomSheetState === "expanded" && (
                <button
                  type="button"
                  className={styles.mapReturnButton}
                  onClick={bottomSheet.handleMapReturn}
                >
                  지도 보기
                  <svg
                    className={styles.mapReturnButtonIcon}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="m3.5 5.5 5-2 7 2 5-2v15l-5 2-7-2-5 2v-15Z" />
                    <path d="M8.5 3.5v15M15.5 5.5v15" />
                  </svg>
                </button>
              )}
            </motion.section>
          </>
        ) : (
          <div
            className={`${styles.main} ${
              map.isMapExpanded ? styles.mapExpanded : ""
            }`}
          >
            <div
              aria-hidden={map.isMapExpanded || undefined}
              aria-label="숙소 검색 결과 패널"
              className={styles.results}
              data-search-pane="results"
              inert={map.isMapExpanded}
              role="region"
            >
              <div
                ref={resultsScrollRef}
                aria-label="숙소 목록 스크롤"
                className={styles.resultsScrollArea}
                data-search-results-scroll=""
                role="region"
              >
                <h2 className={styles.title}>{resultCountLabel}</h2>
                {renderResults("desktop")}
                {renderPagination("full")}
              </div>
            </div>
            <div className={styles.mapSection} data-search-pane="map">
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
