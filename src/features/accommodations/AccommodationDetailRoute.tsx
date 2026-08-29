import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
  type NavigateFunction,
  type SetURLSearchParams,
} from "react-router-dom";
import { ErrorToast } from "../../components/ErrorToast";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { AuthModal } from "../auth/appShell";
import { ReviewModal, toReviewViewModels } from "../reviews/appShell";
import {
  WishlistModal,
  type WishlistModalProps,
} from "../wishlist/appShell";
import { AccommodationBookingCard } from "./components/AccommodationBookingCard";
import { AccommodationDescriptionModal } from "./components/AccommodationDescriptionModal";
import AccommodationHero from "./components/AccommodationHero";
import { AccommodationImageGalleryModal } from "./components/AccommodationImageGalleryModal";
import { AccommodationLocationSection } from "./components/AccommodationLocationSection";
import { AccommodationOverview } from "./components/AccommodationOverview";
import { AccommodationReviewsSection } from "./components/AccommodationReviewsSection";
import { useAccommodationBooking } from "./hooks/useAccommodationBooking";
import type {
  AccommodationAuthIntentExecutionScope,
  ReservationStartAuthIntent,
} from "./hooks/useAccommodationBooking";
import { useAccommodationCoupons } from "./hooks/useAccommodationCoupons";
import type { CouponIssueAuthIntent } from "./hooks/useAccommodationCoupons";
import { useAccommodationDetail } from "./hooks/useAccommodationDetail";
import { useAccommodationImageGallery } from "./hooks/useAccommodationImageGallery";
import { useAccommodationReviews } from "./hooks/useAccommodationReviews";
import {
  toAccommodationBookingCouponViewModel,
  toAccommodationBookingCouponViewModels,
} from "./lib/accommodationBookingSectionsViewModel";
import { toAccommodationBookingViewModel } from "./lib/accommodationBookingViewModel";
import { parsePositiveAccommodationId } from "./lib/accommodationId";
import { toAccommodationDetailViewModel } from "./lib/accommodationDetailViewModel";
import { useOutsideClick } from "../../shared/ui";
import styles from "./AccommodationDetailRoute.module.css";

export interface AccommodationDetailRouteProps {
  authIntent?: AccommodationDetailAuthIntentController;
  accommodationId?: string;
  bookingSearchParams?: URLSearchParams;
  setBookingSearchParams?: SetURLSearchParams;
  navigate?: NavigateFunction;
  wishlistMembership?: Pick<WishlistModalProps, "commands" | "scope">;
}

export interface WishlistOpenAuthIntent {
  readonly type: "wishlist.open";
  readonly accommodationId: number;
}

export type AccommodationDetailAuthIntent =
  | WishlistOpenAuthIntent
  | ReservationStartAuthIntent
  | CouponIssueAuthIntent;

export interface AccommodationDetailAuthIntentGeneration
  extends AccommodationAuthIntentExecutionScope {
  readonly intent: AccommodationDetailAuthIntent;
}

export interface AccommodationDetailAuthIntentController {
  readonly generation: AccommodationDetailAuthIntentGeneration | null;
  request(intent: AccommodationDetailAuthIntent): boolean;
  cancelPending(): void;
}

type AccommodationDetailRouteContentProps = Required<
  Omit<
    AccommodationDetailRouteProps,
    "accommodationId" | "authIntent" | "wishlistMembership"
  >
> &
  Pick<
    AccommodationDetailRouteProps,
    "accommodationId" | "authIntent" | "wishlistMembership"
  >;

const AccommodationDetailRouteContent: React.FC<
  AccommodationDetailRouteContentProps
