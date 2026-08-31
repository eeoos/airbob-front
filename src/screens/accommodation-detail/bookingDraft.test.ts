import {
  deriveBookingDates,
  formatBookingDisplayDate,
  formatBookingLocalDate,
  normalizeBookingCounts,
} from "./bookingDraft";

describe("accommodation booking draft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00"));
  });

  afterEach(() => vi.useRealTimers());

  it("derives valid URL dates and pricing", () => {
    expect(
      deriveBookingDates({
        basePrice: 100000,
        checkIn: "2026-07-20",
        checkOut: "2026-07-23",
        unavailableDates: [],
      }),
    ).toMatchObject({ nights: 3, totalPrice: 300000 });
  });

  it("selects the first available default check-in when dates are absent", () => {
    const result = deriveBookingDates({
      basePrice: 100000,
      unavailableDates: ["2026-07-10", "2026-07-11"],
    });

    expect(formatBookingLocalDate(result.checkIn!)).toBe("2026-07-12");
    expect(formatBookingLocalDate(result.checkOut!)).toBe("2026-07-13");
  });

  it("clamps every occupancy to current accommodation policy", () => {
    expect(
      normalizeBookingCounts(
        {
          adultOccupancy: 8,
          childOccupancy: 7,
          infantOccupancy: 3,
          petOccupancy: 2,
        },
        { maxOccupancy: 4, maxInfants: 1, maxPets: 0 },
      ),
    ).toEqual({ adultCount: 4, childCount: 4, infantCount: 1, petCount: 0 });
  });

  it("formats the existing Korean display date", () => {
    expect(formatBookingDisplayDate(new Date(2026, 6, 10))).toBe(
      "2026. 07. 10.",
    );
  });
});
