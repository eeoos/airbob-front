const fs = require("node:fs");
const path = require("node:path");
const { createTargetPolicy } = require("./target-policy.cjs");

const tokenLayerPolicies = Object.freeze([
  Object.freeze({
    name: "primitive",
    path: "src/shared/styles/tokens/primitive.css",
    tokenNames: Object.freeze([
      "--palette-neutral-1000",
      "--palette-neutral-950",
      "--palette-neutral-700",
      "--palette-neutral-600",
      "--palette-neutral-500",
      "--palette-neutral-350",
      "--palette-neutral-200",
      "--palette-neutral-150",
      "--palette-neutral-100",
      "--palette-neutral-75",
      "--palette-neutral-50",
      "--palette-neutral-0",
      "--palette-coral-400",
      "--palette-coral-500",
      "--palette-coral-600",
      "--palette-teal-500",
      "--palette-teal-600",
      "--palette-rust-600",
      "--palette-mint-50",
      "--palette-rose-50",
      "--palette-amber-50",
      "--palette-amber-800",
      "--palette-black-a08",
      "--palette-black-a12",
      "--palette-black-a15",
      "--palette-black-a18",
      "--palette-black-a24",
      "--palette-black-a45",
      "--palette-black-a70",
      "--palette-white-a50",
      "--palette-white-a90",
      "--space-1",
      "--space-2",
      "--space-3",
      "--space-4",
      "--space-5",
      "--space-6",
      "--space-7",
      "--space-8",
      "--space-10",
      "--space-11",
      "--space-12",
      "--space-16",
      "--motion-duration-fast",
      "--motion-duration-base",
      "--motion-duration-slow",
      "--motion-ease-standard",
      "--font-family-base",
      "--font-size-xs",
      "--font-size-sm",
      "--font-size-md",
      "--font-size-lg",
      "--font-size-xl",
      "--font-size-2xl",
      "--radius-xs",
      "--radius-sm",
      "--radius-6",
      "--radius-md",
      "--radius-lg",
      "--radius-xl",
      "--radius-2xl",
      "--radius-pill",
      "--elevation-1",
      "--elevation-2",
      "--elevation-3",
      "--elevation-4",
      "--elevation-5",
      "--elevation-6",
      "--elevation-7",
      "--elevation-8",
      "--stack-0",
      "--stack-1",
      "--stack-2",
      "--stack-1000",
      "--stack-1100",
      "--stack-2000",
      "--stack-2001",
      "--stack-3000",
      "--stack-4000",
      "--stack-5000",
      "--stack-6000",
      "--size-px-80",
      "--size-px-89",
      "--size-px-130",
      "--size-px-144",
      "--size-px-1120",
      "--size-vw-100",
      "--size-vh-90",
      "--size-vh-100",
      "--environment-safe-area-bottom",
      "--ratio-square",
      "--breakpoint-tablet",
      "--breakpoint-desktop",
      "--breakpoint-wide",
    ]),
  }),
  Object.freeze({
    name: "semantic",
    path: "src/shared/styles/tokens/semantic.css",
    tokenNames: Object.freeze([
      "--color-text-primary",
      "--color-text-secondary",
      "--color-text-inverse",
      "--color-text-strong",
      "--color-background-page",
      "--color-background-muted",
      "--color-background-hover",
      "--color-border-default",
      "--color-border-subtle",
      "--color-border-strong",
      "--color-brand-coral",
      "--color-brand-coral-gradient-end",
      "--color-brand-coral-hover",
      "--color-success",
      "--color-success-hover",
      "--color-danger",
      "--color-status-success-bg",
      "--color-status-danger-bg",
      "--color-status-warning-bg",
      "--color-status-warning-text",
      "--color-scrollbar-track",
      "--color-scrollbar-thumb",
      "--color-scrollbar-thumb-hover",
      "--shadow-sm",
      "--shadow-md",
      "--shadow-lg",
      "--focus-ring",
      "--z-header",
      "--z-sticky",
      "--z-dropdown",
      "--z-dropdown-raised",
      "--z-popover",
      "--z-bottom-sheet",
      "--z-modal",
      "--z-toast",
      "--z-local-base",
      "--z-local-raised",
      "--z-local-overlay",
      "--overlay-backdrop",
      "--overlay-scrim-strong",
      "--overlay-surface-strong",
      "--overlay-surface-muted",
    ]),
  }),
  Object.freeze({
    name: "components",
    path: "src/shared/styles/tokens/components.css",
    tokenNames: Object.freeze([
      "--control-height-sm",
      "--control-height-md",
      "--control-height-lg",
      "--control-touch-target",
      "--radius-control",
      "--shadow-control",
      "--shadow-card",
      "--shadow-modal",
      "--shadow-bottom-sheet",
      "--layout-viewport-width",
      "--layout-viewport-height",
      "--layout-page-max-width",
      "--layout-page-padding-x",
      "--layout-header-desktop-height",
      "--layout-header-mobile-height",
      "--layout-edit-header-height",
      "--layout-modal-max-height",
      "--layout-search-mobile-popover-top",
      "--layout-search-mobile-bottom-sheet-offset",
      "--layout-mobile-safe-bottom",
      "--card-media-ratio",
    ]),
  }),
]);

