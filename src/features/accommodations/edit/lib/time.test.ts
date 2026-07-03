import { formatTime, parseTime } from "./time";

describe("accommodation edit time helpers", () => {
  it("parses 24-hour time into the picker model", () => {
    expect(parseTime("00:05")).toEqual({
      hour: 12,
      minute: 5,
      period: "AM",
      originalHour: 0,
    });
    expect(parseTime("12:30")).toEqual({
      hour: 12,
      minute: 30,
      period: "PM",
      originalHour: 12,
    });
    expect(parseTime("23:45:00")).toEqual({
      hour: 11,
      minute: 45,
      period: "PM",
      originalHour: 23,
    });
  });

  it("formats picker time into zero-padded 24-hour time", () => {
    expect(formatTime(12, 0, "AM")).toBe("00:00");
    expect(formatTime(12, 30, "PM")).toBe("12:30");
    expect(formatTime(3, 5, "PM")).toBe("15:05");
  });
});
