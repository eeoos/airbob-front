import { appendDefinedSearchParam } from "../../../routes/routeQuery";

type RouteParamValue = string | number;

export type WishlistRouteView = "index" | "recently-viewed" | "wishlist-detail";

export type WishlistRouteQuery =
  | {
      id: RouteParamValue;
      view?: never;
    }
  | {
      id?: never;
      view: "recently-viewed";
    }
  | {
      id?: undefined;
      view?: undefined;
    };

export const buildWishlistRouteQuerySearchParams = (
  query?: WishlistRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "id", query?.id);
  appendDefinedSearchParam(params, "view", query?.view);

  return params;
};
