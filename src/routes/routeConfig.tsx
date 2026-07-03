import React from "react";
import Home from "../pages/Home/Home";
import Search from "../pages/Search/Search";
import AccommodationDetail from "../pages/AccommodationDetail/AccommodationDetail";
import AccommodationEdit from "../pages/AccommodationEdit/AccommodationEdit";
import Wishlist from "../pages/Wishlist/Wishlist";
import Profile from "../pages/Profile/Profile";
import ReservationDetail from "../pages/Reservations/ReservationDetail";
import HostReservationDetail from "../pages/Profile/HostReservationDetail/HostReservationDetail";
import ReservationConfirm from "../pages/Reservations/ReservationConfirm";
import ReviewCreate from "../pages/Reservations/ReviewCreate";
import PaymentSuccess from "../pages/Reservations/PaymentSuccess";
import PaymentFail from "../pages/Reservations/PaymentFail";
import Login from "../pages/Auth/Login/Login";
import Signup from "../pages/Auth/Signup/Signup";
import NotFound from "../pages/NotFound/NotFound";
import { ROUTE_PATHS } from "./paths";

export type AppRouteLayout = "main" | "bare";

export interface AppRouteConfig {
  path: string;
  component: React.ComponentType;
  requiresAuth: boolean;
  layout: AppRouteLayout;
}

export const appRoutes: AppRouteConfig[] = [
  { path: ROUTE_PATHS.home, component: Home, requiresAuth: false, layout: "main" },
  { path: ROUTE_PATHS.search, component: Search, requiresAuth: false, layout: "main" },
  {
    path: ROUTE_PATHS.accommodationDetail,
    component: AccommodationDetail,
    requiresAuth: false,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.accommodationConfirm,
    component: ReservationConfirm,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.accommodationEdit,
    component: AccommodationEdit,
    requiresAuth: true,
    layout: "main",
  },
  { path: ROUTE_PATHS.wishlist, component: Wishlist, requiresAuth: true, layout: "main" },
  { path: ROUTE_PATHS.profile, component: Profile, requiresAuth: true, layout: "main" },
  {
    path: ROUTE_PATHS.hostReservationDetail,
    component: HostReservationDetail,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.reservationDetail,
    component: ReservationDetail,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.reviewCreate,
    component: ReviewCreate,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.paymentSuccess,
    component: PaymentSuccess,
    requiresAuth: true,
    layout: "main",
  },
  {
    path: ROUTE_PATHS.paymentFail,
    component: PaymentFail,
    requiresAuth: true,
    layout: "main",
  },
  { path: ROUTE_PATHS.login, component: Login, requiresAuth: false, layout: "bare" },
  { path: ROUTE_PATHS.signup, component: Signup, requiresAuth: false, layout: "bare" },
  { path: ROUTE_PATHS.notFound, component: NotFound, requiresAuth: false, layout: "bare" },
];
