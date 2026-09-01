import type { AppShellId } from "../shells";
import { ROUTE_PATHS } from "./paths";

type RouteAuthPolicy = "public" | "authenticated";
type RouteShell = AppShellId;
export type RouteHeaderPolicy = "default" | "search" | "hidden";
interface RouteDefinitionShape {
  id: string;
  path: string;
  auth: RouteAuthPolicy;
  shell: RouteShell;
  header: RouteHeaderPolicy;
}

export const routeDefinitions = [
  {
    id: "home",
    path: ROUTE_PATHS.home,
    auth: "public",
    shell: "browse",
    header: "default",
  },
  {
    id: "search",
    path: ROUTE_PATHS.search,
    auth: "public",
    shell: "browse",
    header: "search",
  },
  {
    id: "accommodation-detail",
    path: ROUTE_PATHS.accommodationDetail,
    auth: "public",
    shell: "browse",
    header: "default",
  },
  {
    id: "accommodation-confirm",
    path: ROUTE_PATHS.accommodationConfirm,
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "accommodation-edit",
    path: ROUTE_PATHS.accommodationEdit,
    auth: "authenticated",
    shell: "editor",
    header: "default",
  },
  {
    id: "wishlist",
    path: ROUTE_PATHS.wishlist,
    auth: "authenticated",
    shell: "browse",
    header: "default",
  },
  {
    id: "profile",
    path: ROUTE_PATHS.profile,
    auth: "authenticated",
    shell: "browse",
    header: "default",
  },
  {
    id: "host-reservation-detail",
    path: ROUTE_PATHS.hostReservationDetail,
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "reservation-detail",
    path: ROUTE_PATHS.reservationDetail,
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "reservation-review",
    path: ROUTE_PATHS.reviewCreate,
    auth: "authenticated",
    shell: "form",
    header: "default",
  },
  {
    id: "payment-success",
    path: ROUTE_PATHS.paymentSuccess,
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "payment-fail",
    path: ROUTE_PATHS.paymentFail,
    auth: "authenticated",
    shell: "transaction",
    header: "default",
  },
  {
    id: "login",
    path: ROUTE_PATHS.login,
    auth: "public",
    shell: "form",
    header: "hidden",
  },
  {
    id: "signup",
    path: ROUTE_PATHS.signup,
    auth: "public",
    shell: "form",
    header: "hidden",
  },
  {
    id: "not-found",
    path: ROUTE_PATHS.notFound,
    auth: "public",
    shell: "bare",
    header: "hidden",
  },
] as const satisfies readonly RouteDefinitionShape[];

export type AppRouteId = (typeof routeDefinitions)[number]["id"];

export interface AppRouteDefinition extends Omit<RouteDefinitionShape, "id"> {
  id: AppRouteId;
}
