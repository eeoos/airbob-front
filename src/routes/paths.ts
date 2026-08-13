import {
  buildAccommodationBookingRouteSearchParams,
  buildPaymentFailRouteSearchParams,
  buildPaymentSuccessRouteSearchParams,
  buildProfileRouteQuerySearchParams,
  buildSearchRouteSearchParams,
  buildWishlistRouteQuerySearchParams,
} from "./routeQueryContracts";
import type {
  AccommodationBookingRouteQuery,
  PaymentFailRouteQuery,
  PaymentSuccessRouteQuery,
  ProfileRouteQuery,
  SearchRouteQuery,
  WishlistRouteQuery,
} from "./routeQueryContracts";

export type {
  AccommodationBookingRouteQuery,
  PaymentFailReason,
  PaymentFailRouteQuery,
  PaymentSuccessRouteQuery,
  ProfileGuestRouteTab,
  ProfileHostRouteTab,
  ProfileRouteMode,
  ProfileRouteQuery,
  ProfileRouteTab,
  SearchRouteQuery,
  WishlistRouteQuery,
  WishlistRouteView,
} from "./routeQueryContracts";
export { parsePaymentFailReason } from "./routeQueryContracts";

export const ROUTE_PATHS = {
  home: "/",
  search: "/search",
  accommodationDetail: "/accommodations/:id",
  accommodationConfirm: "/accommodations/:id/confirm",
  accommodationEdit: "/accommodations/:id/edit",
  wishlist: "/wishlist",
  profile: "/profile",
  hostReservationDetail: "/profile/host/reservations/:reservationUid",
  reservationDetail: "/reservations/:reservationUid",
  reviewCreate: "/reservations/:reservationUid/review",
  paymentSuccess: "/reservations/:reservationUid/success",
  paymentFail: "/reservations/:reservationUid/fail",
  login: "/login",
  signup: "/signup",
  notFound: "*",
} as const;

export type RouteParamValue = string | number;

export interface AccommodationEditNavigationState {
  accommodationEdit: {
    accommodationId: string;
    source: "created-draft";
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const createAccommodationEditNavigationState = (
  accommodationId: RouteParamValue,
): AccommodationEditNavigationState => ({
  accommodationEdit: {
    accommodationId: String(accommodationId),
    source: "created-draft",
  },
});

export const isAccommodationEditDraftCreationState = (
  state: unknown,
  accommodationId?: RouteParamValue,
): boolean => {
  if (accommodationId === undefined || !isRecord(state)) {
    return false;
  }

  const editState = state.accommodationEdit;
  return (
    isRecord(editState) &&
    editState.source === "created-draft" &&
    editState.accommodationId === String(accommodationId)
  );
};

const buildPath = (template: string, params: Record<string, RouteParamValue>) =>
  template.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) =>
    encodeURIComponent(String(params[key])),
  );

const normalizeQueryString = (query: URLSearchParams | string) =>
  (typeof query === "string" ? query : query.toString()).replace(/^\?+/, "");

const withRawQuery = (path: string, query?: URLSearchParams | string) => {
  if (!query) return path;

  const queryString = normalizeQueryString(query);
  return queryString ? `${path}?${queryString}` : path;
};

export const routeTo = {
  home: () => ROUTE_PATHS.home,
  search: (query?: SearchRouteQuery) =>
    withRawQuery(ROUTE_PATHS.search, buildSearchRouteSearchParams(query)),
  accommodationDetail: (
    id: string | number,
    query?: AccommodationBookingRouteQuery,
  ) =>
    withRawQuery(
      buildPath(ROUTE_PATHS.accommodationDetail, { id }),
      buildAccommodationBookingRouteSearchParams(query),
    ),
  accommodationConfirm: (
    id: string | number,
    query?: AccommodationBookingRouteQuery,
  ) =>
    withRawQuery(
      buildPath(ROUTE_PATHS.accommodationConfirm, { id }),
      buildAccommodationBookingRouteSearchParams(query),
    ),
  accommodationEdit: (id: string | number) =>
    buildPath(ROUTE_PATHS.accommodationEdit, { id }),
  wishlist: (query?: WishlistRouteQuery) =>
    withRawQuery(
      ROUTE_PATHS.wishlist,
      buildWishlistRouteQuerySearchParams(query),
    ),
  profile: (query?: ProfileRouteQuery) =>
    withRawQuery(ROUTE_PATHS.profile, buildProfileRouteQuerySearchParams(query)),
  hostReservationDetail: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.hostReservationDetail, { reservationUid }),
  reservationDetail: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.reservationDetail, { reservationUid }),
  reviewCreate: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.reviewCreate, { reservationUid }),
  paymentSuccess: (
    reservationUid: string,
    query?: PaymentSuccessRouteQuery,
  ) =>
    withRawQuery(
      buildPath(ROUTE_PATHS.paymentSuccess, { reservationUid }),
      buildPaymentSuccessRouteSearchParams(query),
    ),
  paymentFail: (reservationUid: string, query?: PaymentFailRouteQuery) =>
    withRawQuery(
      buildPath(ROUTE_PATHS.paymentFail, { reservationUid }),
      buildPaymentFailRouteSearchParams(query),
    ),
  login: () => ROUTE_PATHS.login,
  signup: () => ROUTE_PATHS.signup,
};
