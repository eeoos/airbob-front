import { ROUTE_PATHS, routeTo } from "./paths";

describe("route path contracts", () => {
  it("keeps existing router path shapes", () => {
    expect(ROUTE_PATHS.home).toBe("/");
    expect(ROUTE_PATHS.search).toBe("/search");
    expect(ROUTE_PATHS.accommodationDetail).toBe("/accommodations/:id");
    expect(ROUTE_PATHS.accommodationConfirm).toBe("/accommodations/:id/confirm");
    expect(ROUTE_PATHS.accommodationEdit).toBe("/accommodations/:id/edit");
    expect(ROUTE_PATHS.profile).toBe("/profile");
    expect(ROUTE_PATHS.reservationDetail).toBe("/reservations/:reservationUid");
    expect(ROUTE_PATHS.paymentSuccess).toBe("/reservations/:reservationUid/success");
    expect(ROUTE_PATHS.paymentFail).toBe("/reservations/:reservationUid/fail");
  });

  it("builds all static routes without changing URL contracts", () => {
    expect(routeTo.home()).toBe("/");
    expect(routeTo.search()).toBe("/search");
    expect(routeTo.wishlist()).toBe("/wishlist");
    expect(routeTo.profile()).toBe("/profile");
    expect(routeTo.login()).toBe("/login");
    expect(routeTo.signup()).toBe("/signup");
  });

  it("builds every dynamic route builder without changing URL contracts", () => {
    expect(routeTo.accommodationDetail(12)).toBe("/accommodations/12");
    expect(routeTo.accommodationConfirm(12)).toBe("/accommodations/12/confirm");
    expect(routeTo.accommodationEdit(12)).toBe("/accommodations/12/edit");
    expect(routeTo.hostReservationDetail("host_123")).toBe(
      "/profile/host/reservations/host_123"
    );
    expect(routeTo.reservationDetail("rsv_123")).toBe("/reservations/rsv_123");
    expect(routeTo.reviewCreate("rsv_123")).toBe("/reservations/rsv_123/review");
    expect(routeTo.paymentSuccess("rsv_123")).toBe("/reservations/rsv_123/success");
    expect(routeTo.paymentFail("rsv_123")).toBe("/reservations/rsv_123/fail");
  });

  it("builds object query routes with URLSearchParams encoding", () => {
    expect(routeTo.accommodationEdit(12, { mode: "create" })).toBe(
      "/accommodations/12/edit?mode=create"
    );
    expect(routeTo.wishlist({ id: "wish 1", view: "grid/card" })).toBe(
      "/wishlist?id=wish+1&view=grid%2Fcard"
    );
    expect(routeTo.profile({ mode: "host", tab: "listings-published" })).toBe(
      "/profile?mode=host&tab=listings-published"
    );
  });

  it("normalizes leading question marks for raw query string builders", () => {
    expect(routeTo.search("?destination=Seoul")).toBe("/search?destination=Seoul");
    expect(routeTo.search("??destination=Seoul")).toBe("/search?destination=Seoul");
    expect(routeTo.accommodationConfirm(12, "?amount=1000")).toBe(
      "/accommodations/12/confirm?amount=1000"
    );
  });

  it("encodes dynamic path params for route builders", () => {
    expect(routeTo.accommodationDetail("room/a b#1")).toBe(
      "/accommodations/room%2Fa%20b%231"
    );
    expect(routeTo.accommodationConfirm("room/a b#1", "?amount=1000")).toBe(
      "/accommodations/room%2Fa%20b%231/confirm?amount=1000"
    );
    expect(routeTo.accommodationEdit("room/a b#1", { mode: "create" })).toBe(
      "/accommodations/room%2Fa%20b%231/edit?mode=create"
    );
    expect(routeTo.hostReservationDetail("host/a b#1")).toBe(
      "/profile/host/reservations/host%2Fa%20b%231"
    );
    expect(routeTo.reservationDetail("rsv/a b#1")).toBe(
      "/reservations/rsv%2Fa%20b%231"
    );
    expect(routeTo.reviewCreate("rsv/a b#1")).toBe(
      "/reservations/rsv%2Fa%20b%231/review"
    );
    expect(routeTo.paymentSuccess("rsv/a b#1")).toBe(
      "/reservations/rsv%2Fa%20b%231/success"
    );
    expect(routeTo.paymentFail("rsv/a b#1")).toBe(
      "/reservations/rsv%2Fa%20b%231/fail"
    );
  });
});
