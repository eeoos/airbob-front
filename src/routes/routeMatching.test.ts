import { ROUTE_PATHS } from "./paths";
import { getRouteShellForPathname } from "./routeMatching";

jest.mock(
  "react-router",
  () => {
    const { TextDecoder, TextEncoder } = jest.requireActual("util");
    Object.assign(globalThis, { TextDecoder, TextEncoder });

    return jest.requireActual("../../node_modules/react-router/dist/development/index.js");
  },
  { virtual: true },
);

jest.mock(
  "react-router/dom",
  () =>
    jest.requireActual(
      "../../node_modules/react-router/dist/development/dom-export.js",
    ),
  { virtual: true },
);

jest.mock(
  "react-router-dom",
  () => jest.requireActual("../../node_modules/react-router-dom/dist/index.js"),
  { virtual: true },
);

describe("route shell matching", () => {
  it("returns search header metadata for the search route", () => {
    expect(getRouteShellForPathname(ROUTE_PATHS.search)).toMatchObject({
      id: "search",
      layout: "main",
      headerMode: "search",
      requiresAuth: false,
    });
  });

  it("matches dynamic accommodation detail paths", () => {
    expect(getRouteShellForPathname("/accommodations/42")).toMatchObject({
      id: "accommodation-detail",
      layout: "main",
      headerMode: "default",
      requiresAuth: false,
    });
  });

  it("falls back to not-found shell metadata for unknown paths", () => {
    expect(getRouteShellForPathname("/missing-route")).toMatchObject({
      id: "not-found",
      layout: "bare",
      headerMode: "hidden",
      requiresAuth: false,
    });
  });
});
