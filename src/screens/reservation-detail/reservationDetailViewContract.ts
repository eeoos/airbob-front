import type { StatusBadgeTone } from "../../shared/ui";

type ReservationDetailStatusTone = StatusBadgeTone;

export type ReservationDetailState<TView> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string | null }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly view: TView };

export interface GuestReservationDetailView {
  readonly reservationUid: string;
  readonly reservationCode: string;
  readonly guestCountLabel: string;
  readonly accommodation: {
    readonly id: number;
    readonly name: string;
    readonly thumbnailUrl: string | null;
  };
  readonly addressLabel: string;
  readonly checkIn: {
    readonly dateLabel: string;
    readonly timeLabel: string;
  };
  readonly checkOut: {
    readonly dateLabel: string;
    readonly timeLabel: string;
  };
  readonly host: {
    readonly nickname: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly avatarInitial: string;
  };
  readonly status: {
    readonly label: string;
    readonly tone: ReservationDetailStatusTone;
  };
  readonly canReview: boolean;
  readonly payment: {
    readonly methodLabel: string;
    readonly amountLabel: string;
    readonly approvedAtLabel: string | null;
    readonly statusLabel: string;
    readonly statusTone: ReservationDetailStatusTone;
    readonly virtualAccount: {
      readonly bankName: string;
      readonly accountNumber: string;
      readonly customerName: string;
      readonly dueDateLabel: string;
    } | null;
  } | null;
  readonly mapEmbedUrl: string | null;
}

export interface HostReservationDetailView {
  readonly reservationCode: string;
  readonly statusLabel: string;
  readonly statusTone: ReservationDetailStatusTone;
  readonly guest: {
    readonly nickname: string;
    readonly avatarUrl: string | null;
    readonly avatarInitial: string;
  };
  readonly guestStaySummaryLabel: string;
  readonly accommodation: {
    readonly id: number;
    readonly name: string;
    readonly thumbnailUrl: string | null;
  };
  readonly addressLabel: string;
  readonly guestCountLabel: string;
  readonly checkInDateLabel: string;
  readonly checkOutDateLabel: string;
  readonly createdAtDateLabel: string;
  readonly payment: {
    readonly nights: number;
    readonly pricePerNightLabel: string;
    readonly totalAmountLabel: string;
  } | null;
}

export interface GuestReservationDetailActions {
  readonly onBack: () => void;
  readonly onBackToProfile: () => void;
  readonly onDismissError: () => void;
  readonly onDismissFeedback: () => void;
  readonly onOpenAccommodation: (accommodationId: number) => void;
  readonly onOpenReview: (reservationUid: string) => void;
}

export interface HostReservationDetailActions {
  readonly onBack: () => void;
  readonly onDismissError: () => void;
  readonly onOpenAccommodation: (accommodationId: number) => void;
}

export interface GuestReservationDetailScreenProps {
  readonly state: ReservationDetailState<GuestReservationDetailView>;
  readonly feedbackMessage: string | null;
  readonly actions: GuestReservationDetailActions;
}

export interface HostReservationDetailScreenProps {
  readonly state: ReservationDetailState<HostReservationDetailView>;
  readonly actions: HostReservationDetailActions;
}

export type ReservationDetailScreenProps =
  | ({ readonly variant: "guest" } & GuestReservationDetailScreenProps)
  | ({ readonly variant: "host" } & HostReservationDetailScreenProps);
