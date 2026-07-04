export type WishlistRouteView = "index" | "recently-viewed" | "wishlist-detail";

export type ProfileRouteMode = "guest" | "host";

export type ProfileGuestRouteTab =
  | "trips"
  | "upcoming"
  | "past"
  | "cancelled";

export type ProfileHostRouteTab =
  | "listings"
  | "listings-published"
  | "listings-draft"
  | "listings-unpublished"
  | "reservations"
  | "reservations-upcoming"
  | "reservations-past"
  | "reservations-cancelled";

export type ProfileRouteTab =
  | ProfileGuestRouteTab
  | ProfileHostRouteTab;

export type PaymentFailReason = "confirm-failed" | "invalid-callback";

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
type WishlistRouteQuery =
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
type ProfileRouteQuery =
  | {
      mode?: "guest";
      tab?: ProfileGuestRouteTab;
    }
  | {
      mode: "host";
      tab?: ProfileHostRouteTab;
    };
type PaymentFailRouteQuery = {
  reason?: PaymentFailReason;
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

const withQuery = (
  path: string,
  entries: Record<string, string | number | undefined>,
) => {
  const params = new URLSearchParams();

  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return withRawQuery(path, query);
};

export const routeTo = {
  home: () => ROUTE_PATHS.home,
  search: (query?: SearchRouteQuery) =>
    withQuery(ROUTE_PATHS.search, {
      destination: query?.destination,
      page: query?.page,
      lat: query?.lat,
      lng: query?.lng,
      topLeftLat: query?.topLeftLat,
      topLeftLng: query?.topLeftLng,
      bottomRightLat: query?.bottomRightLat,
      bottomRightLng: query?.bottomRightLng,
      checkIn: query?.checkIn,
      checkOut: query?.checkOut,
      adultOccupancy: query?.adultOccupancy,
      childOccupancy: query?.childOccupancy,
      infantOccupancy: query?.infantOccupancy,
      petOccupancy: query?.petOccupancy,
    }),
  accommodationDetail: (
    id: string | number,
    query?: AccommodationBookingRouteQuery,
  ) =>
    withQuery(buildPath(ROUTE_PATHS.accommodationDetail, { id }), {
      checkIn: query?.checkIn,
      checkOut: query?.checkOut,
      adultOccupancy: query?.adultOccupancy,
      childOccupancy: query?.childOccupancy,
      infantOccupancy: query?.infantOccupancy,
      petOccupancy: query?.petOccupancy,
    }),
  accommodationConfirm: (
    id: string | number,
    query?: AccommodationBookingRouteQuery,
  ) =>
    withQuery(buildPath(ROUTE_PATHS.accommodationConfirm, { id }), {
      checkIn: query?.checkIn,
      checkOut: query?.checkOut,
      adultOccupancy: query?.adultOccupancy,
      childOccupancy: query?.childOccupancy,
      infantOccupancy: query?.infantOccupancy,
      petOccupancy: query?.petOccupancy,
    }),
  accommodationEdit: (id: string | number, query?: { mode?: "create" }) =>
    withQuery(buildPath(ROUTE_PATHS.accommodationEdit, { id }), {
      mode: query?.mode,
    }),
  wishlist: (query?: WishlistRouteQuery) =>
    withQuery(ROUTE_PATHS.wishlist, {
      id: query?.id,
      view: query?.view,
    }),
  profile: (query?: ProfileRouteQuery) =>
    withQuery(ROUTE_PATHS.profile, {
      mode: query?.mode,
      tab: query?.tab,
    }),
  hostReservationDetail: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.hostReservationDetail, { reservationUid }),
  reservationDetail: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.reservationDetail, { reservationUid }),
  reviewCreate: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.reviewCreate, { reservationUid }),
  paymentSuccess: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.paymentSuccess, { reservationUid }),
  paymentFail: (reservationUid: string, query?: PaymentFailRouteQuery) =>
    withQuery(buildPath(ROUTE_PATHS.paymentFail, { reservationUid }), {
      reason: query?.reason,
    }),
  login: () => ROUTE_PATHS.login,
  signup: () => ROUTE_PATHS.signup,
};
