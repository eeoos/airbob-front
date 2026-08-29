import { routeDefinitions } from "../app/router/definitions";
import { ROUTE_PATHS } from "../app/router/paths";
import { ROUTE_PATHS as legacyRoutePaths } from "./paths";
import { routeDefinitions as legacyRouteDefinitions } from "./routeDefinitions";

describe("legacy route manifest rollback parity", () => {
  it("keeps paths, authentication, and header behavior aligned with the active app manifest", () => {
    expect(legacyRoutePaths).toEqual(ROUTE_PATHS);
    expect(
      legacyRouteDefinitions.map(
        ({ id, path, requiresAuth, headerMode }) => ({
          id,
          path,
          auth: requiresAuth ? "authenticated" : "public",
          header: headerMode,
        }),
      ),
    ).toEqual(
      routeDefinitions.map(({ id, path, auth, header }) => ({
        id,
        path,
        auth,
        header,
      })),
    );
  });
});
