import type { ComponentProps } from "react";
import {
  RecentlyViewedView,
  WishlistDetailView,
  WishlistIndexView,
  WishlistMemoDialog,
  WishlistModal,
} from "../../features/wishlist/components";
import { PageContainer, ToastHost } from "../../shared/ui";

export type WishlistRouteView =
  | { readonly kind: "index" }
  | { readonly kind: "recently-viewed" }
  | { readonly kind: "wishlist-detail"; readonly wishlistId: number };

export interface WishlistNavigationCommands {
  readonly openIndex: () => void;
  readonly replaceWithIndex: () => void;
  readonly openRecentlyViewed: () => void;
  readonly openWishlistDetail: (wishlistId: number) => void;
  readonly openAccommodation: (accommodationId: number) => void;
}

export interface WishlistScreenProps {
  readonly className?: string;
  readonly detail: ComponentProps<typeof WishlistDetailView>;
  readonly errorMessage: string | null;
  readonly index: ComponentProps<typeof WishlistIndexView>;
  readonly memoDialog: ComponentProps<typeof WishlistMemoDialog>;
  readonly onClearError: () => void;
  readonly recentlyViewed: ComponentProps<typeof RecentlyViewedView>;
  readonly saveModal: Omit<
    ComponentProps<typeof WishlistModal>,
    "isOpen"
  > | null;
  readonly view: WishlistRouteView;
}

export function WishlistScreen({
  className,
  detail,
  errorMessage,
  index,
  memoDialog,
  onClearError,
  recentlyViewed,
  saveModal,
  view,
}: WishlistScreenProps) {
  return (
    <PageContainer className={className} variant="wide">
      {view.kind === "recently-viewed" ? (
        <RecentlyViewedView {...recentlyViewed} />
      ) : view.kind === "wishlist-detail" ? (
        <WishlistDetailView {...detail} />
      ) : (
        <WishlistIndexView {...index} />
      )}

      {errorMessage && (
        <ToastHost
          closeLabel="오류 닫기"
          message={errorMessage}
          onClose={onClearError}
        />
      )}

      {saveModal && <WishlistModal {...saveModal} isOpen />}
      <WishlistMemoDialog {...memoDialog} />
    </PageContainer>
  );
}
