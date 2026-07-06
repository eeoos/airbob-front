import React, { useRef, useState, useTransition } from "react";
import type { NavigateFunction, URLSearchParamsInit } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { AuthModal } from "../auth/appShell";
import { ReviewModal, toReviewViewModels } from "../reviews/appShell";
import { WishlistModal } from "../wishlist/appShell";
import { AccommodationBookingCard } from "./components/AccommodationBookingCard";
import { AccommodationDescriptionModal } from "./components/AccommodationDescriptionModal";
import AccommodationHero from "./components/AccommodationHero";
import { AccommodationImageGalleryModal } from "./components/AccommodationImageGalleryModal";
import { AccommodationLocationSection } from "./components/AccommodationLocationSection";
import { AccommodationOverview } from "./components/AccommodationOverview";
import { AccommodationReviewsSection } from "./components/AccommodationReviewsSection";
import { useAccommodationBooking } from "./hooks/useAccommodationBooking";
import { useAccommodationCoupons } from "./hooks/useAccommodationCoupons";
import { useAccommodationDetail } from "./hooks/useAccommodationDetail";
import { useAccommodationImageGallery } from "./hooks/useAccommodationImageGallery";
import { useAccommodationReviews } from "./hooks/useAccommodationReviews";
import { toAccommodationBookingViewModel } from "./lib/accommodationBookingViewModel";
import { toAccommodationDetailViewModel } from "./lib/accommodationDetailViewModel";
import { useOutsideClick } from "../../shared/ui";
import styles from "./AccommodationDetailRoute.module.css";

export interface AccommodationDetailRouteProps {
  accommodationId?: string;
  bookingSearchParams: URLSearchParams;
  setBookingSearchParams: (
    nextInit: URLSearchParamsInit,
    options?: { replace?: boolean }
  ) => void;
  navigate: NavigateFunction;
}

export const AccommodationDetailRoute: React.FC<
  AccommodationDetailRouteProps
