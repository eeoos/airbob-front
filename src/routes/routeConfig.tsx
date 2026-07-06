import React from "react";
import {
  routeDefinitions,
  type AppRouteDefinition,
} from "./routeDefinitions";

const Home = React.lazy(() =>
  import("../features/home").then((module) => ({ default: module.HomeRoute }))
);
const Search = React.lazy(() =>
  import("../features/search").then((module) => ({
    default: module.SearchRoute,
  }))
);
const AccommodationDetail = React.lazy(() =>
  import("../features/accommodations").then((module) => ({
    default: module.AccommodationDetailRoute,
  }))
);
const AccommodationEdit = React.lazy(() =>
  import("../features/accommodations/edit").then((module) => ({
    default: module.AccommodationEditRoute,
  }))
);
const Wishlist = React.lazy(() =>
  import("../features/wishlist").then((module) => ({
    default: module.WishlistRoute,
  }))
);
const Profile = React.lazy(() =>
  import("../features/profile").then((module) => ({
    default: module.ProfileRoute,
  }))
);
const ReservationDetail = React.lazy(() =>
  import("../features/reservations").then((module) => ({
    default: module.ReservationDetailRoute,
  }))
);
const HostReservationDetail = React.lazy(() =>
  import("../features/reservations").then((module) => ({
    default: module.HostReservationDetailRoute,
  }))
);
const ReservationConfirm = React.lazy(() =>
  import("../features/reservations").then((module) => ({
    default: module.ReservationConfirmRoute,
  }))
);
const ReviewCreate = React.lazy(() =>
  import("../features/reviews").then((module) => ({
    default: module.ReviewCreateRoute,
  }))
);
const PaymentSuccess = React.lazy(() =>
  import("../features/reservations").then((module) => ({
    default: module.PaymentSuccessRoute,
  }))
);
const PaymentFail = React.lazy(() =>
  import("../features/reservations").then((module) => ({
    default: module.PaymentFailRoute,
  }))
);
const Login = React.lazy(() =>
  import("../features/auth").then((module) => ({ default: module.LoginRoute }))
);
const Signup = React.lazy(() =>
  import("../features/auth").then((module) => ({ default: module.SignupRoute }))
);
const NotFound = React.lazy(() =>
  import("./NotFoundRoute").then((module) => ({
    default: module.NotFoundRoute,
  }))
);

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
