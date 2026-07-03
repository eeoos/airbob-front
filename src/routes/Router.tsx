import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts";
import RequireAuth from "./RequireAuth";
import { AppRouteConfig, appRoutes } from "./routeConfig";

const renderRouteElement = ({ component: Page, requiresAuth }: AppRouteConfig) => {
  const pageElement = <Page />;

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
