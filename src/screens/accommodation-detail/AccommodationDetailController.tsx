import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  calculateAccommodationCouponDiscount,
  type AccommodationCoupon,
  type AccommodationDetailQueryOptions,
  toAccommodationBookingCouponViewModel,
  toAccommodationBookingCouponViewModels,
  toAccommodationBookingViewModel,
  toAccommodationDetailViewModel,
  useAccommodationDetailReadQuery,
  useValidCouponsReadQuery,
} from "../../features/accommodations/detail/public";
import { useOutsideClick } from "../../shared/ui";
import {
  type ReservationCheckoutHandoffPort,
  type ReservationCreateRouteLease,
  type ReservationCreateSessionPort,
  type ReservationStartIntent,
} from "../../workflows/booking-payment/reservation-create";
import {
  AccommodationDetailScreen,
  type AccommodationDetailReadyView,
  type AccommodationDetailScreenState,
} from "./AccommodationDetailScreen";
import {
  deriveBookingDates,
  formatBookingDisplayDate,
  formatBookingLocalDate,
  normalizeBookingCounts,
} from "./bookingDraft";
import { toAccommodationErrorMessage } from "./accommodationDetailErrors";
import { useAccommodationCouponCommand } from "./useAccommodationCouponCommand";
import { useAccommodationImageGallery } from "./useAccommodationImageGallery";
import { useAccommodationReviewFeed } from "./useAccommodationReviewFeed";
import { useRecentlyViewedRecording } from "./useRecentlyViewedRecording";
import { useReservationCreateCommand } from "./useReservationCreateCommand";

type DetailScope = AccommodationDetailQueryOptions["scope"];

interface AccommodationDetailBookingRouteState {
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly adultOccupancy: number;
  readonly childOccupancy: number;
  readonly infantOccupancy: number;
  readonly petOccupancy: number;
}

export type AccommodationDetailAuthIntent =
  | { readonly type: "wishlist.open"; readonly accommodationId: number }
  | ReservationStartIntent
  | {
      readonly type: "coupon.issue";
      readonly accommodationId: number;
      readonly couponId: number;
    };

export interface AccommodationDetailClaimedAuthIntent {
  readonly attemptId: number;
  readonly intent: AccommodationDetailAuthIntent;
  isCurrent(): boolean;
}

interface AccommodationDetailAuthIntentPort {
  readonly claimed: AccommodationDetailClaimedAuthIntent | null;
  cancelPending(): void;
  completeClaim(attemptId: number): void;
  request(intent: AccommodationDetailAuthIntent): boolean;
}

type WishlistMembership = Omit<
  NonNullable<AccommodationDetailReadyView["wishlistModal"]>,
  "accommodationId" | "isOpen" | "onClose"
>;

export interface AccommodationDetailControllerProps {
  readonly accommodationId: number | null;
  readonly authIntent: AccommodationDetailAuthIntentPort;
  readonly bookingRouteState: AccommodationDetailBookingRouteState;
  readonly checkoutHandoff: ReservationCheckoutHandoffPort;
  readonly isAuthenticated: boolean;
  readonly onReplaceBookingDates: (
    checkIn: string | null,
    checkOut: string | null,
  ) => void;
  readonly recordRecentlyViewed: (
    accommodationId: number,
    options: { readonly signal: AbortSignal },
  ) => Promise<void>;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly routeLease: ReservationCreateRouteLease;
  readonly scope: DetailScope;
  readonly session: ReservationCreateSessionPort;
  readonly wishlistMembership?: WishlistMembership;
}

