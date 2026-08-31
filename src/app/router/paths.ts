import {
  serializeAccommodationBookingRouteQuery,
  serializeSearchRouteQuery,
  type AccommodationBookingRouteQuery,
  type SearchRouteQuery,
} from "./codecs/searchCodec";
import {
  serializeProfileRouteQuery,
  type ProfileRouteQuery,
} from "./codecs/profileCodec";
import {
  serializeWishlistRouteQuery,
  type WishlistRouteQuery,
} from "./codecs/wishlistCodec";
import {
  serializePaymentFailRouteQuery,
  serializePaymentSuccessRouteQuery,
  type PaymentFailRouteQuery,
  type PaymentSuccessRouteQuery,
} from "./codecs/paymentCodec";

export type {
  AccommodationBookingRouteQuery,
  SearchRouteQuery,
} from "./codecs/searchCodec";
export type {
  ProfileGuestRouteTab,
  ProfileHostRouteTab,
  ProfileRouteMode,
  ProfileRouteQuery,
  ProfileRouteTab,
} from "./codecs/profileCodec";
export type {
  WishlistRouteQuery,
  WishlistRouteView,
} from "./codecs/wishlistCodec";
export {
  parsePaymentFailReason,
  type PaymentFailReason,
  type PaymentFailRouteQuery,
  type PaymentSuccessRouteQuery,
} from "./codecs/paymentCodec";

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

const buildPath = (
  template: string,
  params: Record<string, RouteParamValue>,
): string =>
  template.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) =>
    encodeURIComponent(String(params[key])),
  );

const withQuery = (path: string, query: URLSearchParams): string => {
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export const routeTo = {
  home: () => ROUTE_PATHS.home,
  search: (query?: SearchRouteQuery) =>
    withQuery(ROUTE_PATHS.search, serializeSearchRouteQuery(query)),
  accommodationDetail: (
    id: RouteParamValue,
    query?: AccommodationBookingRouteQuery,
  ) =>
    withQuery(
      buildPath(ROUTE_PATHS.accommodationDetail, { id }),
      serializeAccommodationBookingRouteQuery(query),
    ),
  accommodationConfirm: (
    id: RouteParamValue,
    query?: AccommodationBookingRouteQuery,
  ) =>
    withQuery(
      buildPath(ROUTE_PATHS.accommodationConfirm, { id }),
      serializeAccommodationBookingRouteQuery(query),
    ),
  accommodationEdit: (id: RouteParamValue) =>
    buildPath(ROUTE_PATHS.accommodationEdit, { id }),
  wishlist: (query?: WishlistRouteQuery) =>
    withQuery(ROUTE_PATHS.wishlist, serializeWishlistRouteQuery(query)),
  profile: (query?: ProfileRouteQuery) =>
    withQuery(ROUTE_PATHS.profile, serializeProfileRouteQuery(query)),
  hostReservationDetail: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.hostReservationDetail, { reservationUid }),
  reservationDetail: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.reservationDetail, { reservationUid }),
  reviewCreate: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.reviewCreate, { reservationUid }),
  paymentSuccess: (reservationUid: string, query?: PaymentSuccessRouteQuery) =>
    withQuery(
      buildPath(ROUTE_PATHS.paymentSuccess, { reservationUid }),
      serializePaymentSuccessRouteQuery(query),
    ),
  paymentFail: (reservationUid: string, query?: PaymentFailRouteQuery) =>
    withQuery(
      buildPath(ROUTE_PATHS.paymentFail, { reservationUid }),
      serializePaymentFailRouteQuery(query),
    ),
  login: () => ROUTE_PATHS.login,
  signup: () => ROUTE_PATHS.signup,
} as const;
