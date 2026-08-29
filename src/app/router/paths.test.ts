import {
  createAccommodationEditNavigationState,
  isAccommodationEditDraftCreationState,
  ROUTE_PATHS,
  routeTo,
} from "./paths";

describe("app router paths", () => {
  it("preserves all 15 route path templates", () => {
    expect(ROUTE_PATHS).toEqual({
      home: "/",
      search: "/search",
      accommodationDetail: "/accommodations/:id",
      accommodationConfirm: "/accommodations/:id/confirm",
      accommodationEdit: "/accommodations/:id/edit",
      wishlist: "/wishlist",
      profile: "/profile",
      hostReservationDetail: "/profile/host/reservations/:reservationUid",
      reservationDetail: "/reservations/:reservationUid",
      reviewCreate: "/reservations/:reservationUid/review",
      paymentSuccess: "/reservations/:reservationUid/success",
      paymentFail: "/reservations/:reservationUid/fail",
      login: "/login",
      signup: "/signup",
      notFound: "*",
    });
  });

  it("builds static and encoded dynamic paths", () => {
    expect(routeTo.home()).toBe("/");
    expect(routeTo.search()).toBe("/search");
    expect(routeTo.wishlist()).toBe("/wishlist");
    expect(routeTo.profile()).toBe("/profile");
    expect(routeTo.login()).toBe("/login");
    expect(routeTo.signup()).toBe("/signup");
    expect(routeTo.accommodationDetail("room/a b#1")).toBe(
      "/accommodations/room%2Fa%20b%231",
    );
    expect(routeTo.accommodationConfirm("room/a b#1")).toBe(
      "/accommodations/room%2Fa%20b%231/confirm",
    );
    expect(routeTo.accommodationEdit("room/a b#1")).toBe(
      "/accommodations/room%2Fa%20b%231/edit",
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
  });

  it("preserves query key names and serialization order", () => {
    expect(
      routeTo.search({
        destination: "Seoul",
        page: 3,
        checkIn: "2026-07-10",
        adultOccupancy: 2,
      }),
    ).toBe(
      "/search?destination=Seoul&page=3&checkIn=2026-07-10&adultOccupancy=2",
    );
    expect(
      routeTo.accommodationDetail(12, {
        checkIn: "2026-07-10",
        adultOccupancy: 2,
      }),
    ).toBe(
      "/accommodations/12?checkIn=2026-07-10&adultOccupancy=2",
    );
    expect(routeTo.wishlist({ view: "recently-viewed" })).toBe(
      "/wishlist?view=recently-viewed",
    );
    expect(routeTo.profile({ mode: "host", tab: "listings-published" })).toBe(
      "/profile?mode=host&tab=listings-published",
    );
    expect(
      routeTo.paymentSuccess("reservation-123", {
        paymentKey: "key",
        orderId: "reservation-123",
        amount: 120000,
      }),
    ).toBe(
      "/reservations/reservation-123/success?paymentKey=key&orderId=reservation-123&amount=120000",
    );
    expect(
      routeTo.paymentFail("reservation-123", {
        reason: "confirm-failed",
        paymentKey: "key",
        orderId: "reservation-123",
        amount: 120000,
      }),
    ).toBe(
      "/reservations/reservation-123/fail?reason=confirm-failed&paymentKey=key&orderId=reservation-123&amount=120000",
    );
  });

  it("keeps edit draft provenance in navigation state instead of the URL", () => {
    const state = createAccommodationEditNavigationState(12);

    expect(state).toEqual({
      accommodationEdit: {
        accommodationId: "12",
        source: "created-draft",
      },
    });
    expect(isAccommodationEditDraftCreationState(state, 12)).toBe(true);
    expect(isAccommodationEditDraftCreationState(state, 13)).toBe(false);
    expect(routeTo.accommodationEdit(12)).toBe("/accommodations/12/edit");
  });
});
