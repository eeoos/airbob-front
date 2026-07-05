import type { ProfileRouteTab } from "./profileRouteState";
import type { ReservationFilterType } from "../../../types/reservation";

export type ProfileActiveTab =
  | "upcoming"
  | "past"
  | "cancelled"
  | "listings-published"
  | "listings-draft"
  | "listings-unpublished"
  | "reservations-upcoming"
  | "reservations-past"
  | "reservations-cancelled";

export type HostListingStatusType = "PUBLISHED" | "DRAFT" | "UNPUBLISHED";

export const getActiveProfileTab = (tab: ProfileRouteTab): ProfileActiveTab => {
  if (tab === "trips") return "upcoming";
  if (tab === "listings") return "listings-published";
  if (tab === "reservations") return "reservations-upcoming";
  return tab;
};

export const getGuestTripsFilterFromTab = (
  tab: ProfileRouteTab
): ReservationFilterType => {
  if (tab === "past") return "PAST";
  if (tab === "cancelled") return "CANCELLED";
  return "UPCOMING";
};

export const getProfileTabForGuestTripsFilter = (
  filter: ReservationFilterType
): ProfileRouteTab => {
  if (filter === "PAST") return "past";
  if (filter === "CANCELLED") return "cancelled";
  return "upcoming";
};

export const isHostListingTab = (tab: ProfileRouteTab) =>
  tab === "listings" ||
  tab === "listings-published" ||
  tab === "listings-draft" ||
  tab === "listings-unpublished";

export const getHostListingStatusFromTab = (
  tab: ProfileRouteTab
): HostListingStatusType => {
  if (tab === "listings-draft") return "DRAFT";
  if (tab === "listings-unpublished") return "UNPUBLISHED";
  return "PUBLISHED";
};

export const getProfileTabForHostListingStatus = (
  status: HostListingStatusType
): ProfileRouteTab => {
  if (status === "DRAFT") return "listings-draft";
  if (status === "UNPUBLISHED") return "listings-unpublished";
  return "listings-published";
};

export const isHostReservationTab = (tab: ProfileRouteTab) =>
  tab === "reservations" ||
  tab === "reservations-upcoming" ||
  tab === "reservations-past" ||
  tab === "reservations-cancelled";

export const getHostReservationsFilterFromTab = (
  tab: ProfileRouteTab
): ReservationFilterType => {
  if (tab === "reservations-past") return "PAST";
  if (tab === "reservations-cancelled") return "CANCELLED";
  return "UPCOMING";
};

export const getProfileTabForHostReservationsFilter = (
  filter: ReservationFilterType
): ProfileRouteTab => {
  if (filter === "PAST") return "reservations-past";
  if (filter === "CANCELLED") return "reservations-cancelled";
  return "reservations-upcoming";
};
