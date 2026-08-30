import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  routeDefinitions,
  type AppRouteDefinition,
} from "./definitions";
import { AppRouteTree, Router } from "./Router";

const routeModule = (testId: string) => ({
  __esModule: true,
  default: () => <div data-testid={testId}>{testId}</div>,
});

jest.mock("./routes/HomeRoute", () => routeModule("page-home"));
jest.mock("./routes/SearchRoute", () => routeModule("page-search"));
jest.mock("./routes/AccommodationDetailRoute", () =>
  routeModule("page-accommodation-detail"),
);
jest.mock("./routes/ReservationConfirmRoute", () =>
  routeModule("page-accommodation-confirm"),
);
jest.mock("./routes/AccommodationEditRoute", () =>
  routeModule("page-accommodation-edit"),
);
jest.mock("./routes/WishlistRoute", () => routeModule("page-wishlist"));
jest.mock("./routes/ProfileRoute", () => routeModule("page-profile"));
jest.mock("./routes/HostReservationDetailRoute", () =>
  routeModule("page-host-reservation-detail"),
);
jest.mock("./routes/ReservationDetailRoute", () =>
  routeModule("page-reservation-detail"),
);
jest.mock("./routes/ReviewCreateRoute", () =>
  routeModule("page-reservation-review"),
);
jest.mock("./routes/PaymentSuccessRoute", () =>
  routeModule("page-payment-success"),
);
jest.mock("./routes/PaymentFailRoute", () =>
  routeModule("page-payment-fail"),
);
jest.mock("./routes/LoginRoute", () => routeModule("page-login"));
jest.mock("./routes/SignupRoute", () => routeModule("page-signup"));
jest.mock("./routes/NotFoundRoute", () => routeModule("page-not-found"));

const pageTestIds: Record<AppRouteDefinition["id"], string> = {
  home: "page-home",
  search: "page-search",
  "accommodation-detail": "page-accommodation-detail",
  "accommodation-confirm": "page-accommodation-confirm",
  "accommodation-edit": "page-accommodation-edit",
  wishlist: "page-wishlist",
  profile: "page-profile",
  "host-reservation-detail": "page-host-reservation-detail",
  "reservation-detail": "page-reservation-detail",
  "reservation-review": "page-reservation-review",
  "payment-success": "page-payment-success",
  "payment-fail": "page-payment-fail",
  login: "page-login",
  signup: "page-signup",
  "not-found": "page-not-found",
};

const directPath = (path: string) =>
  path
    .replace(":id", "42")
    .replace(":reservationUid", "reservation-42")
    .replace("*", "/missing-route");

describe("app Router", () => {
  it.each(routeDefinitions)(
    "renders the $id adapter with its shell, auth, and header policy",
    async (definition) => {
      render(
        <MemoryRouter initialEntries={[directPath(definition.path)]}>
          <AppRouteTree
            renderAuthenticated={(content) => (
              <div data-testid="auth-boundary">{content}</div>
            )}
            renderHeader={(mode) => (
              <header data-testid="app-header">{mode}</header>
            )}
          />
        </MemoryRouter>,
      );

      const main = screen.getByRole("main");
      const page = await within(main).findByTestId(pageTestIds[definition.id]);

      expect(page).toBeInTheDocument();
      expect(screen.getAllByRole("main")).toHaveLength(1);

      const authBoundary = screen.queryByTestId("auth-boundary");
      expect(authBoundary?.contains(page) ?? false).toBe(
        definition.auth === "authenticated",
      );

      const header = screen.queryByTestId("app-header");
      expect(header?.textContent ?? null).toBe(
        definition.header === "hidden" ? null : definition.header,
      );
    },
  );

  it("keeps the BrowserRouter compatibility wrapper available outside production composition", async () => {
    window.history.replaceState(null, "", "/");

    render(
      <Router
        renderAuthenticated={(content) => content}
        renderHeader={(mode) => <header>{mode}</header>}
      />,
    );

    expect(await screen.findByTestId("page-home")).toBeInTheDocument();
  });

});
