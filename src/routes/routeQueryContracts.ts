import { appendDefinedSearchParam } from "./routeQuery";

type RouteParamValue = string | number;

export type AccommodationBookingRouteQuery = {
  checkIn?: RouteParamValue;
  checkOut?: RouteParamValue;
  adultOccupancy?: RouteParamValue;
  childOccupancy?: RouteParamValue;
  infantOccupancy?: RouteParamValue;
  petOccupancy?: RouteParamValue;
};

export type SearchRouteQuery = AccommodationBookingRouteQuery & {
  destination?: RouteParamValue;
  page?: RouteParamValue;
  lat?: RouteParamValue;
  lng?: RouteParamValue;
  topLeftLat?: RouteParamValue;
  topLeftLng?: RouteParamValue;
  bottomRightLat?: RouteParamValue;
  bottomRightLng?: RouteParamValue;
};

export type WishlistRouteView = "index" | "recently-viewed" | "wishlist-detail";

export type WishlistRouteQuery =
  | { id: RouteParamValue; view?: never }
  | { id?: never; view: "recently-viewed" }
  | { id?: undefined; view?: undefined };

export type ProfileRouteMode = "guest" | "host";
export type ProfileGuestRouteTab = "trips" | "upcoming" | "past" | "cancelled";
export type ProfileHostRouteTab =
  | "listings"
  | "listings-published"
  | "listings-draft"
  | "listings-unpublished"
  | "reservations"
  | "reservations-upcoming"
  | "reservations-past"
  | "reservations-cancelled";
export type ProfileRouteTab = ProfileGuestRouteTab | ProfileHostRouteTab;
export type ProfileRouteQuery =
  | { mode?: "guest"; tab?: ProfileGuestRouteTab }
  | { mode: "host"; tab?: ProfileHostRouteTab };

export type PaymentFailReason = "confirm-failed" | "invalid-callback";
export type PaymentFailRouteQuery = { reason?: PaymentFailReason };

export const parsePaymentFailReason = (
  reason: string | null,
): PaymentFailReason | undefined => {
  if (reason === "confirm-failed" || reason === "invalid-callback") {
    return reason;
  }

  return undefined;
};

export const buildAccommodationBookingRouteSearchParams = (
  query?: AccommodationBookingRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "checkIn", query?.checkIn);
  appendDefinedSearchParam(params, "checkOut", query?.checkOut);
  appendDefinedSearchParam(params, "adultOccupancy", query?.adultOccupancy);
  appendDefinedSearchParam(params, "childOccupancy", query?.childOccupancy);
  appendDefinedSearchParam(params, "infantOccupancy", query?.infantOccupancy);
  appendDefinedSearchParam(params, "petOccupancy", query?.petOccupancy);

  return params;
};

export const buildSearchRouteSearchParams = (query?: SearchRouteQuery) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "destination", query?.destination);
  appendDefinedSearchParam(params, "page", query?.page);
  appendDefinedSearchParam(params, "lat", query?.lat);
  appendDefinedSearchParam(params, "lng", query?.lng);
  appendDefinedSearchParam(params, "topLeftLat", query?.topLeftLat);
  appendDefinedSearchParam(params, "topLeftLng", query?.topLeftLng);
  appendDefinedSearchParam(params, "bottomRightLat", query?.bottomRightLat);
  appendDefinedSearchParam(params, "bottomRightLng", query?.bottomRightLng);
  appendDefinedSearchParam(params, "checkIn", query?.checkIn);
  appendDefinedSearchParam(params, "checkOut", query?.checkOut);
  appendDefinedSearchParam(params, "adultOccupancy", query?.adultOccupancy);
  appendDefinedSearchParam(params, "childOccupancy", query?.childOccupancy);
  appendDefinedSearchParam(params, "infantOccupancy", query?.infantOccupancy);
  appendDefinedSearchParam(params, "petOccupancy", query?.petOccupancy);

  return params;
};

export const buildWishlistRouteQuerySearchParams = (
  query?: WishlistRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "id", query?.id);
  appendDefinedSearchParam(params, "view", query?.view);

  return params;
};

export const buildProfileRouteQuerySearchParams = (
  query?: ProfileRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "mode", query?.mode);
  appendDefinedSearchParam(params, "tab", query?.tab);

  return params;
};

export const buildPaymentFailRouteSearchParams = (
  query?: PaymentFailRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "reason", query?.reason);

  return params;
};