export function AccommodationDetailController({
  accommodationId,
  authIntent,
  bookingRouteState,
  checkoutHandoff,
  isAuthenticated,
  onReplaceBookingDates,
  recordRecentlyViewed,
  resolveImageUrl,
  routeLease,
  scope,
  session,
  wishlistMembership,
}: AccommodationDetailControllerProps) {
  const detailQuery = useAccommodationDetailReadQuery({
    accommodationId,
    scope,
  });
  const couponsQuery = useValidCouponsReadQuery({
    enabled: isAuthenticated,
    scope,
  });
  const accommodation = detailQuery.data ?? null;
  const accommodationIdentity = accommodation?.id ?? null;
  const maxOccupancy = accommodation?.policy.maxOccupancy ?? 0;
  const maxInfants = accommodation?.policy.infantOccupancy ?? 0;
  const maxPets = accommodation?.policy.petOccupancy ?? 0;
  const [, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isGuestPickerOpen, setIsGuestPickerOpen] = useState(false);
  const [adultCount, setAdultCount] = useState(
    bookingRouteState.adultOccupancy,
  );
  const [childCount, setChildCount] = useState(
    bookingRouteState.childOccupancy,
  );
  const [infantCount, setInfantCount] = useState(
    bookingRouteState.infantOccupancy,
  );
  const [petCount, setPetCount] = useState(bookingRouteState.petOccupancy);
  const guestPickerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dateSectionRef = useRef<HTMLDivElement>(null);
  const datePickerBoundaryRef = useRef<{
    contains(target: Node): boolean;
  } | null>(null);
  const handledAuthAttemptRef = useRef<number | null>(null);
  const reviewFeed = useAccommodationReviewFeed({
    accommodationId,
    enabled: Boolean(accommodation?.reviewSummary.totalCount),
    onError: setErrorMessage,
    scope,
  });

  useEffect(() => {
    if (accommodationIdentity === null) return;
    const counts = normalizeBookingCounts(
      {
        adultOccupancy: bookingRouteState.adultOccupancy,
        childOccupancy: bookingRouteState.childOccupancy,
        infantOccupancy: bookingRouteState.infantOccupancy,
        petOccupancy: bookingRouteState.petOccupancy,
      },
      {
        maxOccupancy,
        maxInfants,
        maxPets,
      },
    );
    setAdultCount(counts.adultCount);
    setChildCount(counts.childCount);
    setInfantCount(counts.infantCount);
    setPetCount(counts.petCount);
  }, [
    accommodationIdentity,
    bookingRouteState.adultOccupancy,
    bookingRouteState.childOccupancy,
    bookingRouteState.infantOccupancy,
    bookingRouteState.petOccupancy,
    maxInfants,
    maxOccupancy,
    maxPets,
  ]);

  useRecentlyViewedRecording({
    accommodationId: accommodation?.id ?? null,
    canRecord: routeLease.isCurrent(),
    record: recordRecentlyViewed,
    scope,
  });

  const requireAuthentication = useCallback(
    (intent: AccommodationDetailAuthIntent) => {
      if (!authIntent.request(intent)) return false;
      setIsAuthModalOpen(true);
      return true;
    },
    [authIntent],
  );
  const requestCouponAuthentication = useCallback(
    (couponId: number) => {
      if (accommodationIdentity === null) return;
      requireAuthentication({
        type: "coupon.issue",
        accommodationId: accommodationIdentity,
        couponId,
      });
    },
    [accommodationIdentity, requireAuthentication],
  );
  const {
    issueCoupon,
    issuingCouponId,
    selectedCouponId,
    setSelectedCouponId,
  } = useAccommodationCouponCommand({
    accommodationId: accommodationIdentity,
    isAuthenticated,
    onError: setErrorMessage,
    requestAuthentication: requestCouponAuthentication,
    routeLease,
    session,
  });

  const bookingDates = useMemo(
    () =>
      deriveBookingDates({
        basePrice: accommodation?.basePrice ?? 0,
        unavailableDates: accommodation?.unavailableDates ?? [],
        ...(bookingRouteState.checkIn === undefined
          ? {}
          : { checkIn: bookingRouteState.checkIn }),
        ...(bookingRouteState.checkOut === undefined
          ? {}
          : { checkOut: bookingRouteState.checkOut }),
      }),
    [accommodation, bookingRouteState.checkIn, bookingRouteState.checkOut],
  );
  const coupons = useMemo<readonly AccommodationCoupon[]>(
    () => couponsQuery.data?.coupons ?? [],
    [couponsQuery.data],
  );
  const selectedCoupon =
    coupons.find((coupon) => coupon.id === selectedCouponId) ?? null;
  const selectedCouponDiscount = selectedCoupon
    ? calculateAccommodationCouponDiscount(
        selectedCoupon,
        bookingDates.totalPrice,
      )
    : 0;
  const payablePrice = Math.max(
    bookingDates.totalPrice - selectedCouponDiscount,
    0,
  );
  const { isReservationLocked, isReserving, startReservation } =
    useReservationCreateCommand({
      accommodation,
      bookingDates,
      checkoutHandoff,
      guestCounts: { adultCount, childCount, infantCount, petCount },
      onError: setErrorMessage,
      requestAuthentication: requireAuthentication,
      routeLease,
      scope,
      selectedCoupon,
      session,
    });

  useEffect(() => {
    const claimed = authIntent.claimed;
    if (
      !claimed ||
      handledAuthAttemptRef.current === claimed.attemptId ||
      !claimed.isCurrent() ||
      !accommodation
    ) {
      return;
    }

    if (claimed.intent.accommodationId !== accommodation.id) {
      handledAuthAttemptRef.current = claimed.attemptId;
      authIntent.completeClaim(claimed.attemptId);
      return;
    }

    const complete = () => {
      handledAuthAttemptRef.current = claimed.attemptId;
      authIntent.completeClaim(claimed.attemptId);
    };

    const claimedIntent = claimed.intent;
    switch (claimedIntent.type) {
      case "wishlist.open":
        complete();
        if (wishlistMembership) setIsWishlistModalOpen(true);
        return;
      case "coupon.issue": {
        if (couponsQuery.isFetching) return;
        if (couponsQuery.isError) {
          complete();
          return;
        }
        const coupon = coupons.find(
          (candidate) => candidate.id === claimedIntent.couponId,
        );
        complete();
        if (coupon) {
          void issueCoupon(coupon, true);
        } else {
          setErrorMessage("선택한 쿠폰 정보를 확인할 수 없습니다.");
        }
        return;
      }
      case "reservation.start": {
        if (claimedIntent.couponId !== null && couponsQuery.isFetching) return;
        if (claimedIntent.couponId !== null && couponsQuery.isError) {
          complete();
          return;
        }
        const coupon =
          claimedIntent.couponId === null
            ? null
            : (coupons.find(
                (candidate) => candidate.id === claimedIntent.couponId,
              ) ?? null);
        complete();
        if (claimedIntent.couponId !== null && !coupon) {
          setErrorMessage("선택한 쿠폰 정보를 확인할 수 없습니다.");
          return;
        }
        void startReservation(claimedIntent, coupon);
        return;
      }
    }
  }, [
    accommodation,
    authIntent,
    coupons,
    couponsQuery.isError,
    couponsQuery.isFetching,
    issueCoupon,
    startReservation,
    wishlistMembership,
  ]);

  datePickerBoundaryRef.current = {
    contains: (target: Node) =>
      Boolean(
        datePickerRef.current?.contains(target) ||
        dateSectionRef.current?.contains(target),
      ),
  };
  useOutsideClick(
    guestPickerRef,
    () => setIsGuestPickerOpen(false),
    isGuestPickerOpen,
  );
  useOutsideClick(
    datePickerBoundaryRef,
    () => setIsDatePickerOpen(false),
    isDatePickerOpen,
  );

  const detailView = accommodation
    ? toAccommodationDetailViewModel(accommodation, resolveImageUrl)
    : null;
  const imageGallery = useAccommodationImageGallery({
    imageCount: detailView?.heroImages.length ?? 0,
  });

  let state: AccommodationDetailScreenState;
  if (accommodationId === null) {
    state = { status: "error", message: "숙소 정보를 확인할 수 없습니다." };
  } else if (detailQuery.isLoading) {
    state = { status: "loading" };
  } else if (detailQuery.isError) {
    state = {
      status: "error",
      message: toAccommodationErrorMessage(detailQuery.error),
    };
  } else if (!accommodation || !detailView) {
    state = { status: "error", message: "숙소를 찾을 수 없습니다." };
  } else {
    const couponViewOptions = {
      issuingCouponId,
      selectedCouponId,
      totalPrice: bookingDates.totalPrice,
    };
    const couponViews = toAccommodationBookingCouponViewModels(
      coupons,
      couponViewOptions,
    );
    const selectedCouponView = selectedCoupon
      ? toAccommodationBookingCouponViewModel(selectedCoupon, couponViewOptions)
      : null;
    const readyView: AccommodationDetailReadyView = {
      authModal: {
        isOpen: isAuthModalOpen,
        onClose: () => {
          setIsAuthModalOpen(false);
          authIntent.cancelPending();
        },
      },
      bookingCard: {
        bookingView: toAccommodationBookingViewModel(accommodation),
        isAuthenticated,
        bookingState: {
          payablePrice,
          nights: bookingDates.nights,
          totalPrice: bookingDates.totalPrice,
          checkIn: bookingDates.checkIn,
          checkOut: bookingDates.checkOut,
          dateSectionRef,
          datePickerRef,
          guestPickerRef,
          isDatePickerOpen,
          isGuestPickerOpen,
          adultCount,
          childCount,
          infantCount,
          petCount,
          isReservationLocked,
          isReserving,
        },
        bookingActions: {
          formatDate: formatBookingDisplayDate,
          handleDateSelect: (checkIn, checkOut) => {
            startTransition(() => {
              onReplaceBookingDates(
                checkIn ? formatBookingLocalDate(checkIn) : null,
                checkOut ? formatBookingLocalDate(checkOut) : null,
              );
              if (checkOut) setIsDatePickerOpen(false);
            });
          },
          setIsDatePickerOpen,
          setIsGuestPickerOpen,
          setAdultCount,
          setChildCount,
          setInfantCount,
          setPetCount,
          onReserve: () => void startReservation(),
        },
        couponState: {
          coupons: couponViews,
          errorMessage: couponsQuery.isError
            ? toAccommodationErrorMessage(couponsQuery.error)
            : null,
          isLoadingCoupons: couponsQuery.isFetching,
          selectedCoupon: selectedCouponView,
          couponDiscount: selectedCouponDiscount,
        },
        couponActions: {
          setSelectedCouponId,
          handleIssueCoupon: (couponView) => {
            const coupon = coupons.find(
              (candidate) => candidate.id === couponView.id,
            );
            if (!coupon) return undefined;

            return issueCoupon(coupon);
          },
        },
      },
      descriptionModal: {
        description: detailView.description,
        isOpen: isDescriptionModalOpen,
        onClose: () => setIsDescriptionModalOpen(false),
      },
      galleryModal: {
        accommodationName: detailView.title,
        currentImageIndex: imageGallery.currentImageIndex,
        images: detailView.heroImages,
        isOpen: imageGallery.isImageGalleryOpen,
        onClose: imageGallery.closeGallery,
        onCurrentImageIndexChange: imageGallery.setCurrentImageIndex,
      },
      hero: {
        detailView,
        mobileSlideIndex: imageGallery.mobileSlideIndex,
        onMobileSlideIndexChange: imageGallery.setMobileSlideIndex,
        onOpenGallery: imageGallery.openGallery,
        onSave: () => {
          if (!isAuthenticated) {
            requireAuthentication({
              type: "wishlist.open",
              accommodationId: accommodation.id,
            });
          } else if (wishlistMembership) {
            setIsWishlistModalOpen(true);
          }
        },
        onShare: () => undefined,
        onTouchStart: imageGallery.onTouchStart,
        onTouchMove: imageGallery.onTouchMove,
        onTouchEnd: imageGallery.onTouchEnd,
      },
      location: { detailView },
      overview: {
        detailView,
        onOpenDescription: () => setIsDescriptionModalOpen(true),
      },
      reviewModal: {
        averageRating: detailView.rating.averageRating,
        hasNext: reviewFeed.hasNextReviewPage,
        isFetching: reviewFeed.isFetchingNextReviewPage,
        isOpen: reviewFeed.isReviewModalOpen,
        onClose: reviewFeed.closeReviewModal,
        onLoadMore: reviewFeed.loadNextReviewPage,
        reviews: reviewFeed.allReviews,
        totalCount: detailView.rating.reviewCount,
      },
      reviews: {
        expandedReviews: {},
        onOpenReviews: reviewFeed.openReviewModal,
        reviews: reviewFeed.previewReviews,
        reviewSummary: detailView.rating,
      },
      ...(wishlistMembership
        ? {
            wishlistModal: {
              ...wishlistMembership,
              accommodationId: accommodation.id,
              isOpen: isWishlistModalOpen,
              onClose: () => setIsWishlistModalOpen(false),
            },
          }
        : {}),
    };
    state = { status: "ready", view: readyView };
  }

  return (
    <AccommodationDetailScreen
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(null)}
      state={state}
    />
  );
}
