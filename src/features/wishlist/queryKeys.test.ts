import { wishlistQueryKeys } from "./queryKeys";

describe("wishlistQueryKeys", () => {
  it("builds stable wishlist collection keys", () => {
    expect(wishlistQueryKeys.lists("page=1")).toEqual([
      "wishlist",
      "lists",
      "page=1",
    ]);
  });

  it("builds stable wishlist detail keys", () => {
    expect(wishlistQueryKeys.detail(7)).toEqual(["wishlist", "detail", 7]);
  });
});
