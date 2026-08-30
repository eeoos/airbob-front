import {
  buildAccommodationBookingRouteSearchParams,
  buildPaymentFailRouteSearchParams,
  buildPaymentSuccessRouteSearchParams,
  buildProfileRouteQuerySearchParams,
  buildSearchRouteSearchParams,
  buildWishlistRouteQuerySearchParams,
  parsePaymentFailReason,
} from "./routeQueryContracts";

describe("route query contracts", () => {
  it("builds accommodation booking query params in route-owned key order", () => {
    expect(
      buildAccommodationBookingRouteSearchParams({
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        adultOccupancy: 2,
        childOccupancy: 1,
        infantOccupancy: 0,
        petOccupancy: 1,
      }).toString(),
    ).toBe(
      "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1",
    );
  });

  it("builds search query params with viewport and booking state", () => {
    expect(
      buildSearchRouteSearchParams({
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
      }).toString(),
    ).toBe(
      "destination=Seoul&page=3&lat=37.5665&lng=126.978&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1",
    );
  });

  it("builds wishlist query params for list states", () => {
    expect(buildWishlistRouteQuerySearchParams({ id: 1001 }).toString()).toBe(
      "id=1001",
    );
    expect(
      buildWishlistRouteQuerySearchParams({
        view: "recently-viewed",
      }).toString(),
    ).toBe("view=recently-viewed");
  });

  it("builds profile query params for role-scoped tabs", () => {
    expect(
      buildProfileRouteQuerySearchParams({
        mode: "host",
        tab: "listings-published",
      }).toString(),
    ).toBe("mode=host&tab=listings-published");
  });

  it("parses supported payment failure reasons", () => {
    expect(parsePaymentFailReason("confirm-failed")).toBe("confirm-failed");
    expect(parsePaymentFailReason("invalid-callback")).toBe(
      "invalid-callback",
    );
  });

  it("ignores missing or unsupported payment failure reasons", () => {
    expect(parsePaymentFailReason(null)).toBeUndefined();
    expect(parsePaymentFailReason("declined")).toBeUndefined();
    expect(parsePaymentFailReason("")).toBeUndefined();
  });

  it("builds payment fail reasons without callback credentials", () => {
    expect(
      buildPaymentFailRouteSearchParams({
        reason: "confirm-failed",
      }).toString(),
    ).toBe("reason=confirm-failed");
    expect(
      buildPaymentFailRouteSearchParams({
        reason: "invalid-callback",
      }).toString(),
    ).toBe("reason=invalid-callback");
  });

  it("builds Toss success callback query values through the route contract", () => {
    expect(
      buildPaymentSuccessRouteSearchParams({
        amount: 120000,
        orderId: "reservation-123",
        paymentKey: "payment/key 1",
      }).toString(),
    ).toBe(
      "paymentKey=payment%2Fkey+1&orderId=reservation-123&amount=120000",
    );
  });
});
