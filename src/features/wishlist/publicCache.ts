import type { QueryClient } from "@tanstack/react-query";
import { setAccommodationScopedWishlistMembershipCache } from "./lib/wishlistCacheSync";
import { fetchAccommodationWishlistMembership } from "./lib/wishlistMembership";
import { wishlistQueryKeys } from "./queryKeys";

export const invalidateWishlistCaches = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wishlistQueryKeys.all });
  queryClient.invalidateQueries({
    queryKey: wishlistQueryKeys.recentlyViewed(),
  });
};

export const refreshAccommodationScopedWishlistMembershipCache = async (
  queryClient: QueryClient,
  accommodationId: number,
) => {
  const membership =
    await fetchAccommodationWishlistMembership(accommodationId);

  setAccommodationScopedWishlistMembershipCache(
    queryClient,
    accommodationId,
    membership,
  );

  return membership;
};