const primitiveTokenStylePaths = Object.freeze([tokenLayerPolicies[0].path]);

const derivedTokenStylePaths = Object.freeze(
  tokenLayerPolicies.slice(1).map(({ path: tokenPath }) => tokenPath),
);

const canonicalTokenStylePaths = Object.freeze([
  ...primitiveTokenStylePaths,
  ...derivedTokenStylePaths,
  "src/shared/styles/custom-media.css",
]);

const architectureLayerStyleGlobs = Object.freeze([
  "src/app/**/*.css",
  "src/screens/**/*.css",
  "src/workflows/**/*.css",
  "src/platform/**/*.css",
  "src/shared/**/*.css",
]);

const preExistingStrictStylePaths = Object.freeze([
  "src/app/header/Header.module.css",
  "src/app/header/UserMenu.module.css",
  "src/features/wishlist/components/WishlistViews.module.css",
  "src/features/auth/components/AuthModal/AuthModal.module.css",
]);

const legacyDesignProtectedStylePaths = Object.freeze([
  "src/shared/ui/Button/Button.module.css",
  "src/shared/ui/Card/Card.module.css",
  "src/shared/ui/ClickableCard/ClickableCard.module.css",
  "src/shared/ui/CounterStepper/CounterStepper.module.css",
  "src/shared/ui/Dialog/Dialog.module.css",
  "src/shared/ui/IconButton/IconButton.module.css",
  "src/shared/ui/StateView/StateView.module.css",
  "src/shared/ui/StatusBadge/StatusBadge.module.css",
  "src/shared/ui/Tabs/Tabs.module.css",
  "src/shared/ui/TextField/TextField.module.css",
  "src/shared/ui/ToastHost/ToastHost.module.css",
  "src/shared/ui/DatePicker/DatePicker.module.css",
  "src/app/errors/ErrorBoundary.module.css",
  "src/features/wishlist/components/CreateWishlistModal/CreateWishlistModal.module.css",
  "src/features/wishlist/components/WishlistModal/WishlistModal.module.css",
  "src/features/reviews/components/ReviewModal/ReviewModal.module.css",
  "src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.module.css",
  "src/screens/reservation-confirm/ReservationConfirmScreen.module.css",
  "src/screens/payment-result/PaymentResultScreen.module.css",
  "src/features/search/components/SearchAccommodationCard.module.css",
  "src/screens/search/SearchScreen.module.css",
  "src/features/profile/components/ProfileShell.module.css",
  "src/features/profile/HostListingsPanel.module.css",
  "src/screens/accommodation-detail/AccommodationDetailScreen.module.css",
  "src/features/accommodations/detail/components/AccommodationBookingCard.module.css",
  "src/features/accommodations/detail/components/AccommodationHero.module.css",
  "src/features/accommodations/detail/components/AccommodationLocationSection.module.css",
  "src/features/accommodations/detail/components/AccommodationOverview.module.css",
  "src/features/accommodations/detail/components/AccommodationReviewsSection.module.css",
  "src/features/accommodations/detail/components/AccommodationDescriptionModal.module.css",
  "src/features/accommodations/detail/components/AccommodationImageGalleryModal.module.css",
  "src/features/search/components/SearchBar/SearchBar.module.css",
  "src/app/header/Header.module.css",
  "src/app/header/UserMenu.module.css",
  "src/features/wishlist/components/WishlistViews.module.css",
  "src/features/auth/components/AuthModal/AuthModal.module.css",
]);

