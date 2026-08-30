import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { AppRouteId } from "./definitions";

const HomeRoute = lazy(() => import("./routes/HomeRoute"));
const SearchRoute = lazy(() => import("./routes/SearchRoute"));
const AccommodationDetailRoute = lazy(
  () => import("./routes/AccommodationDetailRoute"),
);
const AccommodationConfirmRoute = lazy(
  () => import("./routes/AccommodationConfirmRoute"),
);
const AccommodationEditRoute = lazy(
  () => import("./routes/AccommodationEditRoute"),
);
const WishlistRoute = lazy(() => import("./routes/WishlistRoute"));
const ProfileRoute = lazy(() => import("./routes/ProfileRoute"));
const HostReservationDetailRoute = lazy(
  () => import("./routes/HostReservationDetailRoute"),
);
const ReservationDetailRoute = lazy(
  () => import("./routes/ReservationDetailRoute"),
);
const ReviewCreateRoute = lazy(
  () => import("./routes/ReviewCreateRoute"),
);
const PaymentSuccessRoute = lazy(
  () => import("./routes/PaymentSuccessRoute"),
);
const PaymentFailRoute = lazy(() => import("./routes/PaymentFailRoute"));
const LoginRoute = lazy(() => import("./routes/LoginRoute"));
const SignupRoute = lazy(() => import("./routes/SignupRoute"));
const NotFoundRoute = lazy(() => import("./routes/NotFoundRoute"));

export const lazyRoutes = {
  home: HomeRoute,
  search: SearchRoute,
  "accommodation-detail": AccommodationDetailRoute,
  "accommodation-confirm": AccommodationConfirmRoute,
  "accommodation-edit": AccommodationEditRoute,
  wishlist: WishlistRoute,
  profile: ProfileRoute,
  "host-reservation-detail": HostReservationDetailRoute,
  "reservation-detail": ReservationDetailRoute,
  "reservation-review": ReviewCreateRoute,
  "payment-success": PaymentSuccessRoute,
  "payment-fail": PaymentFailRoute,
  login: LoginRoute,
  signup: SignupRoute,
  "not-found": NotFoundRoute,
} satisfies Record<
  AppRouteId,
  LazyExoticComponent<ComponentType<Record<string, never>>>
>;
