import { RUNTIME_DESIGN_TOKENS } from "../../../../../shared/styles/runtimeDesignTokens";

export type MarkerIconState = "default" | "selected" | "hovered";

export interface MarkerPriceInput {
  basePrice: number;
  currency: string;
}

export interface MarkerIconModel {
  priceText: string;
  bubbleHeight: number;
  totalWidth: number;
  anchor: {
    x: number;
    y: number;
  };
}

const MARKER_ICON_COLORS = {
  activeBackground: RUNTIME_DESIGN_TOKENS.color.text.resolved,
  activeBorder: RUNTIME_DESIGN_TOKENS.color.text.resolved,
  activeText: RUNTIME_DESIGN_TOKENS.color.textInverse.resolved,
  defaultBackground: RUNTIME_DESIGN_TOKENS.color.surface.resolved,
  defaultBorder: RUNTIME_DESIGN_TOKENS.color.border.resolved,
  defaultText: RUNTIME_DESIGN_TOKENS.color.text.resolved,
} as const;

const MARKER_GEOMETRY = RUNTIME_DESIGN_TOKENS.marker;

const getMarkerPriceText = ({ basePrice, currency }: MarkerPriceInput) => {
  if (currency === "KRW") {
    return `₩${basePrice.toLocaleString()}`;
  }

  return `${currency} ${basePrice.toLocaleString()}`;
};

export const getMarkerIconModel = (
  input: MarkerPriceInput,
): MarkerIconModel => {
  const priceText = getMarkerPriceText(input);
  const textWidth =
    priceText.length * MARKER_GEOMETRY.characterWidthPx +
    MARKER_GEOMETRY.textExtraWidthPx;
  const bubbleWidth = Math.max(textWidth, MARKER_GEOMETRY.minimumBubbleWidthPx);
  const totalWidth = bubbleWidth + MARKER_GEOMETRY.horizontalPaddingPx * 2;

  return {
    priceText,
    bubbleHeight: MARKER_GEOMETRY.bubbleHeightPx,
    totalWidth,
    anchor: {
      x: totalWidth / 2,
      y: MARKER_GEOMETRY.bubbleHeightPx,
    },
  };
};

export const buildMarkerPriceSvg = (
  model: MarkerIconModel,
  state: MarkerIconState,
) => {
  const isActive = state === "selected" || state === "hovered";
  const bubbleFill = isActive
    ? MARKER_ICON_COLORS.activeBackground
    : MARKER_ICON_COLORS.defaultBackground;
  const bubbleStroke = isActive
    ? MARKER_ICON_COLORS.activeBorder
    : MARKER_ICON_COLORS.defaultBorder;
  const strokeWidth = isActive
    ? MARKER_GEOMETRY.activeStrokeWidth
    : MARKER_GEOMETRY.defaultStrokeWidth;
  const textFill = isActive
    ? MARKER_ICON_COLORS.activeText
    : MARKER_ICON_COLORS.defaultText;

  return `
        <svg width="${model.totalWidth}" height="${model.bubbleHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style>
              .price-bubble {
                fill: ${bubbleFill};
                stroke: ${bubbleStroke};
                stroke-width: ${strokeWidth};
              }
              .price-text {
                fill: ${textFill};
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                font-size: ${MARKER_GEOMETRY.textFontSizePx}px;
                font-weight: ${MARKER_GEOMETRY.fontWeight};
              }
            </style>
          </defs>
          <rect class="price-bubble" x="0" y="0" width="${model.totalWidth}" height="${model.bubbleHeight}" rx="${MARKER_GEOMETRY.bubbleRadiusPx}" ry="${MARKER_GEOMETRY.bubbleRadiusPx}"/>
          <text class="price-text" x="${model.totalWidth / 2}" y="${model.bubbleHeight / 2 + MARKER_GEOMETRY.baselineOffsetPx}" text-anchor="middle" dominant-baseline="middle">${model.priceText}</text>
        </svg>
      `;
};
