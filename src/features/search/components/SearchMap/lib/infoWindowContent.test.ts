import type { SearchMapAccommodation } from "../types";
import {
  buildInfoWindowContent,
  buildSearchMapInfoWindowContent,
  INFO_WINDOW_STYLE_TOKENS,
} from "./infoWindowContent";

const createAccommodation = (
  overrides: Partial<SearchMapAccommodation> = {}
): SearchMapAccommodation => ({
  id: 10,
  name: "테스트 숙소",
  thumbnailUrl: null,
  locationLabel: "Seoul, Mapo",
  showReview: false,
  reviewRatingLabel: "0.0",
  reviewCountLabel: "(0)",
  basePrice: 100000,
  currency: "KRW",
  isInWishlist: false,
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  ...overrides,
});

describe("info window content helper", () => {
  it("keeps repeated inline style values behind named constants", () => {
    expect(INFO_WINDOW_STYLE_TOKENS).toMatchObject({
      cardWidth: "327px",
      imageHeight: "211.94px",
      buttonWishlistSize: "28px",
      closeButtonFontSize: "20px",
      lineHeightCompact: "1.2",
      semiboldFontWeight: "600",
      textFontSize: "14px",
      brand: "var(--color-brand-coral)",
      textPrimary: "var(--color-text-primary)",
    });
  });

  it("builds planned info-window content from the vendor-neutral content model", () => {
    const html = buildSearchMapInfoWindowContent({
      accommodationId: `map-10" data-unsafe="true`,
      title: `<Ocean & Mountain "Suite">`,
      priceLabel: `USD"><script>alert(1)</script> 100`,
      imageUrl: `https://cdn.example.com/thumb.jpg" onerror="alert(1)`,
      ratingLabel: `4.9 <script>alert(1)</script>`,
      isWishlisted: false,
    });

    expect(html).toContain('id="info-window-map-10&quot; data-unsafe=&quot;true"');
    expect(html).toContain(
      'data-accommodation-id="map-10&quot; data-unsafe=&quot;true"',
    );
    expect(html).toContain("&lt;Ocean &amp; Mountain &quot;Suite&quot;&gt;");
    expect(html).toContain(
      "USD&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; 100",
    );
    expect(html).toContain(
      `src="https://cdn.example.com/thumb.jpg&quot; onerror=&quot;alert(1)"`,
    );
    expect(html).toContain("4.9 &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('fill="none"');
    expect(html).not.toContain(`<script>alert(1)</script>`);
    expect(html).not.toContain(`onclick=`);
    expect(html).not.toContain("window.closeInfoWindow");
  });

  it("renders fallback image, location, name, and nightly price without dates", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation(),
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
    expect(html).not.toContain('data-info-window-action="wishlist"');
    expect(html).not.toContain("window.toggleWishlist");
    expect(html).not.toContain("window.closeInfoWindow");
    expect(html).not.toContain("onclick=");
  });

  it("renders thumbnail image and wishlist button when enabled", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation({
        thumbnailUrl: "https://cdn.example.com/accommodations/10/thumb.jpg",
        isInWishlist: true,
      }),
      checkIn: null,
      checkOut: null,
      canToggleWishlist: true,
    });

    expect(html).toContain(
      '<img src="https://cdn.example.com/accommodations/10/thumb.jpg"'
    );
    expect(html).toContain('data-info-window-action="wishlist"');
    expect(html).toContain('data-accommodation-id="10"');
    expect(html).toContain('data-is-in-wishlist="true"');
    expect(html).not.toContain("window.toggleWishlist");
    expect(html).not.toContain("window.closeInfoWindow");
    expect(html).not.toContain("onclick=");
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('stroke="var(--color-brand-coral)"');
  });

  it("labels raw action buttons and escapes single quotes in injected fields", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation({
        name: "O'Hare suite",
        thumbnailUrl: "https://cdn.example.com/o'hare.jpg",
        isInWishlist: true,
      }),
      checkIn: null,
      checkOut: null,
      canToggleWishlist: true,
    });

    expect(html).toContain('aria-label="위시리스트에서 제거"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-info-window-action="close"');
    expect(html).toContain('aria-label="지도 숙소 카드 닫기"');
    expect(html).toContain("O&#39;Hare suite");
    expect(html).toContain("o&#39;hare.jpg");
  });

  it("renders total stay price and nights when dates are present", () => {
    const html = buildInfoWindowContent({
      accommodation: createAccommodation(),
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
      checkIn: null,
      checkOut: null,
      canToggleWishlist: false,
    });
    const withReviews = buildInfoWindowContent({
      accommodation: createAccommodation({
        showReview: true,
        reviewRatingLabel: "4.8",
        reviewCountLabel: "(12)",
      }),
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
        locationLabel: `<Seoul>, Mapo & Hongdae`,
        thumbnailUrl: `https://cdn.example.com/thumb.jpg" onerror="alert(1)`,
      }),
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
        locationLabel: `<Country & Region>`,
      }),
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
