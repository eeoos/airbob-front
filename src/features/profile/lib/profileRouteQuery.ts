import { appendDefinedSearchParam } from "../../../routes/routeQuery";

export type ProfileRouteMode = "guest" | "host";

export type ProfileGuestRouteTab =
  | "trips"
  | "upcoming"
  | "past"
  | "cancelled";

export type ProfileHostRouteTab =
  | "listings"
  | "listings-published"
  | "listings-draft"
  | "listings-unpublished"
  | "reservations"
  | "reservations-upcoming"
  | "reservations-past"
  | "reservations-cancelled";

export type ProfileRouteTab = ProfileGuestRouteTab | ProfileHostRouteTab;

export type ProfileRouteQuery =
  | {
      mode?: "guest";
      tab?: ProfileGuestRouteTab;
    }
  | {
      mode: "host";
      tab?: ProfileHostRouteTab;
    };

export const buildProfileRouteQuerySearchParams = (
  query?: ProfileRouteQuery,
) => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "mode", query?.mode);
  appendDefinedSearchParam(params, "tab", query?.tab);

  return params;
};