const highRiskPreRedesignStylePaths = Object.freeze([
  "src/features/reservations/GuestTripsPanel.module.css",
  "src/features/reservations/HostReservationsPanel.module.css",
  "src/screens/reservation-detail/GuestReservationDetailScreen.module.css",
  "src/screens/reservation-detail/HostReservationDetailScreen.module.css",
  "src/screens/review-create/ReviewCreateScreen.module.css",
  "src/features/profile/components/ProfileShell.module.css",
  "src/features/profile/HostListingsPanel.module.css",
  "src/screens/accommodation-edit/components/EditForm.module.css",
  "src/screens/accommodation-edit/components/EditModal.module.css",
  "src/screens/accommodation-edit/components/EditWizardLayout.module.css",
  "src/screens/accommodation-edit/components/PhotosStep.module.css",
  "src/screens/accommodation-edit/components/TimeStep.module.css",
  "src/features/accommodations/detail/components/AccommodationBookingCard.module.css",
  "src/features/accommodations/detail/components/AccommodationHero.module.css",
  "src/features/accommodations/detail/components/AccommodationLocationSection.module.css",
  "src/features/accommodations/detail/components/AccommodationOverview.module.css",
]);

const protectedDesignLiteralStylePaths = Object.freeze([
  ...new Set([
    ...legacyDesignProtectedStylePaths,
    ...highRiskPreRedesignStylePaths,
  ]),
]);

const vendorIntegrationStyleRoot = "src/platform/integrations";
const vendorStyleSuffix = ".vendor.css";
const vendorImportantOverrideGlobs = Object.freeze([
  `${vendorIntegrationStyleRoot}/**/*${vendorStyleSuffix}`,
]);
const isVendorImportantOverridePath = (filePath) => {
  const projectPath = String(filePath).replaceAll("\\", "/");

  return (
    projectPath.startsWith(`${vendorIntegrationStyleRoot}/`) &&
    projectPath.endsWith(vendorStyleSuffix)
  );
};

const allowedBreakpointValues = Object.freeze([
  "480px",
  "768px",
  "769px",
  "1024px",
  "1025px",
  "1200px",
  "1400px",
]);

const collectStylePaths = (projectRoot, directory) => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectStylePaths(projectRoot, entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".css")
      ? [path.relative(projectRoot, entryPath).replaceAll("\\", "/")]
      : [];
  });
};

const createStylePolicy = ({ projectRoot }) => {
  const targetPolicy = createTargetPolicy({ projectRoot });
  const strictMigratedStylePaths = Object.freeze(
    collectStylePaths(projectRoot, path.join(projectRoot, "src/features"))
      .filter((stylePath) => targetPolicy.isTargetPath(stylePath))
      .sort(),
  );
  const strictStyleGlobs = Object.freeze([
    ...architectureLayerStyleGlobs,
    ...strictMigratedStylePaths,
    ...preExistingStrictStylePaths,
  ]);
  const preExistingStrictSet = new Set(preExistingStrictStylePaths);
  const isStrictStylePath = (filePath) => {
    const projectPath = path
      .relative(projectRoot, path.resolve(projectRoot, filePath))
      .replaceAll("\\", "/");

    return (
      projectPath.endsWith(".css") &&
      (targetPolicy.isTargetPath(projectPath) ||
        preExistingStrictSet.has(projectPath))
    );
  };

  return Object.freeze({
    allowedBreakpointValues,
    architectureLayerStyleGlobs,
    canonicalTokenStylePaths,
    derivedTokenStylePaths,
    highRiskPreRedesignStylePaths,
    isStrictStylePath,
    isVendorImportantOverridePath,
    legacyDesignProtectedStylePaths,
    preExistingStrictStylePaths,
    primitiveTokenStylePaths,
    protectedDesignLiteralStylePaths,
    strictMigratedStylePaths,
    strictStyleGlobs,
    tokenLayerPolicies,
    vendorImportantOverrideGlobs,
  });
};

const defaultProjectRoot = path.resolve(__dirname, "../..");
const defaultPolicy = createStylePolicy({ projectRoot: defaultProjectRoot });

module.exports = Object.freeze({
  ...defaultPolicy,
  allowedBreakpointValues,
  architectureLayerStyleGlobs,
  canonicalTokenStylePaths,
  derivedTokenStylePaths,
  highRiskPreRedesignStylePaths,
  legacyDesignProtectedStylePaths,
  preExistingStrictStylePaths,
  primitiveTokenStylePaths,
  protectedDesignLiteralStylePaths,
  tokenLayerPolicies,
  createStylePolicy,
  isVendorImportantOverridePath,
  vendorImportantOverrideGlobs,
});
