import React, { useEffect, useRef, useState, useTransition } from "react";
import type { NavigateFunction, URLSearchParamsInit } from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { AuthModal } from "../auth/components/AuthModal";
import { ReviewModal } from "../reviews/components/ReviewModal/ReviewModal";
import { WishlistModal } from "../wishlist/components/WishlistModal";
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

  const {
    reviews,
    allReviews,
    isReviewModalOpen,
    setIsReviewModalOpen,
    expandedReviews,
  } = useAccommodationReviews({
    accommodationId,
    totalReviewCount: accommodation?.review_summary.total_count ?? 0,
    handleError,
    clearError,
  });

  const imageGallery = useAccommodationImageGallery({
    imageCount: accommodation?.images.length ?? 0,
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        isGuestPickerOpen &&
        guestPickerRef.current &&
        !guestPickerRef.current.contains(target)
      ) {
        setIsGuestPickerOpen(false);
      }

      if (isDatePickerOpen) {
        const isInsideDatePicker = datePickerRef.current?.contains(target);
        const isInsideDateSection = dateSectionRef.current?.contains(target);

        if (!isInsideDatePicker && !isInsideDateSection) {
          setIsDatePickerOpen(false);
        }
      }
    };

    if (isGuestPickerOpen || isDatePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    isGuestPickerOpen,
    isDatePickerOpen,
    setIsGuestPickerOpen,
    setIsDatePickerOpen,
  ]);

  if (isLoading) {
    return (
      <>
        <div className={styles.loading}>로딩 중...</div>
      </>
    );
  }

  if (!accommodation) {
    return (
      <>
        <div className={styles.error}>숙소를 찾을 수 없습니다.</div>
      </>
    );
  }

  return (
    <>
      <div className={styles.container}>
        <AccommodationHero
          accommodation={accommodation}
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
              accommodation={accommodation}
              onOpenDescription={() => setIsDescriptionModalOpen(true)}
            />
          </div>

          <div className={styles.sidebar}>
            <AccommodationBookingCard
              accommodation={accommodation}
              isAuthenticated={isAuthenticated}
              payablePrice={payablePrice}
              nights={nights}
              totalPrice={totalPrice}
              checkIn={checkIn}
              checkOut={checkOut}
              formatDate={formatDate}
              handleDateSelect={handleDateSelect}
              dateSectionRef={dateSectionRef}
              datePickerRef={datePickerRef}
              guestPickerRef={guestPickerRef}
              isDatePickerOpen={isDatePickerOpen}
              setIsDatePickerOpen={setIsDatePickerOpen}
              isGuestPickerOpen={isGuestPickerOpen}
              setIsGuestPickerOpen={setIsGuestPickerOpen}
              adultCount={adultCount}
              setAdultCount={setAdultCount}
              childCount={childCount}
              setChildCount={setChildCount}
              infantCount={infantCount}
              setInfantCount={setInfantCount}
              petCount={petCount}
              setPetCount={setPetCount}
              coupons={coupons}
              isLoadingCoupons={isLoadingCoupons}
              selectedCoupon={selectedCoupon}
              selectedCouponId={selectedCouponId}
              setSelectedCouponId={setSelectedCouponId}
              issuingCouponId={issuingCouponId}
              couponDiscount={couponDiscount}
              handleIssueCoupon={handleIssueCoupon}
              isReserving={booking.isReserving}
              onReserve={handleReserve}
            />
          </div>
        </div>

        <AccommodationLocationSection accommodation={accommodation} />

        <AccommodationReviewsSection
          reviewSummary={accommodation.review_summary}
          reviews={reviews}
          expandedReviews={expandedReviews}
          onOpenReviews={() => setIsReviewModalOpen(true)}
        />
      </div>

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        reviews={allReviews}
        averageRating={accommodation.review_summary.average_rating}
        totalCount={accommodation.review_summary.total_count}
      />
      <WishlistModal
        isOpen={isWishlistModalOpen}
        onClose={() => setIsWishlistModalOpen(false)}
        accommodationId={accommodation.id}
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

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}

      <AccommodationDescriptionModal
        isOpen={isDescriptionModalOpen}
        description={accommodation.description}
        onClose={() => setIsDescriptionModalOpen(false)}
      />

      <AccommodationImageGalleryModal
        isOpen={imageGallery.isImageGalleryOpen}
        accommodationName={accommodation.name}
        images={accommodation.images}
        currentImageIndex={imageGallery.currentImageIndex}
        onCurrentImageIndexChange={imageGallery.setCurrentImageIndex}
        onClose={imageGallery.closeGallery}
      />
    </>
  );
};
