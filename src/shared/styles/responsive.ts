const RESPONSIVE_BREAKPOINTS_PX = Object.freeze({
  phoneMax: 480,
  tabletMax: 768,
  tabletUpMin: 769,
  mobileOrTabletMax: 1024,
  desktopProtectedMin: 1025,
  compactMax: 1200,
  wideMax: 1400,
});

export const RESPONSIVE_MEDIA_QUERIES = Object.freeze({
  phone: `(max-width: ${RESPONSIVE_BREAKPOINTS_PX.phoneMax}px)`,
  tablet: `(max-width: ${RESPONSIVE_BREAKPOINTS_PX.tabletMax}px)`,
  tabletUp: `(min-width: ${RESPONSIVE_BREAKPOINTS_PX.tabletUpMin}px)`,
  mobileOrTablet: `(max-width: ${RESPONSIVE_BREAKPOINTS_PX.mobileOrTabletMax}px)`,
  desktop: `not all and (max-width: ${RESPONSIVE_BREAKPOINTS_PX.mobileOrTabletMax}px)`,
  compact: `(max-width: ${RESPONSIVE_BREAKPOINTS_PX.compactMax}px)`,
  wide: `(max-width: ${RESPONSIVE_BREAKPOINTS_PX.wideMax}px)`,
});
