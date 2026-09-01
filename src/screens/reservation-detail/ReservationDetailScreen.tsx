import { GuestReservationDetailScreen } from "./GuestReservationDetailScreen";
import { HostReservationDetailScreen } from "./HostReservationDetailScreen";
import type { ReservationDetailScreenProps } from "./reservationDetailViewContract";

export type {
  GuestReservationDetailActions,
  GuestReservationDetailView,
  HostReservationDetailActions,
  HostReservationDetailView,
  ReservationDetailScreenProps,
  ReservationDetailState,
} from "./reservationDetailViewContract";

export function ReservationDetailScreen(props: ReservationDetailScreenProps) {
  return props.variant === "guest" ? (
    <GuestReservationDetailScreen
      actions={props.actions}
      feedbackMessage={props.feedbackMessage}
      state={props.state}
    />
  ) : (
    <HostReservationDetailScreen actions={props.actions} state={props.state} />
  );
}
