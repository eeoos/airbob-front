import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { HostListingsApiPort } from "../../features/profile/ports/hostListingsApiPort";
import {
  createHostListingInfiniteQueryOptions,
  type HostListingInfiniteQueryOptions,
} from "../../features/profile/queries/hostListingQueries";
import { toHostListingViewModels } from "../../features/profile/lib/hostListingViewModel";
import type { HostListingFilterStatus } from "../../features/profile/model/hostListing";
import type { ReservationReadApiPort } from "../../features/reservations/ports/reservationReadApiPort";
import { useReservationListReadQuery } from "../../features/reservations/queries/reservationReadQueries";
import type { ReservationFilterType } from "../../features/reservations/model/reservationRead";
import { groupGuestTripsByYear } from "../../features/reservations/lib/guestTripGroups";
import {
  toGuestTripCardViewModel,
  toHostReservationRowViewModel,
} from "../../features/reservations/lib/reservationListViewModel";
import {
  sortHostReservationsByCheckIn,
  type HostReservationCheckInSortDirection,
} from "../../features/reservations/lib/hostReservationSort";
import { useIntersectionLoadMore } from "../../shared/lib/useIntersectionLoadMore";
import type {
  HostListingManagementCommandPort,
  HostListingManagementCommand,
} from "../../workflows/host-listing-management";
import type {
  GuestProfileTab,
  HostProfileSection,
  ProfileMode,
} from "../../features/profile/components/ProfileShell";
import { ProfileScreen } from "./ProfileScreen";
import {
  HOST_LISTING_PUBLICATION_ERROR_MESSAGE,
  toHostListingActionErrorMessage,
  toProfileReadErrorMessage,
} from "./profileErrorMessage";

export type ProfileRouteView =
  | {
      readonly variant: "guest";
      readonly activeTab: GuestProfileTab;
      readonly filterType: ReservationFilterType;
    }
  | {
      readonly variant: "host-listings";
      readonly statusType: HostListingFilterStatus;
    }
  | {
      readonly variant: "host-reservations";
      readonly filterType: ReservationFilterType;
    };

type ProfileSessionScope = HostListingInfiniteQueryOptions["scope"];

export interface ProfileNavigationCommands {
  readonly changeGuestTab: (tab: GuestProfileTab) => void;
  readonly changeHostListingStatus: (status: HostListingFilterStatus) => void;
  readonly changeHostReservationFilter: (
    filter: ReservationFilterType,
  ) => void;
  readonly changeHostSection: (section: HostProfileSection) => void;
  readonly changeMode: (mode: ProfileMode) => void;
  readonly editAccommodation: (accommodationId: number) => void;
  readonly openAccommodation: (accommodationId: number) => void;
  readonly openGuestReservation: (reservationUid: string) => void;
  readonly openHostReservation: (reservationUid: string) => void;
}

export interface ProfileHrefPort {
  readonly guestReservation: (reservationUid: string) => string;
}

export interface ProfileControllerProps {
  readonly confirmDelete: (message: string) => boolean;
  readonly hrefs: ProfileHrefPort;
  readonly hostListingsApi?: HostListingsApiPort;
  readonly hostListingWorkflow: HostListingManagementCommandPort;
  readonly navigation: ProfileNavigationCommands;
  readonly reservationApi?: ReservationReadApiPort;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly routeView: ProfileRouteView;
  readonly scope: ProfileSessionScope;
}

const flattenPages = <TPage, TItem>(
  pages: readonly TPage[] | undefined,
  select: (page: TPage) => readonly TItem[],
): TItem[] => pages?.flatMap(select) ?? [];

interface ProfileReadErrorOptions {
  readonly error: unknown;
  readonly errorUpdatedAt: number;
  readonly identity: string;
  readonly isError: boolean;
}

