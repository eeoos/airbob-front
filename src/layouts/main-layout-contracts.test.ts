import { readFileSync } from "fs";
import { join } from "path";

const mainLayoutRoutePages = [
  "src/pages/Home/Home.tsx",
  "src/pages/Search/Search.tsx",
  "src/pages/AccommodationDetail/AccommodationDetail.tsx",
  "src/pages/AccommodationEdit/AccommodationEdit.tsx",
  "src/pages/Wishlist/Wishlist.tsx",
  "src/pages/Profile/Profile.tsx",
  "src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx",
  "src/pages/Reservations/ReservationConfirm.tsx",
  "src/pages/Reservations/ReservationDetail.tsx",
  "src/pages/Reservations/ReviewCreate.tsx",
  "src/pages/Reservations/PaymentSuccess.tsx",
  "src/pages/Reservations/PaymentFail.tsx",
];

const sourceText = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("MainLayout ownership", () => {
  it("keeps MainLayout owned by the router instead of individual pages", () => {
    const violations = mainLayoutRoutePages.flatMap((relativePath) => {
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
    const source = sourceText("src/pages/Search/Search.tsx");

    expect(source).not.toContain("<main");
    expect(source).not.toContain("</main>");
  });
});
