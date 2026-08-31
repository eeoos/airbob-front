import { snapshotAuthIntent, toAuthIntentLocalDate } from "./authIntent";

describe("authIntent", () => {
  it.each(["2026-01-01", "2028-02-29", "9999-12-31"])(
    "accepts a strict calendar date: %s",
    (value) => {
      expect(toAuthIntentLocalDate(value)).toBe(value);
    },
  );

  it.each([
    "2026-1-01",
    "2026-01-1",
    "2026-02-29",
    "2026-04-31",
    "0000-01-01",
    "not-a-date",
  ])("rejects a non-calendar date: %s", (value) => {
    expect(() => toAuthIntentLocalDate(value)).toThrow(TypeError);
  });

  it("copies only the declared primitive payload", () => {
    const mutableInput: {
      type: "wishlist.open";
      accommodationId: number;
      email: string;
      resume: () => void;
      completion: Promise<void>;
    } = {
      type: "wishlist.open",
      accommodationId: 7,
      email: "must-not-enter-runtime@example.com",
      resume: vi.fn(),
      completion: Promise.resolve(),
    };

    const snapshot = snapshotAuthIntent(mutableInput);
    mutableInput.accommodationId = 8;

    expect(snapshot).toEqual({
      type: "wishlist.open",
      accommodationId: 7,
    });
    expect(snapshot).not.toHaveProperty("email");
    expect(snapshot).not.toHaveProperty("resume");
    expect(snapshot).not.toHaveProperty("completion");
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("rejects invalid identifiers and guest counts", () => {
    expect(() =>
      snapshotAuthIntent({
        type: "coupon.issue",
        accommodationId: 0,
        couponId: 1,
      }),
    ).toThrow("accommodationId must be a positive safe integer");

    expect(() =>
      snapshotAuthIntent({
        type: "reservation.start",
        accommodationId: 1,
        checkIn: toAuthIntentLocalDate("2026-07-10"),
        checkOut: toAuthIntentLocalDate("2026-07-12"),
        adultCount: 2,
        childCount: -1,
        infantCount: 0,
        petCount: 0,
        couponId: null,
      }),
    ).toThrow("childCount must be a non-negative safe integer");
  });
});
