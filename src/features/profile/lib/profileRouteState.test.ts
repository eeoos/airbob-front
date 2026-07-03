import {
  buildProfileRouteSearchParams,
  parseProfileRouteState,
} from "./profileRouteState";

describe("profile route state", () => {
  it("defaults to guest mode and trips tab", () => {
    const state = parseProfileRouteState(new URLSearchParams(""));

    expect(state).toEqual({ mode: "guest", tab: "trips" });
  });

  it("normalizes host mode to listings tab when tab is missing", () => {
    const state = parseProfileRouteState(new URLSearchParams("mode=host"));

    expect(state).toEqual({ mode: "host", tab: "listings" });
  });

  it("keeps the host reservations tab", () => {
    const state = parseProfileRouteState(
      new URLSearchParams("mode=host&tab=reservations")
    );

    expect(state).toEqual({ mode: "host", tab: "reservations" });
  });

  it("falls back from invalid query values without throwing", () => {
    const state = parseProfileRouteState(
      new URLSearchParams("mode=admin&tab=payments")
    );

    expect(state).toEqual({ mode: "guest", tab: "trips" });
  });

  it("builds stable profile query strings", () => {
    expect(
      buildProfileRouteSearchParams({ mode: "host", tab: "reservations" }).toString()
    ).toBe("mode=host&tab=reservations");
  });
});
