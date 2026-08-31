import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";

interface GuestReservationChangedInput {
  readonly reservationUid: string;
  readonly scope: AuthenticatedSessionScope;
}

export interface ReservationReadCacheProjectionPort {
  guestReservationChanged(input: GuestReservationChangedInput): Promise<void>;
}
