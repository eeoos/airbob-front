import type { AccommodationDetailWire } from "./contracts";
import {
  createAccommodationDetailApi,
  type AccommodationDetailApiTransport,
} from "./accommodationDetailApi";

const detailWire: AccommodationDetailWire = {
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "HOUSE",
  base_price: 100000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: [],
  is_in_wishlist: false,
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: null,
  },
  coordinate: { latitude: null, longitude: null },
  host: { id: 1, nickname: "host", thumbnail_image_url: null },
  policy: { max_occupancy: 4, infant_occupancy: 1, pet_occupancy: 0 },
  amenities: [],
  images: [],
  review_summary: { total_count: 0, average_rating: 0 },
};

describe("accommodation detail API adapter", () => {
  it("preserves GET path, omits query/body, forwards AbortSignal, and maps the wire result", async () => {
    const transport = vi.fn().mockResolvedValue(detailWire);
    const api = createAccommodationDetailApi(
      transport as AccommodationDetailApiTransport,
    );
    const signal = new AbortController().signal;

    await expect(api.getDetail(7, { signal })).resolves.toMatchObject({
      id: 7,
      basePrice: 100000,
      isInWishlist: false,
      policy: { maxOccupancy: 4 },
    });

    expect(transport).toHaveBeenCalledWith({
      method: "GET",
      path: "/accommodations/7",
      signal,
    });
    expect(transport.mock.calls.at(0)?.at(0)).not.toHaveProperty("body");
    expect(transport.mock.calls.at(0)?.at(0)).not.toHaveProperty("params");
  });
});
