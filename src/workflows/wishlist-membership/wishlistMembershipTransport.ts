import { recentlyViewedApi, wishlistApi } from "../../features/wishlist/api";
import type { WishlistMembershipTransport } from "./wishlistMembership";

export const wishlistMembershipTransport: WishlistMembershipTransport = {
  createWishlist: (input, signal) => wishlistApi.create(input, { signal }),
  addAccommodation: (wishlistId, input, signal) =>
    wishlistApi.addAccommodation(wishlistId, input, { signal }),
  removeAccommodation: (wishlistAccommodationId, signal) =>
    wishlistApi.removeAccommodation(wishlistAccommodationId, { signal }),
  deleteWishlist: (wishlistId, signal) =>
    wishlistApi.delete(wishlistId, { signal }),
  async saveMemo(wishlistAccommodationId, input, signal) {
    await wishlistApi.updateAccommodationMemo(wishlistAccommodationId, input, {
      signal,
    });
  },
  removeRecentlyViewed: (accommodationId, signal) =>
    recentlyViewedApi.remove(accommodationId, { signal }),
  async getAccommodationMembership(input, signal) {
    const page = await wishlistApi.getWishlists(
      {
        accommodationId: input.accommodationId,
        ...(input.cursor ? { cursor: input.cursor } : {}),
        size: input.size,
      },
      { signal },
    );

    return {
      wishlists: page.wishlists.map((wishlist) => ({
        id: wishlist.id,
        isContained: wishlist.containsAccommodation,
      })),
      pageInfo: {
        hasNext: page.pageInfo.hasNext,
        nextCursor: page.pageInfo.nextCursor,
      },
    };
  },
};
