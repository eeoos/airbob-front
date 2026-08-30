import type { QueryClient } from "@tanstack/react-query";
import {
  createWishlistQueryCacheProjection,
  type WishlistProjectionPort,
} from "../../features/wishlist/public";

const accommodationDetailQueryRoot = ["accommodation", "detail"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const patchAccommodationMembership = (
  value: unknown,
  accommodationId: number,
  isInWishlist: boolean,
): unknown =>
  isRecord(value) &&
  value.id === accommodationId &&
  value.is_in_wishlist !== isInWishlist
    ? { ...value, is_in_wishlist: isInWishlist }
    : value;

const invalidateUnknownLegacyMembership = (queryClient: QueryClient) => {
  queryClient.removeQueries({
    queryKey: accommodationDetailQueryRoot,
    type: "inactive",
  });
  void queryClient.invalidateQueries({
    queryKey: accommodationDetailQueryRoot,
    type: "active",
  });
};

export const createLegacyWishlistProjectionAdapter = (
  queryClient: QueryClient,
): WishlistProjectionPort => {
  const wishlistProjection = createWishlistQueryCacheProjection(queryClient);

  return {
    membershipReconciled(input) {
      wishlistProjection.membershipReconciled(input);
      queryClient.setQueriesData(
        { queryKey: accommodationDetailQueryRoot },
        (previous: unknown) =>
          patchAccommodationMembership(
            previous,
            input.accommodationId,
            input.isInAnyWishlist,
          ),
      );
    },

    membershipRefreshRequired(input) {
      wishlistProjection.membershipRefreshRequired(input);
      invalidateUnknownLegacyMembership(queryClient);
    },

    wishlistCreated(input) {
      wishlistProjection.wishlistCreated(input);
    },

    wishlistDeleted(input) {
      wishlistProjection.wishlistDeleted(input);
      invalidateUnknownLegacyMembership(queryClient);
    },

    memoSaved(input) {
      wishlistProjection.memoSaved(input);
    },

    recentlyViewedRemoved(input) {
      wishlistProjection.recentlyViewedRemoved(input);
    },
  };
};
