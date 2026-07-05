import type { MyReservationInfo } from "../../../types/reservation";
import { formatGuestTripDateRange, groupGuestTripsByYear } from "./guestTripGroups";

type GuestTripGroupFixture = Pick<
  MyReservationInfo,
  "reservation_id" | "reservation_uid" | "check_in_date" | "check_out_date"
>;

const makeTrip = (
  reservationId: number,
  checkInDate: string,
  checkOutDate: string
): GuestTripGroupFixture =>
  ({
    reservation_id: reservationId,
    reservation_uid: `guest-${reservationId}`,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
  });

describe("guest trip display helpers", () => {
  it("groups trips by descending check-in year", () => {
    const groups = groupGuestTripsByYear([
      makeTrip(1, "2025-01-10", "2025-01-12"),
      makeTrip(2, "2026-03-10", "2026-03-12"),
      makeTrip(3, "2025-04-10", "2025-04-12"),
    ]);

    expect(groups.map((group) => group.year)).toEqual([2026, 2025]);
    expect(groups[1].reservations.map((trip) => trip.reservation_uid)).toEqual([
      "guest-1",
      "guest-3",
    ]);
  });

  it("groups trips by literal check-in year for date-only boundaries", () => {
    const groups = groupGuestTripsByYear([
      makeTrip(1, "2026-01-01", "2026-01-02"),
      makeTrip(2, "2026-12-31", "2027-01-01"),
      makeTrip(3, "2027-01-01", "2027-01-02"),
    ]);

    expect(groups.map((group) => group.year)).toEqual([2027, 2026]);
    expect(groups[1].reservations.map((trip) => trip.reservation_uid)).toEqual([
      "guest-1",
      "guest-2",
    ]);
  });

  it("formats same-month, same-year, and cross-year date ranges", () => {
    expect(formatGuestTripDateRange("2026-07-10", "2026-07-12")).toBe(
      "2026년 7월 10일 ~ 12일"
    );
    expect(formatGuestTripDateRange("2026-07-30", "2026-08-02")).toBe(
      "2026년 7월 30일 ~ 8월 2일"
    );
    expect(formatGuestTripDateRange("2026-12-31", "2027-01-02")).toBe(
      "2026년 12월 31일 ~ 2027년 1월 2일"
    );
  });

  it("formats date-only boundary ranges from literal calendar parts", () => {
    expect(formatGuestTripDateRange("2026-01-01", "2026-01-02")).toBe(
      "2026년 1월 1일 ~ 2일"
    );
    expect(formatGuestTripDateRange("2026-12-31", "2027-01-01")).toBe(
      "2026년 12월 31일 ~ 2027년 1월 1일"
    );
  });
});
