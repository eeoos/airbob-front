import { reservationQueryKeys } from "./queryKeys";

describe("reservationQueryKeys", () => {
  it("builds stable guest reservation keys", () => {
    expect(reservationQueryKeys.guestReservations("page=1")).toEqual([
      "reservations",
      "guest",
      "page=1",
    ]);
  });

  it("builds stable host reservation keys", () => {
    expect(reservationQueryKeys.hostReservations("page=1")).toEqual([
      "reservations",
      "host",
      "page=1",
    ]);
  });

  it("builds stable reservation detail keys", () => {
    expect(reservationQueryKeys.guestReservationDetail("reservation-1")).toEqual(
      ["reservations", "guestDetail", "reservation-1"],
    );
    expect(reservationQueryKeys.hostReservationDetail("reservation-1")).toEqual(
      ["reservations", "hostDetail", "reservation-1"],
    );
  });
});
