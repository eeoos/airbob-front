import React from "react";
import {
  routeDefinitions,
  type AppRouteDefinition,
} from "./routeDefinitions";

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

const routeComponents = {
  home: Home,
  search: Search,
  "accommodation-detail": AccommodationDetail,
  "accommodation-confirm": ReservationConfirm,
  "accommodation-edit": AccommodationEdit,
  wishlist: Wishlist,
  profile: Profile,
  "host-reservation-detail": HostReservationDetail,
  "reservation-detail": ReservationDetail,
  "reservation-review": ReviewCreate,
  "payment-success": PaymentSuccess,
  "payment-fail": PaymentFail,
  login: Login,
  signup: Signup,
  "not-found": NotFound,
} satisfies Record<
  AppRouteDefinition["id"],
  React.LazyExoticComponent<React.ComponentType>
>;

export interface AppRouteConfig extends AppRouteDefinition {
  component: React.LazyExoticComponent<React.ComponentType>;
}

export const appRoutes: AppRouteConfig[] = routeDefinitions.map((route) => ({
  ...route,
  component: routeComponents[route.id],
}));
