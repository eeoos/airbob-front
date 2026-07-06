import { matchPath } from "react-router-dom";
import { routeDefinitions } from "./routeDefinitions";

const notFoundRoute = routeDefinitions.find((route) => route.id === "not-found");

if (!notFoundRoute) {
  throw new Error("routeDefinitions must include not-found route metadata");
}

export const getRouteShellForPathname = (pathname: string) => {
  return (
    routeDefinitions.find((route) =>
      matchPath({ path: route.path, end: true }, pathname),
    ) ?? notFoundRoute
  );
};
