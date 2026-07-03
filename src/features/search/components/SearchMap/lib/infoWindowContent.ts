import { AccommodationSearchInfo } from "../../../../../types/accommodation";

interface BuildInfoWindowContentInput {
  accommodation: AccommodationSearchInfo;
  thumbnailUrl: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  canToggleWishlist: boolean;
}

const escapeHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const INFO_WINDOW_TOKENS = {
  background: "var(--color-background-page)",
  backgroundMuted: "var(--color-background-muted)",
  borderRadiusLg: "var(--radius-lg)",
  borderRadiusPill: "var(--radius-pill)",
  brand: "var(--color-brand-coral)",
  buttonBackground: "rgba(255, 255, 255, 0.95)",
  shadowMd: "var(--shadow-md)",
  shadowSm: "var(--shadow-sm)",
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
} as const;

const INFO_WINDOW_FONT =
  "var(--font-family-base), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const calculateNights = (
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
) => {
  if (!checkIn || !checkOut) {
    return 1;
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 1;
};

const formatPrice = (basePrice: number, currency: string) => {
  if (currency === "KRW") {
    return `₩${basePrice.toLocaleString()}`;
  }

  return `${escapeHtml(currency)} ${basePrice.toLocaleString()}`;
};

const formatTotalPrice = (
  basePrice: number,
  nights: number,
  currency: string
) => formatPrice(basePrice * nights, currency);

const buildPriceDisplay = (
  accommodation: AccommodationSearchInfo,
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
) => {
  const nights = calculateNights(checkIn, checkOut);
  const hasDates = checkIn && checkOut;

  if (hasDates) {
    const totalPrice = formatTotalPrice(
      accommodation.base_price,
      nights,
      accommodation.currency
    );
    return `<span>${totalPrice}</span><span style="font-size: 14px; font-weight: 400; color: ${INFO_WINDOW_TOKENS.textSecondary};"> ${nights}박</span>`;
  }

  const price = formatPrice(accommodation.base_price, accommodation.currency);
  return `<span>${price}</span><span style="font-size: 14px; font-weight: 400; color: ${INFO_WINDOW_TOKENS.textSecondary};"> 1박</span>`;
};

const buildReviewDisplay = (accommodation: AccommodationSearchInfo) => {
  if (accommodation.review_summary.total_count <= 0) {
    return "";
  }

  return `<div style="display: flex; align-items: center; gap: 4px; margin-left: 8px; flex-shrink: 0;">
            <span style="font-size: 14px; color: ${INFO_WINDOW_TOKENS.textPrimary};">★</span>
            <span style="font-size: 14px; color: ${INFO_WINDOW_TOKENS.textPrimary}; font-weight: 600;">${accommodation.review_summary.average_rating.toFixed(1)}</span>
            <span style="font-size: 14px; color: ${INFO_WINDOW_TOKENS.textSecondary};">(${accommodation.review_summary.total_count})</span>
          </div>`;
};

export const buildInfoWindowContent = ({
  accommodation,
  thumbnailUrl,
  checkIn,
  checkOut,
  canToggleWishlist,
}: BuildInfoWindowContentInput) => {
  const wishlistIconColor = accommodation.is_in_wishlist
    ? INFO_WINDOW_TOKENS.brand
    : INFO_WINDOW_TOKENS.textPrimary;
  const wishlistIconFill = accommodation.is_in_wishlist ? "currentColor" : "none";
  const wishlistLabel = accommodation.is_in_wishlist
    ? "위시리스트에서 제거"
    : "위시리스트에 저장";
  const priceDisplay = buildPriceDisplay(accommodation, checkIn, checkOut);
  const reviewDisplay = buildReviewDisplay(accommodation);
  const locationText = escapeHtml(
    [
      accommodation.address_summary.city,
      accommodation.address_summary.district,
    ]
      .filter(Boolean)
      .join(", ") || accommodation.address_summary.country
  );
  const accommodationName = escapeHtml(accommodation.name);
  const escapedThumbnailUrl = thumbnailUrl ? escapeHtml(thumbnailUrl) : null;

  return `
          <div id="info-window-${accommodation.id}" style="width: 327px; font-family: ${INFO_WINDOW_FONT}; border-radius: ${INFO_WINDOW_TOKENS.borderRadiusLg}; overflow: hidden; box-shadow: ${INFO_WINDOW_TOKENS.shadowMd}; background: ${INFO_WINDOW_TOKENS.background}; margin: 0; padding: 0; cursor: pointer; display: flex; flex-direction: column;">
            <div style="position: relative; width: 327px; height: 211.94px; overflow: hidden; background-color: ${INFO_WINDOW_TOKENS.backgroundMuted};">
              ${escapedThumbnailUrl ? `<img src="${escapedThumbnailUrl}" alt="${accommodationName}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background-color: ${INFO_WINDOW_TOKENS.backgroundMuted}; color: ${INFO_WINDOW_TOKENS.textSecondary}; font-size: 14px;">이미지 없음</div>` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: ${INFO_WINDOW_TOKENS.backgroundMuted}; color: ${INFO_WINDOW_TOKENS.textSecondary}; font-size: 14px;">이미지 없음</div>`}
              <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 10;">
                ${canToggleWishlist ? `
                  <button type="button" aria-label="${wishlistLabel}" aria-pressed="${accommodation.is_in_wishlist}" onclick="event.stopPropagation(); window.toggleWishlist && window.toggleWishlist(${accommodation.id}, ${accommodation.is_in_wishlist})" style="width: 28px; height: 28px; border-radius: ${INFO_WINDOW_TOKENS.borderRadiusPill}; border: none; background: ${INFO_WINDOW_TOKENS.buttonBackground}; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: ${INFO_WINDOW_TOKENS.shadowSm};">
                    <svg viewBox="0 0 24 24" fill="${wishlistIconFill}" stroke="${wishlistIconColor}" stroke-width="1.5" style="width: 16px; height: 16px; color: ${wishlistIconColor};">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                ` : ""}
                <button type="button" aria-label="지도 숙소 카드 닫기" onclick="event.stopPropagation(); window.closeInfoWindow && window.closeInfoWindow()" style="width: 30px; height: 30px; border-radius: ${INFO_WINDOW_TOKENS.borderRadiusPill}; border: none; background: ${INFO_WINDOW_TOKENS.buttonBackground}; cursor: pointer; display: flex; align-items: center; justify-content: center; color: ${INFO_WINDOW_TOKENS.textPrimary}; font-size: 20px; line-height: 1; box-shadow: ${INFO_WINDOW_TOKENS.shadowSm};">×</button>
              </div>
            </div>
            <div style="width: 327px; padding: 12px 12px 12px 12px; background: ${INFO_WINDOW_TOKENS.background}; box-sizing: border-box; display: flex; flex-direction: column;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                <p style="margin: 0; font-size: 14px; color: ${INFO_WINDOW_TOKENS.textPrimary}; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${locationText}</p>
                ${reviewDisplay}
              </div>
              <h3 style="margin: 0 0 2px 0; font-size: 14px; font-weight: 400; color: ${INFO_WINDOW_TOKENS.textPrimary}; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${accommodationName}</h3>
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${INFO_WINDOW_TOKENS.textPrimary};">
                ${priceDisplay}
              </p>
            </div>
          </div>
        `;
};
