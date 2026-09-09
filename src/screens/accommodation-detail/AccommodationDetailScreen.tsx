import { useRef, type ComponentProps } from "react";
import { useResponsiveLayout } from "../../shared/styles/useResponsiveLayout";
import { AccommodationBookingCard } from "../../features/accommodations/detail/components/AccommodationBookingCard";
import { AccommodationBookingSummary } from "../../features/accommodations/detail/components/AccommodationBookingSummary";
import {
  AccommodationDescriptionModal,
  AccommodationHero,
  AccommodationImageGalleryModal,
  AccommodationLocationSection,
  AccommodationOverview,
  AccommodationReviewsSection,
} from "../../features/accommodations/detail/public";
import {
  DeferredAuthModal,
  type AuthModalProps,
} from "../../features/auth/public";
import { ReviewModal } from "../../features/reviews/public";
import { WishlistModal } from "../../features/wishlist/public";
import {
  Button,
  PageContainer,
  RetryableErrorState,
  Skeleton,
  stateViewRecipes,
  TerminalErrorState,
  ToastHost,
} from "../../shared/ui";
import styles from "./AccommodationDetailScreen.module.css";
import {
  DETAIL_SECTIONS,
  useDetailScrollNavigation,
} from "./useDetailScrollNavigation";

export interface AccommodationDetailReadyView {
  readonly authModal: AuthModalProps;
  readonly bookingCard: ComponentProps<typeof AccommodationBookingCard>;
  readonly descriptionModal: ComponentProps<
    typeof AccommodationDescriptionModal
  >;
  readonly galleryModal: ComponentProps<typeof AccommodationImageGalleryModal>;
  readonly hero: ComponentProps<typeof AccommodationHero>;
  readonly location: ComponentProps<typeof AccommodationLocationSection>;
  readonly overview: ComponentProps<typeof AccommodationOverview>;
  readonly reviewModal: ComponentProps<typeof ReviewModal>;
  readonly reviews: ComponentProps<typeof AccommodationReviewsSection>;
  readonly wishlistModal?: ComponentProps<typeof WishlistModal>;
}

export type AccommodationDetailScreenState =
  | { readonly status: "loading" }
  | {
      readonly status: "retryable-error";
      readonly message: string;
      readonly onRetry: () => void;
    }
  | { readonly status: "terminal-error"; readonly message: string }
  | { readonly status: "ready"; readonly view: AccommodationDetailReadyView };

export interface AccommodationDetailScreenProps {
  readonly errorMessage: string | null;
  readonly onBack?: () => void;
  readonly onClearError: () => void;
  readonly refreshError?: {
    readonly isRetrying: boolean;
    readonly message: string;
    readonly onRetry: () => void;
  } | null;
  readonly state: AccommodationDetailScreenState;
}

