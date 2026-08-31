import { Suspense, type ReactElement, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { appShellComponents } from "../shells";
import { LoadingState } from "../../shared/ui";
import type { RouteHeaderPolicy } from "./definitions";
import { routeManifest, type AppRouteManifestEntry } from "./manifest";

export type VisibleHeaderPolicy = Exclude<RouteHeaderPolicy, "hidden">;

export interface AppRouterComposition {
  renderAuthenticated: (content: ReactElement) => ReactElement;
  renderHeader: (mode: VisibleHeaderPolicy) => ReactNode;
}

const routeFallback = <LoadingState title="페이지를 불러오는 중..." />;

const renderRouteElement = (
  route: AppRouteManifestEntry,
  composition: AppRouterComposition,
) => {
  const Page = route.component;
  const Shell = appShellComponents[route.shell];
  const pageElement = (
    <Suspense fallback={routeFallback}>
      <Page />
    </Suspense>
  );
  const content =
    route.auth === "authenticated"
      ? composition.renderAuthenticated(pageElement)
      : pageElement;
  const header =
    route.header === "hidden"
      ? undefined
      : composition.renderHeader(route.header);

  return <Shell header={header}>{content}</Shell>;
};

export function AppRouteTree(composition: AppRouterComposition) {
  return (
    <Routes>
      {routeManifest.map((route) => (
        <Route
          key={route.id}
          path={route.path}
          element={renderRouteElement(route, composition)}
        />
      ))}
    </Routes>
  );
}
