const fs = require("node:fs");
const path = require("node:path");
const { createTargetPolicy } = require("./target-policy.cjs");

const canonicalTokenStylePaths = Object.freeze([
  "src/styles/tokens.css",
  "src/shared/styles/tokens.css",
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
  "src/layouts/MainLayout.module.css",
  "src/layouts/AppHeader/Header.module.css",
  "src/layouts/AppHeader/UserMenu.module.css",
  "src/features/wishlist/components/WishlistViews.module.css",
  "src/features/auth/components/AuthModal/AuthModal.module.css",
  "src/features/reservations/components/ReservationModal/ReservationModal.module.css",
]);

const legacyDesignProtectedStylePaths = Object.freeze([
  "src/shared/ui/Button/Button.module.css",
  "src/shared/ui/Card/Card.module.css",
  "src/shared/ui/ClickableCard/ClickableCard.module.css",
  "src/shared/ui/CounterStepper/CounterStepper.module.css",
  "src/shared/ui/Dialog/Dialog.module.css",
  "src/shared/ui/IconButton/IconButton.module.css",
  "src/shared/ui/ListingCard/ListingCard.module.css",
  "src/shared/ui/OverlaySurface/OverlaySurface.module.css",
  "src/shared/ui/PageShell/PageShell.module.css",
  "src/shared/ui/StateView/StateView.module.css",
  "src/shared/ui/StatusBadge/StatusBadge.module.css",
  "src/shared/ui/Tabs/Tabs.module.css",
  "src/shared/ui/TextField/TextField.module.css",
  "src/shared/ui/ToastHost/ToastHost.module.css",
  "src/layouts/MainLayout.module.css",
  "src/components/DatePicker/DatePicker.module.css",
  "src/components/ErrorBoundary/ErrorBoundary.module.css",
  "src/features/wishlist/components/CreateWishlistModal/CreateWishlistModal.module.css",
  "src/features/wishlist/components/WishlistModal/WishlistModal.module.css",
  "src/features/reviews/components/ReviewModal/ReviewModal.module.css",
  "src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.module.css",
  "src/features/reservations/PaymentSuccessRoute.module.css",
  "src/features/reservations/PaymentFailRoute.module.css",
  "src/features/search/components/SearchAccommodationCard.module.css",
  "src/features/search/SearchRoute.module.css",
  "src/features/profile/components/ProfileShell.module.css",
  "src/features/profile/HostListingsPanel.module.css",
  "src/features/accommodations/AccommodationDetailRoute.module.css",
  "src/features/accommodations/components/AccommodationBookingCard.module.css",
  "src/features/accommodations/components/AccommodationHero.module.css",
  "src/features/accommodations/components/AccommodationLocationSection.module.css",
  "src/features/accommodations/components/AccommodationOverview.module.css",
  "src/features/accommodations/components/AccommodationReviewsSection.module.css",
  "src/features/accommodations/components/AccommodationDescriptionModal.module.css",
  "src/features/accommodations/components/AccommodationImageGalleryModal.module.css",
  "src/features/search/components/SearchBar/SearchBar.module.css",
  "src/layouts/AppHeader/Header.module.css",
  "src/layouts/AppHeader/UserMenu.module.css",
  "src/features/wishlist/components/WishlistViews.module.css",
  "src/features/auth/components/AuthModal/AuthModal.module.css",
  "src/features/reservations/components/ReservationModal/ReservationModal.module.css",
]);

const highRiskPreRedesignStylePaths = Object.freeze([
  "src/features/reservations/GuestTripsPanel.module.css",
  "src/features/reservations/HostReservationsPanel.module.css",
  "src/features/reservations/HostReservationDetailRoute.module.css",
  "src/features/reservations/ReservationDetailRoute.module.css",
  "src/features/reservations/ReservationConfirmRoute.module.css",
  "src/features/reviews/ReviewCreateRoute.module.css",
  "src/features/profile/components/ProfileShell.module.css",
  "src/features/profile/HostListingsPanel.module.css",
  "src/features/accommodations/edit/components/EditForm.module.css",
  "src/features/accommodations/edit/components/EditModal.module.css",
  "src/features/accommodations/edit/components/EditWizardLayout.module.css",
  "src/features/accommodations/edit/components/PhotosStep.module.css",
  "src/features/accommodations/edit/components/TimeStep.module.css",
  "src/features/accommodations/components/AccommodationBookingCard.module.css",
  "src/features/accommodations/components/AccommodationHero.module.css",
  "src/features/accommodations/components/AccommodationLocationSection.module.css",
  "src/features/accommodations/components/AccommodationOverview.module.css",
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
    highRiskPreRedesignStylePaths,
    isStrictStylePath,
    isVendorImportantOverridePath,
    legacyDesignProtectedStylePaths,
    preExistingStrictStylePaths,
    protectedDesignLiteralStylePaths,
    strictMigratedStylePaths,
    strictStyleGlobs,
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
  highRiskPreRedesignStylePaths,
  legacyDesignProtectedStylePaths,
  preExistingStrictStylePaths,
  protectedDesignLiteralStylePaths,
  createStylePolicy,
  isVendorImportantOverridePath,
  vendorImportantOverrideGlobs,
});
