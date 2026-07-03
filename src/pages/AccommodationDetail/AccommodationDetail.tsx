import React, { useEffect, useRef, useState, useTransition } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import { WishlistModal } from "../../components/WishlistModal";
import { AuthModal } from "../../features/auth/components/AuthModal";
import { ReviewModal } from "../../components/ReviewModal/ReviewModal";
import { useAccommodationBooking } from "../../features/accommodations/hooks/useAccommodationBooking";
import { useAccommodationCoupons } from "../../features/accommodations/hooks/useAccommodationCoupons";
import { useAccommodationDetail } from "../../features/accommodations/hooks/useAccommodationDetail";
import { useAccommodationReviews } from "../../features/accommodations/hooks/useAccommodationReviews";
import { AccommodationBookingCard } from "../../features/accommodations/components/AccommodationBookingCard";
import { AccommodationDescriptionModal } from "../../features/accommodations/components/AccommodationDescriptionModal";
import { AccommodationImageGalleryModal } from "../../features/accommodations/components/AccommodationImageGalleryModal";
import { AccommodationLocationSection } from "../../features/accommodations/components/AccommodationLocationSection";
import { AccommodationOverview } from "../../features/accommodations/components/AccommodationOverview";
import { AccommodationReviewsSection } from "../../features/accommodations/components/AccommodationReviewsSection";
import AccommodationHero from "../../features/accommodations/components/AccommodationHero";
import styles from "./AccommodationDetail.module.css";

const AccommodationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mobileSlideIndex, setMobileSlideIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false);
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dateSectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [, startTransition] = useTransition();

  const requireAuth = (action: () => void | Promise<void>) => {
    setPendingAction(() => action);
    setIsAuthModalOpen(true);
  };
  
  const {
    accommodation,
    isLoading,
    reloadAccommodation,
  } = useAccommodationDetail({
    accommodationId: id,
    isAuthenticated,
    handleError,
    clearError,
  });

  const booking = useAccommodationBooking({
    accommodationId: id,
    accommodation,
    searchParams,
    setSearchParams,
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
    accommodationId: id,
    totalReviewCount: accommodation?.review_summary.total_count ?? 0,
    handleError,
    clearError,
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

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (isGuestPickerOpen && guestPickerRef.current && !guestPickerRef.current.contains(target)) {
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
  }, [isGuestPickerOpen, isDatePickerOpen, setIsGuestPickerOpen, setIsDatePickerOpen]);
  
  // 모바일 이미지 슬라이더 터치 핸들러
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || !accommodation) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    const maxIndex = accommodation.images.length - 1;
    
    if (isLeftSwipe && mobileSlideIndex < maxIndex) {
      setMobileSlideIndex(mobileSlideIndex + 1);
    }
    if (isRightSwipe && mobileSlideIndex > 0) {
      setMobileSlideIndex(mobileSlideIndex - 1);
    }
  };

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
          mobileSlideIndex={mobileSlideIndex}
          onMobileSlideIndexChange={setMobileSlideIndex}
          onOpenGallery={(index) => {
            setCurrentImageIndex(index);
            setIsImageGalleryOpen(true);
          }}
          onSave={() => {
            if (!isAuthenticated) {
              setPendingAction(() => () => setIsWishlistModalOpen(true));
              setIsAuthModalOpen(true);
            } else {
              setIsWishlistModalOpen(true);
            }
          }}
          onShare={() => {}}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
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
        isOpen={isImageGalleryOpen}
        accommodationName={accommodation.name}
        images={accommodation.images}
        currentImageIndex={currentImageIndex}
        onCurrentImageIndexChange={setCurrentImageIndex}
        onClose={() => setIsImageGalleryOpen(false)}
      />
    </>
  );
};

export default AccommodationDetail;
