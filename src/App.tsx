import type { ReactElement } from "react";
import { AppRouteTree, type VisibleHeaderPolicy } from "./app/router/Router";
import { RequireAuthenticatedRoute } from "./app/router/RequireAuthenticatedRoute";
import { Header } from "./app/header";

const renderHeader = (mode: VisibleHeaderPolicy) => (
  <Header headerMode={mode} />
);

const renderAuthenticated = (content: ReactElement) => (
  <RequireAuthenticatedRoute>{content}</RequireAuthenticatedRoute>
);

function App() {
  return (
    <AppRouteTree
      renderAuthenticated={renderAuthenticated}
      renderHeader={renderHeader}
    />
  );
}

export default App;