const useProfileReadError = ({
  error,
  errorUpdatedAt,
  identity,
  isError,
}: ProfileReadErrorOptions) => {
  const currentIdentity = `${identity}:${errorUpdatedAt}`;
  const [dismissedIdentity, setDismissedIdentity] = useState<string | null>(
    null,
  );

  return {
    dismiss: () => setDismissedIdentity(currentIdentity),
    message:
      isError && dismissedIdentity !== currentIdentity
        ? toProfileReadErrorMessage(error)
        : null,
  };
};

type GuestRouteView = Extract<ProfileRouteView, { variant: "guest" }>;

interface GuestProfileControllerProps {
  readonly hrefs: ProfileHrefPort;
  readonly navigation: ProfileNavigationCommands;
  readonly reservationApi?: ReservationReadApiPort;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly routeView: GuestRouteView;
  readonly scope: ProfileSessionScope;
}

function GuestProfileController({
  hrefs,
  navigation,
  reservationApi,
  resolveImageUrl,
  routeView,
  scope,
}: GuestProfileControllerProps) {
  const query = useReservationListReadQuery(
    {
      audience: "guest",
      filterType: routeView.filterType,
      scope,
    },
    reservationApi,
  );
  const reservations = useMemo(
    () => flattenPages(query.data?.pages, (page) => page.reservations),
    [query.data?.pages],
  );
  const groups = useMemo(
    () =>
      groupGuestTripsByYear(reservations).map(({ year, reservations }) => ({
        year,
        trips: reservations.map((reservation) =>
          toGuestTripCardViewModel(reservation, resolveImageUrl),
        ),
      })),
    [reservations, resolveImageUrl],
  );
  const {
    error,
    errorUpdatedAt,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
  } = query;
  const readError = useProfileReadError({
    error,
    errorUpdatedAt,
    identity: `guest:${routeView.filterType}:${scope.subject}:${scope.epoch}`,
    isError,
  });
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const loadMoreRef = useIntersectionLoadMore({
    disabled: isError,
    hasNext: Boolean(hasNextPage),
    isLoading: isFetchingNextPage,
    onLoadMore: loadMore,
  });

  return (
    <ProfileScreen
      variant="guest"
      activeTab={routeView.activeTab}
      guestTrips={{
        errorMessage: readError.message,
        filterType: routeView.filterType,
        getReservationHref: hrefs.guestReservation,
        loadMoreRef,
        onDismissError: readError.dismiss,
        onOpenReservation: navigation.openGuestReservation,
        state: query.isLoading
          ? { status: "loading" }
          : {
              status: "ready",
              groups,
              hasNext: Boolean(hasNextPage),
              isLoadingMore: isFetchingNextPage,
            },
      }}
      onModeChange={navigation.changeMode}
      onTabChange={navigation.changeGuestTab}
    />
  );
}

type HostListingsRouteView = Extract<
  ProfileRouteView,
  { variant: "host-listings" }
>;

interface HostListingsProfileControllerProps {
  readonly confirmDelete: (message: string) => boolean;
  readonly hostListingsApi?: HostListingsApiPort;
  readonly hostListingWorkflow: HostListingManagementCommandPort;
  readonly navigation: ProfileNavigationCommands;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly routeView: HostListingsRouteView;
  readonly scope: ProfileSessionScope;
}

