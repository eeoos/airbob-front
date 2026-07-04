import type { HostReservationInfo } from "../../../types/reservation";
import { getNextHostReservationSort, sortHostReservations } from "./hostReservationSort";

type HostReservationSortFixture = Pick<
  HostReservationInfo,
  "reservation_uid" | "check_in_date" | "check_out_date" | "created_at"
>;

const makeReservation = (
  reservationUid: string,
  checkInDate: string,
  checkOutDate: string,
  createdAt: string
): HostReservationSortFixture =>
  ({
    reservation_uid: reservationUid,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    created_at: createdAt,
  });

describe("host reservation sort", () => {
  const reservations = [
    makeReservation("first", "2026-07-10", "2026-07-12", "2026-01-01T00:00:00"),
    makeReservation("second", "2026-07-08", "2026-07-11", "2026-01-03T00:00:00"),
  ];

  it("sorts by check_in descending", () => {
    expect(sortHostReservations(reservations, "check_in", "desc").map((item) => item.reservation_uid)).toEqual([
      "first",
      "second",
    ]);
  });

  it("sorts by check_in ascending", () => {
    expect(sortHostReservations(reservations, "check_in", "asc").map((item) => item.reservation_uid)).toEqual([
      "second",
      "first",
    ]);
  });

  it("sorts by check_out descending", () => {
    expect(sortHostReservations(reservations, "check_out", "desc").map((item) => item.reservation_uid)).toEqual([
      "first",
      "second",
    ]);
  });

  it("sorts by check_out ascending", () => {
    expect(sortHostReservations(reservations, "check_out", "asc").map((item) => item.reservation_uid)).toEqual([
      "second",
      "first",
    ]);
  });

  it("sorts by created_at ascending", () => {
    expect(sortHostReservations(reservations, "created_at", "asc").map((item) => item.reservation_uid)).toEqual([
      "first",
      "second",
    ]);
  });

  it("sorts by created_at descending", () => {
    expect(sortHostReservations(reservations, "created_at", "desc").map((item) => item.reservation_uid)).toEqual([
      "second",
      "first",
    ]);
  });

  it("defaults to descending order when selecting a different column", () => {
    expect(getNextHostReservationSort("check_in", "asc", "created_at")).toEqual({
      column: "created_at",
      order: "desc",
    });
  });

  it("toggles same-column sort from descending to ascending", () => {
    expect(getNextHostReservationSort("check_in", "desc", "check_in")).toEqual({
      column: "check_in",
      order: "asc",
    });
  });

  it("toggles same-column sort from ascending to descending", () => {
    expect(getNextHostReservationSort("check_out", "asc", "check_out")).toEqual({
      column: "check_out",
      order: "desc",
    });
  });
});
