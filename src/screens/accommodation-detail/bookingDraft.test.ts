import {
  type BookingAvailabilitySnapshot,
  deriveBookingDates,
  formatBookingDisplayDate,
  formatBookingLocalDate,
  normalizeBookingCounts,
} from "./bookingDraft";

const availability: BookingAvailabilitySnapshot = {
  bookingWindowStartInclusive: "2026-07-10",
  bookingWindowEndExclusive: "2027-07-10",
  unavailableRanges: [],
};

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
        availability,
      }),
    ).toMatchObject({
      isStayReady: true,
      nights: 3,
      selectionState: "ready",
      totalPrice: 300000,
    });
  });

  it("selects the first available default check-in when dates are absent", () => {
    const result = deriveBookingDates({
      basePrice: 100000,
      availability: {
        ...availability,
        unavailableRanges: [
          { startDate: "2026-07-10", endDateExclusive: "2026-07-12" },
        ],
      },
    });

    expect(formatBookingLocalDate(result.checkIn!)).toBe("2026-07-12");
    expect(formatBookingLocalDate(result.checkOut!)).toBe("2026-07-13");
  });

  it("uses the server booking-window start instead of the browser date", () => {
    vi.setSystemTime(new Date("2030-01-01T12:00:00"));

    const result = deriveBookingDates({ basePrice: 100000, availability });

    expect(formatBookingLocalDate(result.checkIn!)).toBe("2026-07-10");
    expect(formatBookingLocalDate(result.checkOut!)).toBe("2026-07-11");
  });

  it("fails closed while availability is absent", () => {
    expect(
      deriveBookingDates({ basePrice: 100000, availability: null }),
    ).toEqual({
      checkIn: null,
      checkOut: null,
      isStayReady: false,
      nights: 0,
      selectionState: "availability-unavailable",
      totalPrice: 0,
    });
  });

  it("preserves an explicit conflicting route selection without substituting defaults", () => {
    const result = deriveBookingDates({
      basePrice: 100000,
      checkIn: "2026-07-20",
      checkOut: "2026-07-23",
      availability: {
        ...availability,
        unavailableRanges: [
          { startDate: "2026-07-21", endDateExclusive: "2026-07-22" },
        ],
      },
    });

    expect(formatBookingLocalDate(result.checkIn!)).toBe("2026-07-20");
    expect(formatBookingLocalDate(result.checkOut!)).toBe("2026-07-23");
    expect(result).toMatchObject({
      isStayReady: false,
      nights: 3,
      selectionState: "unavailable",
      totalPrice: 300000,
    });
  });

  it("preserves displayable out-of-window dates and marks them non-ready", () => {
    const result = deriveBookingDates({
      basePrice: 100000,
      checkIn: "2027-07-10",
      checkOut: "2027-07-12",
      availability,
    });

    expect(formatBookingLocalDate(result.checkIn!)).toBe("2027-07-10");
    expect(formatBookingLocalDate(result.checkOut!)).toBe("2027-07-12");
    expect(result).toMatchObject({
      isStayReady: false,
      selectionState: "outside-window",
    });
  });

  it("does not invent a stay when the booking window is fully booked", () => {
    const result = deriveBookingDates({
      basePrice: 100000,
      availability: {
        bookingWindowStartInclusive: "2026-07-10",
        bookingWindowEndExclusive: "2026-07-13",
        unavailableRanges: [
          { startDate: "2026-07-10", endDateExclusive: "2026-07-13" },
        ],
      },
    });

    expect(result).toEqual({
      checkIn: null,
      checkOut: null,
      isStayReady: false,
      nights: 0,
      selectionState: "fully-booked",
      totalPrice: 0,
    });
  });

  it("accepts checkout at a blocked-range start and at the window end", () => {
    const boundaryAvailability: BookingAvailabilitySnapshot = {
      bookingWindowStartInclusive: "2026-07-10",
      bookingWindowEndExclusive: "2026-07-15",
      unavailableRanges: [
        { startDate: "2026-07-12", endDateExclusive: "2026-07-14" },
      ],
    };

    expect(
      deriveBookingDates({
        basePrice: 100000,
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        availability: boundaryAvailability,
      }),
    ).toMatchObject({ nights: 2, totalPrice: 200000 });
    expect(
      deriveBookingDates({
        basePrice: 100000,
        checkIn: "2026-07-14",
        checkOut: "2026-07-15",
        availability: boundaryAvailability,
      }),
    ).toMatchObject({ nights: 1, totalPrice: 100000 });
  });

  it("counts nights by calendar ordinal across DST boundaries", () => {
    expect(
      deriveBookingDates({
        basePrice: 100000,
        checkIn: "2026-03-07",
        checkOut: "2026-03-10",
        availability: {
          bookingWindowStartInclusive: "2026-01-01",
          bookingWindowEndExclusive: "2027-01-01",
          unavailableRanges: [],
        },
      }),
    ).toMatchObject({ nights: 3, totalPrice: 300000 });
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
