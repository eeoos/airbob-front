import {
  appendDefinedSearchParam,
  type SearchParamsInput,
  toSearchParams,
} from "./queryCodecUtils";

export type WishlistRouteQuery =
  | { id: string | number; view?: never }
  | { id?: never; view: "recently-viewed" }
  | { id?: undefined; view?: undefined };

type WishlistRouteState =
  | { view: "index"; wishlistId: null }
  | { view: "recently-viewed"; wishlistId: null }
  | { view: "wishlist-detail"; wishlistId: number };

const parseWishlistId = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseWishlistRouteState = (
  input: SearchParamsInput,
): WishlistRouteState => {
  const params = toSearchParams(input);
  const wishlistId = parseWishlistId(params.get("id"));

  if (wishlistId !== null) {
    return { view: "wishlist-detail", wishlistId };
  }

  if (params.get("view") === "recently-viewed") {
    return { view: "recently-viewed", wishlistId: null };
  }

  return { view: "index", wishlistId: null };
};

export const serializeWishlistRouteQuery = (
  query?: WishlistRouteQuery,
): URLSearchParams => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "id", query?.id);
  appendDefinedSearchParam(params, "view", query?.view);

  return params;
};

const serializeWishlistRouteState = (
  state: WishlistRouteState,
): URLSearchParams => {
  if (state.view === "wishlist-detail") {
    return serializeWishlistRouteQuery({ id: state.wishlistId });
  }

  if (state.view === "recently-viewed") {
    return serializeWishlistRouteQuery({ view: state.view });
  }

  return new URLSearchParams();
};

const canonicalizeWishlistRoute = (input: SearchParamsInput): string =>
  serializeWishlistRouteState(parseWishlistRouteState(input)).toString();

export const wishlistCodec = {
  parse: parseWishlistRouteState,
  serialize: serializeWishlistRouteState,
  canonicalize: canonicalizeWishlistRoute,
} as const;
