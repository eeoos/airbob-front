import {
  formatListingEditorTime,
  parseListingEditorTime,
} from "./listingEditorTime";

describe("listing editor time model", () => {
  it.each([
    [12, 0, "AM", "00:00"],
    [12, 30, "PM", "12:30"],
    [4, 5, "PM", "16:05"],
  ] as const)("formats %s:%s %s", (hour, minute, period, expected) => {
    expect(formatListingEditorTime(hour, minute, period)).toBe(expected);
  });

  it("parses a persisted 24-hour value for the picker", () => {
    expect(parseListingEditorTime("16:30:00")).toEqual({
      hour: 4,
      minute: 30,
      period: "PM",
    });
  });
});
