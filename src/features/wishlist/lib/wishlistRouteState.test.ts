import {
  buildWishlistRouteSearchParams,
  parseWishlistRouteState,
} from "./wishlistRouteState";

describe("wishlist route state", () => {
  it("defaults to wishlist index", () => {
    expect(parseWishlistRouteState(new URLSearchParams(""))).toEqual({
      view: "index",
      wishlistId: null,
    });
  });

  it("parses recently viewed view", () => {
    expect(
      parseWishlistRouteState(new URLSearchParams("view=recently-viewed"))
    ).toEqual({
      view: "recently-viewed",
      wishlistId: null,
    });
  });

  it("parses positive wishlist ids", () => {
    expect(parseWishlistRouteState(new URLSearchParams("id=42"))).toEqual({
      view: "wishlist-detail",
      wishlistId: 42,
    });
  });

  it("ignores invalid wishlist ids", () => {
    expect(parseWishlistRouteState(new URLSearchParams("id=abc"))).toEqual({
      view: "index",
      wishlistId: null,
    });
  });

  it("builds stable wishlist query strings", () => {
    expect(
      buildWishlistRouteSearchParams({
        view: "wishlist-detail",
        wishlistId: 42,
      }).toString()
    ).toBe("id=42");
  });
});
