export type ProfileRouteMode = "guest" | "host";

export type ProfileRouteTab =
  | "trips"
  | "upcoming"
  | "past"
  | "cancelled"
  | "listings"
  | "listings-published"
  | "listings-draft"
  | "listings-unpublished"
  | "reservations"
  | "reservations-upcoming"
  | "reservations-past"
  | "reservations-cancelled";

export interface ProfileRouteState {
  mode: ProfileRouteMode;
  tab: ProfileRouteTab;
}

const GUEST_TABS = new Set<ProfileRouteTab>([
  "trips",
  "upcoming",
  "past",
  "cancelled",
]);

const HOST_TABS = new Set<ProfileRouteTab>([
  "listings",
  "listings-published",
  "listings-draft",
  "listings-unpublished",
  "reservations",
  "reservations-upcoming",
  "reservations-past",
  "reservations-cancelled",
]);

const isProfileRouteTab = (value: string | null): value is ProfileRouteTab =>
  value !== null && (GUEST_TABS.has(value as ProfileRouteTab) || HOST_TABS.has(value as ProfileRouteTab));

export const parseProfileRouteState = (
  params: URLSearchParams
): ProfileRouteState => {
  const modeParam = params.get("mode");

  if (modeParam === "host") {
    const tabParam = params.get("tab");
    return {
      mode: "host",
      tab: isProfileRouteTab(tabParam) && HOST_TABS.has(tabParam) ? tabParam : "listings",
    };
  }

  if (modeParam !== null && modeParam !== "guest") {
    return { mode: "guest", tab: "trips" };
  }

  const tabParam = params.get("tab");
  return {
    mode: "guest",
    tab: isProfileRouteTab(tabParam) && GUEST_TABS.has(tabParam) ? tabParam : "trips",
  };
};

export const buildProfileRouteSearchParams = (
  state: ProfileRouteState
): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("mode", state.mode);
  params.set("tab", state.tab);
  return params;
};