> = ({
  accommodationId,
  bookingSearchParams,
  setBookingSearchParams,
  navigate,
}) => {
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dateSectionRef = useRef<HTMLDivElement>(null);
  const datePickerBoundaryRef = useRef<{
    contains: (target: Node) => boolean;
  } | null>(null);
  const [, startTransition] = useTransition();

  const requireAuth = (action: () => void | Promise<void>) => {
    setPendingAction(() => action);
    setIsAuthModalOpen(true);
  };

  const { accommodation, isLoading, reloadAccommodation } =
    useAccommodationDetail({
      accommodationId,
      isAuthenticated,
      handleError,
      clearError,
    });

  const booking = useAccommodationBooking({
    accommodationId,
    accommodation,
    searchParams: bookingSearchParams,
    setSearchParams: setBookingSearchParams,
    isAuthenticated,
    selectedCoupon: null,
    selectedCouponId: null,
    couponDiscount: 0,
    navigate,
    handleError,
    clearError,
    onRequireAuth: requireAuth,
    startTransition,
  });

  const {
    coupons,
    isLoadingCoupons,
    selectedCoupon,
    selectedCouponId,
    setSelectedCouponId,
    issuingCouponId,
    couponDiscount,
    payablePrice,
    handleIssueCoupon,
  } = useAccommodationCoupons({
    isAuthenticated,
    totalPrice: booking.totalPrice,
    handleError,
    clearError,
    onRequireAuth: requireAuth,
  });

  const detailView = accommodation
    ? toAccommodationDetailViewModel(accommodation)
    : null;

  const {
    reviews,
    allReviews,
    isReviewModalOpen,
    setIsReviewModalOpen,
    expandedReviews,
  } = useAccommodationReviews({
    accommodationId,
    totalReviewCount: detailView?.rating.reviewCount ?? 0,
    handleError,
    clearError,
  });

  const imageGallery = useAccommodationImageGallery({
    imageCount: detailView?.heroImages.length ?? 0,
  });

  const {
    adultCount,
    setAdultCount,
    childCount,
    setChildCount,
    infantCount,
    setInfantCount,
    petCount,
    setPetCount,
    isGuestPickerOpen,
    setIsGuestPickerOpen,
    isDatePickerOpen,
    setIsDatePickerOpen,
    checkIn,
    checkOut,
    nights,
    totalPrice,
    formatDate,
    handleDateSelect,
  } = booking;

  const handleReserve = () =>
    booking.handleReserve({
      selectedCoupon,
      selectedCouponId,
      couponDiscount,
    });

  datePickerBoundaryRef.current = {
    contains: (target: Node) =>
      Boolean(
        datePickerRef.current?.contains(target) ||
          dateSectionRef.current?.contains(target)
      ),
  };

  useOutsideClick(
    guestPickerRef,
    () => setIsGuestPickerOpen(false),
    isGuestPickerOpen
  );
  useOutsideClick(
    datePickerBoundaryRef,
    () => setIsDatePickerOpen(false),
    isDatePickerOpen
  );

  if (isLoading) {
    return (
      <>
        <div className={styles.loading}>로딩 중...</div>
      </>
    );
  }

  if (!accommodation || !detailView) {
    return (
      <>
        <div className={styles.error}>숙소를 찾을 수 없습니다.</div>
      </>
    );
  }

  const bookingView = toAccommodationBookingViewModel(accommodation);
  const reviewViews = toReviewViewModels(reviews);
  const allReviewViews = toReviewViewModels(allReviews);
  const bookingState = {
    payablePrice,
    nights,
    totalPrice,
    checkIn,
    checkOut,
    dateSectionRef,
    datePickerRef,
    guestPickerRef,
    isDatePickerOpen,
    isGuestPickerOpen,
    adultCount,
    childCount,
    infantCount,
    petCount,
    isReserving: booking.isReserving,
  };
  const bookingActions = {
    formatDate,
    handleDateSelect,
    setIsDatePickerOpen,
    setIsGuestPickerOpen,
    setAdultCount,
    setChildCount,
    setInfantCount,
    setPetCount,
    onReserve: handleReserve,
  };
  const couponState = {
    coupons,
    isLoadingCoupons,
    selectedCoupon,
    selectedCouponId,
    issuingCouponId,
    couponDiscount,
  };
  const couponActions = {
    setSelectedCouponId,
    handleIssueCoupon,
  };

  return (
    <>
      <div className={styles.container}>
        <AccommodationHero
          detailView={detailView}
          mobileSlideIndex={imageGallery.mobileSlideIndex}
          onMobileSlideIndexChange={imageGallery.setMobileSlideIndex}
          onOpenGallery={imageGallery.openGallery}
          onSave={() => {
            if (!isAuthenticated) {
              setPendingAction(() => () => setIsWishlistModalOpen(true));
              setIsAuthModalOpen(true);
            } else {
              setIsWishlistModalOpen(true);
            }
          }}
          onShare={() => {}}
          onTouchStart={imageGallery.onTouchStart}
          onTouchMove={imageGallery.onTouchMove}
          onTouchEnd={imageGallery.onTouchEnd}
        />

        <div className={styles.contentWrapper}>
          <div className={styles.leftColumn}>
            <AccommodationOverview
              detailView={detailView}
              onOpenDescription={() => setIsDescriptionModalOpen(true)}
            />
          </div>

          <div className={styles.sidebar}>
            <AccommodationBookingCard
              bookingView={bookingView}
              isAuthenticated={isAuthenticated}
              bookingState={bookingState}
              bookingActions={bookingActions}
              couponState={couponState}
              couponActions={couponActions}
            />
          </div>
        </div>

        <AccommodationLocationSection detailView={detailView} />

        <AccommodationReviewsSection
          reviewSummary={detailView.rating}
          reviews={reviewViews}
          expandedReviews={expandedReviews}
          onOpenReviews={() => setIsReviewModalOpen(true)}
        />
      </div>

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        reviews={allReviewViews}
        averageRating={detailView.rating.averageRating}
        totalCount={detailView.rating.reviewCount}
      />
      <WishlistModal
        isOpen={isWishlistModalOpen}
        onClose={() => setIsWishlistModalOpen(false)}
        accommodationId={detailView.id}
        onSuccess={async () => {
          await reloadAccommodation();
        }}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={() => {
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
      />

      {error && <ErrorToast message={error} onClose={clearError} />}

      <AccommodationDescriptionModal
        isOpen={isDescriptionModalOpen}
        description={detailView.description}
        onClose={() => setIsDescriptionModalOpen(false)}
      />

      <AccommodationImageGalleryModal
        isOpen={imageGallery.isImageGalleryOpen}
        accommodationName={detailView.title}
        images={detailView.heroImages}
        currentImageIndex={imageGallery.currentImageIndex}
        onCurrentImageIndexChange={imageGallery.setCurrentImageIndex}
        onClose={imageGallery.closeGallery}
      />
    </>
  );
};
