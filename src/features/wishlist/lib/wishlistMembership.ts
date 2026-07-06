import { wishlistApi } from "../../../api";
import { WishlistInfos } from "../../../types/wishlist";
import { getWishlistListParams } from "./wishlistListQueryParams";

export interface WishlistMembershipResult {
  isInAnyWishlist: boolean;
  pages: WishlistInfos[];
  pageParams: Array<string | null>;
}

export const fetchAccommodationWishlistMembership = async (
  accommodationId: number
): Promise<WishlistMembershipResult> => {
  let cursor: string | null = null;
  const pages: WishlistInfos[] = [];
  const pageParams: Array<string | null> = [];

  while (true) {
    pageParams.push(cursor);
    const response: WishlistInfos = await wishlistApi.getWishlists(
      getWishlistListParams({
        accommodationId,
        cursor,
      }),
    );
    pages.push(response);

    if (response.wishlists.some((wishlist) => wishlist.is_contained)) {
      return { isInAnyWishlist: true, pages, pageParams };
    }

    cursor = response.page_info.next_cursor ?? null;
    if (!response.page_info.has_next || cursor === null) {
      return { isInAnyWishlist: false, pages, pageParams };
    }
  }
};
