import { isOpaqueIdentifier } from "./opaqueIdentifier";

describe("opaque identifier", () => {
  it.each([
    "reservation-123",
    "reservation_123",
    "6df13da6-735a-4a4a-a8bc-3b8acbdac9bf",
    "a",
    "a".repeat(128),
  ])("accepts a bounded path-safe identifier: %s", (value) => {
    expect(isOpaqueIdentifier(value)).toBe(true);
  });

  it.each([
    "",
    "a".repeat(129),
    "../admin",
    "..%2Fadmin",
    "%252e%252e%252fadmin",
    "reservation/123",
    " reservation-123",
    "reservation-123 ",
    "reservation.123",
  ])("rejects a path-shaped or unbounded value: %s", (value) => {
    expect(isOpaqueIdentifier(value)).toBe(false);
  });
});
