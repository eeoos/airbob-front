import type { WishlistRouteView } from "./wishlistRouteQuery";

export type { WishlistRouteView } from "./wishlistRouteQuery";

export interface WishlistRouteState {
  view: WishlistRouteView;
  wishlistId: number | null;
}

const parseWishlistId = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseWishlistRouteState = (
  params: URLSearchParams
): WishlistRouteState => {
  const wishlistId = parseWishlistId(params.get("id"));

  if (wishlistId !== null) {
    return {
      view: "wishlist-detail",
      wishlistId,
    };
  }

  if (params.get("view") === "recently-viewed") {
    return {
      view: "recently-viewed",
      wishlistId: null,
    };
  }

  return {
    view: "index",
    wishlistId: null,
  };
};

export const buildWishlistRouteSearchParams = (
  state: WishlistRouteState
): URLSearchParams => {
  const params = new URLSearchParams();

  if (state.view === "wishlist-detail" && state.wishlistId !== null) {
    params.set("id", state.wishlistId.toString());
  } else if (state.view === "recently-viewed") {
    params.set("view", "recently-viewed");
  }

  return params;
};
