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
  isAccommodationCouponApplicable,
  mergeAccommodationCoupons,
  type AccommodationCoupon,
  type AccommodationAvailability,
  type AccommodationDetailQueryOptions,
  toAccommodationBookingCouponViewModel,
  toAccommodationBookingCouponViewModels,
  toAccommodationBookingViewModel,
  toAccommodationDetailViewModel,
  useAccommodationDetailReadQuery,
  useAccommodationAvailabilityReadQuery,
  useCouponCampaignsReadQuery,
  useMemberCouponsReadQuery,
} from "../../features/accommodations/detail/public";
import type { AccommodationAmenityCatalog } from "../../features/accommodations/public";
import { useOutsideClick } from "../../shared/ui";
import type {
  BookingTransactionHandle,
  BookingTransactionRouteLease,
  BookingTransactionSessionPort,
  BookingTransactionSnapshot,
  BookingTransactionStartIntent,
  BookingTransactionWorkflow,
} from "../../workflows/booking-payment/transaction/booking";
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
import {
  isAccommodationDetailTerminalError,
  toAccommodationErrorMessage,
} from "./accommodationDetailErrors";
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
  | BookingTransactionStartIntent
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
  readonly amenityCatalog: AccommodationAmenityCatalog;
  readonly authIntent: AccommodationDetailAuthIntentPort;
  readonly bookingFlowHandle: BookingTransactionHandle | null;
  readonly bookingRouteState: AccommodationDetailBookingRouteState;
  readonly bookingWorkflow: BookingTransactionWorkflow;
  readonly isAuthenticated: boolean;
  readonly isPaymentRecoveryBlocked: boolean;
  readonly onBookingFlowHandleChange: (
    handle: BookingTransactionHandle | null,
  ) => boolean;
  readonly onOpenPayment: (
    handle: BookingTransactionHandle,
    snapshot: BookingTransactionSnapshot,
  ) => void;
  readonly onBack?: () => void;
  readonly onOpenTrips: () => void;
  readonly onReplaceBookingDates: (
    checkIn: string | null,
    checkOut: string | null,
  ) => void;
  readonly onTerminalReservation: (
    handle: BookingTransactionHandle,
    snapshot: BookingTransactionSnapshot,
    routeLease: BookingTransactionRouteLease,
  ) => Promise<boolean>;
  readonly recordRecentlyViewed: (
    accommodationId: number,
    options: { readonly signal: AbortSignal },
  ) => Promise<void>;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly routeLease: BookingTransactionRouteLease;
  readonly scope: DetailScope;
  readonly session: BookingTransactionSessionPort;
  readonly wishlistMembership?: WishlistMembership;
}

