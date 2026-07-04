import type { HostReservationInfo } from "../../../types/reservation";
import { sortHostReservations } from "./hostReservationSort";

const makeReservation = (
  reservationUid: string,
  checkInDate: string,
  checkOutDate: string,
  createdAt: string
): HostReservationInfo =>
  ({
    reservation_uid: reservationUid,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    created_at: createdAt,
  }) as HostReservationInfo;

describe("host reservation sort", () => {
  const reservations = [
    makeReservation("first", "2026-07-10", "2026-07-12", "2026-01-01T00:00:00"),
    makeReservation("second", "2026-07-08", "2026-07-11", "2026-01-03T00:00:00"),
  ];

  it("sorts by a date column descending by default", () => {
    expect(sortHostReservations(reservations, "check_in", "desc").map((item) => item.reservation_uid)).toEqual([
      "first",
      "second",
    ]);
  });

  it("sorts by created_at ascending", () => {
    expect(sortHostReservations(reservations, "created_at", "asc").map((item) => item.reservation_uid)).toEqual([
      "first",
      "second",
    ]);
  });
});
