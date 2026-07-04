import type { HostReservationInfo } from "../../../types/reservation";

export type HostReservationSortColumn = "check_in" | "check_out" | "created_at";
export type HostReservationSortOrder = "asc" | "desc";

const getSortValue = (
  reservation: HostReservationInfo,
  column: HostReservationSortColumn
) => {
  if (column === "check_in") return reservation.check_in_date;
  if (column === "check_out") return reservation.check_out_date;
  return reservation.created_at;
};

export const sortHostReservations = (
  reservations: HostReservationInfo[],
  column: HostReservationSortColumn,
  order: HostReservationSortOrder
) =>
  [...reservations].sort((a, b) => {
    const comparison = getSortValue(a, column).localeCompare(getSortValue(b, column));
    return order === "asc" ? comparison : -comparison;
  });

export const getNextHostReservationSort = (
  currentColumn: HostReservationSortColumn,
  currentOrder: HostReservationSortOrder,
  nextColumn: HostReservationSortColumn
) => {
  if (currentColumn !== nextColumn) {
    return { column: nextColumn, order: "desc" as const };
  }

  return {
    column: nextColumn,
    order: currentOrder === "asc" ? ("desc" as const) : ("asc" as const),
  };
};
