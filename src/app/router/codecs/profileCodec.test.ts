import { profileCodec, serializeProfileRouteQuery } from "./profileCodec";

describe("profileCodec", () => {
  it.each([
    ["", { mode: "guest", tab: "trips" }],
    ["mode=guest&tab=past", { mode: "guest", tab: "past" }],
    ["mode=host", { mode: "host", tab: "listings" }],
    [
      "mode=host&tab=reservations-cancelled",
      { mode: "host", tab: "reservations-cancelled" },
    ],
    ["mode=admin&tab=payments", { mode: "guest", tab: "trips" }],
    ["mode=admin&tab=past", { mode: "guest", tab: "trips" }],
    ["mode=host&tab=upcoming", { mode: "host", tab: "listings" }],
    ["mode=guest&tab=listings", { mode: "guest", tab: "trips" }],
  ] as const)("normalizes %s with current fallbacks", (query, expected) => {
    expect(profileCodec.parse(query)).toEqual(expected);
  });

  it("serializes in mode/tab order and round-trips", () => {
    const state = profileCodec.parse("tab=reservations&mode=host");

    expect(profileCodec.serialize(state).toString()).toBe(
      "mode=host&tab=reservations",
    );
    expect(profileCodec.parse(profileCodec.serialize(state))).toEqual(state);
  });

  it("canonicalizes independently of insertion order", () => {
    expect(profileCodec.canonicalize("tab=past&mode=guest")).toBe(
      profileCodec.canonicalize("mode=guest&tab=past"),
    );
  });

  it("preserves optional route-builder input", () => {
    expect(serializeProfileRouteQuery({ mode: "host" }).toString()).toBe(
      "mode=host",
    );
  });
});
