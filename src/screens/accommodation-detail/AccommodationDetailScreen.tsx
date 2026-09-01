import type { ComponentProps } from "react";
import {
  AccommodationBookingCard,
  AccommodationDescriptionModal,
  AccommodationHero,
  AccommodationImageGalleryModal,
  AccommodationLocationSection,
  AccommodationOverview,
  AccommodationReviewsSection,
} from "../../features/accommodations/detail/public";
import { AuthModal } from "../../features/auth/public";
import { ReviewModal } from "../../features/reviews/public";
import { WishlistModal } from "../../features/wishlist/public";
import { PageContainer, stateViewRecipes, ToastHost } from "../../shared/ui";
import styles from "./AccommodationDetailScreen.module.css";

export interface AccommodationDetailReadyView {
  readonly authModal: ComponentProps<typeof AuthModal>;
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
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly view: AccommodationDetailReadyView };

export interface AccommodationDetailScreenProps {
  readonly errorMessage: string | null;
  readonly onClearError: () => void;
  readonly state: AccommodationDetailScreenState;
}

export function AccommodationDetailScreen({
  errorMessage,
  onClearError,
  state,
}: AccommodationDetailScreenProps) {
  if (state.status === "loading") {
    return (
      <PageContainer
        className={styles.loading}
        variant="full"
        {...stateViewRecipes.loading}
      >
        로딩 중...
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer
        className={styles.error}
        variant="full"
        {...stateViewRecipes.terminalError}
      >
        {state.message}
      </PageContainer>
    );
  }

  const { view } = state;

  return (
    <>
      <PageContainer variant="full">
        <AccommodationHero {...view.hero} />

        <div className={styles.contentWrapper}>
          <div className={styles.leftColumn}>
            <AccommodationOverview {...view.overview} />
          </div>
          <div className={styles.sidebar}>
            <AccommodationBookingCard {...view.bookingCard} />
          </div>
        </div>

        <AccommodationLocationSection {...view.location} />
        <AccommodationReviewsSection {...view.reviews} />
      </PageContainer>

      <ReviewModal {...view.reviewModal} />
      {view.wishlistModal && <WishlistModal {...view.wishlistModal} />}
      <AuthModal {...view.authModal} />
      <AccommodationDescriptionModal {...view.descriptionModal} />
      <AccommodationImageGalleryModal {...view.galleryModal} />

      {errorMessage && (
        <ToastHost
          closeLabel="오류 닫기"
          message={errorMessage}
          onClose={onClearError}
        />
      )}
    </>
  );
}
