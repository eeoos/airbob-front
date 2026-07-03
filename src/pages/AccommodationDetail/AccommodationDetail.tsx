import React, { useEffect, useRef, useState, useTransition } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import { WishlistModal } from "../../components/WishlistModal";
import { AuthModal } from "../../features/auth/components/AuthModal";
import { ReviewModal } from "../../components/ReviewModal/ReviewModal";
import { getImageUrl } from "../../utils/image";
import {
  getAccommodationTypeLabel,
  getAmenityLabel,
} from "../../utils/codes";
import { GOOGLE_MAPS_API_KEY } from "../../utils/constants";
import { useAccommodationBooking } from "../../features/accommodations/hooks/useAccommodationBooking";
import { useAccommodationCoupons } from "../../features/accommodations/hooks/useAccommodationCoupons";
import { useAccommodationDetail } from "../../features/accommodations/hooks/useAccommodationDetail";
import { useAccommodationReviews } from "../../features/accommodations/hooks/useAccommodationReviews";
import { AccommodationBookingCard } from "../../features/accommodations/components/AccommodationBookingCard";
import AccommodationHero from "../../features/accommodations/components/AccommodationHero";
import AmenityIcon from "../../features/accommodations/components/AmenityIcon";
import styles from "./AccommodationDetail.module.css";

// AccommodationType을 한글로 변환하는 함수
const getAccommodationTypeKorean = (type: string): string => {
  return getAccommodationTypeLabel(type);
};

