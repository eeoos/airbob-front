import { Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts";
import { LoadingState } from "../shared/ui";
import RequireAuth from "./RequireAuth";
import { AppRouteConfig, appRoutes } from "./routeConfig";

const routeFallback = <LoadingState title="페이지를 불러오는 중..." />;

const renderRouteElement = ({ component: Page, requiresAuth }: AppRouteConfig) => {
  const pageElement = (
    <Suspense fallback={routeFallback}>
      <Page />
    </Suspense>
  );

  if (!requiresAuth) {
    return pageElement;
  }

  return <RequireAuth>{pageElement}</RequireAuth>;
};

const Router = () => {
  const mainRoutes = appRoutes.filter((route) => route.layout === "main");
  const bareRoutes = appRoutes.filter((route) => route.layout === "bare");

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {mainRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={renderRouteElement(route)}
            />
          ))}
        </Route>
        {bareRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={renderRouteElement(route)}
          />
        ))}
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
