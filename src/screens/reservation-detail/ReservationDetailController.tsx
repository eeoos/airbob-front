import { useState } from "react";
import type { ReservationReadApiPort } from "../../features/reservations/ports/reservationReadApiPort";
import {
  useReservationDetailReadQuery,
  type ReservationDetailReadQueryOptions,
} from "../../features/reservations/queries/reservationReadQueries";
import { toHostReservationDetailViewModel } from "../../features/reservations/lib/hostReservationDetailViewModel";
import { toReservationDetailViewModel } from "../../features/reservations/lib/reservationDetailViewModel";
import {
  ReservationDetailScreen,
  type GuestReservationDetailActions,
  type GuestReservationDetailView,
  type HostReservationDetailActions,
  type HostReservationDetailView,
  type ReservationDetailState,
} from "./ReservationDetailScreen";
import { toReservationDetailErrorMessage } from "./reservationDetailErrorMessage";

type ReservationDetailSessionScope = NonNullable<
  ReservationDetailReadQueryOptions<"guest">["scope"]
>;

interface ReservationDetailControllerCommonProps {
  readonly api?: ReservationReadApiPort;
  readonly reservationUid: string;
  readonly resolveImageUrl: (path: string | null) => string;
  readonly scope: ReservationDetailSessionScope;
}

export interface GuestReservationDetailNavigation {
  readonly back: () => void;
  readonly backToProfile: () => void;
  readonly openAccommodation: (accommodationId: number) => void;
  readonly openReview: (reservationUid: string) => void;
}

export interface HostReservationDetailNavigation {
  readonly back: () => void;
  readonly openAccommodation: (accommodationId: number) => void;
}

export type ReservationDetailControllerProps =
  | (ReservationDetailControllerCommonProps & {
      readonly variant: "guest";
      readonly buildMapEmbedUrl: (coordinate: {
        readonly latitude: number;
        readonly longitude: number;
      }) => string | null;
      readonly feedbackMessage: string | null;
      readonly navigation: GuestReservationDetailNavigation;
    })
  | (ReservationDetailControllerCommonProps & {
      readonly variant: "host";
      readonly navigation: HostReservationDetailNavigation;
    });

const errorIdentity = (
  reservationUid: string,
  errorUpdatedAt: number,
): string => `${reservationUid}:${errorUpdatedAt}`;

function GuestReservationDetailController({
  api,
  buildMapEmbedUrl,
  feedbackMessage,
  navigation,
  reservationUid,
  resolveImageUrl,
  scope,
}: Extract<ReservationDetailControllerProps, { variant: "guest" }>) {
  const query = useReservationDetailReadQuery(
    { audience: "guest", reservationUid, scope },
    api,
  );
  const currentErrorIdentity = errorIdentity(
    reservationUid,
    query.errorUpdatedAt,
  );
  const feedbackIdentity = `${reservationUid}:${feedbackMessage ?? ""}`;
  const [dismissedErrorIdentity, setDismissedErrorIdentity] =
    useState<string | null>(null);
  const [dismissedFeedbackIdentity, setDismissedFeedbackIdentity] =
    useState<string | null>(null);

  let state: ReservationDetailState<GuestReservationDetailView>;
  if (query.isLoading) {
    state = { status: "loading" };
  } else if (query.isError) {
    state = {
      status: "error",
      message:
        dismissedErrorIdentity === currentErrorIdentity
          ? null
          : toReservationDetailErrorMessage(query.error),
    };
  } else if (!query.data) {
    state = { status: "missing" };
  } else {
    const { mapCoordinate, ...view } = toReservationDetailViewModel(
      query.data,
      resolveImageUrl,
    );
    state = {
      status: "ready",
      view: {
        ...view,
        mapEmbedUrl: mapCoordinate ? buildMapEmbedUrl(mapCoordinate) : null,
      },
    };
  }

  const actions: GuestReservationDetailActions = {
    onBack: navigation.back,
    onBackToProfile: navigation.backToProfile,
    onDismissError: () => setDismissedErrorIdentity(currentErrorIdentity),
    onDismissFeedback: () =>
      setDismissedFeedbackIdentity(feedbackIdentity),
    onOpenAccommodation: navigation.openAccommodation,
    onOpenReview: navigation.openReview,
  };

  return (
    <ReservationDetailScreen
      variant="guest"
      actions={actions}
      feedbackMessage={
        dismissedFeedbackIdentity === feedbackIdentity
          ? null
          : feedbackMessage
      }
      state={state}
    />
  );
}

function HostReservationDetailController({
  api,
  navigation,
  reservationUid,
  resolveImageUrl,
  scope,
}: Extract<ReservationDetailControllerProps, { variant: "host" }>) {
  const query = useReservationDetailReadQuery(
    { audience: "host", reservationUid, scope },
    api,
  );
  const currentErrorIdentity = errorIdentity(
    reservationUid,
    query.errorUpdatedAt,
  );
  const [dismissedErrorIdentity, setDismissedErrorIdentity] =
    useState<string | null>(null);

  let state: ReservationDetailState<HostReservationDetailView>;
  if (query.isLoading) {
    state = { status: "loading" };
  } else if (query.isError) {
    state = {
      status: "error",
      message:
        dismissedErrorIdentity === currentErrorIdentity
          ? null
          : toReservationDetailErrorMessage(query.error),
    };
  } else if (!query.data) {
    state = { status: "missing" };
  } else {
    state = {
      status: "ready",
      view: toHostReservationDetailViewModel(query.data, resolveImageUrl),
    };
  }
  const actions: HostReservationDetailActions = {
    onBack: navigation.back,
    onDismissError: () => setDismissedErrorIdentity(currentErrorIdentity),
    onOpenAccommodation: navigation.openAccommodation,
  };

  return (
    <ReservationDetailScreen
      variant="host"
      actions={actions}
      state={state}
    />
  );
}

export function ReservationDetailController(
  props: ReservationDetailControllerProps,
) {
  return props.variant === "guest" ? (
    <GuestReservationDetailController {...props} />
  ) : (
    <HostReservationDetailController {...props} />
  );
}
