import {
  accommodationBookingCodec,
  searchCodec,
  serializeAccommodationBookingRouteQuery,
  serializeSearchRouteQuery,
} from "./searchCodec";

describe("accommodationBookingCodec", () => {
  it("parses only validated booking inputs with stable defaults", () => {
    expect(
      accommodationBookingCodec.parse(
        "?token=secret&checkIn=2026-07-10&checkOut=2026-02-30&adultOccupancy=3&childOccupancy=-1&infantOccupancy=2&petOccupancy=invalid",
      ),
    ).toEqual({
      checkIn: "2026-07-10",
      adultOccupancy: 3,
      childOccupancy: 0,
      infantOccupancy: 2,
      petOccupancy: 0,
    });
  });

  it("picks and canonicalizes only booking-owned keys in fixed order", () => {
    const input =
      "petOccupancy=1&destination=Seoul&adultOccupancy=2&checkOut=2026-07-12&checkIn=2026-07-10&token=secret";

    expect(accommodationBookingCodec.pick(input).toString()).toBe(
      "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&petOccupancy=1",
    );
    expect(accommodationBookingCodec.canonicalize(input)).toBe(
      "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=0&infantOccupancy=0&petOccupancy=1",
    );
  });
});

describe("searchCodec", () => {
  it("parses the current valid search URL state", () => {
    expect(
      searchCodec.parse(
        "?destination=Seoul&page=3&lat=37.5665&lng=126.978&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1",
      ),
    ).toEqual({
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
    });
  });

  it.each([
    ["page=2suffix", 2],
    ["page=1.9", 1],
    ["page=-10", 0],
    ["page=99", 14],
    ["page=invalid", 0],
    ["", 0],
  ])("preserves current parseInt and clamp behavior for %s", (query, page) => {
    expect(searchCodec.parse(query).page).toBe(page);
  });

  it("normalizes invalid dates, guest counts, and partial coordinates", () => {
    expect(
      searchCodec.parse(
        "destination=Jeju&lat=37&topLeftLat=38&topLeftLng=126&bottomRightLat=37&checkIn=2026-02-30&checkOut=2026-07-12&adultOccupancy=2x&childOccupancy=-1&infantOccupancy=1.5&petOccupancy=9007199254740992",
      ),
    ).toEqual({
      destination: "Jeju",
      page: 0,
      checkOut: "2026-07-12",
      adultOccupancy: 1,
      childOccupancy: 0,
      infantOccupancy: 0,
      petOccupancy: 0,
    });
  });

  it("serializes route input in the existing fixed key order", () => {
    expect(
      serializeSearchRouteQuery({
        petOccupancy: 1,
        bottomRightLng: 128,
        destination: "서울 / 강남",
        adultOccupancy: 2,
        page: 3,
        lat: 37.5,
        lng: 127,
        topLeftLat: 38,
        topLeftLng: 126,
        bottomRightLat: 37,
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        childOccupancy: 1,
        infantOccupancy: 0,
      }).toString(),
    ).toBe(
      "destination=%EC%84%9C%EC%9A%B8+%2F+%EA%B0%95%EB%82%A8&page=3&lat=37.5&lng=127&topLeftLat=38&topLeftLng=126&bottomRightLat=37&bottomRightLng=128&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1",
    );
  });

  it("canonicalizes equivalent queries independently of insertion order", () => {
    const first = new URLSearchParams();
    first.set("petOccupancy", "1");
    first.set("destination", "Seoul");
    first.set("page", "3");
    first.set("adultOccupancy", "2");

    const second = new URLSearchParams();
    second.set("adultOccupancy", "2");
    second.set("page", "3");
    second.set("destination", "Seoul");
    second.set("petOccupancy", "1");

    expect(searchCodec.canonicalize(first)).toBe(
      searchCodec.canonicalize(second),
    );
    expect(searchCodec.canonicalize(first)).toBe(
      "destination=Seoul&page=3&adultOccupancy=2&childOccupancy=0&infantOccupancy=0&petOccupancy=1",
    );
  });

  it("picks only supported route parameters without injecting defaults", () => {
    expect(
      searchCodec
        .pick("token=secret&adultOccupancy=2&destination=Seoul&empty=&page=3")
        .toString(),
    ).toBe("destination=Seoul&page=3&adultOccupancy=2");
  });

  it("round-trips normalized state", () => {
    const parsed = searchCodec.parse(
      "destination=Busan&page=50&checkIn=2026-07-10&adultOccupancy=3",
    );

    expect(searchCodec.parse(searchCodec.serialize(parsed))).toEqual(parsed);
  });

  it("keeps booking-only serialization order", () => {
    expect(
      serializeAccommodationBookingRouteQuery({
        petOccupancy: 1,
        adultOccupancy: 2,
        checkOut: "2026-07-12",
        checkIn: "2026-07-10",
      }).toString(),
    ).toBe(
      "checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&petOccupancy=1",
    );
  });
});
