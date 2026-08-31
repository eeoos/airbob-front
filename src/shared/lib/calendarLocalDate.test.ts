import {
  addCalendarLocalDateDays,
  calendarLocalDateToDate,
  calendarNightsBetween,
  formatCalendarLocalDate,
  isCanonicalCalendarLocalDate,
  parseCalendarLocalDateOrdinal,
} from "./calendarLocalDate";

describe("calendar local date", () => {
  it.each(["2026-01-01", "2028-02-29", "0001-01-01"])(
    "accepts canonical Gregorian date %s",
    (value) => {
      expect(isCanonicalCalendarLocalDate(value)).toBe(true);
      expect(parseCalendarLocalDateOrdinal(value)).not.toBeNull();
    },
  );

  it.each([
    "2026-1-01",
    "2026-01-1",
    "2026-02-29",
    "0000-01-01",
    "2026-13-01",
    "2026-04-31",
    "",
  ])("rejects malformed local date %s", (value) => {
    expect(isCanonicalCalendarLocalDate(value)).toBe(false);
    expect(parseCalendarLocalDateOrdinal(value)).toBeNull();
  });

  it("counts calendar nights without elapsed-time or DST arithmetic", () => {
    expect(calendarNightsBetween("2026-03-07", "2026-03-10")).toBe(3);
    expect(calendarNightsBetween("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("converts between canonical strings and local Date display values", () => {
    const date = calendarLocalDateToDate("2026-07-10");

    expect(date).not.toBeNull();
    expect(formatCalendarLocalDate(date!)).toBe("2026-07-10");
    expect(
      formatCalendarLocalDate(calendarLocalDateToDate("0001-01-01")!),
    ).toBe("0001-01-01");
    expect(calendarLocalDateToDate("2026-02-30")).toBeNull();
  });

  it("adds calendar days across month and leap-year boundaries", () => {
    expect(addCalendarLocalDateDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarLocalDateDays("2028-02-28", 2)).toBe("2028-03-01");
    expect(addCalendarLocalDateDays("invalid", 1)).toBeNull();
  });
});