> = ({
  authIntent,
  accommodationId,
  bookingSearchParams,
  setBookingSearchParams,
  navigate,
  wishlistMembership,
}) => {
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const handledAuthIntentGenerationRef = useRef<number | null>(null);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dateSectionRef = useRef<HTMLDivElement>(null);
  const datePickerBoundaryRef = useRef<{
    contains: (target: Node) => boolean;
  } | null>(null);
  const [, startTransition] = useTransition();

  const requireAuth = useCallback(
    (intent: AccommodationDetailAuthIntent) => {
      if (!authIntent?.request(intent)) {
        return;
      }

      setIsAuthModalOpen(true);
    },
    [authIntent],
  );

  const { accommodation, isLoading } = useAccommodationDetail({
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
    accommodationId,
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
    handleReserve: executeReservation,
  } = booking;

  const handleReserve = () =>
    executeReservation({
      selectedCoupon,
      selectedCouponId,
      couponDiscount,
    });

  const couponViewModelOptions = {
    issuingCouponId,
    selectedCouponId,
    totalPrice,
  };
  const couponViews = toAccommodationBookingCouponViewModels(
    coupons,
    couponViewModelOptions,
  );
  const selectedCouponView = selectedCoupon
    ? (couponViews.find((coupon) => coupon.id === selectedCoupon.id) ??
      toAccommodationBookingCouponViewModel(
        selectedCoupon,
        couponViewModelOptions,
      ))
    : null;
  const handleIssueCouponView = (
    couponView: (typeof couponViews)[number],
  ) => {
    const sourceCoupon = coupons.find((coupon) => coupon.id === couponView.id);

    if (!sourceCoupon) {
      return;
    }

    return handleIssueCoupon(sourceCoupon);
  };

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

  useEffect(() => {
    const generation = authIntent?.generation;
    if (
      !generation ||
      handledAuthIntentGenerationRef.current === generation.generation ||
      !generation.isCurrent()
    ) {
      return;
    }

    const currentAccommodationId = parsePositiveAccommodationId(accommodationId);
    if (
      !currentAccommodationId ||
      !accommodation ||
      accommodation.id !== currentAccommodationId ||
      generation.intent.accommodationId !== currentAccommodationId
    ) {
      return;
    }

    const intent = generation.intent;
    switch (intent.type) {
      case "wishlist.open":
        handledAuthIntentGenerationRef.current = generation.generation;
        setIsWishlistModalOpen(true);
        return;

      case "coupon.issue": {
        if (isLoadingCoupons) {
          return;
        }

        const coupon = coupons.find(
          (candidate) => candidate.id === intent.couponId,
        );
        handledAuthIntentGenerationRef.current = generation.generation;
        if (coupon) {
          void handleIssueCoupon(coupon, { ...generation, intent });
        }
        return;
      }

      case "reservation.start": {
        const intendedCouponId = intent.couponId;
        if (intendedCouponId !== null) {
          if (isLoadingCoupons) {
            return;
          }

          const intendedCoupon = coupons.find(
            (candidate) => candidate.id === intendedCouponId,
          );
          if (!intendedCoupon) {
            handledAuthIntentGenerationRef.current = generation.generation;
            return;
          }

          if (selectedCouponId !== intendedCouponId) {
            setSelectedCouponId(intendedCouponId);
            return;
          }
        } else if (selectedCouponId !== null) {
          setSelectedCouponId(null);
          return;
        }

        handledAuthIntentGenerationRef.current = generation.generation;
        void executeReservation(
          {
            selectedCoupon,
            selectedCouponId,
            couponDiscount,
          },
          { ...generation, intent },
        );
        return;
      }
    }
  }, [
    accommodation,
    accommodationId,
    authIntent?.generation,
    couponDiscount,
    coupons,
    executeReservation,
    handleIssueCoupon,
    isLoadingCoupons,
    selectedCoupon,
    selectedCouponId,
    setSelectedCouponId,
  ]);

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
    coupons: couponViews,
    isLoadingCoupons,
    selectedCoupon: selectedCouponView,
    couponDiscount,
  };
  const couponActions = {
    setSelectedCouponId,
    handleIssueCoupon: handleIssueCouponView,
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
              requireAuth({
                type: "wishlist.open",
                accommodationId: detailView.id,
              });
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
      {wishlistMembership && (
        <WishlistModal
          isOpen={isWishlistModalOpen}
          onClose={() => setIsWishlistModalOpen(false)}
          accommodationId={detailView.id}
          commands={wishlistMembership.commands}
          scope={wishlistMembership.scope}
        />
      )}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          authIntent?.cancelPending();
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

const AccommodationDetailRouteWithRouter: React.FC<
  AccommodationDetailRouteProps
> = (props) => {
  const { id } = useParams<{ id: string }>();
  const [routeSearchParams, routeSetSearchParams] = useSearchParams();
  const routeNavigate = useNavigate();

  return (
    <AccommodationDetailRouteContent
      authIntent={props.authIntent}
      accommodationId={props.accommodationId ?? id}
      bookingSearchParams={props.bookingSearchParams ?? routeSearchParams}
      navigate={props.navigate ?? routeNavigate}
      setBookingSearchParams={
        props.setBookingSearchParams ?? routeSetSearchParams
      }
      wishlistMembership={props.wishlistMembership}
    />
  );
};

export const AccommodationDetailRoute: React.FC<
  AccommodationDetailRouteProps
> = (props) => {
  if (
    props.bookingSearchParams &&
    props.setBookingSearchParams &&
    props.navigate
  ) {
    return (
      <AccommodationDetailRouteContent
        authIntent={props.authIntent}
        accommodationId={props.accommodationId}
        bookingSearchParams={props.bookingSearchParams}
        navigate={props.navigate}
        setBookingSearchParams={props.setBookingSearchParams}
        wishlistMembership={props.wishlistMembership}
      />
    );
  }

  return <AccommodationDetailRouteWithRouter {...props} />;
};
