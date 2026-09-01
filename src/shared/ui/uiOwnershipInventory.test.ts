import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "src");

const walkSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(path);
    if (!/[.]tsx?$/.test(entry.name) || entry.name.includes(".test."))
      return [];
    return [path];
  });

const productionSourceFiles = walkSourceFiles(sourceRoot);
const toRelativePath = (path: string) =>
  relative(projectRoot, path).replaceAll("\\", "/");
const discoverOwners = (predicate: (source: string, path: string) => boolean) =>
  productionSourceFiles
    .filter((path) => predicate(readFileSync(path, "utf8"), path))
    .map(toRelativePath)
    .sort();

const imageRecipeOwners = {
  "src/features/search/components/SearchAccommodationCard.tsx":
    "search result thumbnail",
  "src/features/wishlist/components/WishlistDetailView.tsx":
    "wishlist accommodation thumbnail",
  "src/features/wishlist/components/WishlistModal/WishlistModal.tsx":
    "wishlist summary thumbnail",
  "src/shared/ui/ImageWithFallback/ImageWithFallback.tsx":
    "domain-free declarative recipe",
} as const;

const vendorImageOwners = {
  "src/features/search/components/SearchMap/lib/infoWindowContent.ts":
    "escaped Google Maps HTML with isolated named-element fallback binding",
} as const;

const intentionallyLocalImageOwners = {
  "src/app/header/Header.tsx": "build-owned static brand asset",
  "src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx":
    "read-only action context thumbnail",
  "src/features/accommodations/detail/components/AccommodationHero.tsx":
    "multi-image gallery presentation",
  "src/features/accommodations/detail/components/AccommodationImageGalleryModal.tsx":
    "full gallery presentation",
  "src/features/accommodations/detail/components/AccommodationOverview.tsx":
    "host avatar with source-presence placeholder",
  "src/features/accommodations/detail/components/AccommodationReviewsSection.tsx":
    "review author media",
  "src/features/profile/HostListingsPanel.tsx": "host listing read model media",
  "src/features/reservations/GuestTripsPanel.tsx":
    "guest trip read model media",
  "src/features/reviews/components/ReviewModal/ReviewModal.tsx":
    "review feed media",
  "src/features/wishlist/components/RecentlyViewedView.tsx":
    "recent history source-presence placeholder",
  "src/features/wishlist/components/WishlistIndexView.tsx":
    "wishlist cover source-presence placeholder",
  "src/screens/accommodation-edit/components/PhotosStep.tsx":
    "locally controlled upload preview",
  "src/screens/reservation-confirm/ReservationConfirmScreen.tsx":
    "checkout context media",
  "src/screens/reservation-detail/GuestReservationDetailScreen.tsx":
    "guest reservation and review context media",
  "src/screens/reservation-detail/HostReservationDetailScreen.tsx":
    "host reservation context media",
  "src/screens/review-create/ReviewCreateScreen.tsx":
    "locally controlled review upload preview",
} as const;

const sharedStateRecipeOwners = {
  "src/app/router/RequireAuthenticatedRoute.tsx": "session gate recipes",
  "src/app/router/Router.tsx": "route suspense loading recipe",
  "src/features/profile/HostListingsPanel.tsx": "host list recipes",
  "src/features/reservations/GuestTripsPanel.tsx": "guest trip recipes",
  "src/features/reservations/HostReservationsPanel.tsx":
    "host reservation recipes",
  "src/features/search/components/SearchMap/Map.tsx":
    "integration loading and retryable-error recipes",
  "src/features/search/components/SearchResultsList.tsx":
    "search loading and empty recipes",
  "src/features/wishlist/components/RecentlyViewedView.tsx":
    "recent history empty recipe",
  "src/features/wishlist/components/WishlistDetailView.tsx":
    "wishlist detail loading and empty recipes",
  "src/features/wishlist/components/WishlistIndexView.tsx":
    "wishlist index loading recipe",
  "src/features/wishlist/components/WishlistModal/WishlistModal.tsx":
    "modal loading recipe",
  "src/screens/accommodation-detail/AccommodationDetailScreen.tsx":
    "detail loading and terminal-error recipes",
  "src/screens/accommodation-edit/AccommodationEditScreen.tsx":
    "editor loading, retryable-error and terminal-error recipes",
  "src/shared/ui/StateView/StateView.tsx": "domain-free state recipe renderer",
} as const;