export function AccommodationDetailScreen({
  errorMessage,
  onClearError,
  onBack,
  refreshError = null,
  state,
}: AccommodationDetailScreenProps) {
  const stateOwnerRef = useRef<HTMLDivElement>(null);
  const isMobile = useResponsiveLayout() === "mobile-tablet";
  const navigation = useDetailScrollNavigation(
    !isMobile && state.status === "ready",
  );
  const backButton = onBack && (
    <button
      type="button"
      className={styles.stateBackButton}
      onClick={onBack}
      aria-label="이전 화면으로"
    >
      ←
    </button>
  );

  if (state.status === "loading") {
    return (
      <div
        ref={stateOwnerRef}
        aria-label="숙소 상세 상태"
        className={styles.stateOwner}
        role="region"
        tabIndex={-1}
      >
        {backButton}
        <PageContainer
          className={styles.loadingShell}
          variant="full"
          {...stateViewRecipes.loading}
        >
          <span className={styles.loadingAnnouncement}>
            숙소 정보를 불러오는 중입니다.
          </span>
          <div className={styles.loadingHeader}>
            <Skeleton className={styles.titleSkeleton} />
            <Skeleton className={styles.metaSkeleton} />
          </div>
          <Skeleton className={styles.heroSkeleton} />
          <div className={styles.loadingContent}>
            <div className={styles.loadingOverview}>
              <Skeleton className={styles.overviewTitleSkeleton} />
              <Skeleton className={styles.overviewLineSkeleton} />
              <Skeleton className={styles.overviewLineShortSkeleton} />
            </div>
            <Skeleton className={styles.bookingSkeleton} />
          </div>
        </PageContainer>
      </div>
    );
  }

  if (state.status === "retryable-error") {
    return (
      <div
        ref={stateOwnerRef}
        aria-label="숙소 상세 상태"
        className={styles.stateOwner}
        role="region"
        tabIndex={-1}
      >
        {backButton}
        <PageContainer className={styles.stateShell} variant="full">
          <RetryableErrorState
            title="숙소 정보를 불러오지 못했어요"
            description={state.message}
            action={
              <Button
                className={`${styles.actionButton} ${styles.primaryAction}`}
                type="button"
                onClick={() => {
                  stateOwnerRef.current?.focus();
                  state.onRetry();
                }}
              >
                다시 시도
              </Button>
            }
          />
        </PageContainer>
      </div>
    );
  }

  if (state.status === "terminal-error") {
    return (
      <div
        ref={stateOwnerRef}
        aria-label="숙소 상세 상태"
        className={styles.stateOwner}
        role="region"
        tabIndex={-1}
      >
        {backButton}
        <PageContainer className={styles.stateShell} variant="full">
          <TerminalErrorState
            title="숙소 정보를 확인할 수 없어요"
            description={state.message}
          />
        </PageContainer>
      </div>
    );
  }

  const { view } = state;

  return (
    <div
      ref={stateOwnerRef}
      aria-label="숙소 상세 상태"
      className={styles.stateOwner}
      role="region"
      tabIndex={-1}
    >
      {!isMobile && (
        <div
          ref={navigation.navigationRef}
          className={styles.detailNavigation}
          data-visible={navigation.visible}
          aria-hidden={!navigation.visible}
          inert={!navigation.visible}
        >
          <div className={styles.navigationInner}>
            <nav aria-label="숙소 상세 목차" className={styles.sectionLinks}>
              {DETAIL_SECTIONS.filter(
                ({ id }) =>
                  id !== "accommodation-amenities-title" ||
                  view.overview.detailView.amenities.length > 0,
              ).map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  aria-current={
                    navigation.activeSection === id ? "location" : undefined
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    navigation.navigateToSection(id);
                  }}
                >
                  {label}
                </a>
              ))}
            </nav>
            {navigation.showReservation && (
              <AccommodationBookingSummary
                bookingState={view.bookingCard.bookingState}
                bookingActions={view.bookingCard.bookingActions}
                ratingLabel={
                  view.overview.detailView.rating.hasReviews
                    ? view.overview.detailView.rating.averageRatingLabel
                    : undefined
                }
                reviewCountLabel={
                  view.overview.detailView.rating.hasReviews
                    ? view.overview.detailView.rating.reviewCountLabel
                    : undefined
                }
                onRevealBooking={() =>
                  navigation.reserveActionRef.current?.scrollIntoView({
                    block: "center",
                    behavior: "instant",
                  })
                }
              />
            )}
          </div>
        </div>
      )}
      <PageContainer variant="full">
        {refreshError && (
          <div className={styles.refreshError} role="alert">
            <div className={styles.refreshErrorCopy}>
              <strong>최신 숙소 정보를 불러오지 못했어요</strong>
              <span>{refreshError.message}</span>
            </div>
            <Button
              isLoading={refreshError.isRetrying}
              loadingLabel="다시 불러오는 중..."
              size="sm"
              className={`${styles.actionButton} ${styles.secondaryAction}`}
              variant="secondary"
              onClick={refreshError.onRetry}
            >
              다시 시도
            </Button>
          </div>
        )}
        <div
          id="accommodation-photos"
          ref={navigation.heroRef}
          tabIndex={-1}
          className={styles.sectionTarget}
        >
          <AccommodationHero {...view.hero} />
        </div>

        <div className={styles.contentWrapper}>
          <div className={styles.leftColumn}>
            <AccommodationOverview {...view.overview} />
          </div>
          {!isMobile && (
            <div className={styles.sidebar}>
              <AccommodationBookingCard
                {...view.bookingCard}
                reserveActionRef={navigation.reserveActionRef}
              />
            </div>
          )}
        </div>

        <div
          id="accommodation-location"
          tabIndex={-1}
          className={styles.sectionTarget}
        >
          <AccommodationLocationSection {...view.location} />
        </div>
        <div
          id="accommodation-reviews"
          tabIndex={-1}
          className={styles.sectionTarget}
        >
          <AccommodationReviewsSection {...view.reviews} />
        </div>
        {isMobile && (
          <AccommodationBookingCard
            {...view.bookingCard}
            locationLabel={view.overview.detailView.locationLabel}
            {...(view.overview.detailView.rating.hasReviews
              ? {
                  ratingLabel:
                    view.overview.detailView.rating.averageRatingLabel,
                }
              : {})}
          />
        )}
      </PageContainer>

      <ReviewModal {...view.reviewModal} />
      {view.wishlistModal && <WishlistModal {...view.wishlistModal} />}
      <DeferredAuthModal {...view.authModal} />
      <AccommodationDescriptionModal {...view.descriptionModal} />
      <AccommodationImageGalleryModal {...view.galleryModal} />

      {errorMessage && (
        <ToastHost
          closeLabel="오류 닫기"
          message={errorMessage}
          onClose={onClearError}
        />
      )}
    </div>
  );
}
