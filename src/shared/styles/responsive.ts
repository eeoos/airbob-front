/**
 * CRA's fixed PostCSS stage cannot compile custom media, and CSS custom
 * properties are invalid inside media conditions. U14 consumers therefore use
 * contract-checked literals; U16 must enable custom-media transformation before
 * any runtime stylesheet consumes the canonical aliases.
 */
export const RESPONSIVE_BREAKPOINTS = Object.freeze({
  mobileOrTabletMaxWidthPx: 1024,
});

export const RESPONSIVE_MEDIA_QUERIES = Object.freeze({
  mobileOrTablet: `(max-width: ${RESPONSIVE_BREAKPOINTS.mobileOrTabletMaxWidthPx}px)`,
  desktop: `not all and (max-width: ${RESPONSIVE_BREAKPOINTS.mobileOrTabletMaxWidthPx}px)`,
});
