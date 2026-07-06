import {
  buildMapBoundsSearchParams,
  buildSearchNavigationParams,
  buildSearchRequestFromParams,
  getSearchParamsSignature,
  getViewportFromSearchParams,
  removeViewportParams,
  toSearchRouteQuery,
} from "./searchParams";
import {
  buildAccommodationDetailSearchParams,
  toAccommodationBookingRouteQuery,
} from "./accommodationDetailParams";

const date = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

describe("search params helpers", () => {
  it("builds Google Place search params with viewport and resets page", () => {
    const existing = new URLSearchParams(
      "destination=old&page=4&sort=popular&topLeftLat=1&topLeftLng=2&bottomRightLat=3&bottomRightLng=4",
    );

    const params = buildSearchNavigationParams(existing, {
      destination: "Seoul",
      selectedPlace: {
        lat: 37.5665,
        lng: 126.978,
        viewport: {
          north: 37.7,
          south: 37.4,
          east: 127.1,
          west: 126.8,
        },
      },
      checkIn: date("2026-07-10"),
      checkOut: date("2026-07-12"),
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 1,
    });

    expect(params.get("destination")).toBe("Seoul");
    expect(params.get("lat")).toBe("37.5665");
    expect(params.get("lng")).toBe("126.978");
    expect(params.get("topLeftLat")).toBe("37.7");
    expect(params.get("topLeftLng")).toBe("126.8");
    expect(params.get("bottomRightLat")).toBe("37.4");
    expect(params.get("bottomRightLng")).toBe("127.1");
    expect(params.get("checkIn")).toBe("2026-07-10");
    expect(params.get("checkOut")).toBe("2026-07-12");
    expect(params.get("adultOccupancy")).toBe("2");
    expect(params.get("childOccupancy")).toBe("1");
    expect(params.get("infantOccupancy")).toBe("0");
    expect(params.get("petOccupancy")).toBe("1");
    expect(params.get("sort")).toBeNull();
    expect(params.has("page")).toBe(false);
  });

  it("builds plain text search params by removing stale viewport and coordinates", () => {
    const existing = new URLSearchParams(
      "destination=old&page=3&lat=1&lng=2&topLeftLat=3&topLeftLng=4&bottomRightLat=5&bottomRightLng=6",
    );

    const params = buildSearchNavigationParams(existing, {
      destination: "Busan",
      selectedPlace: null,
      checkIn: null,
      checkOut: null,
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
    });

    expect(params.get("destination")).toBe("Busan");
    expect(params.has("lat")).toBe(false);
    expect(params.has("lng")).toBe(false);
    expect(params.has("topLeftLat")).toBe(false);
    expect(params.has("topLeftLng")).toBe(false);
    expect(params.has("bottomRightLat")).toBe(false);
    expect(params.has("bottomRightLng")).toBe(false);
    expect(params.has("page")).toBe(false);
    expect(params.get("adultOccupancy")).toBe("1");
    expect(params.get("childOccupancy")).toBe("0");
    expect(params.get("infantOccupancy")).toBe("0");
    expect(params.get("petOccupancy")).toBe("0");
  });

  it("does not carry unrelated route query params into search navigation", () => {
    const currentParams = new URLSearchParams(
      "mode=host&tab=reservations&id=10&view=recently-viewed&page=3&latitude=37&longitude=127",
    );

    const result = buildSearchNavigationParams(currentParams, {
      destination: "서울",
      selectedPlace: null,
      checkIn: null,
      checkOut: null,
      adultOccupancy: 2,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
    });

    expect(result.get("destination")).toBe("서울");
    expect(result.get("adultOccupancy")).toBe("2");
    expect(result.get("mode")).toBeNull();
    expect(result.get("tab")).toBeNull();
    expect(result.get("id")).toBeNull();
    expect(result.get("view")).toBeNull();
    expect(result.get("page")).toBeNull();
    expect(result.get("latitude")).toBeNull();
    expect(result.get("longitude")).toBeNull();
  });

  it("removes stale dates when a new search has no selected dates", () => {
    const existing = new URLSearchParams(
      "destination=old&checkIn=2026-07-10&checkOut=2026-07-12&page=2",
    );

    const params = buildSearchNavigationParams(existing, {
      destination: "Jeju",
      selectedPlace: null,
      checkIn: null,
      checkOut: null,
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
    });

    expect(params.get("destination")).toBe("Jeju");
    expect(params.has("checkIn")).toBe(false);
    expect(params.has("checkOut")).toBe(false);
    expect(params.has("page")).toBe(false);
  });

  it("formats local calendar dates without shifting them through UTC", () => {
    const params = buildSearchNavigationParams(new URLSearchParams(), {
      destination: "Seoul",
      selectedPlace: null,
      checkIn: new Date(2026, 6, 10),
      checkOut: new Date(2026, 6, 12),
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
    });

    expect(params.get("checkIn")).toBe("2026-07-10");
    expect(params.get("checkOut")).toBe("2026-07-12");
  });

  it("builds map bounds params by clearing destination, coordinates, and page", () => {
    const existing = new URLSearchParams(
      "destination=Seoul&lat=37&lng=127&page=2&checkIn=2026-07-10&adultOccupancy=2",
    );

    const params = buildMapBoundsSearchParams(existing, {
      north: 38,
      south: 37,
      east: 128,
      west: 126,
    });

    expect(params.get("topLeftLat")).toBe("38");
    expect(params.get("topLeftLng")).toBe("126");
    expect(params.get("bottomRightLat")).toBe("37");
    expect(params.get("bottomRightLng")).toBe("128");
    expect(params.has("destination")).toBe(false);
    expect(params.has("lat")).toBe(false);
    expect(params.has("lng")).toBe(false);
    expect(params.has("page")).toBe(false);
    expect(params.get("checkIn")).toBe("2026-07-10");
    expect(params.get("adultOccupancy")).toBe("2");
  });

  it("drops non-search route state when building map-bounds params", () => {
    const current = new URLSearchParams(
      "destination=Seoul&id=1001&view=recently-viewed&mode=host&tab=listings&page=2",
    );

    const next = buildMapBoundsSearchParams(current, {
      north: 37.6,
      south: 37.5,
      east: 127.1,
      west: 127.0,
    });

    expect(next.get("id")).toBeNull();
    expect(next.get("view")).toBeNull();
    expect(next.get("mode")).toBeNull();
    expect(next.get("tab")).toBeNull();
    expect(next.get("page")).toBeNull();
    expect(next.get("topLeftLat")).toBe("37.6");
  });

  it("keeps only booking-safe query state for accommodation detail links", () => {
    const current = new URLSearchParams(
      "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1&token=secret&email=a@example.com",
    );

    const next = buildAccommodationDetailSearchParams(current);

    expect(next.toString()).toBe(
      "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1",
    );
  });

  it("converts URLSearchParams to a search route query with only search-safe keys", () => {
    const current = new URLSearchParams(
      "destination=Seoul&page=3&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1&memberId=999999&token=secret&lat=37&lng=127",
    );

    expect(toSearchRouteQuery(current)).toEqual({
      destination: "Seoul",
      page: "3",
      lat: "37",
      lng: "127",
      topLeftLat: "38",
      topLeftLng: "126",
      bottomRightLat: "37",
      bottomRightLng: "128",
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultOccupancy: "2",
      childOccupancy: "1",
      infantOccupancy: "0",
      petOccupancy: "1",
    });
  });

  it("drops non-search params from query cache signatures", () => {
    const params = new URLSearchParams(
      "destination=Seoul&page=2&token=secret&email=a@example.com&memberId=999",
    );

    expect(getSearchParamsSignature(params)).toBe("destination=Seoul&page=2");
  });

  it("converts URLSearchParams to an accommodation booking route query", () => {
    const current = new URLSearchParams(
      "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=1&petOccupancy=1&memberId=999999",
    );

    expect(toAccommodationBookingRouteQuery(current)).toEqual({
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultOccupancy: "2",
      childOccupancy: "1",
      infantOccupancy: "1",
      petOccupancy: "1",
    });
  });

  it("builds a search API request from viewport params and ignores destination", () => {
    const params = new URLSearchParams(
      "destination=Seoul&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1&page=20",
    );

    expect(buildSearchRequestFromParams(params)).toEqual({
      topLeftLat: 38,
      topLeftLng: 126,
      bottomRightLat: 37,
      bottomRightLng: 128,
      destination: undefined,
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 1,
      page: 14,
      size: 18,
    });
  });

  it("builds a search API request from destination when viewport is absent", () => {
    const params = new URLSearchParams("destination=Jeju&page=2");

    expect(buildSearchRequestFromParams(params)).toMatchObject({
      destination: "Jeju",
      topLeftLat: undefined,
      topLeftLng: undefined,
      bottomRightLat: undefined,
      bottomRightLng: undefined,
      page: 2,
      size: 18,
    });
  });

  it("reads and removes viewport params consistently", () => {
    const params = new URLSearchParams(
      "topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&lat=37&lng=127",
    );

    expect(getViewportFromSearchParams(params)).toEqual({
      north: 38,
      west: 126,
      south: 37,
      east: 128,
    });

    const withoutViewport = removeViewportParams(params);

    expect(withoutViewport.has("topLeftLat")).toBe(false);
    expect(withoutViewport.has("topLeftLng")).toBe(false);
    expect(withoutViewport.has("bottomRightLat")).toBe(false);
    expect(withoutViewport.has("bottomRightLng")).toBe(false);
    expect(withoutViewport.get("lat")).toBe("37");
    expect(withoutViewport.get("lng")).toBe("127");
  });
});
