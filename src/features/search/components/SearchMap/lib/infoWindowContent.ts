import type { SearchMapAccommodation } from "../types";

export interface SearchMapInfoWindowContent {
  accommodationId: string;
  title: string;
  priceLabel: string;
  imageUrl?: string;
  ratingLabel?: string;
  isWishlisted: boolean;
  canToggleWishlist?: boolean;
  locationLabel?: string;
  priceSuffixLabel?: string;
  ratingSecondaryLabel?: string;
}

interface BuildInfoWindowContentInput {
  accommodation: SearchMapAccommodation;
  checkIn?: string | null;
  checkOut?: string | null;
  canToggleWishlist: boolean;
}

type SearchMapInfoWindowContentViewModel = Omit<
  SearchMapInfoWindowContent,
  "canToggleWishlist"
> & {
  canToggleWishlist: boolean;
};

const escapeHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const INFO_WINDOW_STYLE_TOKENS = {
  actionGap: "8px",
  actionInset: "12px",
  actionLayerZIndex: "10",
  background: "var(--color-background-page)",
  backgroundMuted: "var(--color-background-muted)",
  borderRadiusLg: "var(--radius-lg)",
  borderRadiusPill: "var(--radius-pill)",
  brand: "var(--color-brand-coral)",
  buttonBackground: "rgba(255, 255, 255, 0.95)",
  buttonCloseSize: "30px",
  buttonIconSize: "16px",
  buttonWishlistSize: "28px",
  cardWidth: "327px",
  contentPadding: "12px 12px 12px 12px",
  imageHeight: "211.94px",
  closeButtonFontSize: "20px",
  lineHeightCompact: "1.2",
  lineHeightTight: "1",
  locationMarginBottom: "2px",
  normalFontWeight: "400",
  ratingGap: "4px",
  ratingMarginLeft: "8px",
  semiboldFontWeight: "600",
  shadowMd: "var(--shadow-md)",
  shadowSm: "var(--shadow-sm)",
  textFontSize: "14px",
  textPrimary: "var(--color-text-primary)",
  textSecondary: "var(--color-text-secondary)",
} as const;

const INFO_WINDOW_FONT =
  "var(--font-family-base), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const calculateNights = (
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
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

  return `${currency} ${basePrice.toLocaleString()}`;
};

const formatTotalPrice = (
  basePrice: number,
  nights: number,
  currency: string,
) => formatPrice(basePrice * nights, currency);

const buildPriceDisplay = (
  accommodation: SearchMapAccommodation,
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
) => {
  const nights = calculateNights(checkIn, checkOut);
  const hasDates = checkIn && checkOut;

  if (hasDates) {
    return {
      priceLabel: formatTotalPrice(
        accommodation.basePrice,
        nights,
        accommodation.currency,
      ),
      priceSuffixLabel: `${nights}박`,
    };
  }

  return {
    priceLabel: formatPrice(accommodation.basePrice, accommodation.currency),
    priceSuffixLabel: "1박",
  };
};

const buildReviewLabels = (accommodation: SearchMapAccommodation) => {
  if (!accommodation.showReview) {
    return undefined;
  }

  return {
    ratingLabel: accommodation.reviewRatingLabel,
    ratingSecondaryLabel: accommodation.reviewCountLabel,
  };
};

