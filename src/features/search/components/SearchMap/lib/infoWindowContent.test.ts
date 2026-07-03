import { AccommodationSearchInfo } from "../../../../../types/accommodation";
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
    expect(html).toContain('stroke="var(--color-brand-coral)"');
  });

  it("labels raw action buttons and escapes single quotes in injected fields", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation({
        name: "O'Hare suite",
        is_in_wishlist: true,
      }),
      thumbnailUrl: "https://cdn.example.com/o'hare.jpg",
      checkIn: null,
      checkOut: null,
      canToggleWishlist: true,
    });

    expect(html).toContain('aria-label="위시리스트에서 제거"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="지도 숙소 카드 닫기"');
    expect(html).toContain("O&#39;Hare suite");
    expect(html).toContain("o&#39;hare.jpg");
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

  it("escapes API-provided text and thumbnail attributes before injecting HTML", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation({
        name: `<img src=x onerror="alert(1)">`,
        address_summary: {
          country: `KR"><script>alert(1)</script>`,
          state: null,
          city: `<Seoul>`,
          district: `Mapo & Hongdae`,
        },
      }),
      thumbnailUrl: `https://cdn.example.com/thumb.jpg" onerror="alert(1)`,
      checkIn: null,
      checkOut: null,
      canToggleWishlist: false,
    });

    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;Seoul&gt;, Mapo &amp; Hongdae");
    expect(html).toContain(
      `src="https://cdn.example.com/thumb.jpg&quot; onerror=&quot;alert(1)"`
    );
    expect(html).not.toContain(`<img src=x onerror="alert(1)">`);
    expect(html).not.toContain(`<script>alert(1)</script>`);
  });

  it("escapes non-KRW currency and fallback country text", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation({
        currency: `USD"><script>alert(1)</script>`,
        address_summary: {
          country: `<Country & Region>`,
          state: null,
          city: "",
          district: "",
        },
      }),
      thumbnailUrl: null,
      checkIn: null,
      checkOut: null,
      canToggleWishlist: false,
    });

    expect(html).toContain("&lt;Country &amp; Region&gt;");
    expect(html).toContain(
      "USD&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; 100,000"
    );
    expect(html).not.toContain(`<Country & Region>`);
    expect(html).not.toContain(`<script>alert(1)</script>`);
  });
});
