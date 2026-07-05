export const WISHLIST_PAGE_SIZE = 20;

interface WishlistListQueryParamsOptions {
  accommodationId?: number;
  cursor?: string | null;
}

export const getWishlistListsParamsSignature = ({
  accommodationId,
}: Pick<WishlistListQueryParamsOptions, "accommodationId"> = {}) =>
  accommodationId === undefined ? "" : `accommodationId=${accommodationId}`;

export const getWishlistListParams = ({
  accommodationId,
  cursor,
}: WishlistListQueryParamsOptions) => ({
  ...(accommodationId === undefined ? {} : { accommodationId }),
  ...(cursor ? { cursor } : {}),
  size: WISHLIST_PAGE_SIZE,
});
