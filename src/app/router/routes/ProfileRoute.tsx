import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createAccommodationDetailQueryCacheProjection } from "../../../features/accommodations/detail/public";
import { hostListingActionsApi } from "../../../features/accommodations/public";
import { createHostListingQueryCacheProjection } from "../../../features/profile/public";
import { resolveImageUrl } from "../../../platform/assets/imageUrl";
import { browserConfirmation } from "../../../platform/browser/confirmation";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import { useStrictModeSafeDisposable } from "../../../shared/lib/useStrictModeSafeDisposable";
import {
  ProfileController,
  type ProfileHrefPort,
  type ProfileNavigationCommands,
  type ProfileRouteView,
} from "../../../screens/profile/public";
import {
  createHostListingManagementWorkflow,
  type HostListingManagementPublicationPort,
} from "../../../workflows/host-listing-management";
import { useSession } from "../../session/useSession";
import { profileCodec, type ProfileRouteState } from "../codecs/profileCodec";
import { routeTo } from "../paths";

const toProfileRouteView = (
  routeState: ProfileRouteState,
): ProfileRouteView => {
  if (routeState.mode === "guest") {
    switch (routeState.tab) {
      case "past":
        return { variant: "guest", activeTab: "past", filterType: "PAST" };
      case "cancelled":
        return {
          variant: "guest",
          activeTab: "cancelled",
          filterType: "CANCELLED",
        };
      case "trips":
      case "upcoming":
        return {
          variant: "guest",
          activeTab: "upcoming",
          filterType: "UPCOMING",
        };
    }
  }

  switch (routeState.tab) {
    case "listings-draft":
      return { variant: "host-listings", statusType: "DRAFT" };
    case "listings-unpublished":
      return { variant: "host-listings", statusType: "UNPUBLISHED" };
    case "reservations-past":
      return { variant: "host-reservations", filterType: "PAST" };
    case "reservations-cancelled":
      return { variant: "host-reservations", filterType: "CANCELLED" };
    case "reservations":
    case "reservations-upcoming":
      return { variant: "host-reservations", filterType: "UPCOMING" };
    case "listings":
    case "listings-published":
      return { variant: "host-listings", statusType: "PUBLISHED" };
  }
};

const listingStatusTabs = {
  DRAFT: "listings-draft",
  PUBLISHED: "listings-published",
  UNPUBLISHED: "listings-unpublished",
} as const;

const reservationFilterTabs = {
  CANCELLED: "reservations-cancelled",
  PAST: "reservations-past",
  UPCOMING: "reservations-upcoming",
} as const;

const profileHrefs = {
  guestReservation: routeTo.reservationDetail,
} satisfies ProfileHrefPort;

function ProfileRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useSession();
  const searchKey = searchParams.toString();
  const routeState = useMemo(() => profileCodec.parse(searchKey), [searchKey]);
  const routeView = useMemo(() => toProfileRouteView(routeState), [routeState]);
  const captureAuthenticatedSession = session.captureAuthenticatedSession;
  const isCurrentSession = session.isCurrentSession;
  const scope = captureAuthenticatedSession();
  const workflowSubject = scope?.subject ?? null;
  const workflowEpoch = scope?.epoch ?? null;
  const workflowSession = useMemo(
    () => ({
      captureAuthenticatedSession: () => {
        const candidate = captureAuthenticatedSession();

        return candidate !== null &&
          candidate.subject === workflowSubject &&
          candidate.epoch === workflowEpoch
          ? candidate
          : null;
      },
      isCurrentSession: (candidate: NonNullable<typeof scope>) =>
        candidate.subject === workflowSubject &&
        candidate.epoch === workflowEpoch &&
        isCurrentSession(candidate),
    }),
    [
      captureAuthenticatedSession,
      isCurrentSession,
      workflowEpoch,
      workflowSubject,
    ],
  );

  const replaceRouteState = useCallback(
    (nextState: ProfileRouteState) => {
      setSearchParams(profileCodec.serialize(nextState), { replace: true });
    },
    [setSearchParams],
  );

  const navigation = useMemo<ProfileNavigationCommands>(
    () => ({
      changeGuestTab: (tab) => replaceRouteState({ mode: "guest", tab }),
      changeHostListingStatus: (status) =>
        replaceRouteState({ mode: "host", tab: listingStatusTabs[status] }),
      changeHostReservationFilter: (filter) =>
        replaceRouteState({
          mode: "host",
          tab: reservationFilterTabs[filter],
        }),
      changeHostSection: (section) =>
        replaceRouteState({
          mode: "host",
          tab:
            section === "listings"
              ? "listings-published"
              : "reservations-upcoming",
        }),
      changeMode: (mode) =>
        replaceRouteState(
          mode === "host"
            ? { mode: "host", tab: "listings" }
            : { mode: "guest", tab: "upcoming" },
        ),
      editAccommodation: (accommodationId) =>
        navigate(routeTo.accommodationEdit(accommodationId)),
      openAccommodation: (accommodationId) =>
        navigate(routeTo.accommodationDetail(accommodationId)),
      openGuestReservation: (reservationUid) =>
        navigate(routeTo.reservationDetail(reservationUid)),
      openHostReservation: (reservationUid) =>
        navigate(routeTo.hostReservationDetail(reservationUid)),
    }),
    [navigate, replaceRouteState],
  );

  const routeLease = useMemo(
    () => ({
      isCurrent: () =>
        browserWindowNavigation.isCurrentHistoryEntry({
          hash: location.hash,
          key: location.key,
          pathname: location.pathname,
          search: location.search,
        }),
    }),
    [location.hash, location.key, location.pathname, location.search],
  );
  const publication = useMemo<HostListingManagementPublicationPort>(() => {
    const accommodationDetails =
      createAccommodationDetailQueryCacheProjection(queryClient);
    const hostListings = createHostListingQueryCacheProjection(queryClient);

    return {
      async publishHostListingChanged({
        accommodationId,
        scope: commandScope,
      }) {
        await Promise.all([
          hostListings.refreshRequired({
            scope: commandScope,
          }),
          accommodationDetails.detailRefreshRequired({
            accommodationId,
            scope: commandScope,
          }),
        ]);
      },
    };
  }, [queryClient]);
  const hostListingWorkflow = useMemo(
    () =>
      createHostListingManagementWorkflow({
        api: hostListingActionsApi,
        publication,
        routeLease,
        session: workflowSession,
      }),
    [publication, routeLease, workflowSession],
  );
  useStrictModeSafeDisposable(hostListingWorkflow);

  if (scope === null || !isCurrentSession(scope)) return null;

  return (
    <ProfileController
      key={`profile:${scope.subject}:${scope.epoch}`}
      confirmDelete={browserConfirmation.confirm}
      hrefs={profileHrefs}
      hostListingWorkflow={hostListingWorkflow}
      navigation={navigation}
      resolveImageUrl={resolveImageUrl}
      routeView={routeView}
      scope={scope}
    />
  );
}

export default ProfileRoute;