function HostListingsProfileController({
  confirmDelete,
  hostListingsApi,
  hostListingWorkflow,
  navigation,
  resolveImageUrl,
  routeView,
  scope,
}: HostListingsProfileControllerProps) {
  const query = useInfiniteQuery(
    createHostListingInfiniteQueryOptions(
      { scope, status: routeView.statusType },
      hostListingsApi,
    ),
  );
  const listings = useMemo(
    () => flattenPages(query.data?.pages, (page) => page.listings),
    [query.data?.pages],
  );
  const listingViews = useMemo(
    () => toHostListingViewModels(listings, resolveImageUrl),
    [listings, resolveImageUrl],
  );
  const [selectedListingId, setSelectedListingId] = useState<number | null>(
    null,
  );
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );
  const actionPendingRef = useRef(false);
  const currentWorkflowRef = useRef(hostListingWorkflow);
  const listingDialogContextRef = useRef({
    accommodationId: null as number | null,
    generation: 0,
  });

  const replaceListingDialogContext = useCallback(
    (accommodationId: number | null) => {
      listingDialogContextRef.current = {
        accommodationId,
        generation: listingDialogContextRef.current.generation + 1,
      };
    },
    [],
  );

  useEffect(() => {
    currentWorkflowRef.current = hostListingWorkflow;
    actionPendingRef.current = false;
    setIsActionPending(false);
  }, [hostListingWorkflow]);

  useEffect(() => {
    replaceListingDialogContext(null);
    setSelectedListingId(null);
    setActionErrorMessage(null);
  }, [replaceListingDialogContext, routeView.statusType]);

  const {
    error,
    errorUpdatedAt,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
  } = query;
  const readError = useProfileReadError({
    error,
    errorUpdatedAt,
    identity: `host-listings:${routeView.statusType}:${scope.subject}:${scope.epoch}`,
    isError,
  });
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const loadMoreRef = useIntersectionLoadMore({
    disabled: isError,
    hasNext: Boolean(hasNextPage),
    isLoading: isFetchingNextPage,
    onLoadMore: loadMore,
  });
  const selectedListing =
    listingViews.find((listing) => listing.id === selectedListingId) ?? null;
  const closeListingActions = useCallback(() => {
    replaceListingDialogContext(null);
    setSelectedListingId(null);
    setActionErrorMessage(null);
  }, [replaceListingDialogContext]);
  const openListingActions = useCallback(
    (accommodationId: number) => {
      replaceListingDialogContext(accommodationId);
      setSelectedListingId(accommodationId);
      setActionErrorMessage(null);
    },
    [replaceListingDialogContext],
  );
  const runHostListingAction = useCallback(
    async (command: HostListingManagementCommand) => {
      if (actionPendingRef.current) return;
      if (
        command.action === "delete" &&
        !confirmDelete("정말 이 리스팅을 삭제하시겠습니까?")
      ) {
        return;
      }

      const workflow = hostListingWorkflow;
      const dialogContext = listingDialogContextRef.current;
      if (dialogContext.accommodationId !== command.accommodationId) return;
      actionPendingRef.current = true;
      setIsActionPending(true);
      setActionErrorMessage(null);

      const result = await workflow.execute(command);
      if (currentWorkflowRef.current !== workflow) return;

      actionPendingRef.current = false;
      setIsActionPending(false);

      if (
        listingDialogContextRef.current.generation !==
          dialogContext.generation ||
        listingDialogContextRef.current.accommodationId !==
          command.accommodationId
      ) {
        return;
      }

      if (result.status === "applied") {
        if (result.publication.status === "succeeded") {
          closeListingActions();
        } else {
          setActionErrorMessage(HOST_LISTING_PUBLICATION_ERROR_MESSAGE);
        }
        return;
      }
      if (result.status === "stale" || result.status === "applied-stale") {
        return;
      }

      setActionErrorMessage(toHostListingActionErrorMessage(result.error));
    },
    [closeListingActions, confirmDelete, hostListingWorkflow],
  );

  return (
    <ProfileScreen
      variant="host-listings"
      accommodationAction={{
        accommodation: selectedListing,
        errorMessage: actionErrorMessage,
        isPending: isActionPending,
        onClose: closeListingActions,
        onDelete: (accommodationId) =>
          void runHostListingAction({ action: "delete", accommodationId }),
        onDismissError: () => setActionErrorMessage(null),
        onEdit: navigation.editAccommodation,
        onOpenDetail: navigation.openAccommodation,
        onPublish: (accommodationId) =>
          void runHostListingAction({ action: "publish", accommodationId }),
        onUnpublish: (accommodationId) =>
          void runHostListingAction({
            action: "unpublish",
            accommodationId,
          }),
      }}
      hostListings={{
        errorMessage: readError.message,
        loadMoreRef,
        onDismissError: readError.dismiss,
        onOpenListingActions: openListingActions,
        onStatusChange: navigation.changeHostListingStatus,
        state: query.isLoading
          ? { status: "loading" }
          : {
              status: "ready",
              listings: listingViews,
              hasNext: Boolean(hasNextPage),
              isLoadingMore: isFetchingNextPage,
            },
        statusType: routeView.statusType,
      }}
      onModeChange={navigation.changeMode}
      onSectionChange={navigation.changeHostSection}
    />
  );
}

