import { serializeWishlistRouteQuery, wishlistCodec } from "./wishlistCodec";

describe("wishlistCodec", () => {
  it.each([
    ["", { view: "index", wishlistId: null }],
    ["view=recently-viewed", { view: "recently-viewed", wishlistId: null }],
    ["id=42", { view: "wishlist-detail", wishlistId: 42 }],
    ["view=recently-viewed&id=42", { view: "wishlist-detail", wishlistId: 42 }],
    ["id=0", { view: "index", wishlistId: null }],
    ["id=-1", { view: "index", wishlistId: null }],
    ["id=abc&view=unknown", { view: "index", wishlistId: null }],
  ] as const)("normalizes %s with current precedence", (query, expected) => {
    expect(wishlistCodec.parse(query)).toEqual(expected);
  });

  it("round-trips each valid state", () => {
    ["", "view=recently-viewed", "id=42"].forEach((query) => {
      const state = wishlistCodec.parse(query);
      expect(wishlistCodec.parse(wishlistCodec.serialize(state))).toEqual(
        state,
      );
    });
  });

  it("canonicalizes independently of insertion order and drops unrelated keys", () => {
    expect(
      wishlistCodec.canonicalize("view=recently-viewed&id=42&token=secret"),
    ).toBe(wishlistCodec.canonicalize("id=42&view=recently-viewed"));
    expect(wishlistCodec.canonicalize("id=42&view=recently-viewed")).toBe(
      "id=42",
    );
  });

  it("keeps route-builder serialization stable", () => {
    expect(serializeWishlistRouteQuery({ id: 1001 }).toString()).toBe(
      "id=1001",
    );
    expect(
      serializeWishlistRouteQuery({ view: "recently-viewed" }).toString(),
    ).toBe("view=recently-viewed");
  });
});
