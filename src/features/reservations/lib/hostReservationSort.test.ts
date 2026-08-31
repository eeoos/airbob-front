import type { HostReservationListItem } from "../model/reservationRead";
import { sortHostReservationsByCheckIn } from "./hostReservationSort";

type ReservationFixture = Pick<
  HostReservationListItem,
  "checkInDate" | "reservationUid"
>;

const reservations: ReservationFixture[] = [
  { reservationUid: "later", checkInDate: "2026-07-10" },
  { reservationUid: "earlier", checkInDate: "2026-07-08" },
];

describe("host reservation check-in sort", () => {
  it("sorts ascending without mutating the input", () => {
    expect(
      sortHostReservationsByCheckIn(reservations, "ascending").map(
        ({ reservationUid }) => reservationUid,
      ),
    ).toEqual(["earlier", "later"]);
    expect(reservations.map(({ reservationUid }) => reservationUid)).toEqual([
      "later",
      "earlier",
    ]);
  });

  it("sorts descending", () => {
    expect(
      sortHostReservationsByCheckIn(reservations, "descending").map(
        ({ reservationUid }) => reservationUid,
      ),
    ).toEqual(["later", "earlier"]);
  });
});
