import type { HostReservationListItem } from "../model/reservationRead";

export type HostReservationCheckInSortDirection = "ascending" | "descending";

type HostReservationWithCheckIn = Pick<HostReservationListItem, "checkInDate">;

export const sortHostReservationsByCheckIn = <
  TReservation extends HostReservationWithCheckIn,
>(
  reservations: readonly TReservation[],
  direction: HostReservationCheckInSortDirection,
): TReservation[] =>
  [...reservations].sort((left, right) => {
    const comparison = left.checkInDate.localeCompare(right.checkInDate);
    return direction === "ascending" ? comparison : -comparison;
  });
