import { AccommodationSearchInfo } from "../../../types/accommodation";
import { buildInfoWindowContent } from "./infoWindowContent";

const createAccommodation = (
  overrides: Partial<AccommodationSearchInfo> = {}
): AccommodationSearchInfo => ({
  id: 10,
  name: "테스트 숙소",
  accommodation_thumbnail_url: null,
  base_price: 100000,
  currency: "KRW",
  type: "APARTMENT",
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo",
  },
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
  is_in_wishlist: false,
  ...overrides,
});

describe("info window content helper", () => {
  it("renders fallback image, location, name, and nightly price without dates", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation(),
      thumbnailUrl: null,
      checkIn: null,
      checkOut: null,
      canToggleWishlist: false,
    });

    expect(html).toContain('id="info-window-10"');
    expect(html).toContain("이미지 없음");
    expect(html).toContain("Seoul, Mapo");
    expect(html).toContain("테스트 숙소");
    expect(html).toContain("₩100,000");
    expect(html).toContain("1박");
    expect(html).not.toContain("window.toggleWishlist");
  });

  it("renders thumbnail image and wishlist button when enabled", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation({
        accommodation_thumbnail_url: "accommodations/10/thumb.jpg",
        is_in_wishlist: true,
      }),
      thumbnailUrl: "https://cdn.example.com/accommodations/10/thumb.jpg",
      checkIn: null,
      checkOut: null,
      canToggleWishlist: true,
    });

    expect(html).toContain(
      '<img src="https://cdn.example.com/accommodations/10/thumb.jpg"'
    );
    expect(html).toContain("window.toggleWishlist && window.toggleWishlist(10, true)");
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('stroke="#ff385c"');
  });

  it("renders total stay price and nights when dates are present", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation(),
      thumbnailUrl: null,
      checkIn: "2026-07-10",
      checkOut: "2026-07-13",
      canToggleWishlist: false,
    });

    expect(html).toContain("₩300,000");
    expect(html).toContain("3박");
  });

  it("renders review summary only when reviews exist", () => {
    const withoutReviews = buildInfoWindowContent({
      accommodation: createAccommodation(),
      thumbnailUrl: null,
      checkIn: null,
      checkOut: null,
      canToggleWishlist: false,
    });
    const withReviews = buildInfoWindowContent({
      accommodation: createAccommodation({
        review_summary: {
          total_count: 12,
          average_rating: 4.75,
        },
      }),
      thumbnailUrl: null,
      checkIn: null,
      checkOut: null,
      canToggleWishlist: false,
    });

    expect(withoutReviews).not.toContain("★");
    expect(withReviews).toContain("★");
    expect(withReviews).toContain("4.8");
    expect(withReviews).toContain("(12)");
  });
});
