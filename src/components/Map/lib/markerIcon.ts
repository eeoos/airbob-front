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

const MARKER_BUBBLE_HEIGHT = 28;
const MARKER_MIN_BUBBLE_WIDTH = 60;
const MARKER_HORIZONTAL_PADDING = 12;

export const getMarkerPriceText = ({
  basePrice,
  currency,
}: MarkerPriceInput) => {
  if (currency === "KRW") {
    return `₩${basePrice.toLocaleString()}`;
  }

  return `${currency} ${basePrice.toLocaleString()}`;
};

export const getMarkerIconModel = (input: MarkerPriceInput): MarkerIconModel => {
  const priceText = getMarkerPriceText(input);
  const textWidth = priceText.length * 8 + 20;
  const bubbleWidth = Math.max(textWidth, MARKER_MIN_BUBBLE_WIDTH);
  const totalWidth = bubbleWidth + MARKER_HORIZONTAL_PADDING * 2;

  return {
    priceText,
    bubbleHeight: MARKER_BUBBLE_HEIGHT,
    totalWidth,
    anchor: {
      x: totalWidth / 2,
      y: MARKER_BUBBLE_HEIGHT,
    },
  };
};

export const buildMarkerPriceSvg = (
  model: MarkerIconModel,
  state: MarkerIconState
) => {
  const isActive = state === "selected" || state === "hovered";
  const bubbleFill = isActive ? "#222222" : "#ffffff";
  const bubbleStroke = isActive ? "#222222" : "#dddddd";
  const strokeWidth = isActive ? 2 : 1;
  const textFill = isActive ? "#ffffff" : "#222222";

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
                font-size: 14px;
                font-weight: 600;
              }
            </style>
          </defs>
          <rect class="price-bubble" x="0" y="0" width="${model.totalWidth}" height="${model.bubbleHeight}" rx="14" ry="14"/>
          <text class="price-text" x="${model.totalWidth / 2}" y="${model.bubbleHeight / 2 + 4}" text-anchor="middle" dominant-baseline="middle">${model.priceText}</text>
        </svg>
      `;
};
