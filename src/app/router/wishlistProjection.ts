import type { QueryClient } from "@tanstack/react-query";
import { createAccommodationDetailQueryCacheProjection } from "../../features/accommodations/detail/public";
import { createSearchQueryCacheProjection } from "../../features/search/public";
import {
  createWishlistQueryCacheProjection,
  type WishlistProjectionPort,
} from "../../features/wishlist/public";

/**
 * App-owned composition for wishlist write projections.
 *
 * The workflow knows only the wishlist projection port. Feature-specific cache
 * schemas stay in their owning features and are joined here at the app layer.
 * Every cache schema stays in its owning feature; the app only fans out the
 * workflow's domain event to those narrow projections.
 */
export const createAppWishlistProjection = (
  queryClient: QueryClient,
): WishlistProjectionPort => {
  const wishlistProjection = createWishlistQueryCacheProjection(queryClient);
  const searchProjection = createSearchQueryCacheProjection(queryClient);
  const accommodationProjection =
    createAccommodationDetailQueryCacheProjection(queryClient);

  return {
    membershipReconciled(input) {
      wishlistProjection.membershipReconciled(input);
      searchProjection.membershipReconciled({
        scope: input.scope,
        accommodationId: input.accommodationId,
        isInWishlist: input.isInAnyWishlist,
      });
      accommodationProjection.membershipReconciled(input);
    },

    membershipRefreshRequired(input) {
      wishlistProjection.membershipRefreshRequired(input);
      searchProjection.membershipRefreshRequired({ scope: input.scope });
      accommodationProjection.membershipRefreshRequired(input);
    },

    wishlistCreated(input) {
      wishlistProjection.wishlistCreated(input);
    },

    wishlistDeleted(input) {
      wishlistProjection.wishlistDeleted(input);
      searchProjection.membershipRefreshRequired({ scope: input.scope });
      accommodationProjection.membershipScopeRefreshRequired({
        scope: input.scope,
      });
    },

    memoSaved(input) {
      wishlistProjection.memoSaved(input);
    },

    recentlyViewedRemoved(input) {
      wishlistProjection.recentlyViewedRemoved(input);
    },
  };
};