// AmenityType을 한글로 변환하는 함수
const getAmenityTypeKorean = (type: string): string => {
  return getAmenityLabel(type);
};

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
  
  // 설명이 길면 잘라서 보여줄 길이 (약 3줄 정도)
  const MAX_DESCRIPTION_LENGTH = 200;
  // 리뷰 content를 잘라서 보여줄 길이 (약 3-4줄 정도)
  const MAX_REVIEW_CONTENT_LENGTH = 150;

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
            <div className={styles.locationSection}>
              <div className={styles.locationInfo}>
                <span className={styles.address}>
                  {accommodation.address_summary.city || accommodation.address_summary.country}의 {getAccommodationTypeKorean(accommodation.type)}
                </span>
                <span className={styles.maxOccupancy}>최대 인원 {accommodation.policy.max_occupancy}명</span>
              </div>
            </div>

            {accommodation.amenities.length > 0 && (
              <div className={styles.amenitiesSection}>
                <div className={styles.amenitiesGrid}>
                  {accommodation.amenities.map((amenity, index) => (
                    <div key={index} className={styles.amenityItem}>
                      <AmenityIcon type={amenity.type} decorative />
                      <span>{getAmenityTypeKorean(amenity.type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.mainContent}>
              <section className={styles.section}>
                <div className={styles.hostInfo}>
                  <div className={styles.hostAvatar}>
                    {accommodation.host.thumbnail_image_url ? (
                      <img
                        src={getImageUrl(accommodation.host.thumbnail_image_url)}
                        alt={accommodation.host.nickname}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {accommodation.host.nickname.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className={styles.hostDetails}>
                    <span className={styles.hostLabel}>호스트:</span>
                    <span className={styles.hostName}>{accommodation.host.nickname} 님</span>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                {accommodation.description && (
                  <>
                    <p className={styles.description}>
                      {accommodation.description.length > MAX_DESCRIPTION_LENGTH
                        ? `${accommodation.description.substring(0, MAX_DESCRIPTION_LENGTH)}...`
                        : accommodation.description}
                    </p>
                    {accommodation.description.length > MAX_DESCRIPTION_LENGTH && (
                      <button
                        className={styles.showMoreButton}
                        onClick={() => setIsDescriptionModalOpen(true)}
                      >
                        더 보기
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
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
        </div>

        <section className={`${styles.section} ${styles.locationSectionFullWidth}`}>
          <h2 className={styles.sectionTitle}>위치</h2>
          <p className={styles.address}>
            {[
              accommodation.address_summary.city,
              accommodation.address_summary.country,
            ].filter(Boolean).join(", ")}
          </p>
          {accommodation.coordinate.latitude && accommodation.coordinate.longitude && (
            <div className={styles.mapContainer}>
              {GOOGLE_MAPS_API_KEY ? (
                <iframe
                  title="숙소 위치 지도"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${accommodation.coordinate.latitude},${accommodation.coordinate.longitude}&zoom=15`}
                />
              ) : (
                <div className={styles.mapPlaceholder}>
                  지도 (위도: {accommodation.coordinate.latitude}, 경도:{" "}
                  {accommodation.coordinate.longitude})
                </div>
              )}
            </div>
          )}
        </section>

        {/* Reviews Section */}
        {accommodation.review_summary.total_count > 0 && (
          <section className={`${styles.section} ${styles.reviewSection}`}>
            <h2 className={styles.sectionTitle}>
              ★ {accommodation.review_summary.average_rating.toFixed(2)} · 후기 {accommodation.review_summary.total_count}개
            </h2>
            
            {reviews.length > 0 && (
              <div className={styles.reviewsGrid}>
                {reviews.map((review) => (
                  <div key={review.id} className={styles.reviewCard}>
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewerInfo}>
                        {review.reviewer.thumbnail_image_url ? (
                          <img
                            src={getImageUrl(review.reviewer.thumbnail_image_url)}
                            alt={review.reviewer.nickname}
                            className={styles.reviewerAvatar}
                          />
                        ) : (
                          <div className={styles.reviewerAvatarPlaceholder}>
                            {review.reviewer.nickname.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className={styles.reviewerDetails}>
                          <div className={styles.reviewerName}>{review.reviewer.nickname}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className={styles.reviewRating}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          viewBox="0 0 24 24"
                          fill={i < review.rating ? "currentColor" : "none"}
                          stroke="currentColor"
                          className={styles.starIcon}
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                    
                    <div className={styles.reviewDate}>
                      {new Date(review.reviewed_at).getFullYear()}년 {new Date(review.reviewed_at).getMonth() + 1}월
                    </div>
                    
                    <div className={styles.reviewContent}>
                      {expandedReviews[review.id] || review.content.length <= MAX_REVIEW_CONTENT_LENGTH
                        ? review.content
                        : `${review.content.substring(0, MAX_REVIEW_CONTENT_LENGTH)}...`}
                    </div>
                    
                    {review.content.length > MAX_REVIEW_CONTENT_LENGTH && (
                      <button
                        className={styles.reviewShowMoreButton}
                        onClick={() => {
                          // "더보기" 버튼 클릭 시 리뷰 모달 열기 (후기 모두 보기와 같은 기능)
                          setIsReviewModalOpen(true);
                        }}
                      >
                        더보기
                      </button>
                    )}
                    
                    {review.images && review.images.length > 0 && (
                      <div className={styles.reviewImages}>
                        {review.images.map((image) => (
                          <img
                            key={image.id}
                            src={getImageUrl(image.image_url)}
                            alt="리뷰 이미지"
                            className={styles.reviewImage}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* 리뷰가 6개 초과인 경우에만 "모두 보기" 버튼 표시 */}
            {accommodation.review_summary.total_count > 6 && (
              <div className={styles.reviewViewAll}>
                <button 
                  className={styles.reviewViewAllButton}
                  onClick={() => setIsReviewModalOpen(true)}
                >
                  후기 {accommodation.review_summary.total_count}개 모두 보기
                </button>
              </div>
            )}
          </section>
        )}

        {accommodation && (
        <>
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
        </>
      )}

      {error && (
        <div className={styles.toastContainer}>
          <ErrorToast message={error} onClose={clearError} />
        </div>
      )}

      {isDescriptionModalOpen && accommodation && (
        <div className={styles.descriptionModal} onClick={() => setIsDescriptionModalOpen(false)}>
          <div className={styles.descriptionModalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.descriptionModalClose}
              onClick={() => setIsDescriptionModalOpen(false)}
            >
              ×
            </button>
            <h2 className={styles.descriptionModalTitle}>숙소 설명</h2>
            <div className={styles.descriptionModalText}>
              {accommodation.description.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < accommodation.description.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {isImageGalleryOpen && accommodation && (
        <div className={styles.galleryModal} onClick={() => setIsImageGalleryOpen(false)}>
          <div className={styles.galleryContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.galleryClose}
              onClick={() => setIsImageGalleryOpen(false)}
            >
              ×
            </button>
            <div className={styles.galleryMain}>
              <img
                src={getImageUrl(accommodation.images[currentImageIndex].image_url)}
                alt={`${accommodation.name} ${currentImageIndex + 1}`}
                className={styles.galleryImage}
              />
              {accommodation.images.length > 1 && (
                <>
                  <button
                    className={`${styles.galleryNav} ${styles.galleryPrev}`}
                    onClick={() => setCurrentImageIndex((prev) => 
                      prev === 0 ? accommodation.images.length - 1 : prev - 1
                    )}
                    disabled={accommodation.images.length <= 1}
                  >
                    ‹
                  </button>
                  <button
                    className={`${styles.galleryNav} ${styles.galleryNext}`}
                    onClick={() => setCurrentImageIndex((prev) => 
                      prev === accommodation.images.length - 1 ? 0 : prev + 1
                    )}
                    disabled={accommodation.images.length <= 1}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            <div className={styles.galleryThumbnails}>
              {accommodation.images.map((image, index) => (
                <button
                  key={image.id}
                  className={`${styles.galleryThumbnail} ${
                    index === currentImageIndex ? styles.galleryThumbnailActive : ""
                  }`}
                  onClick={() => setCurrentImageIndex(index)}
                >
                  <img src={getImageUrl(image.image_url)} alt={`${accommodation.name} ${index + 1}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccommodationDetail;
