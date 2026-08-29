import type { QueryClient } from "@tanstack/react-query";
import {
  createWishlistQueryCacheProjection,
  type WishlistProjectionPort,
} from "../../features/wishlist/public";

const searchQueryRoot = ["search"] as const;
const accommodationDetailQueryRoot = ["accommodation", "detail"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const patchSearchMembership = (
  value: unknown,
  accommodationId: number,
  isInWishlist: boolean,
): unknown => {
  if (!isRecord(value) || !Array.isArray(value.stay_search_result_listing)) {
    return value;
  }

  let changed = false;
  const listing = value.stay_search_result_listing.map((item) => {
    if (
      !isRecord(item) ||
      item.id !== accommodationId ||
      item.is_in_wishlist === isInWishlist
    ) {
      return item;
    }

    changed = true;
    return { ...item, is_in_wishlist: isInWishlist };
  });

  return changed
    ? { ...value, stay_search_result_listing: listing }
    : value;
};

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
  queryClient.removeQueries({ queryKey: searchQueryRoot, type: "inactive" });
  queryClient.removeQueries({
    queryKey: accommodationDetailQueryRoot,
    type: "inactive",
  });
  void queryClient.invalidateQueries({
    queryKey: searchQueryRoot,
    type: "active",
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
        { queryKey: searchQueryRoot },
        (previous: unknown) =>
          patchSearchMembership(
            previous,
            input.accommodationId,
            input.isInAnyWishlist,
          ),
      );
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
