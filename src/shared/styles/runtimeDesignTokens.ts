type RuntimeCssColorTokenName =
  | "--color-background-page"
  | "--color-border-default"
  | "--color-brand-coral"
  | "--color-text-primary"
  | "--color-text-inverse";

type CssVariableReference<Name extends string = string> = `var(${Name})`;
type ResolvedHexColor = `#${string}`;

interface RuntimeCssColorToken<Name extends RuntimeCssColorTokenName> {
  readonly name: Name;
  readonly reference: CssVariableReference<Name>;
  readonly resolved: ResolvedHexColor;
}

const defineColorToken = <const Name extends RuntimeCssColorTokenName>(
  name: Name,
  resolved: ResolvedHexColor,
): RuntimeCssColorToken<Name> =>
  Object.freeze({ name, reference: `var(${name})`, resolved });

/**
 * Pure runtime values for SVG and vendor renderers that cannot consume the CSS
 * cascade. Browser/CSSOM access does not belong in this module.
 */
export const RUNTIME_DESIGN_TOKENS = Object.freeze({
  color: Object.freeze({
    brand: defineColorToken("--color-brand-coral", "#ff385c"),
    border: defineColorToken("--color-border-default", "#ddd"),
    surface: defineColorToken("--color-background-page", "#fff"),
    text: defineColorToken("--color-text-primary", "#222"),
    textInverse: defineColorToken("--color-text-inverse", "#fff"),
  }),
  icon: Object.freeze({
    navigationStrokeWidth: 2,
    wishlistStrokeWidth: 1.5,
  }),
  marker: Object.freeze({
    activeStrokeWidth: 2,
    baselineOffsetPx: 4,
    bubbleHeightPx: 28,
    bubbleRadiusPx: 14,
    characterWidthPx: 8,
    defaultStrokeWidth: 1,
    fontWeight: 600,
    horizontalPaddingPx: 12,
    minimumBubbleWidthPx: 60,
    textExtraWidthPx: 20,
    textFontSizePx: 14,
  }),
});
