import type { QueryClient } from "@tanstack/react-query";
import { createSearchQueryCacheProjection } from "../../features/search/public";
import type { WishlistProjectionPort } from "../../features/wishlist/public";
import { createLegacyWishlistProjectionAdapter } from "../../workflows/wishlist-membership";

/**
 * App-owned composition for wishlist write projections.
 *
 * The workflow knows only the wishlist projection port. Feature-specific cache
 * schemas stay in their owning features and are joined here at the app layer.
 * The legacy adapter is limited to wishlist reads plus accommodation detail
 * until U9 removes the remaining detail compatibility branch.
 */
export const createAppWishlistProjection = (
  queryClient: QueryClient,
): WishlistProjectionPort => {
  const legacyProjection =
    createLegacyWishlistProjectionAdapter(queryClient);
  const searchProjection = createSearchQueryCacheProjection(queryClient);

  return {
    membershipReconciled(input) {
      legacyProjection.membershipReconciled(input);
      searchProjection.membershipReconciled({
        scope: input.scope,
        accommodationId: input.accommodationId,
        isInWishlist: input.isInAnyWishlist,
      });
    },

    membershipRefreshRequired(input) {
      legacyProjection.membershipRefreshRequired(input);
      searchProjection.membershipRefreshRequired({ scope: input.scope });
    },

    wishlistCreated(input) {
      legacyProjection.wishlistCreated(input);
    },

    wishlistDeleted(input) {
      legacyProjection.wishlistDeleted(input);
      searchProjection.membershipRefreshRequired({ scope: input.scope });
    },

    memoSaved(input) {
      legacyProjection.memoSaved(input);
    },

    recentlyViewedRemoved(input) {
      legacyProjection.recentlyViewedRemoved(input);
    },
  };
};