const buildSearchMapInfoWindowContentView = ({
  accommodationId,
  title,
  priceLabel,
  priceSuffixLabel,
  imageUrl,
  locationLabel,
  ratingLabel,
  ratingSecondaryLabel,
  isWishlisted,
  canToggleWishlist,
}: SearchMapInfoWindowContentViewModel) => {
  const wishlistIconColor = isWishlisted
    ? INFO_WINDOW_STYLE_TOKENS.brand
    : INFO_WINDOW_STYLE_TOKENS.textPrimary;
  const wishlistIconFill = isWishlisted ? "currentColor" : "none";
  const wishlistLabel = isWishlisted
    ? "위시리스트에서 제거"
    : "위시리스트에 저장";
  const escapedAccommodationId = escapeHtml(accommodationId);
  const escapedTitle = escapeHtml(title);
  const escapedPriceLabel = escapeHtml(priceLabel);
  const escapedPriceSuffixLabel = priceSuffixLabel
    ? escapeHtml(priceSuffixLabel)
    : null;
  const escapedImageUrl = imageUrl ? escapeHtml(imageUrl) : null;
  const escapedLocationLabel = locationLabel ? escapeHtml(locationLabel) : null;
  const escapedRatingLabel = ratingLabel ? escapeHtml(ratingLabel) : null;
  const escapedRatingSecondaryLabel = ratingSecondaryLabel
    ? escapeHtml(ratingSecondaryLabel)
    : null;

  return `
          <div id="info-window-${escapedAccommodationId}" style="width: ${INFO_WINDOW_STYLE_TOKENS.cardWidth}; font-family: ${INFO_WINDOW_FONT}; border-radius: ${INFO_WINDOW_STYLE_TOKENS.borderRadiusLg}; overflow: hidden; box-shadow: ${INFO_WINDOW_STYLE_TOKENS.shadowMd}; background: ${INFO_WINDOW_STYLE_TOKENS.background}; margin: 0; padding: 0; cursor: pointer; display: flex; flex-direction: column;">
            <div style="position: relative; width: ${INFO_WINDOW_STYLE_TOKENS.cardWidth}; height: ${INFO_WINDOW_STYLE_TOKENS.imageHeight}; overflow: hidden; background-color: ${INFO_WINDOW_STYLE_TOKENS.backgroundMuted};">
              ${escapedImageUrl ? `<img src="${escapedImageUrl}" alt="${escapedTitle}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background-color: ${INFO_WINDOW_STYLE_TOKENS.backgroundMuted}; color: ${INFO_WINDOW_STYLE_TOKENS.textSecondary}; font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize};">이미지 없음</div>` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: ${INFO_WINDOW_STYLE_TOKENS.backgroundMuted}; color: ${INFO_WINDOW_STYLE_TOKENS.textSecondary}; font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize};">이미지 없음</div>`}
              <div style="position: absolute; top: ${INFO_WINDOW_STYLE_TOKENS.actionInset}; right: ${INFO_WINDOW_STYLE_TOKENS.actionInset}; display: flex; gap: ${INFO_WINDOW_STYLE_TOKENS.actionGap}; z-index: ${INFO_WINDOW_STYLE_TOKENS.actionLayerZIndex};">
                ${canToggleWishlist ? `
                  <button type="button" aria-label="${wishlistLabel}" aria-pressed="${isWishlisted}" data-info-window-action="wishlist" data-accommodation-id="${escapedAccommodationId}" data-is-in-wishlist="${isWishlisted}" style="width: ${INFO_WINDOW_STYLE_TOKENS.buttonWishlistSize}; height: ${INFO_WINDOW_STYLE_TOKENS.buttonWishlistSize}; border-radius: ${INFO_WINDOW_STYLE_TOKENS.borderRadiusPill}; border: none; background: ${INFO_WINDOW_STYLE_TOKENS.buttonBackground}; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: ${INFO_WINDOW_STYLE_TOKENS.shadowSm};">
                    <svg viewBox="0 0 24 24" fill="${wishlistIconFill}" stroke="${wishlistIconColor}" stroke-width="1.5" style="width: ${INFO_WINDOW_STYLE_TOKENS.buttonIconSize}; height: ${INFO_WINDOW_STYLE_TOKENS.buttonIconSize}; color: ${wishlistIconColor};">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                ` : ""}
                <button type="button" aria-label="지도 숙소 카드 닫기" data-info-window-action="close" style="width: ${INFO_WINDOW_STYLE_TOKENS.buttonCloseSize}; height: ${INFO_WINDOW_STYLE_TOKENS.buttonCloseSize}; border-radius: ${INFO_WINDOW_STYLE_TOKENS.borderRadiusPill}; border: none; background: ${INFO_WINDOW_STYLE_TOKENS.buttonBackground}; cursor: pointer; display: flex; align-items: center; justify-content: center; color: ${INFO_WINDOW_STYLE_TOKENS.textPrimary}; font-size: ${INFO_WINDOW_STYLE_TOKENS.closeButtonFontSize}; line-height: ${INFO_WINDOW_STYLE_TOKENS.lineHeightTight}; box-shadow: ${INFO_WINDOW_STYLE_TOKENS.shadowSm};">×</button>
              </div>
            </div>
            <div style="width: ${INFO_WINDOW_STYLE_TOKENS.cardWidth}; padding: ${INFO_WINDOW_STYLE_TOKENS.contentPadding}; background: ${INFO_WINDOW_STYLE_TOKENS.background}; box-sizing: border-box; display: flex; flex-direction: column;">
              ${escapedLocationLabel || escapedRatingLabel ? `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${INFO_WINDOW_STYLE_TOKENS.locationMarginBottom};">
                ${escapedLocationLabel ? `<p style="margin: 0; font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize}; color: ${INFO_WINDOW_STYLE_TOKENS.textPrimary}; font-weight: ${INFO_WINDOW_STYLE_TOKENS.semiboldFontWeight}; line-height: ${INFO_WINDOW_STYLE_TOKENS.lineHeightCompact}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapedLocationLabel}</p>` : `<span style="flex: 1;"></span>`}
                ${escapedRatingLabel ? `<div style="display: flex; align-items: center; gap: ${INFO_WINDOW_STYLE_TOKENS.ratingGap}; margin-left: ${INFO_WINDOW_STYLE_TOKENS.ratingMarginLeft}; flex-shrink: 0;">
                  <span style="font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize}; color: ${INFO_WINDOW_STYLE_TOKENS.textPrimary};">★</span>
                  <span style="font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize}; color: ${INFO_WINDOW_STYLE_TOKENS.textPrimary}; font-weight: ${INFO_WINDOW_STYLE_TOKENS.semiboldFontWeight};">${escapedRatingLabel}</span>
                  ${escapedRatingSecondaryLabel ? `<span style="font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize}; color: ${INFO_WINDOW_STYLE_TOKENS.textSecondary};">${escapedRatingSecondaryLabel}</span>` : ""}
                </div>` : ""}
              </div>` : ""}
              <h3 style="margin: 0 0 ${INFO_WINDOW_STYLE_TOKENS.locationMarginBottom} 0; font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize}; font-weight: ${INFO_WINDOW_STYLE_TOKENS.normalFontWeight}; color: ${INFO_WINDOW_STYLE_TOKENS.textPrimary}; line-height: ${INFO_WINDOW_STYLE_TOKENS.lineHeightCompact}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapedTitle}</h3>
              <p style="margin: 0; font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize}; font-weight: ${INFO_WINDOW_STYLE_TOKENS.semiboldFontWeight}; color: ${INFO_WINDOW_STYLE_TOKENS.textPrimary};">
                <span>${escapedPriceLabel}</span>${escapedPriceSuffixLabel ? `<span style="font-size: ${INFO_WINDOW_STYLE_TOKENS.textFontSize}; font-weight: ${INFO_WINDOW_STYLE_TOKENS.normalFontWeight}; color: ${INFO_WINDOW_STYLE_TOKENS.textSecondary};"> ${escapedPriceSuffixLabel}</span>` : ""}
              </p>
            </div>
          </div>
        `;
};

export const buildSearchMapInfoWindowContent = (
  content: SearchMapInfoWindowContent,
) =>
  buildSearchMapInfoWindowContentView({
    ...content,
    canToggleWishlist: content.canToggleWishlist ?? true,
  });

export const buildInfoWindowContent = ({
  accommodation,
  checkIn,
  checkOut,
  canToggleWishlist,
}: BuildInfoWindowContentInput) => {
  const priceDisplay = buildPriceDisplay(accommodation, checkIn, checkOut);
  const reviewLabels = buildReviewLabels(accommodation);

  return buildSearchMapInfoWindowContent({
    accommodationId: String(accommodation.id),
    title: accommodation.name,
    priceLabel: priceDisplay.priceLabel,
    priceSuffixLabel: priceDisplay.priceSuffixLabel,
    imageUrl: accommodation.thumbnailUrl ?? undefined,
    ratingLabel: reviewLabels?.ratingLabel,
    ratingSecondaryLabel: reviewLabels?.ratingSecondaryLabel,
    locationLabel: accommodation.locationLabel,
    isWishlisted: accommodation.isInWishlist,
    canToggleWishlist,
  });
};
