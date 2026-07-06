import { ROUTE_PATHS } from "./paths";
import type { RouteId, RouteShellMeta } from "./routeShell";

export type AppRouteId = RouteId | "not-found";

export interface AppRouteDefinition
  extends Omit<RouteShellMeta<AppRouteId>, "requiresAuth"> {
  path: string;
  requiresAuth: boolean;
}

export const routeDefinitions: AppRouteDefinition[] = [
  {
    id: "home",
    path: ROUTE_PATHS.home,
    requiresAuth: false,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "search",
    path: ROUTE_PATHS.search,
    requiresAuth: false,
    layout: "main",
    headerMode: "search",
  },
  {
    id: "accommodation-detail",
    path: ROUTE_PATHS.accommodationDetail,
    requiresAuth: false,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "accommodation-confirm",
    path: ROUTE_PATHS.accommodationConfirm,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "accommodation-edit",
    path: ROUTE_PATHS.accommodationEdit,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "wishlist",
    path: ROUTE_PATHS.wishlist,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "profile",
    path: ROUTE_PATHS.profile,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "host-reservation-detail",
    path: ROUTE_PATHS.hostReservationDetail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "reservation-detail",
    path: ROUTE_PATHS.reservationDetail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "reservation-review",
    path: ROUTE_PATHS.reviewCreate,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "payment-success",
    path: ROUTE_PATHS.paymentSuccess,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "payment-fail",
    path: ROUTE_PATHS.paymentFail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "login",
    path: ROUTE_PATHS.login,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
  {
    id: "signup",
    path: ROUTE_PATHS.signup,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
  {
    id: "not-found",
    path: ROUTE_PATHS.notFound,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
];
