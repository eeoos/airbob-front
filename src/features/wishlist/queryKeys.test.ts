import { wishlistQueryKeys } from "./queryKeys";

describe("wishlistQueryKeys", () => {
  it("exposes the wishlist root key", () => {
    expect(wishlistQueryKeys.all).toEqual(["wishlist"]);
  });

  it("builds stable wishlist collection keys", () => {
    expect(wishlistQueryKeys.lists("")).toEqual([
      "wishlist",
      "lists",
      "",
    ]);
    expect(wishlistQueryKeys.lists("page=1")).toEqual([
      "wishlist",
      "lists",
      "page=1",
    ]);
    expect(wishlistQueryKeys.lists("page=1&accommodationId=7")).toEqual(
      wishlistQueryKeys.lists("accommodationId=7&page=1"),
    );
  });

  it("builds stable wishlist detail keys", () => {
    expect(wishlistQueryKeys.detail(7)).toEqual([
      "wishlist",
      "detail",
      7,
      "",
    ]);
    expect(wishlistQueryKeys.detail(7, "memo=1")).toEqual([
      "wishlist",
      "detail",
      7,
      "memo=1",
    ]);
    expect(wishlistQueryKeys.detail(7, "page=1&memo=1")).toEqual(
      wishlistQueryKeys.detail(7, "memo=1&page=1"),
    );
  });

  it("builds stable recently viewed keys", () => {
    expect(wishlistQueryKeys.recentlyViewed()).toEqual([
      "wishlist",
      "recentlyViewed",
    ]);
  });
});
