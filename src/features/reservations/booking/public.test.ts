import * as reservationBookingSurface from "./public";

describe("reservation booking public surface", () => {
  it("exports only the production singleton at runtime", () => {
    expect(Object.keys(reservationBookingSurface)).toEqual([
      "reservationBookingApi",
    ]);
    expect(reservationBookingSurface).not.toHaveProperty(
      "createReservationBookingApi",
    );
    expect(reservationBookingSurface).not.toHaveProperty("toReservationQuote");
    expect(reservationBookingSurface).not.toHaveProperty("contracts");
  });
});