export function AccommodationDetailController({
  accommodationId,
  amenityCatalog,
  authIntent,
  bookingFlowHandle,
  bookingRouteState,
  bookingWorkflow,
  isAuthenticated,
  isPaymentRecoveryBlocked,
  onBookingFlowHandleChange,
  onOpenPayment,
  onOpenTrips,
  onBack,
  onReplaceBookingDates,
  onTerminalReservation,
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
  const availabilityQuery = useAccommodationAvailabilityReadQuery({
    accommodationId,
    scope,
  });
  const couponsQuery = useCouponCampaignsReadQuery({
    enabled: isAuthenticated,
    scope,
  });
  const memberCouponsQuery = useMemberCouponsReadQuery({
    enabled: isAuthenticated,
    scope,
  });
  const refetchMemberCoupons = memberCouponsQuery.refetch;
  const refetchCampaigns = couponsQuery.refetch;
  const refreshMyCoupons = useCallback(async () => {
    const result = await refetchMemberCoupons({ throwOnError: true });
    if (!result.data) throw new Error("보유 쿠폰을 확인하지 못했습니다.");
    return result.data;
  }, [refetchMemberCoupons]);
  const refreshCampaigns = useCallback(() => {
    void refetchCampaigns();
  }, [refetchCampaigns]);
  const accommodation = detailQuery.data ?? null;
  const availability: AccommodationAvailability | null =
    availabilityQuery.isError || availabilityQuery.isFetching
      ? null
      : (availabilityQuery.data ?? null);
  const availabilityStatus =
    availabilityQuery.isLoading || availabilityQuery.isFetching
      ? "loading"
      : availability
        ? "ready"
        : "error";
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
  const availabilityInteractionReadyRef = useRef(false);
  availabilityInteractionReadyRef.current = Boolean(
    availabilityStatus === "ready" &&
    availability &&
    accommodationIdentity === availability.accommodationId,
  );
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

  useEffect(() => {
    if (availabilityStatus !== "ready") {
      setIsDatePickerOpen(false);
    }
  }, [availabilityStatus]);

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

  const bookingDates = useMemo(
    () =>
      deriveBookingDates({
        basePrice: accommodation?.basePrice ?? 0,
        availability,
        ...(bookingRouteState.checkIn === undefined
          ? {}
          : { checkIn: bookingRouteState.checkIn }),
        ...(bookingRouteState.checkOut === undefined
          ? {}
          : { checkOut: bookingRouteState.checkOut }),
      }),
    [
      accommodation?.basePrice,
      availability,
      bookingRouteState.checkIn,
      bookingRouteState.checkOut,
    ],
  );
  const {
    issueCoupon,
    issuingCouponId,
    selectedCouponId,
    clearSelectedCoupon,
  } = useAccommodationCouponCommand({
    accommodationId: accommodationIdentity,
    isAuthenticated,
    onError: setErrorMessage,
    requestAuthentication: requestCouponAuthentication,
    routeLease,
    session,
    scope,
    totalPrice: bookingDates.totalPrice,
    refreshMyCoupons,
    refreshCampaigns,
  });

  const coupons = useMemo<readonly AccommodationCoupon[]>(
    () =>
      mergeAccommodationCoupons(
        couponsQuery.data?.coupons ?? [],
        memberCouponsQuery.data?.coupons ?? [],
      ),
    [couponsQuery.data, memberCouponsQuery.data],
  );
  const selectedCoupon =
    memberCouponsQuery.data?.coupons.find(
      (coupon) =>
        coupon.id === selectedCouponId &&
        isAccommodationCouponApplicable(coupon, bookingDates.totalPrice),
    ) ?? null;
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
  const isStayReady = Boolean(
    availabilityStatus === "ready" &&
    availability &&
    accommodation &&
    availability.accommodationId === accommodation.id &&
    bookingDates.isStayReady &&
    bookingDates.checkIn &&
    bookingDates.checkOut &&
    bookingDates.nights > 0,
  );
  const {
    abandonQuote,
    isReservationLocked,
    isReserving,
    quoteSnapshot,
    reservationStatus,
    selectionLocked,
    startReservation,
  } = useReservationCreateCommand({
    accommodation,
    availability,
    bookingDates,
    flowHandle: bookingFlowHandle,
    guestCounts: { adultCount, childCount, infantCount, petCount },
    isRecoveryBlocked: isPaymentRecoveryBlocked,
    onError: setErrorMessage,
    onFlowHandleChange: onBookingFlowHandleChange,
    onOpenPayment,
    onOpenTrips,
    onTerminalReservation,
    requestAuthentication: requireAuthentication,
    routeLease,
    selectedCoupon,
    workflow: bookingWorkflow,
  });

  useEffect(() => {
    if (
      selectionLocked ||
      selectedCouponId === null ||
      memberCouponsQuery.isFetching ||
      memberCouponsQuery.isError ||
      !memberCouponsQuery.data
    )
      return;
    const coupon = memberCouponsQuery.data.coupons.find(
      (item) => item.id === selectedCouponId,
    );
    if (
      !coupon ||
      coupon.status !== "AVAILABLE" ||
      (bookingDates.isStayReady &&
        !isAccommodationCouponApplicable(coupon, bookingDates.totalPrice))
    ) {
      clearSelectedCoupon();
      setErrorMessage(
        "선택한 쿠폰의 상태가 변경되어 적용을 해제했습니다. 보유 쿠폰을 다시 확인해주세요.",
      );
    }
  }, [
    selectionLocked,
    selectedCouponId,
    memberCouponsQuery.data,
    memberCouponsQuery.isFetching,
    memberCouponsQuery.isError,
    bookingDates.isStayReady,
    bookingDates.totalPrice,
    clearSelectedCoupon,
  ]);

  useEffect(() => {
    if (!selectionLocked) return;
    setIsDatePickerOpen(false);
    setIsGuestPickerOpen(false);
  }, [selectionLocked]);

  useEffect(() => {
    if (!selectionLocked || !quoteSnapshot) return;
    setAdultCount(quoteSnapshot.adultCount);
    setChildCount(quoteSnapshot.childCount);
    setInfantCount(quoteSnapshot.infantCount);
    setPetCount(quoteSnapshot.petCount);

    const displayedCheckIn = bookingDates.checkIn
      ? formatBookingLocalDate(bookingDates.checkIn)
      : null;
    const displayedCheckOut = bookingDates.checkOut
      ? formatBookingLocalDate(bookingDates.checkOut)
      : null;
    if (
      displayedCheckIn !== quoteSnapshot.checkIn ||
      displayedCheckOut !== quoteSnapshot.checkOut
    ) {
      onReplaceBookingDates(quoteSnapshot.checkIn, quoteSnapshot.checkOut);
    }
  }, [
    bookingDates.checkIn,
    bookingDates.checkOut,
    onReplaceBookingDates,
    quoteSnapshot,
    selectionLocked,
  ]);

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
        if (couponsQuery.isFetching || memberCouponsQuery.isFetching) return;
        if (couponsQuery.isError || memberCouponsQuery.isError) {
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
        if (availabilityStatus !== "ready") return;
        if (claimedIntent.couponId !== null && memberCouponsQuery.isFetching)
          return;
        if (claimedIntent.couponId !== null && memberCouponsQuery.isError) {
          complete();
          return;
        }
        const coupon =
          claimedIntent.couponId === null
            ? null
            : (memberCouponsQuery.data?.coupons.find(
                (candidate) =>
                  candidate.id === claimedIntent.couponId &&
                  isAccommodationCouponApplicable(
                    candidate,
                    bookingDates.totalPrice,
                  ),
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
    availabilityStatus,
    authIntent,
    coupons,
    couponsQuery.isError,
    couponsQuery.isFetching,
    memberCouponsQuery.data,
    memberCouponsQuery.isFetching,
    memberCouponsQuery.isError,
    bookingDates.totalPrice,
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

  const detailView = useMemo(
    () =>
      accommodation
        ? toAccommodationDetailViewModel(
            accommodation,
            resolveImageUrl,
            amenityCatalog,
          )
        : null,
    [accommodation, amenityCatalog, resolveImageUrl],
  );
  const imageGallery = useAccommodationImageGallery({
    imageCount: detailView?.heroImages.length ?? 0,
  });

  let state: AccommodationDetailScreenState;
  const detailErrorIsTerminal =
    detailQuery.isError &&
    isAccommodationDetailTerminalError(detailQuery.error);
  const refreshError =
    detailQuery.isError && accommodation && !detailErrorIsTerminal
      ? {
          isRetrying: Boolean(detailQuery.isFetching),
          message: toAccommodationErrorMessage(detailQuery.error),
          onRetry: () => void detailQuery.refetch(),
        }
      : null;
  if (accommodationId === null) {
    state = {
      status: "terminal-error",
      message: "숙소 정보를 확인할 수 없습니다.",
    };
  } else if (detailQuery.isLoading) {
    state = { status: "loading" };
  } else if (detailQuery.isError && (!accommodation || detailErrorIsTerminal)) {
    const message = toAccommodationErrorMessage(detailQuery.error);
    state = detailErrorIsTerminal
      ? { status: "terminal-error", message }
      : {
          status: "retryable-error",
          message,
          onRetry: () => void detailQuery.refetch(),
        };
  } else if (!accommodation || !detailView) {
    state = {
      status: "terminal-error",
      message: "숙소를 찾을 수 없습니다.",
    };
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
        bookingView: toAccommodationBookingViewModel(
          accommodation,
          availability,
        ),
        isAuthenticated,
        bookingState: {
          payablePrice,
          availabilityStatus,
          isStayReady,
          nights: bookingDates.nights,
          selectionState: bookingDates.selectionState,
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
          quoteSnapshot,
          reservationStatus,
          selectionLocked,
        },
        bookingActions: {
          formatDate: formatBookingDisplayDate,
          handleDateSelect: (checkIn, checkOut) => {
            if (selectionLocked || !availabilityInteractionReadyRef.current) {
              return;
            }
            startTransition(() => {
              onReplaceBookingDates(
                checkIn ? formatBookingLocalDate(checkIn) : null,
                checkOut ? formatBookingLocalDate(checkOut) : null,
              );
            });
          },
          onDatePickerOpenChange: setIsDatePickerOpen,
          onGuestPickerOpenChange: setIsGuestPickerOpen,
          onAdultCountChange: (next) => {
            if (!selectionLocked) setAdultCount(next);
          },
          onChildCountChange: (next) => {
            if (!selectionLocked) setChildCount(next);
          },
          onInfantCountChange: (next) => {
            if (!selectionLocked) setInfantCount(next);
          },
          onPetCountChange: (next) => {
            if (!selectionLocked) setPetCount(next);
          },
          onAbandonQuote: abandonQuote,
          onReserve: () => {
            if (
              !quoteSnapshot &&
              (!availabilityInteractionReadyRef.current || !isStayReady)
            ) {
              return;
            }
            if (!quoteSnapshot && issuingCouponId !== null) {
              setErrorMessage("쿠폰 확인이 끝난 뒤 예약을 진행해주세요.");
              return;
            }
            if (
              !quoteSnapshot &&
              selectedCouponId !== null &&
              (memberCouponsQuery.isFetching ||
                memberCouponsQuery.isError ||
                !selectedCoupon)
            ) {
              setErrorMessage(
                "선택한 쿠폰 상태를 다시 확인하거나 적용을 해제해주세요.",
              );
              return;
            }
            void startReservation();
          },
          retryAvailability: () => void availabilityQuery.refetch(),
        },
        couponState: {
          coupons: couponViews,
          errorMessage:
            couponsQuery.isError || memberCouponsQuery.isError
              ? toAccommodationErrorMessage(
                  couponsQuery.error ?? memberCouponsQuery.error,
                )
              : null,
          isLoadingCoupons:
            couponsQuery.isFetching || memberCouponsQuery.isFetching,
          selectedCoupon: selectedCouponView,
          couponDiscount: selectedCouponDiscount,
        },
        couponActions: {
          retryCoupons: () => {
            if (!selectionLocked)
              void Promise.all([
                couponsQuery.refetch(),
                memberCouponsQuery.refetch(),
              ]);
          },
          onSelectedCouponIdChange: (couponId) => {
            if (!selectionLocked && couponId === null) clearSelectedCoupon();
          },
          handleIssueCoupon: (couponView) => {
            if (
              selectionLocked ||
              memberCouponsQuery.isFetching ||
              memberCouponsQuery.isError
            )
              return undefined;
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
        ...(onBack ? { onBack } : {}),
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
        errorMessage: reviewFeed.reviewErrorMessage,
        hasNext: reviewFeed.hasNextReviewPage,
        isFetching: reviewFeed.isFetchingNextReviewPage,
        isOpen: reviewFeed.isReviewModalOpen,
        isRetrying: reviewFeed.isRetryingReviewFeed,
        loadMoreErrorMessage: reviewFeed.loadMoreErrorMessage,
        onClose: reviewFeed.closeReviewModal,
        onLoadMore: reviewFeed.loadNextReviewPage,
        onRetry: reviewFeed.retryReviewFeed,
        onRetryLoadMore: reviewFeed.retryNextReviewPage,
        reviews: reviewFeed.allReviews,
        status: reviewFeed.status,
        totalCount: detailView.rating.reviewCount,
      },
      reviews: {
        errorMessage: reviewFeed.reviewErrorMessage,
        expandedReviews: {},
        isRetrying: reviewFeed.isRetryingReviewFeed,
        onOpenReviews: reviewFeed.openReviewModal,
        onRetry: reviewFeed.retryReviewFeed,
        reviews: reviewFeed.previewReviews,
        reviewSummary: detailView.rating,
        status: reviewFeed.status,
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
      {...(onBack ? { onBack } : {})}
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(null)}
      refreshError={refreshError}
      state={state}
    />
  );
}
