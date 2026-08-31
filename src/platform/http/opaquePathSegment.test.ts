import { encodeOpaquePathSegment } from "./opaquePathSegment";

describe("opaque API path segment", () => {
  it.each([
    "reservation-123",
    "reservation_123",
    "6df13da6-735a-4a4a-a8bc-3b8acbdac9bf",
  ])("accepts one bounded path-safe segment: %s", (value) => {
    expect(encodeOpaquePathSegment(value)).toBe(value);
  });

  it.each([
    "../../admin",
    "..%2F..%2Fadmin",
    "%252e%252e%252fadmin",
    "reservation-123/payment-attempts",
    " reservation-123",
    "",
  ])("rejects a path-shaped value: %s", (value) => {
    expect(() => encodeOpaquePathSegment(value)).toThrow(
      expect.objectContaining({
        code: "INVALID_OPAQUE_PATH_SEGMENT",
        kind: "validation",
      }),
    );
  });
});
