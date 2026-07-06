import React from "react";
import { ROUTE_PATHS } from "./paths";
import type { RouteId, RouteShellMeta } from "./routeShell";

const Home = React.lazy(() => import("../pages/Home/Home"));
const Search = React.lazy(() => import("../pages/Search/Search"));
const AccommodationDetail = React.lazy(
  () => import("../pages/AccommodationDetail/AccommodationDetail")
);
const AccommodationEdit = React.lazy(
  () => import("../pages/AccommodationEdit/AccommodationEdit")
);
const Wishlist = React.lazy(() => import("../pages/Wishlist/Wishlist"));
const Profile = React.lazy(() => import("../pages/Profile/Profile"));
const ReservationDetail = React.lazy(
  () => import("../pages/Reservations/ReservationDetail")
);
const HostReservationDetail = React.lazy(
  () => import("../pages/Profile/HostReservationDetail/HostReservationDetail")
);
const ReservationConfirm = React.lazy(
  () => import("../pages/Reservations/ReservationConfirm")
);
const ReviewCreate = React.lazy(
  () => import("../pages/Reservations/ReviewCreate")
);
const PaymentSuccess = React.lazy(
  () => import("../pages/Reservations/PaymentSuccess")
);
const PaymentFail = React.lazy(() => import("../pages/Reservations/PaymentFail"));
const Login = React.lazy(() => import("../pages/Auth/Login/Login"));
const Signup = React.lazy(() => import("../pages/Auth/Signup/Signup"));
const NotFound = React.lazy(() => import("../pages/NotFound/NotFound"));

type AppRouteId = RouteId | "not-found";

export interface AppRouteConfig extends Omit<RouteShellMeta, "id" | "requiresAuth"> {
  id: AppRouteId;
  path: string;
  component: React.LazyExoticComponent<React.ComponentType>;
  requiresAuth: boolean;
}

export const appRoutes: AppRouteConfig[] = [
  {
    id: "home",
    path: ROUTE_PATHS.home,
    component: Home,
    requiresAuth: false,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "search",
    path: ROUTE_PATHS.search,
    component: Search,
    requiresAuth: false,
    layout: "main",
    headerMode: "search",
  },
  {
    id: "accommodation-detail",
    path: ROUTE_PATHS.accommodationDetail,
    component: AccommodationDetail,
    requiresAuth: false,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "accommodation-confirm",
    path: ROUTE_PATHS.accommodationConfirm,
    component: ReservationConfirm,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "accommodation-edit",
    path: ROUTE_PATHS.accommodationEdit,
    component: AccommodationEdit,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "wishlist",
    path: ROUTE_PATHS.wishlist,
    component: Wishlist,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "profile",
    path: ROUTE_PATHS.profile,
    component: Profile,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "host-reservation-detail",
    path: ROUTE_PATHS.hostReservationDetail,
    component: HostReservationDetail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "reservation-detail",
    path: ROUTE_PATHS.reservationDetail,
    component: ReservationDetail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "reservation-review",
    path: ROUTE_PATHS.reviewCreate,
    component: ReviewCreate,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "payment-success",
    path: ROUTE_PATHS.paymentSuccess,
    component: PaymentSuccess,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "payment-fail",
    path: ROUTE_PATHS.paymentFail,
    component: PaymentFail,
    requiresAuth: true,
    layout: "main",
    headerMode: "default",
  },
  {
    id: "login",
    path: ROUTE_PATHS.login,
    component: Login,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
  {
    id: "signup",
    path: ROUTE_PATHS.signup,
    component: Signup,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
  {
    id: "not-found",
    path: ROUTE_PATHS.notFound,
    component: NotFound,
    requiresAuth: false,
    layout: "bare",
    headerMode: "hidden",
  },
];
