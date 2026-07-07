import { readFileSync } from "fs";
import { join } from "path";

const mainLayoutRouteContainers = [
  "src/features/home/HomeRoute.tsx",
  "src/features/search/SearchRoute.tsx",
  "src/features/accommodations/AccommodationDetailRoute.tsx",
  "src/features/accommodations/edit/AccommodationEditRoute.tsx",
  "src/features/wishlist/WishlistRoute.tsx",
  "src/features/profile/ProfileRoute.tsx",
  "src/features/reservations/HostReservationDetailRoute.tsx",
  "src/features/reservations/ReservationConfirmRoute.tsx",
  "src/features/reservations/ReservationDetailRoute.tsx",
  "src/features/reviews/ReviewCreateRoute.tsx",
  "src/features/reservations/PaymentSuccessRoute.tsx",
  "src/features/reservations/PaymentFailRoute.tsx",
];

const sourceText = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("MainLayout ownership", () => {
  it("keeps MainLayout owned by the router instead of individual pages", () => {
    const violations = mainLayoutRouteContainers.flatMap((relativePath) => {
      const source = sourceText(relativePath);
      const importsMainLayout =
        source.includes("from \"../../layouts\"") ||
        source.includes("from \"../../../layouts\"") ||
        source.includes("from '../../layouts'") ||
        source.includes("from '../../../layouts'");
      const rendersMainLayout = source.includes("<MainLayout");

      return importsMainLayout || rendersMainLayout ? [relativePath] : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps Search from nesting a main element inside MainLayout", () => {
    const source = sourceText("src/features/search/SearchRoute.tsx");

    expect(source).not.toContain("<main");
    expect(source).not.toContain("</main>");
  });
});
