import { parsePositiveAccommodationId } from "./accommodationId";

describe("parsePositiveAccommodationId", () => {
  it.each([
    ["1", 1],
    ["42", 42],
    ["0007", 7],
  ])("parses a positive safe integer: %s", (value, expected) => {
    expect(parsePositiveAccommodationId(value)).toBe(expected);
  });

  it.each([undefined, "", "0", "-1", "1.5", "1e2", "9007199254740992"])(
    "rejects an invalid accommodation id: %s",
    (value) => {
      expect(parsePositiveAccommodationId(value)).toBeNull();
    },
  );
});
