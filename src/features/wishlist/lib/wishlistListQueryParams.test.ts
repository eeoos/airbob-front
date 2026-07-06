import {
  getWishlistListParams,
  getWishlistListsParamsSignature,
  WISHLIST_PAGE_SIZE,
} from "./wishlistListQueryParams";

describe("wishlist list query params", () => {
  it("builds the default wishlist list request params", () => {
    expect(getWishlistListParams({})).toEqual({
      size: WISHLIST_PAGE_SIZE,
    });
  });

  it("builds accommodation-scoped wishlist list request params", () => {
    expect(
      getWishlistListParams({
        accommodationId: 7,
        cursor: "cursor-1",
      }),
    ).toEqual({
      accommodationId: 7,
      cursor: "cursor-1",
      size: WISHLIST_PAGE_SIZE,
    });
  });

  it("builds stable cache signatures for accommodation-scoped lists", () => {
    expect(getWishlistListsParamsSignature()).toBe("");
    expect(getWishlistListsParamsSignature({ accommodationId: 7 })).toBe(
      "accommodationId=7",
    );
  });
});
