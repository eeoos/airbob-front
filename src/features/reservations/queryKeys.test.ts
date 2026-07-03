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
});