type HostReservationsRouteView = Extract<
  ProfileRouteView,
  { variant: "host-reservations" }
>;

interface HostReservationsProfileControllerProps {
  readonly navigation: ProfileNavigationCommands;
  readonly reservationApi?: ReservationReadApiPort;
  readonly routeView: HostReservationsRouteView;
  readonly scope: ProfileSessionScope;
}

function HostReservationsProfileController({
  navigation,
  reservationApi,
  routeView,
  scope,
}: HostReservationsProfileControllerProps) {
  const query = useReservationListReadQuery(
    {
      audience: "host",
      filterType: routeView.filterType,
      scope,
    },
    reservationApi,
  );
  const [sortDirection, setSortDirection] =
    useState<HostReservationCheckInSortDirection>("descending");
  const reservations = useMemo(
    () => flattenPages(query.data?.pages, (page) => page.reservations),
    [query.data?.pages],
  );
  const rows = useMemo(
    () =>
      sortHostReservationsByCheckIn(reservations, sortDirection).map(
        toHostReservationRowViewModel,
      ),
    [reservations, sortDirection],
  );
  const {
    error,
    errorUpdatedAt,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
  } = query;
  const readError = useProfileReadError({
    error,
    errorUpdatedAt,
    identity: `host-reservations:${routeView.filterType}:${scope.subject}:${scope.epoch}`,
    isError,
  });
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const loadMoreRef = useIntersectionLoadMore({
    disabled: isError,
    hasNext: Boolean(hasNextPage),
    isLoading: isFetchingNextPage,
    onLoadMore: loadMore,
  });

  return (
    <ProfileScreen
      variant="host-reservations"
      hostReservations={{
        checkInSortDirection: sortDirection,
        errorMessage: readError.message,
        filterType: routeView.filterType,
        loadMoreRef,
        onCheckInSort: () =>
          setSortDirection((current) =>
            current === "ascending" ? "descending" : "ascending",
          ),
        onDismissError: readError.dismiss,
        onFilterChange: navigation.changeHostReservationFilter,
        onOpenReservation: navigation.openHostReservation,
        state: query.isLoading
          ? { status: "loading" }
          : {
              status: "ready",
              rows,
              hasNext: Boolean(hasNextPage),
              isLoadingMore: isFetchingNextPage,
            },
      }}
      onModeChange={navigation.changeMode}
      onSectionChange={navigation.changeHostSection}
    />
  );
}

export function ProfileController(props: ProfileControllerProps) {
  switch (props.routeView.variant) {
    case "guest":
      return (
        <GuestProfileController
          hrefs={props.hrefs}
          navigation={props.navigation}
          reservationApi={props.reservationApi}
          resolveImageUrl={props.resolveImageUrl}
          routeView={props.routeView}
          scope={props.scope}
        />
      );
    case "host-listings":
      return (
        <HostListingsProfileController
          confirmDelete={props.confirmDelete}
          hostListingsApi={props.hostListingsApi}
          hostListingWorkflow={props.hostListingWorkflow}
          navigation={props.navigation}
          resolveImageUrl={props.resolveImageUrl}
          routeView={props.routeView}
          scope={props.scope}
        />
      );
    case "host-reservations":
      return (
        <HostReservationsProfileController
          navigation={props.navigation}
          reservationApi={props.reservationApi}
          routeView={props.routeView}
          scope={props.scope}
        />
      );
  }
}
