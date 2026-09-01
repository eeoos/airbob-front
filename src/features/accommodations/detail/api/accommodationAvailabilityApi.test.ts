import type { AccommodationAvailabilityWire } from "./contracts";
import {
  createAccommodationAvailabilityApi,
  type AccommodationAvailabilityApiTransport,
} from "./accommodationAvailabilityApiFactory";

const availabilityWire: AccommodationAvailabilityWire = {
  booking_window_start_inclusive: "2026-07-10",
  booking_window_end_exclusive: "2027-07-10",
  unavailable_ranges: [
    { start_date: "2026-07-12", end_date_exclusive: "2026-07-14" },
  ],
};

describe("accommodation availability API adapter", () => {
  it("uses the separate GET endpoint, binds the requested id, and forwards cancellation", async () => {
    const transport = vi.fn().mockResolvedValue(availabilityWire);
    const api = createAccommodationAvailabilityApi(
      transport as AccommodationAvailabilityApiTransport,
    );
    const signal = new AbortController().signal;

    await expect(api.getAvailability(7, { signal })).resolves.toEqual({
      accommodationId: 7,
      bookingWindowStartInclusive: "2026-07-10",
      bookingWindowEndExclusive: "2027-07-10",
      unavailableRanges: [
        { startDate: "2026-07-12", endDateExclusive: "2026-07-14" },
      ],
    });

    expect(transport).toHaveBeenCalledWith({
      method: "GET",
      path: "/accommodations/7/availability",
      signal,
    });
    expect(transport.mock.calls.at(0)?.at(0)).not.toHaveProperty("body");
    expect(transport.mock.calls.at(0)?.at(0)).not.toHaveProperty("params");
  });

  it.each([
    [
      "non-canonical date",
      { ...availabilityWire, booking_window_start_inclusive: "2026-7-10" },
    ],
    [
      "reversed window",
      {
        ...availabilityWire,
        booking_window_start_inclusive: "2027-07-10",
        booking_window_end_exclusive: "2026-07-10",
      },
    ],
    [
      "reversed range",
      {
        ...availabilityWire,
        unavailable_ranges: [
          { start_date: "2026-07-14", end_date_exclusive: "2026-07-12" },
        ],
      },
    ],
    [
      "range outside window",
      {
        ...availabilityWire,
        unavailable_ranges: [
          { start_date: "2026-07-09", end_date_exclusive: "2026-07-12" },
        ],
      },
    ],
    [
      "overlapping ranges",
      {
        ...availabilityWire,
        unavailable_ranges: [
          { start_date: "2026-07-12", end_date_exclusive: "2026-07-15" },
          { start_date: "2026-07-14", end_date_exclusive: "2026-07-16" },
        ],
      },
    ],
  ])("runtime-rejects a malformed %s response", async (_name, value) => {
    const api = createAccommodationAvailabilityApi(
      vi.fn().mockResolvedValue(value) as AccommodationAvailabilityApiTransport,
    );

    await expect(api.getAvailability(7)).rejects.toThrow(
      "Accommodation availability response is invalid.",
    );
  });
});
