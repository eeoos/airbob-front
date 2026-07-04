import React, { useEffect, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { GuestTripsPanel, HostReservationsPanel } from "../reservations";
import { HostListingsPanel } from "./HostListingsPanel";
import { ProfileShell } from "./components/ProfileShell";
import {
  buildProfileRouteSearchParams,
  parseProfileRouteState,
} from "./lib/profileRouteState";
import type {
  ProfileRouteMode,
  ProfileRouteState,
} from "./lib/profileRouteState";
import {
  getActiveProfileTab,
  getGuestTripsFilterFromTab,
  getHostListingStatusFromTab,
  getHostReservationsFilterFromTab,
  getProfileTabForHostListingStatus,
  getProfileTabForHostReservationsFilter,
  isHostListingTab,
} from "./lib/profileTabs";

interface ProfileRouteProps {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

export const ProfileRoute: React.FC<ProfileRouteProps> = ({
  searchParams,
  setSearchParams,
}) => {
  const initialRouteState = parseProfileRouteState(searchParams);
  const [routeState, setRouteState] =
    useState<ProfileRouteState>(initialRouteState);

  useEffect(() => {
    setRouteState(parseProfileRouteState(searchParams));
  }, [searchParams]);

  const setProfileRouteState = (state: ProfileRouteState) => {
    setRouteState(state);
    setSearchParams(buildProfileRouteSearchParams(state), { replace: true });
  };

  const activeTab = getActiveProfileTab(routeState.tab);

  const setMode = (mode: ProfileRouteMode) => {
    setProfileRouteState({
      mode,
      tab: mode === "host" ? "listings" : "upcoming",
    });
  };

  return (
    <ProfileShell
      mode={routeState.mode}
      activeTab={activeTab}
      onModeChange={setMode}
      onGuestTabChange={(tab) => setProfileRouteState({ mode: "guest", tab })}
      onHostListingsClick={() =>
        setProfileRouteState({ mode: "host", tab: "listings-published" })
      }
      onHostReservationsClick={() =>
        setProfileRouteState({ mode: "host", tab: "reservations-upcoming" })
      }
    >
      {routeState.mode === "guest" ? (
        <GuestTripsPanel
          filterType={getGuestTripsFilterFromTab(routeState.tab)}
        />
      ) : isHostListingTab(routeState.tab) ? (
        <HostListingsPanel
          statusType={getHostListingStatusFromTab(routeState.tab)}
          onStatusChange={(status) =>
            setProfileRouteState({
              mode: "host",
              tab: getProfileTabForHostListingStatus(status),
            })
          }
        />
      ) : (
        <HostReservationsPanel
          filterType={getHostReservationsFilterFromTab(routeState.tab)}
          onFilterChange={(filter) =>
            setProfileRouteState({
              mode: "host",
              tab: getProfileTabForHostReservationsFilter(filter),
            })
          }
        />
      )}
    </ProfileShell>
  );
};
