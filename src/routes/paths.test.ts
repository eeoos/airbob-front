import { parsePaymentFailReason, ROUTE_PATHS, routeTo } from "./paths";

describe("route path contracts", () => {
  it("keeps existing router path shapes", () => {
    expect(ROUTE_PATHS.home).toBe("/");
    expect(ROUTE_PATHS.search).toBe("/search");
    expect(ROUTE_PATHS.accommodationDetail).toBe("/accommodations/:id");
    expect(ROUTE_PATHS.accommodationConfirm).toBe(
      "/accommodations/:id/confirm",
    );
    expect(ROUTE_PATHS.accommodationEdit).toBe("/accommodations/:id/edit");
    expect(ROUTE_PATHS.profile).toBe("/profile");
    expect(ROUTE_PATHS.reservationDetail).toBe("/reservations/:reservationUid");
    expect(ROUTE_PATHS.paymentSuccess).toBe(
      "/reservations/:reservationUid/success",
    );
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

  it("re-exports payment fail query helpers from route contracts", () => {
    expect(parsePaymentFailReason("confirm-failed")).toBe("confirm-failed");
    expect(parsePaymentFailReason("declined")).toBeUndefined();
  });

  it("builds every dynamic route builder without changing URL contracts", () => {
    expect(routeTo.accommodationDetail(12)).toBe("/accommodations/12");
    expect(routeTo.accommodationConfirm(12)).toBe("/accommodations/12/confirm");
    expect(routeTo.accommodationEdit(12)).toBe("/accommodations/12/edit");
    expect(routeTo.hostReservationDetail("host_123")).toBe(
      "/profile/host/reservations/host_123",
    );
    expect(routeTo.reservationDetail("rsv_123")).toBe("/reservations/rsv_123");
    expect(routeTo.reviewCreate("rsv_123")).toBe(
      "/reservations/rsv_123/review",
    );
    expect(routeTo.paymentSuccess("rsv_123")).toBe(
      "/reservations/rsv_123/success",
    );
    expect(routeTo.paymentFail("rsv_123")).toBe("/reservations/rsv_123/fail");
    expect(routeTo.paymentFail("reservation-123", { reason: "confirm-failed" })).toBe(
      "/reservations/reservation-123/fail?reason=confirm-failed",
    );
    expect(routeTo.paymentFail("reservation-123", { reason: "invalid-callback" })).toBe(
      "/reservations/reservation-123/fail?reason=invalid-callback",
    );
  });

  it("builds typed search query routes with current viewport keys", () => {
    expect(
      routeTo.search({
        destination: "Seoul",
        page: 3,
        lat: 37.5665,
        lng: 126.978,
        topLeftLat: 38,
        topLeftLng: 126,
        bottomRightLat: 37,
        bottomRightLng: 128,
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        adultOccupancy: 2,
        childOccupancy: 1,
        infantOccupancy: 0,
        petOccupancy: 1,
      }),
    ).toBe(
      "/search?destination=Seoul&page=3&lat=37.5665&lng=126.978&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1",
    );
  });

  it("builds typed accommodation booking query routes", () => {
    const bookingQuery = {
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 1,
    };

    expect(routeTo.accommodationDetail(12, bookingQuery)).toBe(
      "/accommodations/12?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1",
    );
    expect(routeTo.accommodationConfirm(12, bookingQuery)).toBe(
      "/accommodations/12/confirm?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1",
    );
  });

  it("builds object query routes with URLSearchParams encoding", () => {
    expect(routeTo.accommodationEdit(12, { mode: "create" })).toBe(
      "/accommodations/12/edit?mode=create",
    );
    expect(routeTo.wishlist({ view: "recently-viewed" })).toBe(
      "/wishlist?view=recently-viewed",
    );
    expect(routeTo.wishlist({ id: 1001 })).toBe("/wishlist?id=1001");
    expect(routeTo.profile({ mode: "host", tab: "listings-published" })).toBe(
      "/profile?mode=host&tab=listings-published",
    );
  });

  it("rejects unsupported route-state query values at compile time", () => {
    // @ts-expect-error wishlist view must stay aligned with WishlistRouteView.
    routeTo.wishlist({ view: "grid/card" });
    // @ts-expect-error wishlist detail routes must be built with id, not view.
    routeTo.wishlist({ view: "wishlist-detail" });
    // @ts-expect-error wishlist detail id and recently-viewed view are mutually exclusive parser states.
    routeTo.wishlist({ id: 1001, view: "recently-viewed" });
    // @ts-expect-error profile tab must stay aligned with ProfileRouteTab.
    routeTo.profile({ mode: "host", tab: "payments" });
    // @ts-expect-error host mode must not accept guest-only tabs.
    routeTo.profile({ mode: "host", tab: "upcoming" });
    // @ts-expect-error guest mode must not accept host-only tabs.
    routeTo.profile({ mode: "guest", tab: "listings" });
    // @ts-expect-error search route queries must be typed objects.
    routeTo.search("destination=Seoul&memberId=999999");
    // @ts-expect-error search route queries must be typed objects.
    routeTo.search(new URLSearchParams("destination=Seoul"));
    // @ts-expect-error accommodation detail route queries must be typed objects.
    routeTo.accommodationDetail(12, "memberId=999999");
    // @ts-expect-error accommodation detail route queries must be typed objects.
    routeTo.accommodationDetail(12, new URLSearchParams("checkIn=2026-07-10"));
    // @ts-expect-error accommodation confirm route queries must be typed objects.
    routeTo.accommodationConfirm(12, "memberId=999999");
    // @ts-expect-error accommodation confirm route queries must be typed objects.
    routeTo.accommodationConfirm(12, new URLSearchParams("checkIn=2026-07-10"));
    // @ts-expect-error payment fail reason must stay aligned with supported recovery reasons.
    routeTo.paymentFail("rsv_123", { reason: "declined" });
  });

  it("encodes dynamic path params for route builders", () => {
    expect(routeTo.accommodationDetail("room/a b#1")).toBe(
      "/accommodations/room%2Fa%20b%231",
    );
    expect(
      routeTo.accommodationConfirm("room/a b#1", {
        checkIn: "2026-07-10",
        adultOccupancy: 2,
      }),
    ).toBe(
      "/accommodations/room%2Fa%20b%231/confirm?checkIn=2026-07-10&adultOccupancy=2",
    );
    expect(routeTo.accommodationEdit("room/a b#1", { mode: "create" })).toBe(
      "/accommodations/room%2Fa%20b%231/edit?mode=create",
    );
    expect(routeTo.hostReservationDetail("host/a b#1")).toBe(
      "/profile/host/reservations/host%2Fa%20b%231",
    );
    expect(routeTo.reservationDetail("rsv/a b#1")).toBe(
      "/reservations/rsv%2Fa%20b%231",
    );
    expect(routeTo.reviewCreate("rsv/a b#1")).toBe(
      "/reservations/rsv%2Fa%20b%231/review",
    );
    expect(routeTo.paymentSuccess("rsv/a b#1")).toBe(
      "/reservations/rsv%2Fa%20b%231/success",
    );
    expect(routeTo.paymentFail("rsv/a b#1")).toBe(
      "/reservations/rsv%2Fa%20b%231/fail",
    );
  });
});
