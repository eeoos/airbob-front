import { readFileSync } from "node:fs";
import { join } from "node:path";
import { routeDefinitions } from "./definitions";

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const pageContainerOwners = [
  ["home", "src/screens/home/HomeScreen.tsx", "edge"],
  [
    "accommodation-detail",
    "src/screens/accommodation-detail/AccommodationDetailScreen.tsx",
    "full",
  ],
  [
    "accommodation-confirm",
    "src/screens/reservation-confirm/ReservationConfirmScreen.tsx",
    "content",
  ],
  ["wishlist", "src/screens/wishlist/WishlistScreen.tsx", "wide"],
  ["profile", "src/screens/profile/ProfileScreen.tsx", "full"],
  [
    "host-reservation-detail",
    "src/screens/reservation-detail/HostReservationDetailScreen.tsx",
    "content",
  ],
  [
    "reservation-review",
    "src/screens/review-create/ReviewCreateScreen.tsx",
    "narrow",
  ],
  [
    "payment-success",
    "src/screens/payment-result/PaymentResultScreen.tsx",
    "narrow",
  ],
  [
    "payment-fail",
    "src/screens/payment-result/PaymentResultScreen.tsx",
    "narrow",
  ],
  ["login", "src/screens/auth/AuthScreen.tsx", "narrow"],
  ["signup", "src/screens/auth/AuthScreen.tsx", "narrow"],
  ["not-found", "src/screens/not-found/NotFoundScreen.tsx", "narrow"],
] as const;

const viewportExceptionOwners = [
  ["search", "src/screens/search/SearchScreen.tsx"],
  [
    "accommodation-edit",
    "src/screens/accommodation-edit/AccommodationEditScreen.tsx",
  ],
  [
    "reservation-detail",
    "src/screens/reservation-detail/GuestReservationDetailScreen.tsx",
  ],
] as const;

describe("page layout source policy", () => {
  it("records exactly one width and gutter owner for every route", () => {
    const registeredRouteIds = [
      ...pageContainerOwners.map(([routeId]) => routeId),
      ...viewportExceptionOwners.map(([routeId]) => routeId),
    ];

    expect(new Set(registeredRouteIds).size).toBe(registeredRouteIds.length);
    expect([...registeredRouteIds].sort()).toEqual(
      routeDefinitions.map(({ id }) => id).sort(),
    );
  });

  it.each(pageContainerOwners)(
    "%s renders its registered PageContainer recipe",
    (_routeId, sourcePath, variant) => {
      const source = readSource(sourcePath);

      expect(source).toContain("PageContainer");
      expect(source).toContain(`variant="${variant}"`);
    },
  );

  it("keeps the viewport exceptions explicit instead of constraining them at the shell", () => {
    viewportExceptionOwners.forEach(([, sourcePath]) => {
      expect(readSource(sourcePath)).not.toContain("PageContainer");
    });
    expect(
      readSource(
        "src/screens/reservation-detail/GuestReservationDetailScreen.tsx",
      ),
    ).toContain("<div className={guestStyles.container}>");

    const shellCss = readSource("src/app/shells/ShellFrame.module.css");
    expect(shellCss).not.toMatch(/max-width|padding-inline/);
  });

  it("removes page width and horizontal gutter declarations from migrated screen roots", () => {
    [
      "src/screens/accommodation-detail/AccommodationDetailScreen.module.css",
      "src/screens/auth/AuthScreen.module.css",
      "src/screens/home/HomeScreen.module.css",
      "src/screens/payment-result/PaymentResultScreen.module.css",
      "src/screens/reservation-confirm/ReservationConfirmScreen.module.css",
      "src/screens/reservation-detail/HostReservationDetailScreen.module.css",
      "src/screens/review-create/ReviewCreateScreen.module.css",
    ].forEach((sourcePath) => {
      const containerBlocks = Array.from(
        readSource(sourcePath).matchAll(/\.container\s*\{([^}]*)\}/gs),
        (match) => match[1],
      ).join("\n");

      expect(containerBlocks).not.toMatch(
        /max-width|margin:\s*0\s+auto|padding-inline|padding\s*:/,
      );
    });
  });
});
