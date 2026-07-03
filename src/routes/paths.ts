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

type ProfileMode = "guest" | "host";
type RouteParamValue = string | number;

const buildPath = (template: string, params: Record<string, RouteParamValue>) =>
  template.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) =>
    encodeURIComponent(String(params[key]))
  );

const normalizeQueryString = (query: URLSearchParams | string) =>
  (typeof query === "string" ? query : query.toString()).replace(/^\?+/, "");

const withRawQuery = (path: string, query?: URLSearchParams | string) => {
  if (!query) return path;

  const queryString = normalizeQueryString(query);
  return queryString ? `${path}?${queryString}` : path;
};

const withQuery = (path: string, entries: Record<string, string | number | undefined>) => {
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
  search: (query?: URLSearchParams | string) => withRawQuery(ROUTE_PATHS.search, query),
  accommodationDetail: (id: string | number) =>
    buildPath(ROUTE_PATHS.accommodationDetail, { id }),
  accommodationConfirm: (id: string | number, query?: URLSearchParams | string) =>
    withRawQuery(buildPath(ROUTE_PATHS.accommodationConfirm, { id }), query),
  accommodationEdit: (id: string | number, query?: { mode?: "create" }) =>
    withQuery(buildPath(ROUTE_PATHS.accommodationEdit, { id }), { mode: query?.mode }),
  wishlist: (query?: { id?: string | number; view?: string }) =>
    withQuery(ROUTE_PATHS.wishlist, {
      id: query?.id,
      view: query?.view,
    }),
  profile: (query?: { mode?: ProfileMode; tab?: string }) =>
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
  paymentFail: (reservationUid: string) =>
    buildPath(ROUTE_PATHS.paymentFail, { reservationUid }),
  login: () => ROUTE_PATHS.login,
  signup: () => ROUTE_PATHS.signup,
};
