export type RouteId =
  | "home"
  | "search"
  | "login"
  | "signup"
  | "wishlist"
  | "profile"
  | "accommodation-detail"
  | "accommodation-confirm"
  | "accommodation-edit"
  | "reservation-detail"
  | "reservation-review"
  | "payment-success"
  | "payment-fail"
  | "host-reservation-detail";

export type RouteShell = "main" | "bare";

export type HeaderMode = "default" | "search" | "hidden";

export interface RouteShellMeta<RouteIdentifier extends string = RouteId> {
  id: RouteIdentifier;
  layout: RouteShell;
  headerMode: HeaderMode;
  requiresAuth?: boolean;
}
