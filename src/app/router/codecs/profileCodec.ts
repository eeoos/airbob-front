import {
  appendDefinedSearchParam,
  type SearchParamsInput,
  toSearchParams,
} from "./queryCodecUtils";

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
  | { mode?: "guest"; tab?: ProfileGuestRouteTab }
  | { mode: "host"; tab?: ProfileHostRouteTab };

export type ProfileRouteState =
  | { mode: "guest"; tab: ProfileGuestRouteTab }
  | { mode: "host"; tab: ProfileHostRouteTab };

const GUEST_TABS = new Set<ProfileGuestRouteTab>([
  "trips",
  "upcoming",
  "past",
  "cancelled",
]);

const HOST_TABS = new Set<ProfileHostRouteTab>([
  "listings",
  "listings-published",
  "listings-draft",
  "listings-unpublished",
  "reservations",
  "reservations-upcoming",
  "reservations-past",
  "reservations-cancelled",
]);

export const parseProfileRouteState = (
  input: SearchParamsInput,
): ProfileRouteState => {
  const params = toSearchParams(input);
  const mode = params.get("mode");
  const tab = params.get("tab");

  if (mode === "host") {
    return {
      mode,
      tab: HOST_TABS.has(tab as ProfileHostRouteTab)
        ? (tab as ProfileHostRouteTab)
        : "listings",
    };
  }

  if (mode !== null && mode !== "guest") {
    return { mode: "guest", tab: "trips" };
  }

  return {
    mode: "guest",
    tab: GUEST_TABS.has(tab as ProfileGuestRouteTab)
      ? (tab as ProfileGuestRouteTab)
      : "trips",
  };
};

export const serializeProfileRouteQuery = (
  query?: ProfileRouteQuery | ProfileRouteState,
): URLSearchParams => {
  const params = new URLSearchParams();

  appendDefinedSearchParam(params, "mode", query?.mode);
  appendDefinedSearchParam(params, "tab", query?.tab);

  return params;
};

const canonicalizeProfileRoute = (input: SearchParamsInput): string =>
  serializeProfileRouteQuery(parseProfileRouteState(input)).toString();

export const profileCodec = {
  parse: parseProfileRouteState,
  serialize: serializeProfileRouteQuery,
  canonicalize: canonicalizeProfileRoute,
} as const;