const intentionallyLocalStateOwners = {
  "src/app/session/LogoutRevocationNotice.tsx":
    "assertive session revocation notice",
  "src/features/accommodations/detail/components/AccommodationBookingCardSections.tsx":
    "inline coupon sub-state inside an otherwise ready card",
  "src/features/reviews/components/ReviewModal/ReviewModal.tsx":
    "incremental modal feed status",
  "src/features/search/components/SearchPagination.tsx":
    "pagination-local progress status",
  "src/screens/payment-result/PaymentResultScreen.tsx":
    "workflow-specific operation progress and outcome",
  "src/screens/reservation-confirm/ReservationConfirmScreen.tsx":
    "checkout workflow state surface",
  "src/screens/review-create/ReviewCreateScreen.tsx":
    "review workflow state surface",
  "src/shared/ui/DatePicker/DatePicker.tsx": "calendar interaction status",
  "src/shared/ui/TextField/TextField.tsx": "field-local validation message",
  "src/shared/ui/ToastHost/ToastHost.tsx": "assertive transient message host",
} as const;

const keys = (inventory: Record<string, string>) => Object.keys(inventory);

describe("production UI owner inventory", () => {
  it("accounts for every production image owner", () => {
    const discovered = discoverOwners((source) =>
      /<img\b|<ImageWithFallback\b/.test(source),
    );
    const inventoried = [
      ...keys(imageRecipeOwners),
      ...keys(vendorImageOwners),
      ...keys(intentionallyLocalImageOwners),
    ].sort();

    expect(discovered).toEqual(inventoried);
    expect(new Set(inventoried).size).toBe(inventoried.length);
    keys(imageRecipeOwners)
      .filter((path) => !path.includes("/ImageWithFallback.tsx"))
      .forEach((path) => {
        expect(readFileSync(join(projectRoot, path), "utf8")).toContain(
          "<ImageWithFallback",
        );
      });
  });

  it("forbids React image consumers from mutating sibling styles", () => {
    const violations = productionSourceFiles
      .filter((path) => path.endsWith(".tsx"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return (
          /(?:next|previous)ElementSibling/.test(source) ||
          /[.]style[.](?:display|opacity|visibility)/.test(source)
        );
      })
      .map(toRelativePath);

    expect(violations).toEqual([]);
  });

  it("keeps vendor image fallback free of inline scripts", () => {
    const source = readFileSync(
      join(
        sourceRoot,
        "features/search/components/SearchMap/lib/infoWindowContent.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/\sonerror=/i);
    expect(source).toContain("data-info-window-image");
    expect(source).toContain("data-info-window-image-fallback");
  });

  it("accounts for state recipe adopters and intentional local semantics", () => {
    const stateOwnerPattern =
      /<LoadingState\b|<EmptyState\b|<ErrorState\b|<RetryableErrorState\b|<TerminalErrorState\b|stateViewRecipes[.]|role="(?:status|alert)"|className=\{[^}]*styles[.](?:loading|empty|error)\}/;
    const discovered = discoverOwners(
      (source, path) => path.endsWith(".tsx") && stateOwnerPattern.test(source),
    );
    const inventoried = [
      ...keys(sharedStateRecipeOwners),
      ...keys(intentionallyLocalStateOwners),
    ].sort();

    expect(discovered).toEqual(inventoried);
    expect(new Set(inventoried).size).toBe(inventoried.length);

    const recipeUsagePattern =
      /<LoadingState\b|<EmptyState\b|<RetryableErrorState\b|<TerminalErrorState\b|stateViewRecipes[.]/;
    keys(sharedStateRecipeOwners)
      .filter((path) => !path.endsWith("/StateView.tsx"))
      .forEach((path) => {
        expect(readFileSync(join(projectRoot, path), "utf8")).toMatch(
          recipeUsagePattern,
        );
      });
    keys(intentionallyLocalStateOwners).forEach((path) => {
      expect(readFileSync(join(projectRoot, path), "utf8")).not.toMatch(
        recipeUsagePattern,
      );
    });
  });
});
