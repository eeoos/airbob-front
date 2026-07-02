import { BrowserRouter, Route, Routes } from "react-router-dom";
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
  return (
    <BrowserRouter>
      <Routes>
        {appRoutes.map((route) => (
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
